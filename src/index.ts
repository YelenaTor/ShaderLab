/** Browser-safe entry: WebGL runtime + shader_frame consumer API. For Vite use `@yoruxiii/shaderlab/vite`. */
export { shader_frame } from "./shader-frame.js";
export type { SlabLibrary, SlabFrameCallOptions, SlabAugmentCall } from "./shader-frame.js";
export type { ShaderFrameInstance } from "./vite/runtime.js";
export type * from "./compiler/types.js";
export type * from "./compiler/errors.js";
