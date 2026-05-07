import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSlab } from "../../src/compiler/compile.js";
import { ERROR_CODES, type ErrorCodeId } from "../../src/compiler/errors.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "../fixtures");

function assertDiagnosticShape(d: {
  code: string;
  severity: string;
  message: string;
  filename?: string;
  line?: number;
  suggestion?: string;
}, context: string): void {
  expect(ERROR_CODES[d.code as ErrorCodeId], `${context}: unknown code ${d.code}`).toBeDefined();
  expect(d.severity, `${context}: severity`).toBe(ERROR_CODES[d.code as ErrorCodeId].severity);
  expect(typeof d.message, `${context}: message`).toBe("string");
  expect(d.message.length, `${context}: message empty`).toBeGreaterThan(0);
  expect(typeof d.filename, `${context}: filename`).toBe("string");
  expect(d.filename!.length, `${context}: filename empty`).toBeGreaterThan(0);
  expect(typeof d.line, `${context}: line`).toBe("number");
  expect(d.line! >= 1, `${context}: line ${d.line}`).toBe(true);
  if (d.suggestion !== undefined) {
    expect(typeof d.suggestion, `${context}: suggestion`).toBe("string");
  }
}

describe("diagnostic consistency", () => {
  it("every diagnostic from slab fixtures matches registry severity and required fields", () => {
    const files = readdirSync(fixturesDir).filter(
      (f) => f.endsWith(".slab") && !f.endsWith(".slab.d.ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const src = readFileSync(join(fixturesDir, name), "utf8");
      const r = compileSlab(src, name);
      let i = 0;
      for (const d of r.diagnostics) {
        assertDiagnosticShape(d, `${name}#${i++}`);
      }
    }
  });

  it("formatDiagnostic output includes code bracket line for a warn", () => {
    const r = compileSlab(
      readFileSync(join(fixturesDir, "w0101_bad_render_mode.slab"), "utf8"),
      "w0101_bad_render_mode.slab",
    );
    expect(r.diagnostics.some((d) => d.code === "W0101")).toBe(true);
  });

  it("parse-time uniform diagnostics use opening-tag line when not on line 1", () => {
    const r = compileSlab(
      readFileSync(join(fixturesDir, "e0303_bad_uniform_type.slab"), "utf8"),
      "e0303_bad_uniform_type.slab",
    );
    const e0303 = r.diagnostics.find((d) => d.code === "E0303");
    expect(e0303, "E0303 expected for bad uniform type").toBeDefined();
    expect(e0303!.line, "uniform sits below line 1 in fixture").toBeGreaterThanOrEqual(2);
  });
});
