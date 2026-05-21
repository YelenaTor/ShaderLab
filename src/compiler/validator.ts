import { findBuiltinMisuse, scanBuiltinStages } from "./builtins.js";
import type { SlabModule, RenderMode, ShaderType } from "./types.js";
import { diagnostic } from "./errors.js";
import type { ShaderlabDiagnostic } from "./errors.js";
import { isHintRecognized, parseDefaultValue, parseHint, valueInRange } from "./hints.js";

const VALID_SHADER_TYPES = new Set<string>(["canvas_item", "canvas_25d", "postprocess", "spatial"]);

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

/** Semantic validation; mutates `ast.frames[].renderModes` from `renderModeTokens`. */
export function validate(ast: SlabModule, filename = "input.slab"): ShaderlabDiagnostic[] {
  const diagnostics: ShaderlabDiagnostic[] = [];

  const seenIds = new Set<string>();
  for (const sh of ast.frames) {
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
        diagnostic("E0201", "Missing `id` attribute on `<shader_frame>`", filename, sh.line ?? 1),
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
        diagnostic("E0203", "Missing `type` attribute on `<shader_frame>`", filename, sh.line ?? 1),
      );
    } else if (!VALID_SHADER_TYPES.has(sh.typeRaw)) {
      diagnostics.push(
        diagnostic(
          "E0203",
          `Unknown \`type\` value "${sh.typeRaw}"`,
          filename,
          sh.line ?? 1,
          'Use type="canvas_item", type="canvas_25d", type="postprocess", or type="spatial"',
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
              `\`${mode}\` render mode has no effect for type="${sh.typeRaw}" (no lighting pipeline for canvas_item, canvas_25d, postprocess, or spatial)`,
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
      const rawHint = u.hint?.trim();
      if (
        (rawHint === "parallax_layer" ||
          rawHint === "layer_depth" ||
          rawHint === "parallax_strength") &&
        u.type !== "float"
      ) {
        diagnostics.push(
          diagnostic(
            "W0201",
            `\`hint="${rawHint}"\` is only valid on \`type="float"\` uniforms — hint will be ignored`,
            filename,
            u.line ?? sh.line ?? 1,
          ),
        );
      } else if (u.hint && !isHintRecognized(u.hint)) {
        diagnostics.push(
          diagnostic(
            "W0201",
            `Unknown \`hint\` value "${u.hint}" — hint will be ignored`,
            filename,
            u.line ?? sh.line ?? 1,
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
              u.line ?? sh.line ?? 1,
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
        } else if (b === "CANVAS_TEXTURE" || b === "CANVAS_UV") {
          suggestion = "Use type=\"spatial\" for CANVAS_TEXTURE / CANVAS_UV (canvas augment mode)";
        } else if (b === "TEXTURE") {
          suggestion = "Use type=\"canvas_item\" or type=\"canvas_25d\" for TEXTURE";
        } else if (
          b === "PARALLAX_UV" ||
          b === "PARALLAX_OFFSET" ||
          b === "LAYER_DEPTH" ||
          b === "PARALLAX_STRENGTH"
        ) {
          suggestion = "Use type=\"canvas_25d\" for first-class 2.5D parallax builtins";
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

    const referencedStages = scanBuiltinStages(vb, fb);
    const referenced = Array.from(referencedStages.combined);
    if (sh.typeRaw === "postprocess") {
        if (!referenced.includes("SCREEN_TEXTURE") && !referenced.includes("SCREEN_UV")) {
          diagnostics.push(
            diagnostic(
              "W0402",
              "Unused `SCREEN_TEXTURE` or `SCREEN_UV` in postprocess frame",
              filename,
              sh.line ?? 1,
            ),
          );
        }
      }

    if (sh.typeRaw === "postprocess" && sh.vertexBody !== null) {
      diagnostics.push(diagnostic("E0405", "`<vertex>` body declared on a `postprocess` frame", filename, sh.line ?? 1));
    }

    if (sh.typeRaw === "spatial") {
      if (sh.mode === null) {
        diagnostics.push(diagnostic("W0402", "`mode` attribute omitted on spatial frame. Defaulting to `standalone`.", filename, sh.line ?? 1));
        sh.mode = "standalone";
      }

      if (sh.mode === "standalone") {
        if (referenced.includes("CANVAS_TEXTURE") || referenced.includes("CANVAS_UV")) {
          diagnostics.push(diagnostic("E0406", "`CANVAS_TEXTURE` or `CANVAS_UV` referenced in a standalone spatial.", filename, sh.line ?? 1));
        }
      } else if (sh.mode === "augment") {
        if (sh.vertexBody !== null) {
          diagnostics.push(diagnostic("E0407", "`<vertex>` body declared on a spatial augment frame.", filename, sh.line ?? 1));
        }
        if (!referenced.includes("CANVAS_TEXTURE") && !referenced.includes("CANVAS_UV")) {
          diagnostics.push(diagnostic("W0403", "Spatial augment does not reference `CANVAS_TEXTURE` or `CANVAS_UV`.", filename, sh.line ?? 1));
        }
      }
    }

    for (const u of sh.uniforms) {
      if (u.deferred && !u.mutable) {
        diagnostics.push(diagnostic("E0403", "`deferred=\"true\"` combined with `mutable=\"false\"`.", filename, u.line ?? sh.line ?? 1));
      }
    }
  }

  return diagnostics;
}

