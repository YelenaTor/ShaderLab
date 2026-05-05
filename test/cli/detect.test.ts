import { describe, expect, it } from "vitest";
import { detectFrameworkFromDeps } from "../../src/cli/detect.js";

describe("detectFrameworkFromDeps", () => {
  it("prefers nuxt over vite", () => {
    expect(detectFrameworkFromDeps({ nuxt: "^3", vite: "^6" })).toBe("nuxt");
  });

  it("prefers sveltekit over vite", () => {
    expect(detectFrameworkFromDeps({ "@sveltejs/kit": "^2", vite: "^6" })).toBe("sveltekit");
  });

  it("detects remix", () => {
    expect(detectFrameworkFromDeps({ "@remix-run/react": "^2", vite: "^6" })).toBe("remix");
  });

  it("detects next", () => {
    expect(detectFrameworkFromDeps({ next: "^15" })).toBe("next");
  });

  it("detects bare vite", () => {
    expect(detectFrameworkFromDeps({ vite: "^6" })).toBe("vite");
  });

  it("returns unknown", () => {
    expect(detectFrameworkFromDeps({ react: "^19" })).toBe("unknown");
  });
});
