import type { ShaderRuntimeMetadata } from "../compiler/types.js";
import type { AttachOptions, ShaderInstance } from "../vite/runtime.js";

/** Shape of a compiled `.slab` module (see Vite plugin `emitSlabModule`). */
export type SlabModule<T extends Record<string, ShaderInstance> = Record<string, ShaderInstance>> = {
  readonly __shaders: T;
};

/** Read shader type without importing `ShaderLabRuntime` (avoids ESM circularity with `runtime.ts`). */
function shaderType(inst: ShaderInstance): ShaderRuntimeMetadata["shaderType"] {
  const cfg = (inst as unknown as { config?: { metadata?: { shaderType?: string } } }).config;
  const t = cfg?.metadata?.shaderType;
  if (t === "postprocess" || t === "spatial" || t === "canvas_item") return t;
  return "canvas_item";
}

function shaderMeta(inst: ShaderInstance): ShaderRuntimeMetadata | undefined {
  return (inst as unknown as { config?: { metadata?: ShaderRuntimeMetadata } }).config?.metadata;
}

function requiresCanvasFeed(inst: ShaderInstance): boolean {
  const m = shaderMeta(inst);
  return m?.shaderType === "spatial" && m.requiresCanvasFeed === true;
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
    attach(canvas: HTMLCanvasElement, options?: AttachOptions) {
      if (attached.length > 0) {
        throw new Error("[shaderlab] useShader().attach: already attached; call detachAll() first");
      }
      const entries = Object.entries(shaders) as [string, ShaderInstance][];

      const hasPost = entries.some(([, s]) => shaderType(s) === "postprocess");
      const spatialAugEntries = entries.filter(([, s]) => requiresCanvasFeed(s));
      if (hasPost && spatialAugEntries.length > 0) {
        throw new Error(
          "[shaderlab] useShader: combining postprocess and spatial (CANVAS_TEXTURE / CANVAS_UV) in one auto-wired slab is not supported in 0.3.0-testing; attach postprocess manually once multi-stage compositing exists.",
        );
      }
      if (spatialAugEntries.length > 1) {
        throw new Error(
          "[shaderlab] useShader: at most one spatial shader using CANVAS_TEXTURE / CANVAS_UV per slab in 0.3.0-testing; use manual attach for deeper chains.",
        );
      }

      const canvasItems = entries.filter(([, s]) => shaderType(s) === "canvas_item");
      const standaloneSpatial = entries.filter(
        ([, s]) => shaderType(s) === "spatial" && !requiresCanvasFeed(s),
      );

      let feeder: ShaderInstance;
      let feederIsCanvas: boolean;

      if (canvasItems.length > 1) {
        throw new Error("[shaderlab] useShader: multiple canvas_item shaders in one slab — attach manually");
      }
      if (canvasItems.length === 1) {
        feeder = canvasItems[0]![1];
        feederIsCanvas = true;
      } else if (entries.length === 1 && standaloneSpatial.length === 1) {
        feeder = standaloneSpatial[0]![1];
        feederIsCanvas = false;
      } else if (standaloneSpatial.length > 0) {
        throw new Error(
          "[shaderlab] useShader: standalone spatial must be the only shader in the slab, or add a canvas_item shader",
        );
      } else {
        throw new Error("[shaderlab] useShader: slab has no canvas_item shader to attach first");
      }

      const { feedFrom: _omit, ...sharedOpts } = options ?? {};
      feeder.attach(canvas, sharedOpts);
      attached.push(feeder);

      for (const [, sh] of entries) {
        if (sh === feeder) continue;
        const ty = shaderType(sh);
        if (ty === "postprocess") {
          if (!feederIsCanvas) {
            throw new Error("[shaderlab] useShader: postprocess requires a canvas_item feeder");
          }
          sh.attach(canvas, { ...sharedOpts, feedFrom: feeder });
          attached.push(sh);
        } else if (ty === "spatial" && requiresCanvasFeed(sh)) {
          if (!feederIsCanvas) {
            throw new Error("[shaderlab] useShader: canvas-fed spatial requires a canvas_item feeder");
          }
          sh.attach(canvas, { ...sharedOpts, feedFrom: feeder });
          attached.push(sh);
        } else if (ty === "spatial") {
          throw new Error(
            "[shaderlab] useShader: unexpected extra standalone spatial in slab — attach manually",
          );
        } else if (ty === "canvas_item") {
          throw new Error("[shaderlab] useShader: multiple canvas_item shaders in one slab — attach manually");
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
