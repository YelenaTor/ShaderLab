import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WriterReport, WriterRunOptions } from "./types.js";
import { appendFilePreview, emptyReport, mergeReports } from "./types.js";
import { scaffoldShaderlabFiles } from "./scaffold.js";

const NEXT_NAMES = ["next.config.ts", "next.config.mts", "next.config.js", "next.config.mjs"];

export function findNextConfig(projectRoot: string): string | null {
  for (const name of NEXT_NAMES) {
    const path = join(projectRoot, name);
    if (existsSync(path)) return path;
  }
  return null;
}

function hasShaderlabNext(src: string): boolean {
  return /from\s+["']@yoruxiii\/shaderlab\/next["']/.test(src) || /\bwithShaderlab\s*\(/.test(src);
}

function patchNextConfig(src: string): { ok: true; out: string } | { ok: false } {
  if (/export\s+default\s+withShaderlab\s*\(/.test(src)) return { ok: true, out: src };
  let out = src;
  if (!/from\s+["']@yoruxiii\/shaderlab\/next["']/.test(out)) {
    out = `import { withShaderlab } from "@yoruxiii/shaderlab/next";\n${out}`;
  }
  if (/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/.test(out)) {
    out = out.replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/, "export default withShaderlab($1);");
    return { ok: true, out };
  }
  if (/export\s+default\s+({[\s\S]*?});?\s*$/.test(out)) {
    out = out.replace(/export\s+default\s+({[\s\S]*?});?\s*$/, "export default withShaderlab($1);\n");
    return { ok: true, out };
  }
  return { ok: false };
}

/** Experimental Next.js webpack-mode setup. */
export function writeNextStub(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  const dryRun = opts?.dryRun === true;
  const r = mergeReports(emptyReport(), scaffoldShaderlabFiles(projectRoot, opts));
  if (opts?.config === false) {
    r.messages.push("Skipped Next config edit.");
    return r;
  }

  const existing = findNextConfig(projectRoot);
  const target = existing ?? join(projectRoot, "next.config.ts");
  if (existing) {
    const original = readFileSync(existing, "utf8");
    if (hasShaderlabNext(original)) {
      r.skipped.push(existing);
      r.messages.push("Next config already references withShaderlab(); skipped config edit.");
      return r;
    }
    const patched = patchNextConfig(original);
    if (!patched.ok) {
      r.messages.push(
        "Could not patch next.config automatically. Add `withShaderlab()` from `@yoruxiii/shaderlab/next` manually. Experimental Next support requires webpack mode.",
      );
      return r;
    }
    if (!dryRun) writeFileSync(existing, patched.out, "utf8");
    r.modifiedFiles.push(existing);
    appendFilePreview(r, existing, original, patched.out, dryRun);
  } else {
    const source = `import { withShaderlab } from "@yoruxiii/shaderlab/next";

export default withShaderlab({});
`;
    if (!dryRun) writeFileSync(target, source, "utf8");
    r.createdFiles.push(target);
    appendFilePreview(r, target, null, source, dryRun);
  }

  r.messages.push(
    "Added experimental Next.js webpack-mode support. Use `next dev --webpack` if your Next version defaults dev mode to Turbopack; Turbopack support is deferred.",
  );
  return r;
}
