/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { ShaderLabRuntime } from "../../src/vite/runtime.js";
import type { ShaderInstanceConfig } from "../../src/vite/runtime.js";
import type { UniformBindingMeta } from "../../src/compiler/types.js";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
}

/** Drive at least one `drawFrame` so `applyUserUniforms` runs (real RAF is not fired in tests). */
function stubRafForDrawLoop(maxFrames = 6): void {
  let n = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => {
    if (n++ < maxFrames) {
      queueMicrotask(() => cb(performance.now()));
    }
    return n;
  }));
}

function createMockGl(): WebGL2RenderingContext & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  const log = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
  };

  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    FRAMEBUFFER: 36160,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,
    DEPTH_TEST: 2929,
    LEQUAL: 515,
    TRIANGLES: 4,
    CULL_FACE: 2884,
    BLEND: 3042,
    ONE: 1,
    DST_COLOR: 774,
    ZERO: 0,
    ONE_MINUS_SRC_ALPHA: 771,
    TEXTURE0: 33984,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    UNSIGNED_SHORT: 5123,
    UNSIGNED_INT: 5125,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(() => log("useProgram")),
    getUniformLocation: vi.fn((_, name: string) => ({ name })),
    uniform1f: vi.fn((...a) => log("uniform1f", ...a)),
    uniform2f: vi.fn((...a) => log("uniform2f", ...a)),
    uniform3f: vi.fn((...a) => log("uniform3f", ...a)),
    uniform4f: vi.fn((...a) => log("uniform4f", ...a)),
    uniform1i: vi.fn((...a) => log("uniform1i", ...a)),
    uniformMatrix4fv: vi.fn((...a) => log("uniformMatrix4fv", ...a)),
    clearColor: vi.fn(),
    clear: vi.fn(),
    viewport: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    depthFunc: vi.fn(),
    depthMask: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    bindFramebuffer: vi.fn(),
    bindTexture: vi.fn((...a) => log("bindTexture", ...a)),
    activeTexture: vi.fn((...a) => log("activeTexture", ...a)),
    texImage2D: vi.fn((...a) => log("texImage2D", ...a)),
    texParameteri: vi.fn(),
    createTexture: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => 36053),
    createFramebuffer: vi.fn(() => ({})),
  };
  return Object.assign(gl, { calls }) as unknown as WebGL2RenderingContext & {
    calls: { method: string; args: unknown[] }[];
  };
}

function createCanvas(gl: WebGL2RenderingContext): HTMLCanvasElement & {
  listeners: Record<string, ((e: MouseEvent) => void) | undefined>;
} {
  const listeners: Record<string, ((e: MouseEvent) => void) | undefined> = {};
  return {
    width: 0,
    height: 0,
    clientWidth: 100,
    clientHeight: 50,
    getContext: vi.fn(() => gl),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 100, height: 50 })),
    addEventListener: vi.fn((name: string, fn: (e: MouseEvent) => void) => {
      listeners[name] = fn;
    }),
    removeEventListener: vi.fn((name: string) => {
      delete listeners[name];
    }),
    listeners,
  } as unknown as HTMLCanvasElement & {
    listeners: Record<string, ((e: MouseEvent) => void) | undefined>;
  };
}

function baseCfg(meta: ShaderInstanceConfig["metadata"]): ShaderInstanceConfig {
  return {
    shaderId: "t",
    vertexSource: "#version 300 es\nvoid main(){gl_Position=vec4(0.0);}",
    fragmentSource: "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nvoid main(){fragColor=vec4(1.0);}",
    metadata: meta,
  };
}

