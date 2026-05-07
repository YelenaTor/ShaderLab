import { parseHint } from "../hints.js";
import type { BlendMode, RenderMode, UniformAst, UniformBindingMeta } from "../types.js";

/**
 * GLSL uniform symbol for a slab uniform name.
 * Uniform names are validated in the parser (`E0304`), so no character sanitization is done here.
 */
export function glslUniformName(userName: string): string {
  return `u_${userName}`;
}

export function pickBlend(modes: readonly RenderMode[]): BlendMode | null {
  if (modes.includes("blend_add")) return "add";
  if (modes.includes("blend_multiply")) return "multiply";
  if (modes.includes("blend_premult_alpha")) return "premult_alpha";
  return null;
}

export interface UniformBuildResult {
  meta: UniformBindingMeta[];
  decls: string[];
  /** Next free texture unit index after user uniforms. */
  nextTexUnit: number;
}

export function buildUniformBlock(
  uniforms: readonly UniformAst[],
  startTexUnit = 0,
): UniformBuildResult {
  let texUnit = startTexUnit;
  const meta: UniformBindingMeta[] = [];
  const decls: string[] = [];

  for (const u of uniforms) {
    const glsl = glslUniformName(u.name);
    const glslType =
      u.type === "sampler2D" ? "sampler2D" : u.type === "bool" ? "bool" : u.type;
    decls.push(`uniform ${glslType} ${glsl};`);
    const hintParsed = parseHint(u.hint);
    const range =
      hintParsed && hintParsed.kind === "range"
        ? ([hintParsed.min, hintParsed.max] as const)
        : null;
    const tu = u.type === "sampler2D" ? texUnit++ : null;
    const mousePosition = hintParsed?.kind === "named" && hintParsed.name === "mouse_position";
    meta.push({
      name: u.name,
      glslName: glsl,
      slabType: u.type,
      hint: u.hint,
      default: u.default,
      range,
      textureUnit: tu,
      mousePosition,
    });
  }

  return { meta, decls, nextTexUnit: texUnit };
}
