/**
 * Ambient fallback for `*.slab` imports before the Vite plugin emits a precise sibling `*.slab.d.ts`.
 * Add to your `tsconfig.json`:
 * `"compilerOptions": { "types": ["shaderlab/client"] }`
 * or use `/// <reference types="shaderlab/client" />` in a global `.d.ts` file.
 */
declare module "*.slab" {
  import type { ShaderInstance } from "shaderlab";
  /** Placeholder — real exports are declared in the generated `*.slab.d.ts` next to each slab. */
  export const __shaders: Record<string, ShaderInstance<Record<string, unknown>>>;
}
