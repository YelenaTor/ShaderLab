import { describe, expect, it } from "vitest";
import remixAdapter from "../../src/adapters/remix.js";
import viteShaderlab from "../../src/vite/entry.js";

describe("shaderlab/remix adapter", () => {
  it("re-exports the same Vite plugin factory as shaderlab/vite", () => {
    expect(remixAdapter).toBe(viteShaderlab);
    const p = (remixAdapter as () => { name: string })();
    expect(p.name).toBe("shaderlab");
  });
});
