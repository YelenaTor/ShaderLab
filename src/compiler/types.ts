/**
 * Internal AST and compiler output shapes — see docs/LANGUAGE.md.
 * The compiler layer must not import from vite/, adapters/, or cli/.
 */

export type ShaderType = "canvas_item" | "postprocess" | "spatial";

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

/** Blend mode derived from `render_mode` blend tokens (mutually exclusive in valid slabs). */
export type BlendMode = "add" | "multiply" | "premult_alpha";

export interface UniformNode {
  name: string;
  type: UniformType;
  hint: string | null;
  default: string | null;
  /** `true` = overridable at use site; `false` = sealed. */
  mutable: boolean;
  /** `true` = no default available, must be provided at use site. Implies `mutable: true`. */
  deferred: boolean;
  /** Best-effort line of `<uniform>` start for diagnostics. */
  line?: number;
}

export interface ShaderFrameNode {
  id: string;
  /** Raw `type` attribute (may be invalid until validated). */
  typeRaw: string;
  type: ShaderType;
  /** Spatial mode: `"standalone"` | `"augment"` | `null` (non-spatial types). */
  mode: "standalone" | "augment" | null;
  /** Raw tokens from `render_mode` before semantic validation. */
  renderModeTokens: string[];
  /** Validated render modes (filled by validator). */
  renderModes: RenderMode[];
  uniforms: UniformNode[];
  /** CDATA body of `<vertex>`, or `null` if omitted. */
  vertexBody: string | null;
  /** CDATA body of `<fragment>` (required in valid documents). */
  fragmentBody: string;
  /** Best-effort line of `<shader_frame>` start for diagnostics. */
  line?: number;
}

export interface SlabModule {
  /** Value of root `<shaderlab version="...">`. */
  version: string;
  frames: ShaderFrameNode[];
}

export interface OverrideNode {
  name: string;
  value: unknown;
}

export interface AugmentNode {
  kind: 'augment';
  frameId: string;
  sourceFile: string;
  overrides: OverrideNode[];
  loadIndex: number;
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
  /** Whether this uniform is overridable at the use site. */
  mutable: boolean;
  /** Whether this uniform requires consumer assignment at the use site. */
  deferred: boolean;
}

/** Serializable metadata consumed by `createShaderInstance`. */
export interface ShaderRuntimeMetadata {
  shaderType: ShaderType;
  referencedBuiltins: readonly string[];
  uniforms: readonly UniformBindingMeta[];
  blendMode: BlendMode | null;
  cullDisabled: boolean;
  /** WebGL texture unit for builtin `TEXTURE` (`canvas_item` only). */
  textureBuiltinUnit?: number | null;
  /** WebGL texture unit for builtin `SCREEN_TEXTURE` (`postprocess` only). */
  screenTextureUnit?: number | null;
  /**
   * When `true`, `spatial` samples a paired `canvas_item` via `CANVAS_TEXTURE` / `CANVAS_UV`;
   * runtime `attach` must pass `{ feedFrom: canvasItemInstance }`.
   */
  requiresCanvasFeed?: boolean;
  /** WebGL texture unit for builtin `CANVAS_TEXTURE` (`spatial` augment only). */
  canvasTextureUnit?: number | null;
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
