import { describe, expect, it } from "vitest";
import { transformShaderFrameCalls } from "../../src/vite/shader-frame-transform.js";

describe("shader_frame transform", () => {
  it("rewrites library.slab reference to binding", () => {
    const src = `shader_frame.water(liquids.slab);`;
    const { code } = transformShaderFrameCalls(src, "app.ts");
    expect(code).toBe(`shader_frame.water(liquids);`);
  });

  it("lowers options block with uniform overrides", () => {
    const src = `shader_frame.water(liquids.slab) {
  speed: 1.2,
  tint: [0.1, 0.4, 0.8]
}`;
    const { code } = transformShaderFrameCalls(src, "app.ts");
    expect(code).toContain("shader_frame.water(liquids, {");
    expect(code).toContain("speed: 1.2");
    expect(code).not.toContain("liquids.slab");
  });

  it("preserves .slab in import paths", () => {
    const src = `import hello from "./hello.slab";\nshader_frame.bg(hello);`;
    const { code } = transformShaderFrameCalls(src, "main.ts");
    expect(code).toContain('from "./hello.slab"');
    expect(code).toContain("shader_frame.bg(hello)");
  });

  it("lowers positional augment declarations", () => {
    const src = `shader_frame.water(liquids.slab) {
  augment.ripple(spatials.slab),
  augment.caustics(spatials.slab)
}`;
    const { code } = transformShaderFrameCalls(src, "app.ts");
    expect(code).toContain("augments:");
    expect(code).toContain('frameId: "ripple"');
    expect(code).toContain("loadIndex: 0");
    expect(code).toContain('frameId: "caustics"');
    expect(code).toContain("loadIndex: 1");
  });

  it("rewrites multiple calls while preserving strings and comments", () => {
    const src = `const fake = "shader_frame.nope(fake.slab) { bad: true }";
// shader_frame.nope(fake.slab) { bad: true }
shader_frame.water(liquids.slab) { speed: 1.2 }
const tpl = \`shader_frame.nope(fake.slab) { bad: true }\`;
shader_frame.fire(fx.slab);`;
    const { code } = transformShaderFrameCalls(src, "app.ts");
    expect(code).toContain('"shader_frame.nope(fake.slab) { bad: true }"');
    expect(code).toContain("// shader_frame.nope(fake.slab) { bad: true }");
    expect(code).toContain("shader_frame.water(liquids, { speed: 1.2 })");
    expect(code).toContain("`shader_frame.nope(fake.slab) { bad: true }`");
    expect(code).toContain("shader_frame.fire(fx);");
  });

  it("supports nested option values and nested augment option blocks", () => {
    const src = `shader_frame.water(liquids.slab) {
  config: { nested: [1, 2, call({ x: "}" })] },
  tint: [0.1, 0.4, 0.8],
  augment.ripple(spatials.slab) {
    strength: Math.max(0.2, values[0]),
    nested: { ok: true }
  }
}`;
    const { code } = transformShaderFrameCalls(src, "app.ts");
    expect(code).toContain("config: { nested: [1, 2, call({ x: \"}\" })] }");
    expect(code).toContain('frameId: "ripple"');
    expect(code).toContain("strength: Math.max(0.2, values[0])");
    expect(code).toContain("nested: { ok: true }");
  });

  it("throws clear errors for malformed ShaderLab blocks", () => {
    const src = `shader_frame.water(liquids.slab) { speed: 1.2`;
    expect(() => transformShaderFrameCalls(src, "bad.ts")).toThrow(/bad\.ts:.*Unmatched/);
  });

  it("throws instead of dropping unsupported top-level entries", () => {
    const src = `shader_frame.water(liquids.slab) {
  speed: 1.2,
  makeSideEffect()
}`;
    expect(() => transformShaderFrameCalls(src, "bad.ts")).toThrow(
      /Unsupported shader_frame options entry/,
    );
  });
});
