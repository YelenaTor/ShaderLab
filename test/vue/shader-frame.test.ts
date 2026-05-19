/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { ShaderFrameInstance } from "../../src/vite/runtime.js";
import { useShaderFrame } from "../../src/vue/index.js";

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

describe("shaderlab/vue useShaderFrame", () => {
  it("mounts frame on canvas attach", () => {
    const frame = mockFrame();
    const App = defineComponent({
      setup() {
        const { canvasRef } = useShaderFrame(frame);
        return () => h("canvas", { ref: canvasRef });
      },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    createApp(App).mount(host);
    expect(frame.mount).toHaveBeenCalled();
    document.body.removeChild(host);
  });
});
