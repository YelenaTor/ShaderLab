import type { SlabModule } from "../runtime/use-shader.js";
import type { AttachOptions, ShaderInstance } from "../vite/runtime.js";
import { useShader as useShaderCore } from "../runtime/use-shader.js";

export type { SlabModule } from "../runtime/use-shader.js";
export type { AttachOptions, ShaderInstance } from "../vite/runtime.js";

export type ShaderlabActionParams<T extends Record<string, ShaderInstance> = Record<string, ShaderInstance>> = {
  module: SlabModule<T>;
  attachOptions?: AttachOptions;
};

/**
 * Svelte action — attaches all shaders in a `.slab` module to the host `<canvas>` element.
 *
 * ```svelte
 * <canvas use:shaderlab={{ module: helloModule }}></canvas>
 * ```
 */
export function shaderlab<T extends Record<string, ShaderInstance>>(
  node: HTMLCanvasElement,
  initial: ShaderlabActionParams<T>,
): { destroy(): void; update(p: ShaderlabActionParams<T>): void } {
  let current = initial;
  let api = useShaderCore(current.module);

  const run = () => {
    api.detachAll();
    api = useShaderCore(current.module);
    api.attach(node, current.attachOptions);
  };

  run();

  return {
    destroy() {
      api.detachAll();
    },
    update(p: ShaderlabActionParams<T>) {
      current = p;
      run();
    },
  };
}
