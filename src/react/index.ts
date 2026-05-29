import { createElement, forwardRef, useCallback, useEffect, useRef } from "react";
import type { CanvasHTMLAttributes, Ref, RefObject } from "react";
import type { MountOptions, ShaderFrameInstance } from "../vite/runtime.js";

function assignRef<T>(target: Ref<T> | undefined, value: T | null): void {
  if (!target) return;
  if (typeof target === "function") {
    target(value);
    return;
  }
  target.current = value;
}

/** Mounts a `ShaderFrameInstance` to a canvas ref on mount. */
export function useShaderFrame(
  frame: ShaderFrameInstance,
  mountOptions?: MountOptions,
): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // React effects do not run during SSR, so WebGL setup stays browser-only.
    const canvas = canvasRef.current;
    if (!canvas) return;
    frame.mount(canvas, mountOptions);
    return () => {
      frame.unmount();
    };
  }, [frame, mountOptions]);

  return canvasRef;
}

export function useShaderUniforms(
  frame: ShaderFrameInstance,
  uniforms?: Record<string, unknown>,
): void {
  useEffect(() => {
    if (!uniforms) return;
    for (const [key, value] of Object.entries(uniforms)) {
      frame.set(key, value);
    }
  }, [frame, uniforms]);
}

export type ShaderFrameProps = {
  frame: ShaderFrameInstance;
  mountOptions?: MountOptions;
  uniforms?: Record<string, unknown>;
} & CanvasHTMLAttributes<HTMLCanvasElement>;

/** Renders a `<canvas>` and mounts the frame on mount. */
export const ShaderFrame = forwardRef<HTMLCanvasElement, ShaderFrameProps>(function ShaderFrame(
  props,
  forwardedRef,
) {
  const { frame, mountOptions, uniforms, ...canvasProps } = props;
  const ref = useShaderFrame(frame, mountOptions);
  useShaderUniforms(frame, uniforms);
  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      ref.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef, ref],
  );

  return createElement("canvas", { ref: setCanvasRef, ...canvasProps });
});
