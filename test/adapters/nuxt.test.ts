import { describe, expect, it, vi } from "vitest";

const addVitePlugin = vi.hoisted(() => vi.fn());
const defineNuxtModule = vi.hoisted(() =>
  vi.fn((def: { meta?: unknown; setup?: (opts: unknown) => void }) => def),
);

vi.mock("@nuxt/kit", () => ({
  defineNuxtModule,
  addVitePlugin,
}));

describe("shaderlab/nuxt adapter", () => {
  it("registers a Nuxt module that calls addVitePlugin with shaderlab()", async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("../../src/adapters/nuxt.js");
    const def = mod.default as { meta?: { name?: string }; setup?: (o: unknown) => void };
    expect(defineNuxtModule).toHaveBeenCalled();
    expect(def.meta?.name).toBe("shaderlab");
    expect(typeof def.setup).toBe("function");
    def.setup!({ dts: false });
    expect(addVitePlugin).toHaveBeenCalledTimes(1);
    const plugin = addVitePlugin.mock.calls[0]![0];
    expect(typeof plugin).toBe("object");
    expect((plugin as { name?: string }).name).toBe("shaderlab");

    addVitePlugin.mockClear();
    def.setup!({ dts: true });
    expect(addVitePlugin).toHaveBeenCalledTimes(1);
    const plugin2 = addVitePlugin.mock.calls[0]![0];
    expect((plugin2 as { name?: string }).name).toBe("shaderlab");
  });
});
