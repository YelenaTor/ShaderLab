import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { formatUnifiedDiff } from "../../src/cli/diff-preview.js";
import { runInitForFramework } from "../../src/cli/init.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../fixtures/projects");

function copyFixture(name: string): string {
  const src = join(fixtures, name);
  const dest = mkdtempSync(join(tmpdir(), `shaderlab-${name}-`));
  cpSync(src, dest, { recursive: true });
  return dest;
}

describe("init dry-run", () => {
  it("does not mutate filesystem for vite fixture but reports would-create / would-modify + diffs", () => {
    const root = copyFixture("vite-minimal");
    try {
      const beforeCfg = readFileSync(join(root, "vite.config.ts"), "utf8");
      const r = runInitForFramework("vite", root, { dryRun: true });
      expect(existsSync(join(root, "src", "shaders", "hello.slab"))).toBe(false);
      expect(readFileSync(join(root, "vite.config.ts"), "utf8")).toBe(beforeCfg);
      expect(r.createdFiles.some((f) => f.endsWith(join("src", "shaders", "hello.slab")))).toBe(true);
      expect(r.modifiedFiles.some((f) => f.endsWith("vite.config.ts"))).toBe(true);
      expect(r.fileDiffs?.length).toBe(2);
      const slabDiff = r.fileDiffs?.find((d) => d.path.endsWith("hello.slab"));
      expect(slabDiff?.before).toBeNull();
      expect(slabDiff?.after).toContain("<shaderlab");
      const viteDiff = r.fileDiffs?.find((d) => d.path.endsWith("vite.config.ts"));
      expect(viteDiff?.before).toBe(beforeCfg);
      expect(viteDiff?.after).toContain('@yoruxiii/shaderlab/vite');
      expect(viteDiff?.after).toContain("shaderlab()");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not mutate nuxt fixture but records config preview", () => {
    const root = copyFixture("nuxt-minimal");
    try {
      const beforeCfg = readFileSync(join(root, "nuxt.config.ts"), "utf8");
      const r = runInitForFramework("nuxt", root, { dryRun: true });
      expect(readFileSync(join(root, "nuxt.config.ts"), "utf8")).toBe(beforeCfg);
      expect(existsSync(join(root, "src", "shaders", "hello.slab"))).toBe(false);
      expect(r.modifiedFiles.some((f) => f.includes("nuxt.config"))).toBe(true);
      expect(r.fileDiffs?.some((d) => d.path.includes("nuxt.config") && d.before === beforeCfg)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("second dry-run after live init skips files and emits no diff previews", () => {
    const root = copyFixture("vite-minimal");
    try {
      runInitForFramework("vite", root, { dryRun: false });
      const r = runInitForFramework("vite", root, { dryRun: true });
      expect(r.skipped.length).toBeGreaterThanOrEqual(1);
      expect(r.fileDiffs?.length ?? 0).toBe(0);
      expect(r.createdFiles.length).toBe(0);
      expect(r.modifiedFiles.length).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("formatUnifiedDiff emits markers for new file", () => {
    const u = formatUnifiedDiff("src/shaders/hello.slab", null, "hello\n");
    expect(u).toContain("--- /dev/null");
    expect(u).toContain("+++ b/src/shaders/hello.slab");
    expect(u).toContain("+hello");
  });

  it("dry-run includes selected example preview", () => {
    const root = copyFixture("vite-minimal");
    try {
      const r = runInitForFramework("vite", root, { dryRun: true, example: "vue" });
      const exampleDiff = r.fileDiffs?.find((d) => d.path.endsWith("ShaderLabExample.vue"));
      expect(exampleDiff?.before).toBeNull();
      expect(exampleDiff?.after).toContain("@yoruxiii/shaderlab/vue");
      expect(existsSync(join(root, "src", "ShaderLabExample.vue"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
