import { createElement, useEffect, useRef } from "react";
import type { CanvasHTMLAttributes, RefObject } from "react";
import type { ShaderFrameInstance } from "../vite/runtime.js";

/** Mounts a `ShaderFrameInstance` to a canvas ref on mount. */
export function useShaderFrame(
  frame: ShaderFrameInstance,
): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    frame.mount(canvas);
    return () => {
      frame.unmount();
    };
  }, [frame]);

  return canvasRef;
}

export type ShaderFrameProps = {
  frame: ShaderFrameInstance;
} & CanvasHTMLAttributes<HTMLCanvasElement>;

/** Renders a `<canvas>` and mounts the frame on mount. */
export function ShaderFrame(props: ShaderFrameProps) {
  const { frame, ...canvasProps } = props;
  const ref = useShaderFrame(frame);
  return createElement("canvas", { ref, ...canvasProps });
}
