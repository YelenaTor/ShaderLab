import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import shaderlab from "../../src/vite/plugin.js";

describe("HMR emit", () => {
  it("emits __invokeSlabFrame and import.meta.hot accept after two compiles", () => {
    const slab1 = `<shaderlab version="2.0">
  <shader_frame id="demo" type="canvas_item">
    <fragment><![CDATA[COLOR = vec4(1.0, 0.0, 0.0, 1.0);]]></fragment>
  </shader_frame>
</shaderlab>`;
    const slab2 = slab1.replace("1.0, 0.0", "0.0, 1.0");
    const plugin = shaderlab();
    const run = (src: string) =>
      (plugin.transform as NonNullable<typeof plugin.transform>).call(
        { warn: () => {}, error: () => {} } as never,
        src,
        "/proj/src/panel.slab",
      );
    const a = run(slab1) as { code: string };
    const b = run(slab2) as { code: string };
    expect(a.code).toContain("__invokeSlabFrame");
    expect(a.code).toContain("import.meta.hot");
    expect(b.code).toContain("0.0, 1.0, 0.0, 1.0");
    const c1 = compileSlab(slab1, "panel.slab");
    const c2 = compileSlab(slab2, "panel.slab");
    expect(c1.output!.shaders[0]!.metadata.uniforms.map((u) => u.name)).toEqual(
      c2.output!.shaders[0]!.metadata.uniforms.map((u) => u.name),
    );
  });
});
