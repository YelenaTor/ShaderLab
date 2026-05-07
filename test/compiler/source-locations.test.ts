import { describe, expect, it } from "vitest";
import {
  buildLineIndex,
  findShaderLines,
  findUniformLines,
  offsetToLine,
} from "../../src/compiler/source-locations.js";

describe("source-locations", () => {
  it("buildLineIndex / offsetToLine round-trip for typical offsets", () => {
    const src = "a\nbc\ndef\n";
    const idx = buildLineIndex(src);
    expect(idx[0]).toBe(0);
    expect(offsetToLine(idx, 0)).toBe(1);
    expect(offsetToLine(idx, 1)).toBe(1);
    expect(offsetToLine(idx, 2)).toBe(2);
    expect(offsetToLine(idx, 4)).toBe(2);
    expect(offsetToLine(idx, 5)).toBe(3);
    expect(offsetToLine(idx, src.length - 1)).toBe(3);
  });

  it("findShaderLines returns [2, 6, 10] for a three-shader fixture", () => {
    const src = `a
<shader id="1">
</shader>


<shader id="2">
</shader>


<shader id="3">
`;
    const lineIndex = buildLineIndex(src);
    expect(findShaderLines(src, lineIndex)).toEqual([2, 6, 10]);
  });

  it("findUniformLines returns nested uniform lines per shader span", () => {
    const src = `a
<shader id="1">
  <uniforms><uniform name="u1" type="float" /></uniforms>
</shader>


<shader id="2">
  <uniforms>
    <uniform name="u2a" type="float" />
    <uniform name="u2b" type="float" />
  </uniforms>
</shader>


<shader id="3">
  <uniforms><uniform name="u3" type="float" /></uniforms>
`;
    const lineIndex = buildLineIndex(src);
    expect(findShaderLines(src, lineIndex)).toEqual([2, 7, 15]);
    expect(findUniformLines(src, lineIndex)).toEqual([[3], [9, 10], [16]]);
  });
});
