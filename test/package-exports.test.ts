import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("package exports", () => {
  it("exposes the Svelte component subpath", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      version: string;
    };
    expect(pkg.version).toBe("0.4.2-testing.0");
    expect(pkg.exports["./svelte/ShaderFrame.svelte"]).toEqual({
      svelte: "./dist/svelte/ShaderFrame.svelte",
      default: "./dist/svelte/ShaderFrame.svelte",
    });
  });
});
