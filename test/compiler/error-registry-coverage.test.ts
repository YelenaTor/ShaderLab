import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, type ErrorCodeId } from "../../src/compiler/errors.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "../fixtures");

function readAllSlabFixtures(): string {
  return readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".slab") && !f.endsWith(".slab.d.ts"))
    .map((f) => readFileSync(join(fixturesDir, f), "utf8"))
    .join("\n");
}

describe("§11 error code registry coverage", () => {
  it("every ERROR_CODES id appears in fixtures or key test sources", () => {
    const slabs = readAllSlabFixtures();
    const testSources = [
      readFileSync(join(here, "compile.test.ts"), "utf8"),
      readFileSync(join(here, "schema.test.ts"), "utf8"),
      readFileSync(join(here, "shader-frame.test.ts"), "utf8"),
      readFileSync(join(here, "types-emit-mutable.test.ts"), "utf8"),
      readFileSync(join(here, "../../src/vite/runtime.ts"), "utf8"),
      readFileSync(join(here, "../../src/compiler/validator.ts"), "utf8"),
      readFileSync(join(here, "../../src/compiler/errors.ts"), "utf8"),
      readFileSync(join(here, "shader-frame-transform.test.ts"), "utf8"),
      readFileSync(join(here, "../vite/runtime.test.ts"), "utf8"),
      readFileSync(join(here, "../vite/hints.test.ts"), "utf8"),
    ].join("\n");
    const corpus = `${slabs}\n${testSources}`;

    for (const code of Object.keys(ERROR_CODES) as ErrorCodeId[]) {
      const needle = new RegExp(`\\b${code}\\b`);
      expect(needle.test(corpus), `No fixture/test reference found for ${code}`).toBe(true);
    }
  });
});
