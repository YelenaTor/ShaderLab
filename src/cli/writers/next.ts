import type { WriterReport, WriterRunOptions } from "./types.js";
import { emptyReport, mergeReports } from "./types.js";
import { scaffoldHelloSlab } from "./scaffold.js";

/** Next.js does not use Vite; only scaffold shaders + message. */
export function writeNextStub(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  const r = mergeReports(emptyReport(), scaffoldHelloSlab(projectRoot, opts));
  r.messages.push(
    "Next.js uses Webpack/Turbopack, not Vite — ShaderLab does not wire into next.config automatically. Use a Vite-based stack or add a custom loader. Created src/shaders/hello.slab only.",
  );
  return r;
}
