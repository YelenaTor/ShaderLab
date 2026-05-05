import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";

/**
 * docs/LANGUAGE.md — schema / document structure parity (valid + invalid).
 */
describe("§4 slab schema parity", () => {
  it("accepts minimal valid document: version, shader id/type, fragment only", () => {
    const src = `<shaderlab version="1.0">
  <shader id="a" type="canvas_item">
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "minimal.slab");
    expect(r.output).not.toBeNull();
    expect(r.diagnostics.filter((d) => d.severity === "Error")).toHaveLength(0);
    expect(r.output!.shaders).toHaveLength(1);
    expect(r.output!.shaders[0]!.id).toBe("a");
  });

  it("accepts multiple shaders in one file", () => {
    const src = `<shaderlab version="1.0">
  <shader id="one" type="canvas_item">
    <fragment><![CDATA[COLOR = vec4(1.0,0.0,0.0,1.0);]]></fragment>
  </shader>
  <shader id="two" type="postprocess">
    <fragment><![CDATA[COLOR = texture(SCREEN_TEXTURE, SCREEN_UV);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "multi.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders).toHaveLength(2);
    expect(r.output!.shaders.map((s) => s.id).sort()).toEqual(["one", "two"]);
  });

  it("accepts optional render_mode on shader", () => {
    const src = `<shaderlab version="1.0">
  <shader id="x" type="canvas_item" render_mode="cull_disabled">
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "modes.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders[0]!.metadata.cullDisabled).toBe(true);
  });

  it("accepts zero uniforms (empty uniforms block omitted)", () => {
    const src = `<shaderlab version="1.0">
  <shader id="u" type="canvas_item">
    <fragment><![CDATA[COLOR = vec4(UV, 0.0, 1.0);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "nou.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders[0]!.metadata.uniforms).toHaveLength(0);
  });

  it("accepts uniforms with name, type, optional hint and default", () => {
    const src = `<shaderlab version="1.0">
  <shader id="s" type="canvas_item">
    <uniforms>
      <uniform name="speed" type="float" hint="range(0.0, 2.0)" default="1.0" />
      <uniform name="tint" type="vec3" hint="color" default="1.0, 1.0, 1.0" />
    </uniforms>
    <fragment><![CDATA[COLOR = vec4(UV * speed, 0.0, 1.0) + vec4(tint, 0.0);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "uniforms.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders[0]!.metadata.uniforms.length).toBeGreaterThanOrEqual(2);
    const names = r.output!.shaders[0]!.metadata.uniforms.map((u) => u.name);
    expect(names).toContain("speed");
    expect(names).toContain("tint");
  });

  it("preserves CDATA angle brackets inside fragment body", () => {
    const src = `<shaderlab version="1.0">
  <shader id="c" type="canvas_item">
    <fragment><![CDATA[
COLOR = vec4(1.0);
if (UV.x < 0.5) { COLOR = vec4(0.0, 1.0, 0.0, 1.0); }
    ]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "cdata.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders[0]!.fragmentGlsl).toContain("if (UV.x < 0.5)");
  });

  it("accepts optional vertex block with user logic", () => {
    const src = `<shaderlab version="1.0">
  <shader id="v" type="canvas_item">
    <vertex><![CDATA[
// user vertex stage (canvas_item default VS still provides UV)
    ]]></vertex>
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "vertex.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders[0]!.vertexGlsl).toContain("user vertex");
  });
});
