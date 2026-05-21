/**
 * Error / diagnostic registry — documented in docs/LANGUAGE.md (Diagnostics and stable codes).
 */

export type Severity = "Warn" | "Hazard" | "Error";

export type ErrorCodeId =
  | "E0101"
  | "E0102"
  | "E0201"
  | "E0202"
  | "E0203"
  | "E0301"
  | "E0302"
  | "E0303"
  | "E0304"
  | "E0401"
  | "E0402"
  | "E0403"
  | "E0404"
  | "E0405"
  | "E0406"
  | "E0407"
  | "E0408"
  | "E0409"
  | "H0101"
  | "H0201"
  | "H0312"
  | "H0401"
  | "W0101"
  | "W0201"
  | "W0202"
  | "W0301"
  | "W0401"
  | "W0402"
  | "W0403";

export interface ShaderlabDiagnostic {
  code: ErrorCodeId;
  severity: Severity;
  message: string;
  filename?: string;
  line?: number;
  suggestion?: string;
}

export const ERROR_CODES: Record<ErrorCodeId, { severity: Severity; summary: string }> = {
  E0101: {
    severity: "Error",
    summary: "Missing `version` attribute on root `<shaderlab>` element",
  },
  E0102: {
    severity: "Error",
    summary: "Unknown `version` value",
  },
  E0201: {
    severity: "Error",
    summary: "Missing `id` attribute on `<shader_frame>`",
  },
  E0202: {
    severity: "Error",
    summary: "Duplicate shader `id` within the same file",
  },
  E0203: {
    severity: "Error",
    summary: "Unknown `type` value",
  },
  E0301: {
    severity: "Error",
    summary: "Missing `<fragment>` block",
  },
  E0302: {
    severity: "Error",
    summary: "Missing `name` on `<uniform>`",
  },
  E0303: {
    severity: "Error",
    summary: "Unknown uniform `type`",
  },
  E0304: {
    severity: "Error",
    summary: "Invalid uniform `name` (use letters, digits, underscore only)",
  },
  E0401: {
    severity: "Error",
    summary: "`<shader>` element found. Not valid in schema v2.0.",
  },
  E0402: {
    severity: "Error",
    summary: "`version=\"1.0\"` root element. Must be `version=\"2.0\"`.",
  },
  E0403: {
    severity: "Error",
    summary: "`deferred=\"true\"` combined with `mutable=\"false\"`.",
  },
  E0404: {
    severity: "Error",
    summary: "Augment attached to a `postprocess` frame.",
  },
  E0405: {
    severity: "Error",
    summary: "`<vertex>` body declared on a `postprocess` frame.",
  },
  E0406: {
    severity: "Error",
    summary: "`CANVAS_TEXTURE` or `CANVAS_UV` referenced in a standalone spatial.",
  },
  E0407: {
    severity: "Error",
    summary: "`<vertex>` body declared on a spatial augment frame.",
  },
  E0408: {
    severity: "Error",
    summary: "Augment reference points to a frame that is not a spatial augment.",
  },
  E0409: {
    severity: "Error",
    summary: "Pipeline stage declared after `postprocess`.",
  },
  H0101: {
    severity: "Hazard",
    summary:
      "Lighting-related render_mode flags have no effect on canvas_item, canvas_25d, postprocess, or spatial",
  },
  H0201: {
    severity: "Hazard",
    summary: "Contradictory blend modes specified together",
  },
  H0312: {
    severity: "Hazard",
    summary: "Builtin used outside its valid shader type",
  },
  H0401: {
    severity: "Hazard",
    summary: "Runtime: uniform value set outside `range()` bounds — clamped",
  },
  W0101: {
    severity: "Warn",
    summary: "Unknown `render_mode` flag — will be ignored",
  },
  W0201: {
    severity: "Warn",
    summary: "Unknown `hint` value — hint will be ignored",
  },
  W0202: {
    severity: "Warn",
    summary: "`default` value outside `range()` bounds",
  },
  W0301: {
    severity: "Warn",
    summary: "`<vertex>` block is empty — could be omitted",
  },
  W0401: {
    severity: "Warn",
    summary: "Deferred uniform declared but not supplied at any known use site.",
  },
  W0402: {
    severity: "Warn",
    summary: "`mode` omitted on spatial frame (defaults to `standalone`), OR unused `SCREEN_TEXTURE` in postprocess.",
  },
  W0403: {
    severity: "Warn",
    summary: "Spatial augment does not reference `CANVAS_TEXTURE` or `CANVAS_UV`.",
  },
};

/**
 * Builds a diagnostic with **severity taken from `ERROR_CODES`** so codes never drift from their tier.
 * Always set `filename` and `line` at call sites (use `line: 1` when unknown).
 */
export function diagnostic(
  code: ErrorCodeId,
  message: string,
  filename: string,
  line: number,
  suggestion?: string,
): ShaderlabDiagnostic {
  return {
    code,
    severity: ERROR_CODES[code].severity,
    message,
    filename,
    line,
    suggestion,
  };
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case "Warn":
      return "Warn";
    case "Hazard":
      return "Hazard";
    case "Error":
      return "Error";
    default: {
      const _x: never = severity;
      return _x;
    }
  }
}

/** Formats a diagnostic like §11 (file:line, code, severity, message, optional suggestion). */
export function formatDiagnostic(d: ShaderlabDiagnostic, defaultFilename: string): string {
  const file = d.filename ?? defaultFilename;
  const line = d.line ?? 1;
  const sev = severityLabel(d.severity);
  let out = `[shaderlab] ${file}:${line}\n  ${d.code} [${sev}] — ${d.message}`;
  if (d.suggestion) {
    out += `\n  → ${d.suggestion}`;
  }
  return out;
}

export class CompileError extends Error {
  readonly diagnostics: ShaderlabDiagnostic[];

  constructor(diagnostics: ShaderlabDiagnostic[], defaultFilename: string) {
    const formatted = diagnostics.map((x) => formatDiagnostic(x, defaultFilename)).join("\n\n");
    super(formatted);
    this.name = "CompileError";
    this.diagnostics = diagnostics;
  }
}
