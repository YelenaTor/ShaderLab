import { parseArgs } from "node:util";

export interface ParsedCli {
  values: {
    help?: boolean;
    version?: boolean;
    "dry-run"?: boolean;
    yes?: boolean;
  };
  positionals: string[];
}

/** Parses `process.argv`-style array (`argv[0]` = node, `argv[1]` = script). */
export function parseShaderlabCli(argv: string[]): ParsedCli {
  return parseArgs({
    args: argv.slice(2),
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      "dry-run": { type: "boolean" },
      yes: { type: "boolean", short: "y" },
    },
  }) as ParsedCli;
}
