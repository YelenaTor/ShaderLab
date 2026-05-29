import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WriterReport, WriterRunOptions } from "./types.js";
import { appendFilePreview, emptyReport, mergeReports } from "./types.js";
import { scaffoldShaderlabFiles } from "./scaffold.js";

const NUXT_NAMES = ["nuxt.config.ts", "nuxt.config.mjs", "nuxt.config.js"];

export function findNuxtConfig(projectRoot: string): string | null {
  for (const n of NUXT_NAMES) {
    const p = join(projectRoot, n);
    if (existsSync(p)) return p;
  }
  return null;
}

function hasNuxtModule(src: string): boolean {
  return /["'](?:@yoruxiii\/)?shaderlab\/nuxt["']/.test(src);
}

function ensureNuxtModule(src: string): { ok: true; out: string } | { ok: false } {
  if (hasNuxtModule(src)) {
    return { ok: true, out: src };
  }
  if (/modules\s*:\s*\[\s*\]/.test(src)) {
    return {
      ok: true,
      out: src.replace(/modules\s*:\s*\[\s*\]/, `modules: ["@yoruxiii/shaderlab/nuxt"]`),
    };
  }
  if (/modules\s*:\s*\[/.test(src)) {
    return {
      ok: true,
      out: src.replace(/modules\s*:\s*\[/, `modules: [\n    "@yoruxiii/shaderlab/nuxt",`),
    };
  }
  return { ok: false };
}

export function writeNuxtConfig(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  const dryRun = opts?.dryRun === true;
  const r = mergeReports(emptyReport(), scaffoldShaderlabFiles(projectRoot, opts));
  if (opts?.config === false) {
    r.messages.push("Skipped Nuxt config edit.");
    return r;
  }
  const cfg = findNuxtConfig(projectRoot);
  if (!cfg) {
    r.messages.push("No nuxt.config.* found; created src/shaders/hello.slab only.");
    return r;
  }
  const original = readFileSync(cfg, "utf8");
  let src = original;
  if (hasNuxtModule(src)) {
    r.skipped.push(cfg);
    r.messages.push("Nuxt config already includes @yoruxiii/shaderlab/nuxt; skipped.");
    return r;
  }
  const patched = ensureNuxtModule(src);
  if (!patched.ok) {
    r.messages.push(
      'Could not find `modules: [...]` in nuxt.config. Add "@yoruxiii/shaderlab/nuxt" to modules manually.',
    );
    return r;
  }
  if (!dryRun) writeFileSync(cfg, patched.out, "utf8");
  r.modifiedFiles.push(cfg);
  appendFilePreview(r, cfg, original, patched.out, dryRun);
  return r;
}
