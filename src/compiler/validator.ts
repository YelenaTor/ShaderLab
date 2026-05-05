import { findBuiltinMisuse } from "./builtins.js";
import type { ShaderlabAst, RenderMode, ShaderType } from "./types.js";
import { diagnostic } from "./errors.js";
import type { ShaderlabDiagnostic } from "./errors.js";
import { isHintRecognized, parseDefaultValue, parseHint, valueInRange } from "./hints.js";

const VALID_SHADER_TYPES = new Set<string>(["canvas_item", "postprocess"]);

const VALID_RENDER = new Set<RenderMode>([
  "unshaded",
  "cull_disabled",
  "blend_add",
  "blend_multiply",
  "blend_premult_alpha",
  "depth_draw_never",
  "diffuse_toon",
  "specular_disabled",
]);

const BLEND_MODES = new Set<RenderMode>(["blend_add", "blend_multiply", "blend_premult_alpha"]);

const ID_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Semantic validation; mutates `ast.shaders[].renderModes` from `renderModeTokens`. */
export function validate(ast: ShaderlabAst, filename = "input.slab"): ShaderlabDiagnostic[] {
  const diagnostics: ShaderlabDiagnostic[] = [];

  if (ast.version && ast.version !== "1.0") {
    diagnostics.push(
      diagnostic(
        "E0102",
        `Unknown \`version\` value "${ast.version}"`,
        filename,
        1,
        'Use version="1.0"',
      ),
    );
  }

  const seenIds = new Set<string>();
  for (const sh of ast.shaders) {
    if (sh.id && seenIds.has(sh.id)) {
      diagnostics.push(
        diagnostic(
          "E0202",
          `Duplicate shader \`id\` "${sh.id}" within the same file`,
          filename,
          sh.line ?? 1,
        ),
      );
    }
    if (sh.id) {
      seenIds.add(sh.id);
    }

    if (!sh.id.trim()) {
      diagnostics.push(
        diagnostic("E0201", "Missing `id` attribute on `<shader>`", filename, sh.line ?? 1),
      );
    } else if (!ID_RE.test(sh.id)) {
      diagnostics.push(
        diagnostic(
          "E0201",
          `Invalid shader \`id\` "${sh.id}" (use letters, digits, underscore only)`,
          filename,
          sh.line ?? 1,
        ),
      );
    }

    if (!sh.typeRaw.trim()) {
      diagnostics.push(
        diagnostic("E0203", "Missing `type` attribute on `<shader>`", filename, sh.line ?? 1),
      );
    } else if (!VALID_SHADER_TYPES.has(sh.typeRaw)) {
      diagnostics.push(
        diagnostic(
          "E0203",
          `Unknown \`type\` value "${sh.typeRaw}"`,
          filename,
          sh.line ?? 1,
          'Use type="canvas_item" or type="postprocess"',
        ),
      );
    }

    if (sh.fragmentBody.trim() === "") {
      diagnostics.push(
        diagnostic(
          "E0301",
          "Missing `<fragment>` block or empty fragment body",
          filename,
          sh.line ?? 1,
        ),
      );
    }

    const resolvedModes: RenderMode[] = [];
    for (const tok of sh.renderModeTokens) {
      if (VALID_RENDER.has(tok as RenderMode)) {
        resolvedModes.push(tok as RenderMode);
      } else {
        diagnostics.push(
          diagnostic(
            "W0101",
            `Unknown \`render_mode\` flag "${tok}" — will be ignored`,
            filename,
            sh.line ?? 1,
          ),
        );
      }
    }
    sh.renderModes = resolvedModes;

    const blends = resolvedModes.filter((m) => BLEND_MODES.has(m));
    if (blends.length > 1) {
      diagnostics.push(
        diagnostic(
          "H0201",
          "Contradictory blend modes specified together",
          filename,
          sh.line ?? 1,
          "Pick only one of blend_add, blend_multiply, blend_premult_alpha",
        ),
      );
    }

    const lightingModesWithoutRuntimeSupport: RenderMode[] = [
      "unshaded",
      "depth_draw_never",
      "diffuse_toon",
      "specular_disabled",
    ];
    if (VALID_SHADER_TYPES.has(sh.typeRaw)) {
      for (const mode of lightingModesWithoutRuntimeSupport) {
        if (resolvedModes.includes(mode)) {
          diagnostics.push(
            diagnostic(
              "H0101",
              `\`${mode}\` render mode has no effect for type="${sh.typeRaw}" (ShaderLab 0.1 targets canvas_item and postprocess only)`,
              filename,
              sh.line ?? 1,
            ),
          );
        }
      }
    }

    const vb = sh.vertexBody ?? "";
    const fb = sh.fragmentBody;
    if (sh.vertexBody !== null && vb.trim() === "") {
      diagnostics.push(
        diagnostic(
          "W0301",
          "`<vertex>` block is empty — could be omitted",
          filename,
          sh.line ?? 1,
        ),
      );
    }

    for (const u of sh.uniforms) {
      if (u.hint && !isHintRecognized(u.hint)) {
        diagnostics.push(
          diagnostic(
            "W0201",
            `Unknown \`hint\` value "${u.hint}" — hint will be ignored`,
            filename,
            sh.line ?? 1,
          ),
        );
      }
      const hint = parseHint(u.hint);
      if (hint && hint.kind === "range") {
        const dv = parseDefaultValue(u.type, u.default);
        if (dv !== undefined && !valueInRange(u.type, dv, hint.min, hint.max)) {
          diagnostics.push(
            diagnostic(
              "W0202",
              "`default` value outside `range()` bounds",
              filename,
              sh.line ?? 1,
            ),
          );
        }
      }
    }

    if (VALID_SHADER_TYPES.has(sh.typeRaw)) {
      const misuse = findBuiltinMisuse(sh.typeRaw as ShaderType, vb, fb);
      for (const b of misuse) {
        let suggestion: string | undefined;
        if (b === "SCREEN_TEXTURE" || b === "SCREEN_UV") {
          suggestion = "Use type=\"postprocess\" for SCREEN_TEXTURE / SCREEN_UV";
        } else if (b === "TEXTURE") {
          suggestion = "Use type=\"canvas_item\" for TEXTURE";
        }
        diagnostics.push(
          diagnostic(
            "H0312",
            `'${b}' is not available in type="${sh.typeRaw}"`,
            filename,
            sh.line ?? 1,
            suggestion,
          ),
        );
      }
    }
  }

  return diagnostics;
}
