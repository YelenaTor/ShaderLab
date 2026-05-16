#!/usr/bin/env node
import { relative } from "node:path";
import { detectProject } from "./detect.js";
import { formatUnifiedDiff } from "./diff-preview.js";
import { runInitForFramework } from "./init.js";
import { parseShaderlabCli } from "./parse-args.js";
import type { WriterReport } from "./writers/types.js";

const VERSION = "0.3.2-testing.1";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`shaderlab v${VERSION}

Usage:
  npx shaderlab [init] [--dry-run] [-y|--yes]   Add framework config + src/shaders/hello.slab
  npx shaderlab --help
  npx shaderlab --version

  --dry-run   Show created/modified/skipped paths and unified diff previews; do not write files.
  -y, --yes   Non-interactive affirmation. Init currently performs no prompts; flag documents intent for CI/scripts (reserved if prompts are added later).
`);
}

function printReport(framework: string, root: string, rep: WriterReport, dryRun: boolean): void {
  const mode = dryRun ? " (dry-run)" : "";
  // eslint-disable-next-line no-console
  console.log(`ShaderLab init${mode} — framework: ${framework}\nProject: ${root}\n`);
  for (const m of rep.messages) {
    // eslint-disable-next-line no-console
    console.log(`• ${m}`);
  }
  if (rep.createdFiles.length) {
    // eslint-disable-next-line no-console
    console.log(dryRun ? "\nWould create:" : "\nCreated:");
    for (const f of rep.createdFiles) console.log(`  ${f}`);
  }
  if (rep.modifiedFiles.length) {
    // eslint-disable-next-line no-console
    console.log(dryRun ? "\nWould modify:" : "\nModified:");
    for (const f of rep.modifiedFiles) console.log(`  ${f}`);
  }
  if (rep.skipped.length) {
    // eslint-disable-next-line no-console
    console.log("\nSkipped (already present):");
    for (const f of rep.skipped) console.log(`  ${f}`);
  }
  // eslint-disable-next-line no-console
  console.log(dryRun ? "\nDone (dry-run — no files written)." : "\nDone.");
}

function printDryRunDiffs(projectRoot: string, rep: WriterReport): void {
  if (!rep.fileDiffs?.length) return;
  // eslint-disable-next-line no-console
  console.log("\n--- Proposed changes (unified diff) ---\n");
  for (const d of rep.fileDiffs) {
    const rel = relative(projectRoot, d.path).replace(/\\/g, "/") || d.path;
    // eslint-disable-next-line no-console
    console.log(formatUnifiedDiff(rel, d.before, d.after));
    // eslint-disable-next-line no-console
    console.log("");
  }
}

function main(): void {
  const { values, positionals } = parseShaderlabCli(process.argv);

  if (values.help) {
    printHelp();
    process.exit(0);
  }
  if (values.version) {
    // eslint-disable-next-line no-console
    console.log(VERSION);
    process.exit(0);
  }

  const cmd = positionals[0] ?? "init";
  if (cmd !== "init") {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
  }

  const dryRun = values["dry-run"] === true;

  const info = detectProject(process.cwd());
  if (!info) {
    // eslint-disable-next-line no-console
    console.error("No package.json found in this directory or any parent.");
    process.exit(1);
  }

  const rep = runInitForFramework(info.framework, info.projectRoot, { dryRun });
  printReport(info.framework, info.projectRoot, rep, dryRun);
  if (dryRun) printDryRunDiffs(info.projectRoot, rep);
  process.exit(0);
}

main();