describe("§7 uniform hint runtime behavior", () => {
  it("binds sampler2D with texture hint and uploads image via texImage2D", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    stubRafForDrawLoop();
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: vi.fn(() => 0) });

    const uTex: UniformBindingMeta = {
      name: "albedoMap",
      glslName: "u_albedoMap",
      slabType: "sampler2D",
      hint: "texture",
      default: null,
      range: null,
      textureUnit: 1,
      mousePosition: false,
    };
    const gl = createMockGl();
    const canvas = createCanvas(gl);
    const rt = new ShaderLabRuntime(
      baseCfg({
        shaderType: "canvas_item",
        referencedBuiltins: [],
        uniforms: [uTex],
        blendMode: null,
        cullDisabled: false,
      }),
    );
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 2;
    rt.set('albedoMap', c);
    rt.mount(canvas);
    await vi.waitFor(() => expect(gl.calls.some((c) => c.method === "texImage2D")).toBe(true));
    expect(gl.calls.some((c) => c.method === "uniform1i")).toBe(true);
    rt.unmount();
    vi.unstubAllGlobals();
  });

  it("binds sampler2D with albedo hint like a user texture", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    stubRafForDrawLoop();
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: vi.fn(() => 0) });

    const u: UniformBindingMeta = {
      name: "albedo",
      glslName: "u_albedo",
      slabType: "sampler2D",
      hint: "albedo",
      default: null,
      range: null,
      textureUnit: 0,
      mousePosition: false,
    };
    const gl = createMockGl();
    const canvas = createCanvas(gl);
    const rt = new ShaderLabRuntime(
      baseCfg({
        shaderType: "canvas_item",
        referencedBuiltins: [],
        uniforms: [u],
        blendMode: null,
        cullDisabled: false,
      }),
    );
    const c2 = document.createElement("canvas");
    c2.width = 1;
    c2.height = 1;
    rt.set('albedo', c2);
    rt.mount(canvas);
    await vi.waitFor(() => expect(gl.calls.some((c) => c.method === "bindTexture")).toBe(true));
    rt.unmount();
    vi.unstubAllGlobals();
  });

  it("binds sampler2D with normal_map hint", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    stubRafForDrawLoop();
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: vi.fn(() => 0) });

    const u: UniformBindingMeta = {
      name: "nm",
      glslName: "u_nm",
      slabType: "sampler2D",
      hint: "normal_map",
      default: null,
      range: null,
      textureUnit: 2,
      mousePosition: false,
    };
    const gl = createMockGl();
    const canvas = createCanvas(gl);
    const rt = new ShaderLabRuntime(
      baseCfg({
        shaderType: "canvas_item",
        referencedBuiltins: [],
        uniforms: [u],
        blendMode: null,
        cullDisabled: false,
      }),
    );
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    rt.set('nm', c);
    rt.mount(canvas);
    await vi.waitFor(() =>
      expect(gl.calls.filter((x) => x.method === "activeTexture").length).toBeGreaterThan(0),
    );
    rt.unmount();
    vi.unstubAllGlobals();
  });

  it("linearizes vec3 color hint at bind time", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    stubRafForDrawLoop();
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: vi.fn(() => 0) });

    const u: UniformBindingMeta = {
      name: "tint",
      glslName: "u_tint",
      slabType: "vec3",
      hint: "color",
      default: null,
      range: null,
      textureUnit: null,
      mousePosition: false,
    };
    const gl = createMockGl();
    const canvas = createCanvas(gl);
    const rt = new ShaderLabRuntime(
      baseCfg({
        shaderType: "canvas_item",
        referencedBuiltins: [],
        uniforms: [u],
        blendMode: null,
        cullDisabled: false,
      }),
    );
    rt.mount(canvas);
    // sRGB 1.0 maps to linear 1.0 — use a mid-gray to observe lift from gamma curve.
    rt.set('tint', [0.5, 0.5, 0.5]);
    const store = rt.uniforms as Record<string, unknown>;
    const v = store.__tint as number[];
    expect(v[0]).toBeLessThan(0.5);
    expect(v[0]).toBeGreaterThan(0.2);
    rt.unmount();
    vi.unstubAllGlobals();
  });

  it("clamps float with range() hint and emits H0401", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    stubRafForDrawLoop();
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: vi.fn(() => 0) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const u: UniformBindingMeta = {
      name: "speed",
      glslName: "u_speed",
      slabType: "float",
      hint: "range(0.0, 1.0)",
      default: null,
      range: [0, 1] as const,
      textureUnit: null,
      mousePosition: false,
    };
    const gl = createMockGl();
    const canvas = createCanvas(gl);
    const rt = new ShaderLabRuntime(
      baseCfg({
        shaderType: "canvas_item",
        referencedBuiltins: [],
        uniforms: [u],
        blendMode: null,
        cullDisabled: false,
      }),
    );
    rt.mount(canvas);
    rt.set('speed', 99);
    expect((rt.uniforms as Record<string, unknown>).__speed).toBe(1);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0] ?? "")).toContain("H0401");
    warn.mockRestore();
    rt.unmount();
    vi.unstubAllGlobals();
  });
});
