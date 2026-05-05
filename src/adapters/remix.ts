/**
 * Remix re-exports the ShaderLab Vite plugin for convenience.
 *
 * Remix v2 uses Vite; there is no separate Remix module loader — register the plugin
 * in `vite.config.ts` beside `@remix-run/dev`'s plugin. `npx shaderlab init` can patch that file.
 *
 * ```ts
 * import { vitePlugin as remix } from "@remix-run/dev";
 * import shaderlab from "shaderlab/remix";
 * export default defineConfig({ plugins: [remix(), shaderlab()] });
 * ```
 */
export { default } from "../vite/entry.js";
