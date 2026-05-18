import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";

// Minimal valid slab helpers
function makeOldSlab(id = "x", type = "canvas_item"): string {
  return `<shaderlab version="1.0">
  <shader id="${id}" type="${type}">
    <fragment><![CDATA[void fragment() { COLOR = vec4(1.0); }]]></fragment>
  </shader>
</shaderlab>`;
}

function makeNewSlab(id = "x", type = "canvas_item"): string {
  // shader_frame is not yet parsed in 0.3.1 — the parser doesn't recognise the
  // tag so it produces an empty slab. No W0401 should appear.
  return `<shaderlab version="1.0">
  <shader_frame id="${id}" type="${type}">
    <fragment><![CDATA[void fragment() { COLOR = vec4(1.0); }]]></fragment>
  </shader_frame>
</shaderlab>`;
}

describe("W0401 — <shader> deprecation warning", () => {
  it("emits W0401 for a legacy <shader> tag", () => {
    const r = compileSlab(makeOldSlab(), "old.slab");
    const w = r.diagnostics.find((d) => d.code === "W0401");
    expect(w).toBeDefined();
    expect(w!.severity).toBe("Warn");
    expect(w!.suggestion).toContain("shader_frame");
    expect(w!.suggestion).toContain("docs/API.md");
  });

  it("does not block codegen — output is non-null despite W0401", () => {
    const r = compileSlab(makeOldSlab(), "old.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders).toHaveLength(1);
    expect(r.diagnostics.filter((d) => d.severity === "Error")).toHaveLength(0);
  });

  it("emits one W0401 per legacy shader, not one per slab", () => {
    const src = `<shaderlab version="1.0">
  <shader id="a" type="canvas_item">
    <fragment><![CDATA[void fragment() { COLOR = vec4(1.0); }]]></fragment>
  </shader>
  <shader id="b" type="postprocess">
    <fragment><![CDATA[void fragment() { COLOR = texture(SCREEN_TEXTURE, SCREEN_UV); }]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "two_old.slab");
    const warns = r.diagnostics.filter((d) => d.code === "W0401");
    expect(warns).toHaveLength(2);
    // Each warning names its shader
    expect(warns[0]!.message).toContain('"a"');
    expect(warns[1]!.message).toContain('"b"');
  });

  it("does not emit W0401 when only <shader_frame> tags are present", () => {
    const r = compileSlab(makeNewSlab(), "new.slab");
    const w = r.diagnostics.find((d) => d.code === "W0401");
    expect(w).toBeUndefined();
  });

  it("warns on old tags and is silent on shader_frame in a mixed slab", () => {
    // Mixed slab: one <shader> (old), one <shader_frame> (future, currently ignored by parser).
    // Only the old one should trigger W0401.
    const src = `<shaderlab version="1.0">
  <shader id="legacy" type="canvas_item">
    <fragment><![CDATA[void fragment() { COLOR = vec4(1.0); }]]></fragment>
  </shader>
  <shader_frame id="modern" type="postprocess">
    <fragment><![CDATA[void fragment() { COLOR = texture(SCREEN_TEXTURE, SCREEN_UV); }]]></fragment>
  </shader_frame>
</shaderlab>`;
    const r = compileSlab(src, "mixed.slab");
    const warns = r.diagnostics.filter((d) => d.code === "W0401");
    expect(warns).toHaveLength(1);
    expect(warns[0]!.message).toContain('"legacy"');
    // Codegen still succeeds for the parseable legacy shader
    expect(r.output).not.toBeNull();
  });
});
