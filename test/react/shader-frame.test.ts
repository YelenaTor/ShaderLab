/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { ShaderFrameInstance } from "../../src/vite/runtime.js";
import { useShaderFrame } from "../../src/react/index.js";

function mockFrame(): ShaderFrameInstance {
  return {
    type: "canvas_item",
    id: "bg",
    uniforms: {},
    mount: vi.fn(),
    unmount: vi.fn(),
    set: vi.fn(),
  };
}

function TestApp({ frame }: { frame: ShaderFrameInstance }) {
  const ref = useShaderFrame(frame);
  return createElement("canvas", { ref, "data-testid": "cv" });
}

describe("shaderlab/react useShaderFrame", () => {
  it("mounts frame on canvas attach", async () => {
    const frame = mockFrame();
    const rootEl = document.createElement("div");
    document.body.appendChild(rootEl);
    const root = createRoot(rootEl);
    await act(async () => {
      root.render(createElement(TestApp, { frame }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(frame.mount).toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    expect(frame.unmount).toHaveBeenCalled();
    document.body.removeChild(rootEl);
  });
});
