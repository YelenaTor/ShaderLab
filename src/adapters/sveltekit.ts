/**
 * SvelteKit re-exports the ShaderLab Vite plugin for convenience.
 *
 * SvelteKit has no Nuxt-style `modules[]` hook — add the plugin in `vite.config.ts`
 * (often next to `@sveltejs/kit/vite`). `npx shaderlab init` can patch that file.
 *
 * ```ts
 * import { sveltekit } from "@sveltejs/kit/vite";
 * import shaderlab from "@yoruxiii/shaderlab/sveltekit";
 * export default defineConfig({ plugins: [sveltekit(), shaderlab()] });
 * ```
 */
export { default } from "../vite/entry.js";
