import { createElement, useEffect, useMemo, useRef } from "react";
import type { CanvasHTMLAttributes, RefObject } from "react";
import type { SlabModule } from "../runtime/use-shader.js";
import type { AttachOptions, ShaderInstance } from "../vite/runtime.js";
import { useShader as useShaderCore } from "../runtime/use-shader.js";

export type { SlabModule } from "../runtime/use-shader.js";
export type { AttachOptions, ShaderInstance } from "../vite/runtime.js";

/**
 * React hook — attaches all shaders in a `.slab` module to a canvas ref on mount.
 * Pass the **imported** module (with `__shaders`), not a string path.
 */
export function useShader<T extends Record<string, ShaderInstance>>(
  mod: SlabModule<T>,
  attachOptions?: AttachOptions,
): {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  shaders: T;
} {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const api = useMemo(() => useShaderCore(mod), [mod]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    api.attach(canvas, attachOptions);
    return () => {
      api.detachAll();
    };
  }, [api, mod, attachOptions]);

  return { canvasRef, shaders: api.shaders };
}

export type ShaderLabProps<T extends Record<string, ShaderInstance>> = {
  /** Imported `.slab` module (must expose `__shaders`). */
  module: SlabModule<T>;
  attachOptions?: AttachOptions;
} & CanvasHTMLAttributes<HTMLCanvasElement>;

/**
 * Renders a `<canvas>` and attaches the slab on mount.
 */
export function ShaderLab<T extends Record<string, ShaderInstance>>(props: ShaderLabProps<T>) {
  const { module: slabMod, attachOptions, ...canvasProps } = props;
  const api = useMemo(() => useShaderCore(slabMod), [slabMod]);
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    api.attach(canvas, attachOptions);
    return () => {
      api.detachAll();
    };
  }, [api, slabMod, attachOptions]);

  return createElement("canvas", { ref, ...canvasProps });
}
