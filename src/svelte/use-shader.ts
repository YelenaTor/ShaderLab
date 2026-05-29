import type { MountOptions, ShaderFrameInstance } from "../vite/runtime.js";

export type ShaderFrameActionOptions =
  | ShaderFrameInstance
  | {
      frame: ShaderFrameInstance;
      mountOptions?: MountOptions;
      uniforms?: Record<string, unknown>;
    };

function normalizeOptions(value: ShaderFrameActionOptions): {
  frame: ShaderFrameInstance;
  mountOptions?: MountOptions;
  uniforms?: Record<string, unknown>;
} {
  if ("mount" in value && "unmount" in value) {
    return { frame: value };
  }
  return value;
}

function applyUniforms(frame: ShaderFrameInstance, uniforms?: Record<string, unknown>): void {
  if (!uniforms) return;
  for (const [key, value] of Object.entries(uniforms)) {
    frame.set(key, value);
  }
}

/**
 * Svelte action — mounts a `ShaderFrameInstance` to the host `<canvas>` element.
 *
 * ```svelte
 * <canvas use:shaderframe={{ frame: waterFrame, mountOptions, uniforms }}></canvas>
 * ```
 */
export function shaderframe(
  node: HTMLCanvasElement,
  options: ShaderFrameActionOptions,
): { destroy(): void; update(nextOptions: ShaderFrameActionOptions): void } {
  let current = normalizeOptions(options);
  current.frame.mount(node, current.mountOptions);
  applyUniforms(current.frame, current.uniforms);

  return {
    destroy() {
      current.frame.unmount();
    },
    update(nextOptions: ShaderFrameActionOptions) {
      const next = normalizeOptions(nextOptions);
      const shouldRemount =
        current.frame !== next.frame || current.mountOptions !== next.mountOptions;
      if (shouldRemount) {
        current.frame.unmount();
        next.frame.mount(node, next.mountOptions);
      }
      applyUniforms(next.frame, next.uniforms);
      current = next;
    },
  };
}
