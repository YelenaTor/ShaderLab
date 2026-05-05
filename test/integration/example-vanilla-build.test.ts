import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../..");
const exampleDir = join(repoRoot, "examples/vanilla-vite");
const distIndex = join(repoRoot, "dist/index.js");

describe("examples/vanilla-vite", () => {
  it("builds with local file:shaderlab dependency", () => {
    execSync("npm run build", { cwd: repoRoot, stdio: "pipe", encoding: "utf8" });
    expect(existsSync(distIndex)).toBe(true);
    execSync("npm install", { cwd: exampleDir, stdio: "pipe", encoding: "utf8" });
    const out = execSync("npm run build", { cwd: exampleDir, stdio: "pipe", encoding: "utf8" });
    expect(out).toContain("vite");
  }, 120_000);
});
