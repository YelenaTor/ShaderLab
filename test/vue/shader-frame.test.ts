/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { h, nextTick, ref } from "vue";
import { render } from "@testing-library/vue";
import type { MountOptions, ShaderFrameInstance } from "../../src/vite/runtime.js";
import { ShaderFrame, useShaderFrame } from "../../src/vue/index.js";

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

describe("shaderlab/vue helpers", () => {
  it("mounts and unmounts from the composable with mount options", () => {
    const frame = mockFrame();
    const mountOptions = { visibilityPause: true };
    const view = render({
      setup() {
        const { canvasRef } = useShaderFrame(frame, mountOptions);
        return () => h("canvas", { ref: canvasRef, "data-testid": "cv" });
      },
    });
    const canvas = view.getByTestId("cv");
    expect(frame.mount).toHaveBeenCalledWith(canvas, mountOptions);
    view.unmount();
    expect(frame.unmount).toHaveBeenCalled();
  });

  it("passes mount options and applies uniforms from the component", () => {
    const frame = mockFrame();
    const mountOptions: MountOptions = { maxDevicePixelRatio: 1 };
    const view = render(ShaderFrame, {
      props: {
        frame,
        mountOptions,
        uniforms: { depth: 0.7 },
      },
      attrs: { "data-testid": "cv" },
    });
    const canvas = view.getByTestId("cv");
    expect(frame.mount).toHaveBeenCalledWith(canvas, mountOptions);
    expect(frame.set).toHaveBeenCalledWith("depth", 0.7);
    view.unmount();
  });

  it("remounts when the frame prop changes", async () => {
    const first = mockFrame("first");
    const second = mockFrame("second");
    const current = ref(first);
    const view = render({
      setup() {
        return () => h(ShaderFrame, { frame: current.value, "data-testid": "cv" });
      },
    });
    const canvas = view.getByTestId("cv");
    current.value = second;
    await nextTick();
    expect(first.unmount).toHaveBeenCalled();
    expect(second.mount).toHaveBeenCalledWith(canvas, undefined);
    view.unmount();
  });
});
