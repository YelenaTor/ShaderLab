import { describe, expect, it, vi } from "vitest";
import { ShaderLabRuntime } from "../../src/vite/runtime.js";
import type { ShaderInstanceConfig } from "../../src/vite/runtime.js";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
}

function createMockGl(): WebGL2RenderingContext {
  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    FRAMEBUFFER: 36160,
    COLOR_BUFFER_BIT: 16384,
    TRIANGLES: 4,
    CULL_FACE: 2884,
    BLEND: 3042,
    ONE: 1,
    DST_COLOR: 774,
    ZERO: 0,
    ONE_MINUS_SRC_ALPHA: 771,
    TEXTURE0: 33984,
    TEXTURE_2D: 3553,
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
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform1i: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    viewport: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    drawArrays: vi.fn(),
  };
  return gl as unknown as WebGL2RenderingContext;
}

function createCanvas(gl: WebGL2RenderingContext): HTMLCanvasElement & {
  listeners: Record<string, ((e: MouseEvent) => void) | undefined>;
} {
  const listeners: Record<string, ((e: MouseEvent) => void) | undefined> = {};
  return {
    width: 0,
    height: 0,
    clientWidth: 200,
    clientHeight: 100,
    getContext: vi.fn(() => gl),
    getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20, width: 200, height: 100 })),
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

describe("ShaderLabRuntime mouse_position", () => {
  it("keeps uniform read-only and updates from normalized mouse position", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: vi.fn(() => 1000) });

    const cfg: ShaderInstanceConfig = {
      shaderId: "demo",
      vertexSource: "#version 300 es\nvoid main(){gl_Position=vec4(0.0);}",
      fragmentSource: "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nvoid main(){fragColor=vec4(1.0);}",
      metadata: {
        shaderType: "canvas_item",
        referencedBuiltins: [],
        uniforms: [
          {
            name: "mouse",
            glslName: "u_mouse",
            slabType: "vec2",
            hint: "mouse_position",
            default: null,
            range: null,
            textureUnit: null,
            mousePosition: true,
          },
        ],
        blendMode: null,
        cullDisabled: false,
      },
    };
    const gl = createMockGl();
    const canvas = createCanvas(gl);
    const rt = new ShaderLabRuntime(cfg);
    const u = rt.uniforms as Record<string, unknown>;

    rt.uniforms.mouse = [0.9, 0.9] as unknown;
    expect(u.__mouse).toEqual([0, 0]);

    rt.attach(canvas);
    canvas.listeners.mousemove?.({ clientX: 110, clientY: 45 } as MouseEvent);
    expect(u.__mouse).toEqual([0.5, 0.75]);

    rt.detach();
    expect(canvas.listeners.mousemove).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe("ShaderLabRuntime attach options", () => {
  it("caps backing store with maxDevicePixelRatio", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: vi.fn(() => 1000) });

    const cfg: ShaderInstanceConfig = {
      shaderId: "demo",
      vertexSource: "#version 300 es\nvoid main(){gl_Position=vec4(0.0);}",
      fragmentSource: "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nvoid main(){fragColor=vec4(1.0);}",
      metadata: {
        shaderType: "canvas_item",
        referencedBuiltins: [],
        uniforms: [],
        blendMode: null,
        cullDisabled: false,
      },
    };
    const gl = createMockGl();
    const canvas = createCanvas(gl);
    const rt = new ShaderLabRuntime(cfg);
    rt.attach(canvas, { maxDevicePixelRatio: 1 });
    expect(canvas.width).toBe(200);

    rt.detach();
    const canvas2 = createCanvas(gl);
    const rt2 = new ShaderLabRuntime(cfg);
    rt2.attach(canvas2);
    expect(canvas2.width).toBe(400);
    rt2.detach();
    vi.unstubAllGlobals();
  });
});
