import { composeSlabFrame, terminalFrameType } from "./pipeline-compose.js";
import type { ShaderFrameInstance } from "./vite/runtime.js";

/** Ordered frame metadata emitted with each compiled `.slab` library. */
export interface FramePipelineEntry {
  readonly id: string;
  readonly shaderType: import("./compiler/types.js").ShaderType;
  readonly mode: "standalone" | "augment" | null;
  readonly order: number;
  /** Mutable / deferred uniform names for this frame (emit-time; used by composer). */
  readonly mutableUniforms: readonly string[];
}

/** Compiled `.slab` library module shape (emitted by the Vite plugin). */
export interface SlabLibrary {
  readonly __invokeSlabFrame: (
    frameId: string,
    options?: SlabFrameCallOptions,
  ) => ShaderFrameInstance;
  readonly __slabFrameIds: readonly string[];
  readonly __framePipeline: readonly FramePipelineEntry[];
}

export interface SlabAugmentCall {
  readonly frameId: string;
  readonly slab: SlabLibrary;
  readonly loadIndex: number;
  readonly options?: SlabFrameCallOptions;
}

export type SlabFrameCallOptions = Record<string, unknown> & {
  readonly augments?: readonly SlabAugmentCall[];
};

function resolveAugments(
  options: SlabFrameCallOptions | undefined,
): ShaderFrameInstance[] | undefined {
  if (!options?.augments?.length) return undefined;
  const sorted = [...options.augments].sort((a, b) => a.loadIndex - b.loadIndex);
  return sorted.map((a) => a.slab.__invokeSlabFrame(a.frameId, a.options));
}

/**
 * Top-level consumer API: `shader_frame.water(liquids)` where `liquids` is a compiled slab library.
 * The Vite plugin may rewrite `liquids.slab` references to the imported library binding.
 */
export const shader_frame = new Proxy(
  {} as Record<string, (slab: SlabLibrary, options?: SlabFrameCallOptions) => ShaderFrameInstance>,
  {
    get(_target, prop: string) {
      return (slab: SlabLibrary, options?: SlabFrameCallOptions) => {
        if (!slab || typeof slab.__invokeSlabFrame !== "function") {
          throw new Error(
            "[shaderlab] Expected a compiled .slab library module (missing __invokeSlabFrame)",
          );
        }
        const augmentInstances = resolveAugments(options);
        const { augments: _a, ...rest } = options ?? {};
        const frameType = slab.__framePipeline
          ? terminalFrameType(slab, prop)
          : undefined;
        if (frameType === "postprocess") {
          return composeSlabFrame(slab, prop, rest, augmentInstances);
        }
        return slab.__invokeSlabFrame(
          prop,
          augmentInstances?.length ? { ...rest, augments: augmentInstances } : rest,
        );
      };
    },
  },
);
