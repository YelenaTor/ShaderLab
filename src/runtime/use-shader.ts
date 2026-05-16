import type { ShaderRuntimeMetadata } from "../compiler/types.js";
import type { AttachOptions, ShaderInstance } from "../vite/runtime.js";

/** Shape of a compiled `.slab` module (see Vite plugin `emitSlabModule`). */
export type SlabModule<T extends Record<string, ShaderInstance> = Record<string, ShaderInstance>> = {
  readonly __shaders: T;
};

const MAX_SPATIAL_AUG = 8;

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
 *
 * Multi-pass slabs are wired in pipeline order: canvas_item → spatial (augment) → postprocess,
 * regardless of `<shader>` order in the source file.
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

      const canvasItems = entries.filter(([, s]) => shaderType(s) === "canvas_item");
      const spatialAug = entries.filter(([, s]) => requiresCanvasFeed(s));
      const posts = entries.filter(([, s]) => shaderType(s) === "postprocess");
      const standaloneSpatial = entries.filter(
        ([, s]) => shaderType(s) === "spatial" && !requiresCanvasFeed(s),
      );

      if (canvasItems.length > 1) {
        throw new Error("[shaderlab] useShader: multiple canvas_item shaders in one slab — attach manually");
      }
      if (spatialAug.length > MAX_SPATIAL_AUG) {
        throw new Error(
          `[shaderlab] useShader: at most ${MAX_SPATIAL_AUG} canvas-fed spatial shaders per slab`,
        );
      }
      if (posts.length > 1) {
        throw new Error("[shaderlab] useShader: multiple postprocess shaders in one slab — attach manually");
      }

      const needsCanvas = spatialAug.length > 0 || posts.length > 0;
      const canvasItem = canvasItems[0]?.[1];

      if (needsCanvas && !canvasItem) {
        throw new Error("[shaderlab] useShader: slab needs a canvas_item shader for this chain");
      }

      if (posts.length === 1 && spatialAug.length === 0 && !canvasItem) {
        throw new Error("[shaderlab] useShader: postprocess requires a canvas_item feeder");
      }

      if (entries.length === 1 && standaloneSpatial.length === 1) {
        const { feedFrom: _omit, ...sharedOpts } = options ?? {};
        standaloneSpatial[0]![1].attach(canvas, sharedOpts);
        attached.push(standaloneSpatial[0]![1]);
        return;
      }

      if (standaloneSpatial.length > 0 && (canvasItem || spatialAug.length > 0 || posts.length > 0)) {
        throw new Error(
          "[shaderlab] useShader: standalone spatial must be the only shader in the slab, or add a canvas_item shader",
        );
      }

      if (!canvasItem && entries.length > 0) {
        throw new Error("[shaderlab] useShader: slab has no canvas_item shader to attach first");
      }

      const stages: ShaderInstance[] = [];
      if (canvasItem) stages.push(canvasItem);
      for (const [, s] of spatialAug) stages.push(s);
      if (posts[0]) stages.push(posts[0][1]);

      const { feedFrom: _omit, ...sharedOpts } = options ?? {};
      let chainTail: ShaderInstance | undefined;
      for (const sh of stages) {
        if (chainTail === undefined) {
          sh.attach(canvas, sharedOpts);
        } else {
          sh.attach(canvas, { ...sharedOpts, feedFrom: chainTail });
        }
        attached.push(sh);
        chainTail = sh;
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
