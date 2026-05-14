/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { ShaderInstance } from "../../src/vite/runtime.js";
import { useShader as useShaderReact } from "../../src/react/index.js";

function mockShader(type: "canvas_item" | "postprocess" | "spatial"): ShaderInstance {
  const attach = vi.fn();
  const detach = vi.fn();
  return {
    uniforms: {},
    attach,
    detach,
    config: { metadata: { shaderType: type } },
  } as unknown as ShaderInstance;
}

function TestApp({ mod }: { mod: { __shaders: Record<string, ShaderInstance> } }) {
  const { canvasRef } = useShaderReact(mod);
  return createElement("canvas", { ref: canvasRef, "data-testid": "cv" });
}

describe("shaderlab/react useShader", () => {
  it("attaches after mount", async () => {
    const bg = mockShader("canvas_item");
    const mod = { __shaders: { bg } };
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(createElement(TestApp, { mod }));
    });
    // Flush useEffect from useShader (runs after paint).
    await act(async () => {
      await Promise.resolve();
    });
    expect(bg.attach).toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(el);
  });
});
