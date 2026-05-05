import { describe, expect, it, vi } from "vitest";
import { useShader } from "../../src/runtime/use-shader.js";
import type { ShaderInstance } from "../../src/vite/runtime.js";

function mockShader(type: "canvas_item" | "postprocess"): ShaderInstance {
  const attach = vi.fn();
  const detach = vi.fn();
  return {
    uniforms: {},
    attach,
    detach,
    config: { metadata: { shaderType: type } },
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

    expect(bg.attach).toHaveBeenCalledWith(canvas);
    expect(chroma.attach).toHaveBeenCalledWith(canvas, { feedFrom: bg });
    expect(bg.attach.mock.invocationCallOrder[0]).toBeLessThan(chroma.attach.mock.invocationCallOrder[0]!);

    api.detachAll();
    expect(chroma.detach).toHaveBeenCalled();
    expect(bg.detach).toHaveBeenCalled();
  });

  it("throws when slab is only postprocess", () => {
    const api = useShader({ __shaders: { x: mockShader("postprocess") } });
    expect(() => api.attach({} as HTMLCanvasElement)).toThrow(/no canvas_item shader to attach first/);
  });

  it("throws on second attach without detach", () => {
    const api = useShader({ __shaders: { a: mockShader("canvas_item") } });
    const c = {} as HTMLCanvasElement;
    api.attach(c);
    expect(() => api.attach(c)).toThrow(/already attached/);
  });
});
