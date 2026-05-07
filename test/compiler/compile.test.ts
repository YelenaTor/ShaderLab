import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../fixtures");

function load(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

describe("compileSlab", () => {
  it("compiles hello_ok.slab", () => {
    const r = compileSlab(load("hello_ok.slab"), "hello_ok.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders).toHaveLength(1);
    expect(r.output!.shaders[0]!.vertexGlsl).toContain("#version 300 es");
    expect(r.output!.shaders[0]!.fragmentGlsl).toContain("fragColor");
    expect(r.diagnostics.filter((d) => d.severity === "Error")).toHaveLength(0);
  });

  it("compiles post_ok.slab", () => {
    const r = compileSlab(load("post_ok.slab"), "post_ok.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders[0]!.fragmentGlsl).toContain("SCREEN_TEXTURE");
  });

  const errorCases: { file: string; code: string }[] = [
    { file: "e0101_missing_version.slab", code: "E0101" },
    { file: "e0102_bad_version.slab", code: "E0102" },
    { file: "e0201_missing_id.slab", code: "E0201" },
    { file: "e0202_dup_id.slab", code: "E0202" },
    { file: "e0203_bad_type.slab", code: "E0203" },
    { file: "e0203_typo_spacial.slab", code: "E0203" },
    { file: "e0203_unsupported_spatial.slab", code: "E0203" },
    { file: "e0301_empty_fragment.slab", code: "E0301" },
    { file: "e0301_missing_fragment_tag.slab", code: "E0301" },
    { file: "e0302_uniform_no_name.slab", code: "E0302" },
    { file: "e0303_bad_uniform_type.slab", code: "E0303" },
    { file: "e0304_uniform_bad_name.slab", code: "E0304" },
  ];

  for (const { file, code } of errorCases) {
    it(`errors on ${file} (${code})`, () => {
      const r = compileSlab(load(file), file);
      expect(r.output).toBeNull();
      expect(r.diagnostics.some((d) => d.code === code && d.severity === "Error")).toBe(true);
    });
  }

  const warnCases: { file: string; code: string }[] = [
    { file: "w0101_bad_render_mode.slab", code: "W0101" },
    { file: "w0201_bad_hint.slab", code: "W0201" },
    { file: "w0202_default_out_range.slab", code: "W0202" },
    { file: "w0301_empty_vertex.slab", code: "W0301" },
  ];

  for (const { file, code } of warnCases) {
    it(`warns on ${file} (${code})`, () => {
      const r = compileSlab(load(file), file);
      expect(r.output).not.toBeNull();
      expect(r.diagnostics.some((d) => d.code === code)).toBe(true);
    });
  }

  it("emits H0312 for SCREEN_TEXTURE in canvas_item but still compiles", () => {
    const r = compileSlab(load("h0312_screen_in_canvas.slab"), "h0312_screen_in_canvas.slab");
    expect(r.output).not.toBeNull();
    expect(r.diagnostics.some((d) => d.code === "H0312")).toBe(true);
  });

  it("emits H0101 for lighting render_mode flags on canvas_item", () => {
    const r = compileSlab(load("h0101_unshaded_canvas.slab"), "h0101_unshaded_canvas.slab");
    expect(r.output).not.toBeNull();
    expect(r.diagnostics.some((d) => d.code === "H0101" && d.severity === "Hazard")).toBe(true);
  });

  it("emits H0201 for contradictory blend modes", () => {
    const r = compileSlab(load("h0201_blend_conflict.slab"), "h0201_blend_conflict.slab");
    expect(r.output).not.toBeNull();
    expect(r.diagnostics.some((d) => d.code === "H0201" && d.severity === "Hazard")).toBe(true);
  });

  it("treats render_mode tokens as an unordered set (order does not change metadata)", () => {
    const a = `<shaderlab version="1.0">
  <shader id="x" type="canvas_item" render_mode="cull_disabled,blend_add">
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
</shaderlab>`;
    const b = `<shaderlab version="1.0">
  <shader id="x" type="canvas_item" render_mode="blend_add,cull_disabled">
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
</shaderlab>`;
    const ra = compileSlab(a, "order-a.slab");
    const rb = compileSlab(b, "order-b.slab");
    expect(ra.output).not.toBeNull();
    expect(rb.output).not.toBeNull();
    expect(ra.output!.shaders[0]!.metadata).toEqual(rb.output!.shaders[0]!.metadata);
  });

  it("maps all blend and cull render modes to runtime metadata", () => {
    const src = `<shaderlab version="1.0">
  <shader id="add" type="canvas_item" render_mode="blend_add,cull_disabled">
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
  <shader id="mul" type="canvas_item" render_mode="blend_multiply">
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
  <shader id="premult" type="postprocess" render_mode="blend_premult_alpha">
    <fragment><![CDATA[COLOR = texture(SCREEN_TEXTURE, SCREEN_UV);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "render_modes.slab");
    expect(r.output).not.toBeNull();
    const shaders = Object.fromEntries(r.output!.shaders.map((s) => [s.id, s]));
    expect(shaders.add!.metadata.blendMode).toBe("add");
    expect(shaders.add!.metadata.cullDisabled).toBe(true);
    expect(shaders.mul!.metadata.blendMode).toBe("multiply");
    expect(shaders.premult!.metadata.blendMode).toBe("premult_alpha");
  });

  it("rejects unknown shader type values with E0203", () => {
    const src = `<shaderlab version="1.0">
  <shader id="x" type="spatial">
    <fragment><![CDATA[COLOR = vec4(1.0);]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "unknown_type_rejected.slab");
    expect(r.output).toBeNull();
    expect(r.diagnostics.some((d) => d.code === "E0203" && d.severity === "Error")).toBe(true);
  });

  it("covers builtin matrix parity across shader types", () => {
    const src = `<shaderlab version="1.0">
  <shader id="canvas_ok" type="canvas_item">
    <fragment><![CDATA[
COLOR = texture(TEXTURE, UV) * VERTEX_COLOR + vec4(vec3(TIME), 0.0);
COLOR.xy += RESOLUTION / max(RESOLUTION, vec2(1.0));
    ]]></fragment>
  </shader>
  <shader id="post_ok" type="postprocess">
    <fragment><![CDATA[
COLOR = texture(SCREEN_TEXTURE, SCREEN_UV) + vec4(TIME / max(RESOLUTION.x, 1.0));
    ]]></fragment>
  </shader>
</shaderlab>`;
    const r = compileSlab(src, "builtin_matrix.slab");
    expect(r.output).not.toBeNull();
    expect(r.diagnostics.some((d) => d.code === "H0312")).toBe(false);
  });
});
