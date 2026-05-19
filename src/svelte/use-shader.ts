import type { ShaderFrameInstance } from "../vite/runtime.js";

/**
 * Svelte action — mounts a `ShaderFrameInstance` to the host `<canvas>` element.
 *
 * ```svelte
 * <canvas use:shaderframe={waterFrame}></canvas>
 * ```
 */
export function shaderframe(
  node: HTMLCanvasElement,
  frame: ShaderFrameInstance,
): { destroy(): void; update(p: ShaderFrameInstance): void } {
  let current = frame;
  current.mount(node);

  return {
    destroy() {
      current.unmount();
    },
    update(p: ShaderFrameInstance) {
      if (current !== p) {
        current.unmount();
        current = p;
        current.mount(node);
      }
    },
  };
}
