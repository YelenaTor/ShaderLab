import { describe, expect, it } from "vitest";
import sveltekitAdapter from "../../src/adapters/sveltekit.js";
import viteShaderlab from "../../src/vite/entry.js";

describe("shaderlab/sveltekit adapter", () => {
  it("re-exports the same Vite plugin factory as shaderlab/vite", () => {
    expect(sveltekitAdapter).toBe(viteShaderlab);
    const p = (sveltekitAdapter as () => { name: string })();
    expect(p.name).toBe("shaderlab");
  });
});
