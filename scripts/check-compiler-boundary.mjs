#!/usr/bin/env node
/**
 * Ensures src/compiler never pulls in Vite integration, framework adapters, or CLI layers.
 * Cross-platform (path.normalize / path.relative); runs without extra dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(repoRoot, "src");
const compilerRoot = path.join(srcRoot, "compiler");

const forbiddenSrcDirs = ["vite", "adapters", "cli"].map((d) => path.join(srcRoot, d));

/** Package subpaths that map onto forbidden layers (must not appear in compiler sources). */
const forbiddenBarePrefixes = [
  "shaderlab/vite",
  "shaderlab/nuxt",
  "shaderlab/sveltekit",
  "shaderlab/remix",
  "shaderlab/postinstall",
];

function* walkCompilerTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkCompilerTsFiles(full);
    else if (e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) yield full;
  }
}

function collectStaticSpecifiers(source) {
  const specs = new Set();

  const fromRe = /\bfrom\s+["']([^"']+)["']/g;
  let m;
  while ((m = fromRe.exec(source))) specs.add(m[1]);

  const dynRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dynRe.exec(source))) specs.add(m[1]);

  return [...specs];
}

function isRelativeSpecifier(spec) {
  return spec.startsWith("./") || spec.startsWith("../");
}

function resolvedTouchesForbiddenSrc(resolvedAbs) {
  const normalized = path.normalize(resolvedAbs);
  for (const root of forbiddenSrcDirs) {
    const rel = path.relative(root, normalized);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) return root;
  }
  return null;
}

function forbiddenBareImport(spec) {
  if (spec.startsWith(".") || spec.startsWith("/")) return null;
  for (const prefix of forbiddenBarePrefixes) {
    if (spec === prefix || spec.startsWith(`${prefix}/`)) return prefix;
  }
  return null;
}

const violations = [];

for (const file of walkCompilerTsFiles(compilerRoot)) {
  const source = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);

  for (const spec of collectStaticSpecifiers(source)) {
    const bare = forbiddenBareImport(spec);
    if (bare) {
      violations.push({
        file,
        spec,
        detail: `forbidden package path (${bare})`,
      });
      continue;
    }

    if (!isRelativeSpecifier(spec)) continue;

    const resolved = path.resolve(dir, spec);
    const hitRoot = resolvedTouchesForbiddenSrc(resolved);
    if (hitRoot) {
      violations.push({
        file,
        spec,
        detail: `resolves under ${path.relative(repoRoot, hitRoot)}`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Compiler boundary violations (src/compiler must not depend on vite/, adapters/, or cli/):\n");
  for (const v of violations) {
    console.error(`  ${path.relative(repoRoot, v.file)}`);
    console.error(`    import: ${v.spec}`);
    console.error(`    ${v.detail}\n`);
  }
  process.exitCode = 1;
} else {
  console.log("Compiler boundary OK.");
}
