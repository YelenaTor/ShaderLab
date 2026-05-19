import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import { emitSlabDts } from "../../src/compiler/types-emit.js";

describe("emitSlabDts", () => {
  it("emits declare module and __invokeSlabFrame", () => {
    const src = `<shaderlab version="2.0">
  <shader_frame id="demo" type="canvas_item">
    <fragment><![CDATA[
COLOR = vec4(UV, 0.0, 1.0);
    ]]></fragment>
  </shader_frame>
</shaderlab>`;
    const r = compileSlab(src, "src/hello.slab");
    expect(r.output).not.toBeNull();
    const dts = emitSlabDts(r.output!, "src/hello.slab");
    expect(dts).toContain('declare module "./hello.slab"');
    expect(dts).toContain("export function __invokeSlabFrame");
    expect(dts).toContain("__slabFrameIds");
    expect(dts).toContain("export {};");
  });

  it("emits range JSDoc, vec tuples, and readonly mouse_position", () => {
    const src = `<shaderlab version="2.0">
  <shader_frame id="main" type="canvas_item">
    <uniforms>
      <uniform name="strength" type="float" hint="range(0.0, 0.05)" default="0.01" mutable="true" />
      <uniform name="mouse_uv" type="vec2" hint="mouse_position" />
      <uniform name="tint" type="vec3" hint="color" mutable="true" />
    </uniforms>
    <fragment><![CDATA[
COLOR = vec4(UV, 1.0);
    ]]></fragment>
  </shader_frame>
</shaderlab>`;
    const r = compileSlab(src, "widgets/panel.slab");
    expect(r.output).not.toBeNull();
    const dts = emitSlabDts(r.output!, "widgets/panel.slab");
    expect(dts).toContain('declare module "./panel.slab"');
    expect(dts).toContain("range: 0-0.05");
    expect(dts).toContain("readonly mouse_uv: readonly [number, number]");
    expect(dts).toContain("tint?: [number, number, number]");
    expect(dts).toMatch(/color hint/);
  });
});
