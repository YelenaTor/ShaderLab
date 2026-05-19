import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { handleShaderlabHotUpdate } from "./hmr.js";
import { dirnameOf, fileBasename, joinPath, relativeFromRoot, toPosix } from "./path-utils.js";
import { compileSlab } from "../compiler/compile.js";
import { formatDiagnostic } from "../compiler/errors.js";
import { emitSlabDts } from "../compiler/types-emit.js";
import { emitSlabModule } from "./emit-slab-module.js";
import { transformShaderFrameCalls } from "./shader-frame-transform.js";

export type ShaderlabDtsOption = boolean | { outDir?: string };

export interface ShaderlabPluginOptions {
  /** When `true` (default), emit a sibling `*.slab.d.ts` after each successful compile. Set `false` to skip. */
  dts?: ShaderlabDtsOption;
}

function resolveSidecarPath(slabPath: string, projectRoot: string, dts: ShaderlabDtsOption | undefined): string | null {
  if (dts === false) return null;
  const outDir = typeof dts === "object" && dts.outDir ? dts.outDir : undefined;
  const baseFile = fileBasename(slabPath);
  const stem = `${baseFile.replace(/\.slab$/i, "")}.slab.d.ts`;
  if (outDir) {
    const rel = relativeFromRoot(projectRoot, slabPath);
    const relDir = dirnameOf(rel);
    const mid = relDir === "." ? "" : relDir;
    return mid ? joinPath(projectRoot, outDir, mid, stem) : joinPath(projectRoot, outDir, stem);
  }
  return joinPath(dirnameOf(toPosix(slabPath)), stem);
}

async function writeSidecarIfChanged(path: string, content: string): Promise<void> {
  try {
    const prev = await readFile(path, "utf8");
    if (prev === content) return;
  } catch {
    // missing
  }
  await mkdir(dirnameOf(toPosix(path)), { recursive: true });
  await writeFile(path, content, "utf8");
}

function isIgnoredSlabRelPath(relPosix: string): boolean {
  return (
    relPosix.startsWith("node_modules/") ||
    relPosix.startsWith("dist/") ||
    relPosix.startsWith("test/") ||
    relPosix.startsWith(".git/")
  );
}

async function collectSlabFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      const p = joinPath(d, e.name);
      const rel = relativeFromRoot(root, p);
      if (e.isDirectory()) {
        if (isIgnoredSlabRelPath(rel + "/")) continue;
        await walk(p);
      } else if (e.name.endsWith(".slab") && !e.name.endsWith(".slab.d.ts")) {
        if (!isIgnoredSlabRelPath(rel)) out.push(p);
      }
    }
  }
  await walk(root);
  return out;
}

export default function shaderlab(options?: ShaderlabPluginOptions): Plugin {
  let projectRoot = process.cwd();
  const dtsOpt = options?.dts ?? true;

  return {
    name: "shaderlab",
    enforce: "pre",
    handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".slab")) {
        return handleShaderlabHotUpdate(ctx);
      }
    },
    configResolved(config) {
      projectRoot = config.root;
    },
    async buildStart() {
      if (dtsOpt === false) return;
      const slabs = await collectSlabFiles(projectRoot);
      for (const p of slabs) {
        const src = await readFile(p, "utf8");
        const r = compileSlab(src, p);
        if (!r.output || r.diagnostics.some((d) => d.severity === "Error")) continue;
        const target = resolveSidecarPath(p, projectRoot, dtsOpt);
        if (!target) continue;
        await writeSidecarIfChanged(target, emitSlabDts(r.output, p));
      }
    },
    transform(code, id) {
      if (/\.(tsx?|jsx?|vue|svelte)$/.test(id) && !id.includes("node_modules")) {
        const out = transformShaderFrameCalls(code, id);
        if (out.code !== code) {
          return { code: out.code, map: null };
        }
        return null;
      }
      if (!id.endsWith(".slab")) {
        return null;
      }
      const r = compileSlab(code, id);
      for (const d of r.diagnostics) {
        if (d.severity === "Error") continue;
        this.warn(formatDiagnostic({ ...d, filename: d.filename ?? id }, id));
      }
      const firstErr = r.diagnostics.find((d) => d.severity === "Error");
      if (firstErr) {
        this.error(formatDiagnostic({ ...firstErr, filename: firstErr.filename ?? id }, id));
      }
      if (!r.output) {
        this.error(`[shaderlab] ${id}: compilation produced no output`);
      }
      const out = r.output!;
      const dts = options?.dts ?? true;
      if (dts !== false) {
        const target = resolveSidecarPath(id, projectRoot, dts);
        if (target) {
          void writeSidecarIfChanged(target, emitSlabDts(out, id)).catch((e) => {
            this.warn(`[shaderlab] failed to write sidecar for ${id}: ${String(e)}`);
          });
        }
      }
      return {
        code: emitSlabModule(out),
        map: null,
      };
    },
  };
}
