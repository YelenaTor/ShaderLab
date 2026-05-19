import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(root, "src/index.ts"),
        internal: resolve(root, "src/internal.ts"),
        "vite/entry": resolve(root, "src/vite/entry.ts"),
        "react/index": resolve(root, "src/react/index.ts"),
        "vue/index": resolve(root, "src/vue/index.ts"),
        "svelte/use-shader": resolve(root, "src/svelte/use-shader.ts"),
        "adapters/nuxt": resolve(root, "src/adapters/nuxt.ts"),
        "adapters/sveltekit": resolve(root, "src/adapters/sveltekit.ts"),
        "adapters/remix": resolve(root, "src/adapters/remix.ts"),
        "cli/index": resolve(root, "src/cli/index.ts"),
        "cli/postinstall": resolve(root, "src/cli/postinstall.ts"),
      },
      formats: ["es"],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: (id) => {
        if (id === "fast-xml-parser" || id.startsWith("fast-xml-parser/")) return true;
        if (id === "vite" || id.startsWith("vite/")) return true;
        if (id.startsWith("node:")) return true;
        if (id === "@nuxt/kit" || id.startsWith("@nuxt/kit/")) return true;
        if (id === "react" || id.startsWith("react/")) return true;
        if (id === "react-dom" || id.startsWith("react-dom/")) return true;
        if (id === "vue" || id.startsWith("vue/")) return true;
        if (id === "svelte" || id.startsWith("svelte/")) return true;
        return ["fs", "path", "url", "util", "os", "crypto", "stream", "buffer"].includes(
          id,
        );
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
