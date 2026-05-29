#!/usr/bin/env node
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { detectProject } from "./detect.js";
import { formatUnifiedDiff } from "./diff-preview.js";
import { runInitForFramework } from "./init.js";
import { parseShaderlabCli } from "./parse-args.js";
import { defaultExample, parseExampleAnswer, parseYesNoAnswer } from "./prompts.js";
import type { InitExample, UiFramework } from "./writers/types.js";
import type { WriterReport } from "./writers/types.js";

const require = createRequire(import.meta.url);
const { version: VERSION } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../../package.json"),
) as { version: string };

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`shaderlab v${VERSION}

Usage:
  npx shaderlab [init] [--dry-run] [-y|--yes]   Add framework config + src/shaders/hello.slab
  npx shaderlab --help
  npx shaderlab --version

  --dry-run   Show created/modified/skipped paths and unified diff previews; do not write files.
  -y, --yes   Non-interactive mode. Uses detected defaults and skips prompts.
`);
}

function printReport(
  framework: string,
  ui: string,
  root: string,
  rep: WriterReport,
  dryRun: boolean,
): void {
  const mode = dryRun ? " (dry-run)" : "";
  // eslint-disable-next-line no-console
  console.log(`ShaderLab init${mode} — framework: ${framework}, ui: ${ui}\nProject: ${root}\n`);
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

async function askYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultValue: boolean,
): Promise<boolean> {
  const suffix = defaultValue ? " [Y/n] " : " [y/N] ";
  return parseYesNoAnswer(await rl.question(`${question}${suffix}`), defaultValue);
}

async function askExample(
  rl: ReturnType<typeof createInterface>,
  ui: UiFramework,
): Promise<InitExample> {
  const fallback = defaultExample(ui);
  const answer = (
    await rl.question(
      `Create example files? react/vue/svelte/vanilla/none [${fallback}] `,
    )
  );
  const parsed = parseExampleAnswer(answer, ui);
  if (parsed.message) {
    // eslint-disable-next-line no-console
    console.log(parsed.message);
  }
  return parsed.example;
}

async function resolveInitOptions(
  yes: boolean,
  ui: UiFramework,
): Promise<{ config: boolean; example: InitExample }> {
  if (yes || !input.isTTY) {
    return { config: true, example: defaultExample(ui) };
  }
  const rl = createInterface({ input, output });
  try {
    const config = await askYesNo(rl, "Patch framework config?", true);
    const example = await askExample(rl, ui);
    return { config, example };
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
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
  const yes = values.yes === true;

  const info = detectProject(process.cwd());
  if (!info) {
    // eslint-disable-next-line no-console
    console.error("No package.json found in this directory or any parent.");
    process.exit(1);
  }

  const options = await resolveInitOptions(yes, info.ui);
  const rep = runInitForFramework(info.framework, info.projectRoot, { dryRun, ...options });
  printReport(info.framework, info.ui, info.projectRoot, rep, dryRun);
  if (dryRun) printDryRunDiffs(info.projectRoot, rep);
  process.exit(0);
}

void main();
