import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { writeViteConfig } from "../../src/cli/writers/vite.js";
import { writeNuxtConfig } from "../../src/cli/writers/nuxt.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../fixtures/projects");

function copyFixture(name: string): string {
  const src = join(fixtures, name);
  const dest = mkdtempSync(join(tmpdir(), `shaderlab-${name}-`));
  cpSync(src, dest, { recursive: true });
  return dest;
}

describe("CLI writers", () => {
  it("patches vite.config.ts idempotently", () => {
    const root = copyFixture("vite-minimal");
    try {
      const r1 = writeViteConfig(root);
      expect(r1.modifiedFiles.length).toBeGreaterThan(0);
      const cfg = readFileSync(join(root, "vite.config.ts"), "utf8");
      expect(cfg).toContain('import shaderlab from "shaderlab/vite"');
      expect(cfg).toContain("shaderlab()");
      const r2 = writeViteConfig(root);
      expect(r2.skipped.some((s) => s.includes("vite.config"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects shaderlab in vite.config with single-quoted import", () => {
    const root = copyFixture("vite-minimal");
    try {
      writeViteConfig(root);
      let cfg = readFileSync(join(root, "vite.config.ts"), "utf8");
      cfg = cfg.replace(/from\s+"shaderlab\/vite"/g, "from 'shaderlab/vite'");
      writeFileSync(join(root, "vite.config.ts"), cfg, "utf8");
      const r3 = writeViteConfig(root);
      expect(r3.skipped.some((s) => s.includes("vite.config"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("inserts shaderlab/nuxt into nuxt.config", () => {
    const root = copyFixture("nuxt-minimal");
    try {
      writeNuxtConfig(root);
      const cfg = readFileSync(join(root, "nuxt.config.ts"), "utf8");
      expect(cfg).toContain("shaderlab/nuxt");
      expect(existsSync(join(root, "src", "shaders", "hello.slab"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not duplicate shaderlab() when another plugin is already in the array", () => {
    const root = copyFixture("vite-minimal");
    try {
      writeViteConfig(root);
      let cfg = readFileSync(join(root, "vite.config.ts"), "utf8");
      cfg = cfg.replace(
        /plugins:\s*\[\s*\n\s*shaderlab\(\)/,
        "plugins: [\n    { name: \"other\" },\n    shaderlab()",
      );
      writeFileSync(join(root, "vite.config.ts"), cfg, "utf8");
      const r = writeViteConfig(root);
      expect(r.skipped.some((s) => s.includes("vite.config"))).toBe(true);
      const finalCfg = readFileSync(join(root, "vite.config.ts"), "utf8");
      expect((finalCfg.match(/\bshaderlab\s*\(/g) ?? []).length).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips nuxt.config when shaderlab/nuxt already present", () => {
    const root = copyFixture("nuxt-minimal");
    try {
      const r1 = writeNuxtConfig(root);
      expect(r1.modifiedFiles.some((f) => f.includes("nuxt.config"))).toBe(true);
      const r2 = writeNuxtConfig(root);
      expect(r2.skipped.some((s) => s.includes("nuxt.config"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
