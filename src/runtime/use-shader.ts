import type { AttachOptions, ShaderInstance } from "../vite/runtime.js";

/** Shape of a compiled `.slab` module (see Vite plugin `emitSlabModule`). */
export type SlabModule<T extends Record<string, ShaderInstance> = Record<string, ShaderInstance>> = {
  readonly __shaders: T;
};

/** Read shader type without importing `ShaderLabRuntime` (avoids ESM circularity with `runtime.ts`). */
function shaderType(inst: ShaderInstance): "canvas_item" | "postprocess" {
  const cfg = (inst as unknown as { config?: { metadata?: { shaderType?: string } } }).config;
  const t = cfg?.metadata?.shaderType;
  if (t === "postprocess" || t === "canvas_item") return t;
  return "canvas_item";
}

/**
 * Orchestrates `attach` / `detach` for all shaders in a `.slab` module.
 * Pass the **imported module** (with `__shaders`), not a string path.
 */
export function useShader<T extends Record<string, ShaderInstance>>(mod: SlabModule<T>): {
  readonly shaders: T;
  attach(canvas: HTMLCanvasElement, options?: AttachOptions): void;
  detachAll(): void;
} {
  const shaders = mod.__shaders;
  const attached: ShaderInstance[] = [];

  return {
    shaders,
    attach(canvas: HTMLCanvasElement, _options?: AttachOptions) {
      if (attached.length > 0) {
        throw new Error("[shaderlab] useShader().attach: already attached; call detachAll() first");
      }
      const entries = Object.entries(shaders) as [string, ShaderInstance][];
      const feederEntry = entries.find(([, s]) => shaderType(s) !== "postprocess");
      if (!feederEntry) {
        throw new Error("[shaderlab] useShader: slab has no canvas_item shader to attach first");
      }
      const [, feeder] = feederEntry;
      feeder.attach(canvas);
      attached.push(feeder);

      for (const [, sh] of entries) {
        if (sh === feeder) continue;
        const t = shaderType(sh);
        if (t === "postprocess") {
          sh.attach(canvas, { feedFrom: feeder });
          attached.push(sh);
        } else {
          throw new Error(
            "[shaderlab] useShader: multiple non-postprocess shaders in one slab — attach instances manually",
          );
        }
      }
    },
    detachAll() {
      for (let i = attached.length - 1; i >= 0; i--) {
        attached[i]!.detach();
      }
      attached.length = 0;
    },
  };
}
