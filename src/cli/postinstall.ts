#!/usr/bin/env node
/**
 * One-time friendly notice after `npm install shaderlab` in a consumer app.
 * Integrator notes: docs/USAGE.md and README post-install guidance.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectProject } from "./detect.js";

const here = dirname(fileURLToPath(import.meta.url));
/** `dist/cli` -> package root */
const shaderlabPackageRoot = resolve(join(here, "..", ".."));

function main(): void {
  if (process.env.npm_lifecycle_event && process.env.npm_lifecycle_event !== "postinstall") {
    return;
  }

  const initCwd = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : resolve(process.cwd());
  if (initCwd === shaderlabPackageRoot) {
    return;
  }

  const info = detectProject(initCwd);
  if (!info || info.framework === "unknown") {
    return;
  }

  if (info.packageName === "shaderlab") {
    return;
  }

  const nm = join(initCwd, "node_modules");
  if (!existsSync(nm)) {
    mkdirSync(nm, { recursive: true });
  }
  const sentinel = join(nm, ".shaderlab-noticed");
  if (existsSync(sentinel)) {
    return;
  }

  const label =
    info.framework === "nuxt"
      ? "Nuxt"
      : info.framework === "next"
        ? "Next.js"
        : info.framework === "sveltekit"
          ? "SvelteKit"
          : info.framework === "remix"
            ? "Remix"
            : info.framework === "vite"
              ? "Vite"
              : "Unknown";
  console.log(
    `ShaderLab detected: ${label} project\nRun \`npx shaderlab init\` to generate config, or set up manually.`,
  );
  writeFileSync(sentinel, `${new Date().toISOString()}\n`, "utf8");
}

main();
