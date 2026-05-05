import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import { emitSlabDts } from "../../src/compiler/types-emit.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../fixtures");

/** Mirrors `emitSlabModule` in [src/vite/plugin.ts](src/vite/plugin.ts) for golden assertions. */
function emitSlabModuleLikePlugin(output: import("../../src/compiler/types.js").CompilerOutput): string {
  const lines: string[] = [];
  lines.push(`import { createShaderInstance } from "shaderlab";`);
  const entries: string[] = [];
  for (const sh of output.shaders) {
    const payload = {
      shaderId: sh.id,
      vertexSource: sh.vertexGlsl,
      fragmentSource: sh.fragmentGlsl,
      metadata: sh.metadata,
    };
    entries.push(`  ${JSON.stringify(sh.exportName)}: createShaderInstance(${JSON.stringify(payload)})`);
  }
  lines.push(`export const __shaders = {\n${entries.join(",\n")}\n};\n`);
  for (const sh of output.shaders) {
    lines.push(`export const ${sh.exportName} = __shaders[${JSON.stringify(sh.exportName)}];\n`);
  }
  return lines.join("\n");
}

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

    const mod = emitSlabModuleLikePlugin(r.output!);
    expect(mod).toContain("export const __shaders");
    expect(mod).toContain('"bg"');
    expect(mod).toContain('"pp"');
    expect(mod).toContain('"overlay"');
    expect(mod).toContain("createShaderInstance");

    const dts = emitSlabDts(r.output!, "multi_types_one_file.slab");
    expect(dts).toContain("declare module \"./multi_types_one_file.slab\"");
    expect(dts).toContain("readonly bg:");
    expect(dts).toContain("readonly pp:");
    expect(dts).toContain("readonly overlay:");
    expect(dts).toContain("export declare const __shaders");
  });
});
