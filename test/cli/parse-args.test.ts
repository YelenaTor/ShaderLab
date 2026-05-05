import { describe, expect, it } from "vitest";
import { parseShaderlabCli } from "../../src/cli/parse-args.js";

describe("parseShaderlabCli", () => {
  it("parses init --dry-run -y", () => {
    const { values, positionals } = parseShaderlabCli([
      "node",
      "shaderlab",
      "init",
      "--dry-run",
      "-y",
    ]);
    expect(positionals).toEqual(["init"]);
    expect(values["dry-run"]).toBe(true);
    expect(values.yes).toBe(true);
  });

  it("parses --yes long form", () => {
    const { values } = parseShaderlabCli(["node", "x", "init", "--yes"]);
    expect(values.yes).toBe(true);
  });
});
