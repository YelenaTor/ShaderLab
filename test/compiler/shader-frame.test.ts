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

describe("<shader_frame> parsing and validation", () => {
  it("parses frame_canvas_ok.slab (version 2.0, shader_frame, canvas_item)", () => {
    const r = compileSlab(load("frame_canvas_ok.slab"), "frame_canvas_ok.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders).toHaveLength(1);
    expect(r.output!.shaders[0]!.id).toBe("demo");
    expect(r.output!.shaders[0]!.metadata.shaderType).toBe("canvas_item");
    expect(r.diagnostics.filter((d) => d.severity === "Error")).toHaveLength(0);
  });

  it("parses mode=\"augment\" on spatial frame correctly", () => {
    const r = compileSlab(load("frame_spatial_augment_ok.slab"), "frame_spatial_augment_ok.slab");
    expect(r.output).not.toBeNull();
    const sh = r.ast.frames[0]!;
    expect(sh.mode).toBe("augment");
    expect(sh.type).toBe("spatial");
    expect(r.diagnostics.filter((d) => d.severity === "Error")).toHaveLength(0);
  });

  it("parses mutable=\"true\" / mutable=\"false\" on uniforms", () => {
    const r = compileSlab(load("frame_mutable_sealed.slab"), "frame_mutable_sealed.slab");
    expect(r.output).not.toBeNull();
    const uniforms = r.ast.frames[0]!.uniforms;
    expect(uniforms).toHaveLength(2);
    const speed = uniforms.find((u) => u.name === "speed")!;
    const tileSize = uniforms.find((u) => u.name === "tile_size")!;
    expect(speed.mutable).toBe(true);
    expect(tileSize.mutable).toBe(false);
  });

  it("E0401 for legacy <shader> element", () => {
    const r = compileSlab(load("e0401_shader_legacy.slab"), "e0401_shader_legacy.slab");
    expect(r.output).toBeNull();
    expect(r.diagnostics.some((d) => d.code === "E0401" && d.severity === "Error")).toBe(true);
  });

  it("E0402 for version=\"1.0\" root", () => {
    const r = compileSlab(load("e0402_version_1.slab"), "e0402_version_1.slab");
    expect(r.output).toBeNull();
    expect(r.diagnostics.some((d) => d.code === "E0402" && d.severity === "Error")).toBe(true);
  });

  it("compiles frame_chain_ok.slab (multi-frame: canvas + augment + post)", () => {
    const r = compileSlab(load("frame_chain_ok.slab"), "frame_chain_ok.slab");
    expect(r.output).not.toBeNull();
    expect(r.output!.shaders).toHaveLength(3);
    const byId = Object.fromEntries(r.output!.shaders.map((s) => [s.id, s]));
    expect(byId.water!.metadata.shaderType).toBe("canvas_item");
    expect(byId.ripple!.metadata.requiresCanvasFeed).toBe(true);
    expect(byId.bloom!.metadata.shaderType).toBe("postprocess");
    expect(r.diagnostics.filter((d) => d.severity === "Error")).toHaveLength(0);
  });
});
