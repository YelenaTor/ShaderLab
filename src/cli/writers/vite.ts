import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WriterReport, WriterRunOptions } from "./types.js";
import { appendFilePreview, emptyReport, mergeReports } from "./types.js";
import { scaffoldShaderlabFiles } from "./scaffold.js";

const VITE_NAMES = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"];

export function findViteConfig(projectRoot: string): string | null {
  for (const n of VITE_NAMES) {
    const p = join(projectRoot, n);
    if (existsSync(p)) return p;
  }
  return null;
}

function hasShaderlabPlugin(src: string): boolean {
  return /from\s+["'](?:@yoruxiii\/)?shaderlab\/vite["']/.test(src) && /\bshaderlab\s*\(/.test(src);
}

function ensureImport(src: string): string {
  if (/from\s+["'](?:@yoruxiii\/)?shaderlab\/vite["']/.test(src)) {
    return src;
  }
  return `import shaderlab from "@yoruxiii/shaderlab/vite";\n${src}`;
}

function ensurePluginInPluginsArray(src: string): { ok: true; out: string } | { ok: false } {
  if (/\bshaderlab\s*\(/.test(src)) {
    return { ok: true, out: src };
  }
  // plugins: []  -> plugins: [shaderlab()]
  if (/plugins\s*:\s*\[\s*\]/.test(src)) {
    return {
      ok: true,
      out: src.replace(/plugins\s*:\s*\[\s*\]/, "plugins: [shaderlab()]"),
    };
  }
  // plugins: [  -> plugins: [\n    shaderlab(),
  if (/plugins\s*:\s*\[/.test(src)) {
    return {
      ok: true,
      out: src.replace(/plugins\s*:\s*\[/, "plugins: [\n    shaderlab(),"),
    };
  }
  return { ok: false };
}

export function writeViteConfig(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  const dryRun = opts?.dryRun === true;
  const r = mergeReports(emptyReport(), scaffoldShaderlabFiles(projectRoot, opts));
  if (opts?.config === false) {
    r.messages.push("Skipped Vite config edit.");
    return r;
  }
  const existing = findViteConfig(projectRoot);
  const target = existing ?? join(projectRoot, "vite.config.ts");

  if (existing) {
    const original = readFileSync(existing, "utf8");
    let src = original;
    if (hasShaderlabPlugin(src)) {
      r.skipped.push(existing);
      r.messages.push("Vite config already references shaderlab(); skipped plugin edit.");
      return r;
    }
    src = ensureImport(src);
    const plugged = ensurePluginInPluginsArray(src);
    if (!plugged.ok) {
      r.messages.push(
        "Could not find a `plugins: [...]` array to patch. Add `shaderlab()` manually to vite.config.",
      );
      if (!dryRun) writeFileSync(existing, src, "utf8");
      r.modifiedFiles.push(existing);
      appendFilePreview(r, existing, original, src, dryRun);
      return r;
    }
    if (!dryRun) writeFileSync(existing, plugged.out, "utf8");
    r.modifiedFiles.push(existing);
    appendFilePreview(r, existing, original, plugged.out, dryRun);
    return r;
  }

const minimal = `import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
`;
  if (!dryRun) writeFileSync(target, minimal, "utf8");
  r.createdFiles.push(target);
  appendFilePreview(r, target, null, minimal, dryRun);
  return r;
}
