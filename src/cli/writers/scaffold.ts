import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WriterReport, WriterRunOptions } from "./types.js";
import { appendFilePreview, emptyReport } from "./types.js";

/** Minimal example shader (canvas_item) for `src/shaders/hello.slab`. */
export const HELLO_SLAB = `<shaderlab version="1.0">
  <shader id="hello" type="canvas_item">
    <fragment><![CDATA[
COLOR = vec4(UV, sin(TIME) * 0.5 + 0.5, 1.0);
    ]]></fragment>
  </shader>
</shaderlab>
`;

export function scaffoldHelloSlab(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  const dryRun = opts?.dryRun === true;
  const r = emptyReport();
  const dir = join(projectRoot, "src", "shaders");
  const file = join(dir, "hello.slab");
  if (existsSync(file)) {
    r.skipped.push(file);
    return r;
  }
  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, HELLO_SLAB, "utf8");
  }
  r.createdFiles.push(file);
  appendFilePreview(r, file, null, HELLO_SLAB, dryRun);
  return r;
}

