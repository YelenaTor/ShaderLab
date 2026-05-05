/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { ShaderInstance } from "../../src/vite/runtime.js";
import { useShader as useShaderVue } from "../../src/vue/index.js";

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

describe("shaderlab/vue useShader", () => {
  it("attaches on mount", () => {
    const bg = mockShader("canvas_item");
    const mod = { __shaders: { bg } };
    const App = defineComponent({
      setup() {
        const { canvasRef } = useShaderVue(mod);
        return () => h("canvas", { ref: canvasRef });
      },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    createApp(App).mount(host);
    expect(bg.attach).toHaveBeenCalled();
    document.body.removeChild(host);
  });
});
