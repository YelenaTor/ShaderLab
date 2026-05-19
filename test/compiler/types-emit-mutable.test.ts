import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import { emitSlabDts } from "../../src/compiler/types-emit.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../fixtures");

function load(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

describe("types-emit mutable filtering", () => {
  it("sealed uniform is absent from emitted d.ts", () => {
    const r = compileSlab(load("frame_mutable_sealed.slab"), "frame_mutable_sealed.slab");
    expect(r.output).not.toBeNull();
    const dts = emitSlabDts(r.output!, "frame_mutable_sealed.slab");
    // speed is mutable — must be present
    expect(dts).toContain("speed");
    // tile_size is sealed — must be absent
    expect(dts).not.toContain("tile_size");
  });

  it("mutable uniform is present in emitted d.ts", () => {
    const src = `<shaderlab version="2.0">
  <shader_frame id="fx" type="canvas_item">
    <uniforms>
      <uniform name="brightness" type="float" mutable="true" default="1.0" />
    </uniforms>
    <fragment><![CDATA[COLOR = vec4(UV * brightness, 0.0, 1.0);]]></fragment>
  </shader_frame>
</shaderlab>`;
    const r = compileSlab(src, "mutable.slab");
    expect(r.output).not.toBeNull();
    const dts = emitSlabDts(r.output!, "mutable.slab");
    expect(dts).toContain("brightness");
  });

  it("Deferred<T> type alias is present in all emitted modules", () => {
    const src = `<shaderlab version="2.0">
  <shader_frame id="demo" type="canvas_item">
    <fragment><![CDATA[COLOR = vec4(UV, 0.0, 1.0);]]></fragment>
  </shader_frame>
</shaderlab>`;
    const r = compileSlab(src, "deferred.slab");
    expect(r.output).not.toBeNull();
    const dts = emitSlabDts(r.output!, "deferred.slab");
    expect(dts).toContain("Deferred<T>");
    expect(dts).toContain("__deferred");
  });

});
