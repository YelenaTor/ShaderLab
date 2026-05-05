import { addVitePlugin, defineNuxtModule } from "@nuxt/kit";
import shaderlab, { type ShaderlabPluginOptions } from "../vite/entry.js";

/**
 * Nuxt module — registers the ShaderLab Vite plugin on the Nuxt Vite dev/build pipeline.
 *
 * ```ts
 * // nuxt.config.ts
 * export default defineNuxtConfig({ modules: ["shaderlab/nuxt"] });
 * ```
 */
export default defineNuxtModule<ShaderlabPluginOptions>({
  meta: { name: "shaderlab", configKey: "shaderlab" },
  setup(options: ShaderlabPluginOptions | undefined) {
    addVitePlugin(shaderlab(options));
  },
});
