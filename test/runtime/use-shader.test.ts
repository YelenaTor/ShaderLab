import { describe, expect, it, vi } from "vitest";
import { useShader } from "../../src/runtime/use-shader.js";
import type { ShaderInstance } from "../../src/vite/runtime.js";

function mockShader(
  type: "canvas_item" | "postprocess" | "spatial",
  opts?: { requiresCanvasFeed?: boolean },
): ShaderInstance {
  const attach = vi.fn();
  const detach = vi.fn();
  return {
    uniforms: {},
    attach,
    detach,
    config: {
      metadata: {
        shaderType: type,
        ...(opts?.requiresCanvasFeed !== undefined ? { requiresCanvasFeed: opts.requiresCanvasFeed } : {}),
      },
    },
  } as unknown as ShaderInstance;
}

describe("useShader", () => {
  it("attaches feeder then postprocess with feedFrom", () => {
    const bg = mockShader("canvas_item");
    const chroma = mockShader("postprocess");
    const mod = { __shaders: { bg, chroma } };
    const api = useShader(mod);
    expect(api.shaders).toBe(mod.__shaders);

    const canvas = {} as HTMLCanvasElement;
    api.attach(canvas);

    expect(bg.attach).toHaveBeenCalledWith(canvas, {});
    expect(chroma.attach).toHaveBeenCalledWith(canvas, { feedFrom: bg });
    expect(bg.attach.mock.invocationCallOrder[0]).toBeLessThan(chroma.attach.mock.invocationCallOrder[0]!);

    api.detachAll();
    expect(chroma.detach).toHaveBeenCalled();
    expect(bg.detach).toHaveBeenCalled();
  });

  it("forwards shared attach options to feeder and post (feedFrom from slab wiring)", () => {
    const bg = mockShader("canvas_item");
    const chroma = mockShader("postprocess");
    const api = useShader({ __shaders: { bg, chroma } });
    const canvas = {} as HTMLCanvasElement;
    api.attach(canvas, { maxDevicePixelRatio: 1.5, visibilityPause: true });
    expect(bg.attach).toHaveBeenCalledWith(canvas, { maxDevicePixelRatio: 1.5, visibilityPause: true });
    expect(chroma.attach).toHaveBeenCalledWith(canvas, {
      maxDevicePixelRatio: 1.5,
      visibilityPause: true,
      feedFrom: bg,
    });
  });

  it("attaches canvas_item then spatial augment with feedFrom", () => {
    const bg = mockShader("canvas_item");
    const space = mockShader("spatial", { requiresCanvasFeed: true });
    const api = useShader({ __shaders: { bg, space } });
    const canvas = {} as HTMLCanvasElement;
    api.attach(canvas);
    expect(bg.attach).toHaveBeenCalledWith(canvas, {});
    expect(space.attach).toHaveBeenCalledWith(canvas, { feedFrom: bg });
  });

  it("attaches canvas_item → spatial → postprocess in pipeline order (ignores slab key order)", () => {
    const bg = mockShader("canvas_item");
    const space = mockShader("spatial", { requiresCanvasFeed: true });
    const pp = mockShader("postprocess");
    const api = useShader({ __shaders: { pp, space, bg } });
    const canvas = {} as HTMLCanvasElement;
    api.attach(canvas);
    expect(bg.attach).toHaveBeenCalledWith(canvas, {});
    expect(space.attach).toHaveBeenCalledWith(canvas, { feedFrom: bg });
    expect(pp.attach).toHaveBeenCalledWith(canvas, { feedFrom: space });
    expect(bg.attach.mock.invocationCallOrder[0]).toBeLessThan(space.attach.mock.invocationCallOrder[0]!);
    expect(space.attach.mock.invocationCallOrder[0]).toBeLessThan(pp.attach.mock.invocationCallOrder[0]!);
  });

  it("throws when slab is only postprocess", () => {
    const api = useShader({ __shaders: { x: mockShader("postprocess") } });
    expect(() => api.attach({} as HTMLCanvasElement)).toThrow(/canvas_item shader/);
  });

  it("allows standalone spatial as the only shader", () => {
    const s = mockShader("spatial", { requiresCanvasFeed: false });
    const api = useShader({ __shaders: { s } });
    const canvas = {} as HTMLCanvasElement;
    api.attach(canvas);
    expect(s.attach).toHaveBeenCalledWith(canvas, {});
  });

  it("throws on second attach without detach", () => {
    const api = useShader({ __shaders: { a: mockShader("canvas_item") } });
    const c = {} as HTMLCanvasElement;
    api.attach(c);
    expect(() => api.attach(c)).toThrow(/already attached/);
  });
});
