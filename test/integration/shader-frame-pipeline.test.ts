import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import type { CompilerOutput } from "../../src/compiler/types.js";
import { composeSlabFrame } from "../../src/pipeline-compose.js";
import { shader_frame } from "../../src/shader-frame.js";
import type { SlabLibrary } from "../../src/shader-frame.js";
import {
  createShaderInstance,
  ShaderLabRuntime,
  type ShaderFrameInstance,
} from "../../src/vite/runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../fixtures");

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
}

function createMockGl(): WebGL2RenderingContext {
  let currentFb: WebGLFramebuffer | null = null;
  const fboA = {} as WebGLFramebuffer;
  return {
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
    DEPTH_TEST: 0x0b71,
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
    }),
    getParameter: vi.fn((p: number) => (p === 36006 ? currentFb : null)),
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
  } as unknown as WebGL2RenderingContext;
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

function buildSlabLibrary(output: CompilerOutput): SlabLibrary & {
  instances: Map<string, ShaderLabRuntime>;
} {
  const instances = new Map<string, ShaderLabRuntime>();
  const __framePipeline = output.shaders.map((sh, order) => ({
    id: sh.id,
    shaderType: sh.metadata.shaderType,
    mode:
      sh.metadata.shaderType === "spatial"
        ? sh.metadata.requiresCanvasFeed
          ? ("augment" as const)
          : ("standalone" as const)
        : null,
    order,
    mutableUniforms: sh.metadata.uniforms
      .filter((u) => u.mutable || u.deferred)
      .map((u) => u.name),
  }));

  const configs = Object.fromEntries(
    output.shaders.map((sh) => [
      sh.id,
      {
        shaderId: sh.id,
        vertexSource: sh.vertexGlsl,
        fragmentSource: sh.fragmentGlsl,
        metadata: sh.metadata,
      },
    ]),
  );

  return {
    instances,
    __framePipeline,
    __slabFrameIds: Object.freeze(Object.keys(configs)),
    __invokeSlabFrame(frameId, options) {
      const cfg = configs[frameId];
      if (!cfg) {
        throw new Error(`Unknown frame "${frameId}"`);
      }
      const inst = createShaderInstance(cfg, options ?? {}) as ShaderLabRuntime;
      instances.set(`${frameId}:${instances.size}`, inst);
      return inst;
    },
  };
}

function terminalRuntime(root: ShaderFrameInstance): ShaderLabRuntime {
  if (root instanceof ShaderLabRuntime) {
    return root;
  }
  const inner = (root as { terminal: ShaderLabRuntime }).terminal;
  if (!(inner instanceof ShaderLabRuntime)) {
    throw new Error("expected composed terminal runtime");
  }
  return inner;
}

describe("shader_frame composed pipeline", () => {
  it("water → ripple → bloom with a single mount and no feedFrom in test code", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const gl = createMockGl();
    const canvas = createCanvas(gl);

    const src = readFileSync(join(fixtures, "frame_chain_ok.slab"), "utf8");
    const compiled = compileSlab(src, "frame_chain_ok.slab");
    expect(compiled.output).not.toBeNull();

    const lib = buildSlabLibrary(compiled.output!);
    const ripple = lib.__invokeSlabFrame("ripple", {}) as ShaderLabRuntime;
    const rippleDraw = vi.spyOn(ripple, "drawScenePass");

    const bloom = composeSlabFrame(lib, "bloom", {}, [ripple]);
    bloom.mount(canvas);

    const water = [...lib.instances.values()].find((i) => i.id === "water");
    expect(water).toBeDefined();
    const waterDraw = vi.spyOn(water!, "drawScenePass");

    terminalRuntime(bloom).drawFrame();

    expect(waterDraw).toHaveBeenCalled();
    expect(rippleDraw).toHaveBeenCalled();

    bloom.unmount();
    vi.unstubAllGlobals();
  });

  it("shader_frame.bloom composes feeder; warns when feedFrom is passed to mount", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const gl = createMockGl();
    const canvas = createCanvas(gl);

    const src = readFileSync(join(fixtures, "frame_chain_ok.slab"), "utf8");
    const lib = buildSlabLibrary(compileSlab(src, "chain.slab").output!);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const bloom = shader_frame.bloom(lib);
    const dummy = lib.__invokeSlabFrame("water", {}) as ShaderLabRuntime;

    bloom.mount(canvas, { feedFrom: dummy });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("feedFrom is ignored on a composed frame"),
    );

    const water = [...lib.instances.values()].find((i) => i.id === "water");
    const waterDraw = vi.spyOn(water!, "drawScenePass");
    terminalRuntime(bloom).drawFrame();
    expect(waterDraw).toHaveBeenCalled();

    bloom.unmount();
    warn.mockRestore();
    vi.unstubAllGlobals();
  });

  it("partitions feeder and terminal mutable uniforms from one options object", () => {
    const src = readFileSync(join(fixtures, "frame_chain_ok.slab"), "utf8");
    const lib = buildSlabLibrary(compileSlab(src, "chain.slab").output!);

    const bloom = composeSlabFrame(lib, "bloom", { speed: 2.5, threshold: 0.4 });

    const water = [...lib.instances.values()].find((i) => i.id === "water");
    expect(water).toBeDefined();
    expect(water!.uniforms.speed).toBe(2.5);

    const terminal = terminalRuntime(bloom);
    expect(terminal.uniforms.threshold).toBe(0.4);
  });
});
