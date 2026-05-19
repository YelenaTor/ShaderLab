import { parse } from "./parser.js";
import { validate } from "./validator.js";
import { generate } from "./codegen.js";
import type { CompilerOutput, SlabModule } from "./types.js";
import type { ShaderlabDiagnostic } from "./errors.js";
import { CompileError } from "./errors.js";

export interface CompileResult {
  ast: SlabModule;
  diagnostics: ShaderlabDiagnostic[];
  output: CompilerOutput | null;
}

export function compileSlab(source: string, filename = "input.slab"): CompileResult {
  const { ast, diagnostics: parseDiag } = parse(source, filename);
  const diagnostics = [...parseDiag, ...validate(ast, filename)];
  const hasError = diagnostics.some((d) => d.severity === "Error");
  if (hasError) {
    return { ast, diagnostics, output: null };
  }
  const output = generate(ast);
  return { ast, diagnostics, output };
}

export function compileSlabOrThrow(source: string, filename = "input.slab"): CompilerOutput {
  const r = compileSlab(source, filename);
  if (!r.output) {
    const errors = r.diagnostics.filter((d) => d.severity === "Error");
    throw new CompileError(errors.length > 0 ? errors : r.diagnostics, filename);
  }
  return r.output;
}
