/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createRef, createElement } from "react";
import { act, render } from "@testing-library/react";
import type { ShaderFrameInstance } from "../../src/vite/runtime.js";
import { ShaderFrame, useShaderFrame } from "../../src/react/index.js";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

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

function TestHookApp({
  frame,
  mountOptions,
}: {
  frame: ShaderFrameInstance;
  mountOptions?: Parameters<ShaderFrameInstance["mount"]>[1];
}) {
  const ref = useShaderFrame(frame, mountOptions);
  return createElement("canvas", { ref, "data-testid": "cv" });
}

describe("shaderlab/react helpers", () => {
  it("mounts and unmounts from the hook with mount options", () => {
    const frame = mockFrame();
    const mountOptions = { visibilityPause: true };
    const view = render(createElement(TestHookApp, { frame, mountOptions }));
    const canvas = view.getByTestId("cv");
    expect(frame.mount).toHaveBeenCalledWith(canvas, mountOptions);
    view.unmount();
    expect(frame.unmount).toHaveBeenCalled();
  });

  it("applies uniforms and forwards the canvas ref", () => {
    const frame = mockFrame();
    const canvasRef = createRef<HTMLCanvasElement>();
    const mountOptions = { maxDevicePixelRatio: 1 };
    const view = render(
      createElement(ShaderFrame, {
        frame,
        mountOptions,
        uniforms: { depth: 0.4, active: true },
        ref: canvasRef,
        "data-testid": "cv",
      }),
    );
    const canvas = view.getByTestId("cv");
    expect(canvasRef.current).toBe(canvas);
    expect(frame.mount).toHaveBeenCalledWith(canvas, mountOptions);
    expect(frame.set).toHaveBeenCalledWith("depth", 0.4);
    expect(frame.set).toHaveBeenCalledWith("active", true);
    view.unmount();
  });

  it("remounts when the frame changes", () => {
    const first = mockFrame("first");
    const second = mockFrame("second");
    const view = render(createElement(ShaderFrame, { frame: first, "data-testid": "cv" }));
    const canvas = view.getByTestId("cv");
    act(() => {
      view.rerender(createElement(ShaderFrame, { frame: second, "data-testid": "cv" }));
    });
    expect(first.unmount).toHaveBeenCalled();
    expect(second.mount).toHaveBeenCalledWith(canvas, undefined);
    view.unmount();
  });
});
