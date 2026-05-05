import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Parent of `scripts/` = package root */
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "src", "svelte", "ShaderLab.svelte");
const destDir = join(root, "dist", "svelte");
const dest = join(destDir, "ShaderLab.svelte");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
