import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type DetectedFramework = "nuxt" | "next" | "sveltekit" | "remix" | "vite" | "unknown";

export interface DetectResult {
  framework: DetectedFramework;
  projectRoot: string;
  packageJsonPath: string;
  packageName: string | null;
}

/** Walk up from `startDir` until a `package.json` is found. */
export function findProjectRoot(startDir = process.cwd()): string | null {
  let dir = startDir;
  for (;;) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function readDeps(projectRoot: string): Record<string, string> {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) {
    return {};
  }
  try {
    const j = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return { ...j.dependencies, ...j.devDependencies };
  } catch {
    return {};
  }
}

function readPackageName(projectRoot: string): string | null {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const j = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    return typeof j.name === "string" ? j.name : null;
  } catch {
    return null;
  }
}

/** Order: first match wins (Nuxt/SvelteKit/Remix before bare Vite). */
export function detectFrameworkFromDeps(deps: Record<string, string>): DetectedFramework {
  if ("nuxt" in deps) return "nuxt";
  if ("@sveltejs/kit" in deps) return "sveltekit";
  for (const k of Object.keys(deps)) {
    if (k.startsWith("@remix-run/")) return "remix";
  }
  if ("next" in deps) return "next";
  if ("vite" in deps) return "vite";
  return "unknown";
}

export function detectProject(startDir = process.cwd()): DetectResult | null {
  const projectRoot = findProjectRoot(startDir);
  if (!projectRoot) {
    return null;
  }
  const deps = readDeps(projectRoot);
  const framework = detectFrameworkFromDeps(deps);
  return {
    framework,
    projectRoot,
    packageJsonPath: join(projectRoot, "package.json"),
    packageName: readPackageName(projectRoot),
  };
}
