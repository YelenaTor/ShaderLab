/**
 * Vite plugin entry — use `import shaderlab from "shaderlab/vite"` in vite.config only.
 * Keeps `node:fs` / compiler out of the browser bundle (`shaderlab` main is runtime-only).
 */
export { default, default as shaderlab } from "./plugin.js";
export type { ShaderlabDtsOption, ShaderlabPluginOptions } from "./plugin.js";
