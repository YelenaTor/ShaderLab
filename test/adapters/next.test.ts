import { describe, expect, it } from "vitest";
import { withShaderlab } from "../../src/adapters/next.js";

describe("Next adapter", () => {
  it("adds slab and block-syntax webpack loaders", () => {
    const config = withShaderlab({
      webpack(base) {
        base.resolve = { extensions: [".tsx", ".ts", ".js"] };
        return base;
      },
    });

    const out = config.webpack!({ module: { rules: [] }, resolve: { extensions: [] } }, {});

    expect(out.resolve?.extensions?.[0]).toBe(".slab");
    expect(out.module?.rules).toHaveLength(2);
    expect(JSON.stringify(out.module?.rules)).toContain("slab-loader.cjs");
    expect(JSON.stringify(out.module?.rules)).toContain("transform-loader.cjs");
  });

  it("can disable the block-syntax loader", () => {
    const config = withShaderlab({}, { blockSyntax: false });
    const out = config.webpack!({ module: { rules: [] }, resolve: { extensions: [] } }, {});

    expect(out.module?.rules).toHaveLength(1);
    expect(JSON.stringify(out.module?.rules)).toContain("slab-loader.cjs");
    expect(JSON.stringify(out.module?.rules)).not.toContain("transform-loader.cjs");
  });
});
