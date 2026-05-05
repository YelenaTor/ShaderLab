/**
 * Internal AST and compiler output shapes — see docs/LANGUAGE.md.
 * The compiler layer must not import from vite/, adapters/, or cli/.
 */

export type ShaderType = "canvas_item" | "postprocess";

export type RenderMode =
  | "unshaded"
  | "cull_disabled"
  | "blend_add"
  | "blend_multiply"
  | "blend_premult_alpha"
  | "depth_draw_never"
  | "diffuse_toon"
  | "specular_disabled";

export type UniformType =
  | "float"
  | "int"
  | "bool"
  | "vec2"
  | "vec3"
  | "vec4"
  | "sampler2D";

/** Raw `hint` attribute value from `<uniform>` (e.g. `range(0.0, 5.0)`). */
export interface UniformAst {
  name: string;
  type: UniformType;
  hint: string | null;
  default: string | null;
}

export interface ShaderAst {
  id: string;
  /** Raw `type` attribute (may be invalid until validated). */
  typeRaw: string;
  type: ShaderType;
  /** Raw tokens from `render_mode` before semantic validation. */
  renderModeTokens: string[];
  /** Validated render modes (filled by validator). */
  renderModes: RenderMode[];
  uniforms: UniformAst[];
  /** CDATA body of `<vertex>`, or `null` if omitted. */
  vertexBody: string | null;
  /** CDATA body of `<fragment>` (required in valid documents). */
  fragmentBody: string;
  /** Best-effort line of `<shader>` start for diagnostics. */
  line?: number;
}

export interface ShaderlabAst {
  /** Value of root `<shaderlab version="...">`. */
  version: string;
  shaders: ShaderAst[];
}

/** Uniform binding plan for runtime / codegen. */
export interface UniformBindingMeta {
  name: string;
  glslName: string;
  slabType: UniformType;
  hint: string | null;
  default: string | null;
  range: readonly [number, number] | null;
  textureUnit: number | null;
  mousePosition: boolean;
}

/** Serializable metadata consumed by `createShaderInstance`. */
export interface ShaderRuntimeMetadata {
  shaderType: ShaderType;
  referencedBuiltins: readonly string[];
  uniforms: readonly UniformBindingMeta[];
  blendMode: "normal" | "add" | "multiply" | "premult_alpha" | null;
  cullDisabled: boolean;
  /** WebGL texture unit for builtin `TEXTURE` (`canvas_item` only). */
  textureBuiltinUnit?: number | null;
  /** WebGL texture unit for builtin `SCREEN_TEXTURE` (`postprocess` only). */
  screenTextureUnit?: number | null;
}

/** Per-shader codegen result (GLSL + metadata). */
export interface CompiledShader {
  id: string;
  exportName: string;
  vertexGlsl: string;
  fragmentGlsl: string;
  metadata: ShaderRuntimeMetadata;
}

export interface CompilerOutput {
  shaders: CompiledShader[];
}
