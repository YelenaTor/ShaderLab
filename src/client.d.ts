/**
 * Ambient fallback for `*.slab` imports before the Vite plugin emits a precise sibling `*.slab.d.ts`.
 * Add to your `tsconfig.json`:
 * `"compilerOptions": { "types": ["@yoruxiii/shaderlab/client"] }`
 * or use `/// <reference types="@yoruxiii/shaderlab/client" />` in a global `.d.ts` file.
 *
 * Per-frame options types and `__invokeSlabFrame` overloads are declared in the generated `*.slab.d.ts`.
 */
declare module "*.slab" {
  import type { SlabLibrary } from "@yoruxiii/shaderlab";
  const lib: SlabLibrary;
  export default lib;
}
