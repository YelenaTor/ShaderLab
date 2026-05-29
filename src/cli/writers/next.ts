import type { WriterReport, WriterRunOptions } from "./types.js";
import { emptyReport, mergeReports } from "./types.js";
import { scaffoldShaderlabFiles } from "./scaffold.js";

/** Next.js does not use Vite; only scaffold shaders + message. */
export function writeNextStub(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  const r = mergeReports(emptyReport(), scaffoldShaderlabFiles(projectRoot, opts));
  r.messages.push(
    "Next.js uses Webpack/Turbopack, not Vite, so ShaderLab does not wire into next.config automatically. Created ShaderLab example files only.",
  );
  return r;
}
