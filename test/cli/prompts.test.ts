import { describe, expect, it } from "vitest";
import {
  defaultExample,
  parseExampleAnswer,
  parseYesNoAnswer,
} from "../../src/cli/prompts.js";

describe("CLI prompt parsing", () => {
  it("uses detected UI defaults for non-interactive init", () => {
    expect(defaultExample("react")).toBe("react");
    expect(defaultExample("vue")).toBe("vue");
    expect(defaultExample("svelte")).toBe("svelte");
    expect(defaultExample("unknown")).toBe("vanilla");
  });

  it("parses yes/no answers with defaults", () => {
    expect(parseYesNoAnswer("", true)).toBe(true);
    expect(parseYesNoAnswer("", false)).toBe(false);
    expect(parseYesNoAnswer("yes", false)).toBe(true);
    expect(parseYesNoAnswer("n", true)).toBe(false);
  });

  it("parses example choices and falls back on invalid input", () => {
    expect(parseExampleAnswer("", "react").example).toBe("react");
    expect(parseExampleAnswer("none", "react").example).toBe("none");
    expect(parseExampleAnswer("bad", "vue")).toEqual({
      example: "vue",
      message: 'Unknown example choice "bad", using vue.',
    });
  });
});
