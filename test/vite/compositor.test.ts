import { describe, expect, it, vi } from "vitest";
import { ShaderLabRuntime } from "../../src/vite/runtime.js";
import type { ShaderInstanceConfig } from "../../src/vite/runtime.js";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
}

function createMockGl(): WebGL2RenderingContext & {
  framebufferBindings: (WebGLFramebuffer | null)[];
} {
  const framebufferBindings: (WebGLFramebuffer | null)[] = [];
  let currentFb: WebGLFramebuffer | null = null;
  const fboA = {} as WebGLFramebuffer;
  const fboB = {} as WebGLFramebuffer;

  const gl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    FRAMEBUFFER: 36160,
    FRAMEBUFFER_BINDING: 36006,
    COLOR_BUFFER_BIT: 16384,
    COLOR_ATTACHMENT0: 36064,
    FRAMEBUFFER_COMPLETE: 36053,
    TRIANGLES: 4,
    CULL_FACE: 2884,
    BLEND: 3042,
    ONE: 1,
    DST_COLOR: 774,
    ZERO: 0,
    ONE_MINUS_SRC_ALPHA: 771,
    TEXTURE0: 33984,
    TEXTURE_2D: 3553,
    TEXTURE_MIN_FILTER: 9728,
    TEXTURE_MAG_FILTER: 9729,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    framebufferBindings,
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
    bindFramebuffer: vi.fn((_target: number, fb: WebGLFramebuffer | null) => {
      currentFb = fb;
      framebufferBindings.push(fb);
    }),
    getParameter: vi.fn((p: number) => {
      if (p === 36006) return currentFb;
      return null;
    }),
    createFramebuffer: vi.fn(() => fboA),
    deleteFramebuffer: vi.fn(),
    createTexture: vi.fn(() => ({})),
    deleteTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => 36053),
    activeTexture: vi.fn(),
  };
  return gl as unknown as WebGL2RenderingContext & {
    framebufferBindings: (WebGLFramebuffer | null)[];
  };
}

function minimalConfig(
  shaderType: "canvas_item" | "spatial" | "postprocess",
  extra: Partial<ShaderInstanceConfig["metadata"]> = {},
): ShaderInstanceConfig {
  return {
    shaderId: shaderType,
    vertexSource: "#version 300 es\nvoid main() { gl_Position = vec4(0.0); }",
    fragmentSource: "#version 300 es\nout vec4 fragColor; void main() { fragColor = vec4(1.0); }",
    metadata: {
      shaderType,
      referencedBuiltins: [],
      uniforms: [],
      blendMode: null,
      cullDisabled: false,
      ...extra,
    },
  };
}

function createCanvas(gl: WebGL2RenderingContext): HTMLCanvasElement {
  return {
    width: 64,
    height: 64,
    clientWidth: 64,
    clientHeight: 64,
    getContext: vi.fn(() => gl),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 64, height: 64 })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

describe("3-stage compositor runtime", () => {
  it("spatial drawScenePass renders canvas into scratch FBO then spatial into bound target", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const gl = createMockGl();
    const canvas = createCanvas(gl);

    const bg = new ShaderLabRuntime(minimalConfig("canvas_item"));
    const space = new ShaderLabRuntime(
      minimalConfig("spatial", {
        requiresCanvasFeed: true,
        canvasTextureUnit: 0,
        referencedBuiltins: ["CANVAS_TEXTURE"],
      }),
    );
    const canvasDraw = vi.spyOn(bg, "drawScenePass");

    bg.attach(canvas);
    space.attach(canvas, { feedFrom: bg });

    const postFbo = {} as WebGLFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, postFbo);
    space.drawScenePass(0, 64, 64);

    expect(canvasDraw).toHaveBeenCalled();
    expect(gl.framebufferBindings.length).toBeGreaterThanOrEqual(2);
    expect(gl.framebufferBindings[gl.framebufferBindings.length - 1]).toBe(postFbo);

    space.detach();
    bg.detach();
    vi.unstubAllGlobals();
  });

  it("postprocess accepts canvas-fed spatial as feedFrom", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const gl = createMockGl();
    const canvas = createCanvas(gl);

    const bg = new ShaderLabRuntime(minimalConfig("canvas_item"));
    const space = new ShaderLabRuntime(
      minimalConfig("spatial", {
        requiresCanvasFeed: true,
        canvasTextureUnit: 0,
        referencedBuiltins: ["CANVAS_TEXTURE"],
      }),
    );
    const pp = new ShaderLabRuntime(
      minimalConfig("postprocess", {
        screenTextureUnit: 0,
        referencedBuiltins: ["SCREEN_TEXTURE"],
      }),
    );
    const spatialFeed = vi.spyOn(space, "drawScenePass");

    bg.attach(canvas);
    space.attach(canvas, { feedFrom: bg });
    pp.attach(canvas, { feedFrom: space });

    (pp as unknown as { drawFrame(): void }).drawFrame();
    expect(spatialFeed).toHaveBeenCalled();

    pp.detach();
    space.detach();
    bg.detach();
    vi.unstubAllGlobals();
  });

  it("nested spatial drawScenePass calls prior canvas-fed spatial then canvas", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const gl = createMockGl();
    const canvas = createCanvas(gl);

    const bg = new ShaderLabRuntime(minimalConfig("canvas_item"));
    const spaceA = new ShaderLabRuntime(
      minimalConfig("spatial", {
        requiresCanvasFeed: true,
        canvasTextureUnit: 0,
        referencedBuiltins: ["CANVAS_TEXTURE"],
      }),
    );
    const spaceB = new ShaderLabRuntime(
      minimalConfig("spatial", {
        requiresCanvasFeed: true,
        canvasTextureUnit: 0,
        referencedBuiltins: ["CANVAS_TEXTURE"],
      }),
    );
    const canvasDraw = vi.spyOn(bg, "drawScenePass");
    const spaceADraw = vi.spyOn(spaceA, "drawScenePass");

    bg.attach(canvas);
    spaceA.attach(canvas, { feedFrom: bg });
    spaceB.attach(canvas, { feedFrom: spaceA });

    const postFbo = {} as WebGLFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, postFbo);
    spaceB.drawScenePass(0, 64, 64);

    expect(spaceADraw).toHaveBeenCalled();
    expect(canvasDraw).toHaveBeenCalled();
    expect(gl.framebufferBindings[gl.framebufferBindings.length - 1]).toBe(postFbo);

    spaceB.detach();
    spaceA.detach();
    bg.detach();
    vi.unstubAllGlobals();
  });
});
