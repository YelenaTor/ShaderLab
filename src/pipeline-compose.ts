import type { ShaderType } from "./compiler/types.js";
import type { FramePipelineEntry, SlabLibrary } from "./shader-frame.js";
import type { MountOptions, ShaderFrameInstance } from "./vite/runtime.js";
import { ShaderLabRuntime } from "./vite/runtime.js";

export type { FramePipelineEntry };

export function partitionFrameOptions(
  rest: Record<string, unknown>,
  feederMutableNames: readonly string[],
  terminalMutableNames: readonly string[],
): { feederOpts: Record<string, unknown>; terminalOpts: Record<string, unknown> } {
  const feederSet = new Set(feederMutableNames);
  const terminalSet = new Set(terminalMutableNames);
  const feederOpts: Record<string, unknown> = {};
  const terminalOpts: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (feederSet.has(key)) {
      feederOpts[key] = value;
    } else if (terminalSet.has(key)) {
      terminalOpts[key] = value;
    } else {
      terminalOpts[key] = value;
    }
  }
  return { feederOpts, terminalOpts };
}

const COMPOSED_FEEDFROM_WARN =
  "[shaderlab] feedFrom is ignored on a composed frame — the pipeline is wired automatically. Remove feedFrom from your mount() call.";

function getPipeline(slab: SlabLibrary): readonly FramePipelineEntry[] {
  if (!slab.__framePipeline?.length) {
    throw new Error(
      "[shaderlab] Compiled .slab library is missing __framePipeline (rebuild with a current ShaderLab Vite plugin)",
    );
  }
  return slab.__framePipeline;
}

function findFeederId(
  pipeline: readonly FramePipelineEntry[],
  terminal: FramePipelineEntry,
): string | null {
  for (const entry of pipeline) {
    if (entry.order >= terminal.order) continue;
    if (entry.shaderType === "canvas_item" || entry.shaderType === "canvas_25d") {
      return entry.id;
    }
  }
  return null;
}

class ComposedFrameInstance implements ShaderFrameInstance<Record<string, unknown>> {
  constructor(
    private readonly terminal: ShaderFrameInstance<Record<string, unknown>>,
    private readonly feedFrom: ShaderFrameInstance<Record<string, unknown>>,
  ) {}

  get type() {
    return this.terminal.type;
  }

  get id() {
    return this.terminal.id;
  }

  get uniforms() {
    return this.terminal.uniforms;
  }

  mount(target: HTMLElement | HTMLCanvasElement, options?: MountOptions): void {
    if (options?.feedFrom !== undefined) {
      console.warn(COMPOSED_FEEDFROM_WARN);
    }
    const { feedFrom: _ignored, ...rest } = options ?? {};
    this.terminal.mount(target, { ...rest, feedFrom: this.feedFrom });
  }

  unmount(): void {
    this.terminal.unmount();
  }

  set(param: string, value: unknown): void {
    this.terminal.set(param, value);
  }

  drawScenePass(t: number, w: number, h: number): void {
    this.terminal.drawScenePass(t, w, h);
  }

  _slabHotSwap?(next: ShaderFrameInstance<Record<string, unknown>>): void {
    this.terminal._slabHotSwap?.(next);
  }
}

/**
 * Build a mountable instance for a slab frame. Postprocess terminals get an auto-wired upstream chain.
 */
export function composeSlabFrame(
  slab: SlabLibrary,
  terminalFrameId: string,
  restOptions: Record<string, unknown>,
  augmentInstances?: ShaderFrameInstance[],
): ShaderFrameInstance<Record<string, unknown>> {
  const pipeline = getPipeline(slab);
  const terminalEntry = pipeline.find((e) => e.id === terminalFrameId);
  if (!terminalEntry) {
    throw new Error(
      `[shaderlab] Unknown frame "${terminalFrameId}" in this .slab library`,
    );
  }

  if (terminalEntry.shaderType === "canvas_item" || terminalEntry.shaderType === "canvas_25d") {
    const augments = augmentInstances?.length ? augmentInstances : undefined;
    return slab.__invokeSlabFrame(terminalFrameId, augments ? { ...restOptions, augments } : restOptions);
  }

  if (terminalEntry.shaderType === "postprocess") {
    const feederId = findFeederId(pipeline, terminalEntry);
    if (!feederId) {
      throw new Error(
        `[shaderlab] postprocess frame "${terminalFrameId}" requires a canvas_item or canvas_25d feeder in the same .slab library`,
      );
    }

    const feederEntry = pipeline.find((e) => e.id === feederId)!;
    const { feederOpts, terminalOpts } = partitionFrameOptions(
      restOptions,
      feederEntry.mutableUniforms,
      terminalEntry.mutableUniforms,
    );

    let tail = slab.__invokeSlabFrame(feederId, feederOpts) as ShaderLabRuntime;
    if (augmentInstances?.length) {
      for (const aug of augmentInstances) {
        if (!(aug instanceof ShaderLabRuntime)) {
          throw new Error("[shaderlab] augment instances must be ShaderFrameInstance runtimes");
        }
        aug._setPartner(tail);
        tail = aug;
      }
    }

    const terminal = slab.__invokeSlabFrame(terminalFrameId, terminalOpts);
    return new ComposedFrameInstance(terminal, tail);
  }

  return slab.__invokeSlabFrame(terminalFrameId, restOptions);
}

export function terminalFrameType(
  slab: SlabLibrary,
  frameId: string,
): ShaderType | undefined {
  return getPipeline(slab).find((e) => e.id === frameId)?.shaderType;
}
