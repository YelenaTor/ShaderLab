import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import { emitSlabDts } from "../../src/compiler/types-emit.js";

describe("§14 type emit semantics", () => {
  it("marks mouse_position as readonly tuple and sampler2D as DOM image union", () => {
    const src = `<shaderlab version="2.0">
  <shader_frame id="demo" type="canvas_item">
    <uniforms>
      <uniform name="mouse" type="vec2" hint="mouse_position" />
      <uniform name="tex" type="sampler2D" hint="texture" mutable="true" />
      <uniform name="speed" type="float" hint="range(0.0, 10.0)" default="1.0" mutable="true" />
    </uniforms>
    <fragment><![CDATA[COLOR = vec4(UV, 0.0, 1.0);]]></fragment>
  </shader_frame>
</shaderlab>`;
    const r = compileSlab(src, "emitsem.slab");
    expect(r.output).not.toBeNull();
    const dts = emitSlabDts(r.output!, "emitsem.slab");
    expect(dts).toContain("readonly mouse: readonly [number, number]");
    expect(dts).toContain("HTMLImageElement | HTMLCanvasElement | ImageBitmap");
    expect(dts).toMatch(/range:\s*0-10/);
    expect(dts).toContain("export interface DemoOptions");
  });

  it("emits one uniforms interface per shader_frame in multi-frame slab", () => {
    const src = `<shaderlab version="2.0">
  <shader_frame id="a" type="canvas_item"><fragment><![CDATA[COLOR=vec4(1);]]></fragment></shader_frame>
  <shader_frame id="b" type="canvas_item"><fragment><![CDATA[COLOR=vec4(0);]]></fragment></shader_frame>
</shaderlab>`;
    const r = compileSlab(src, "two.slab");
    expect(r.output).not.toBeNull();
    const dts = emitSlabDts(r.output!, "two.slab");
    expect(dts).toContain("export interface AOptions");
    expect(dts).toContain("export interface BOptions");
  });
});
