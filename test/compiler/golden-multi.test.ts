import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import { emitSlabDts } from "../../src/compiler/types-emit.js";
import { emitSlabModule } from "../../src/vite/emit-slab-module.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../fixtures");

describe("§10 multi-shader pipeline goldens", () => {
  it("compiles multiple canvas_item + postprocess in one slab and emits module + d.ts shape", () => {
    const src = readFileSync(join(fixtures, "multi_types_one_file.slab"), "utf8");
    const r = compileSlab(src, "multi_types_one_file.slab");
    expect(r.output).not.toBeNull();
    expect(r.diagnostics.filter((d) => d.severity === "Error")).toHaveLength(0);
    expect(r.output!.shaders).toHaveLength(3);

    const byId = Object.fromEntries(r.output!.shaders.map((s) => [s.id, s]));
    expect(byId.bg!.metadata.shaderType).toBe("canvas_item");
    expect(byId.pp!.metadata.shaderType).toBe("postprocess");
    expect(byId.overlay!.metadata.shaderType).toBe("canvas_item");
    expect(byId.bg!.fragmentGlsl).toContain("u_slab_texture_builtin");
    expect(byId.pp!.fragmentGlsl).toContain("u_slab_screen_texture");

    const mod = emitSlabModule(r.output!);
    expect(mod).toContain("__invokeSlabFrame");
    expect(mod).toContain("__framePipeline");
    expect(mod).toContain("mutableUniforms");
    expect(mod).toContain('"bg"');
    expect(mod).toContain('"pp"');
    expect(mod).toContain('from "@yoruxiii/shaderlab/internal"');
    expect(mod).toContain("createShaderInstance");

    const dts = emitSlabDts(r.output!, "multi_types_one_file.slab");
    expect(dts).toContain('declare module "./multi_types_one_file.slab"');
    expect(dts).toContain("__invokeSlabFrame");
  });
});
