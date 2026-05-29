/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ShaderFrameInstance } from "../../src/vite/runtime.js";
import { shaderframe } from "../../src/svelte/use-shader.js";

function mockFrame(id = "bg"): ShaderFrameInstance {
  return {
    type: "canvas_item",
    id,
    uniforms: {},
    mount: vi.fn(),
    unmount: vi.fn(),
    set: vi.fn(),
    drawScenePass: vi.fn(),
  };
}

describe("shaderlab/svelte helpers", () => {
  it("mounts, updates, and unmounts from the action", () => {
    const first = mockFrame("first");
    const second = mockFrame("second");
    const canvas = document.createElement("canvas");
    const mountOptions = { visibilityPause: true };
    const action = shaderframe(canvas, {
      frame: first,
      mountOptions,
      uniforms: { depth: 0.3 },
    });
    expect(first.mount).toHaveBeenCalledWith(canvas, mountOptions);
    expect(first.set).toHaveBeenCalledWith("depth", 0.3);
    action.update({ frame: second, uniforms: { depth: 0.8 } });
    expect(first.unmount).toHaveBeenCalled();
    expect(second.mount).toHaveBeenCalledWith(canvas, undefined);
    expect(second.set).toHaveBeenCalledWith("depth", 0.8);
    action.destroy();
    expect(second.unmount).toHaveBeenCalled();
  });

  it("keeps bare frame action compatibility", () => {
    const frame = mockFrame();
    const canvas = document.createElement("canvas");
    const action = shaderframe(canvas, frame);
    expect(frame.mount).toHaveBeenCalledWith(canvas, undefined);
    action.destroy();
    expect(frame.unmount).toHaveBeenCalled();
  });

  it("threads component props into the action parameter", () => {
    const source = readFileSync(join(process.cwd(), "src", "svelte", "ShaderFrame.svelte"), "utf8");
    expect(source).toContain("export let mountOptions");
    expect(source).toContain("export let uniforms");
    expect(source).toContain("use:shaderframe={{ frame, mountOptions, uniforms }}");
  });
});
