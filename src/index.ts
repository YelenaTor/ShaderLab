/** Browser-safe entry: WebGL runtime only. For Vite config use `import shaderlab from "shaderlab/vite"`. */
export { createShaderInstance, useShader } from "./vite/runtime.js";
export type { AttachOptions, ShaderInstance, ShaderInstanceConfig, SlabModule } from "./vite/runtime.js";
export type * from "./compiler/types.js";
export type * from "./compiler/errors.js";
