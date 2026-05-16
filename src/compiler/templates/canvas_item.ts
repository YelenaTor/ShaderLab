import { scanBuiltinStages } from "../builtins.js";
import type { CompiledShader, ShaderAst, ShaderRuntimeMetadata, UniformAst } from "../types.js";
import { glslUniformName, buildUniformBlock, pickBlend } from "./shared.js";

/** Documented in LANGUAGE.md — horizontal parallax scale for PARALLAX_UV. */
const PARALLAX_TIME_SCALE = 0.05;

function findParallaxLayerUniform(uniforms: readonly UniformAst[]): UniformAst | undefined {
  return uniforms.find((u) => u.type === "float" && u.hint?.trim() === "parallax_layer");
}

export function buildCanvasItemShader(sh: ShaderAst): CompiledShader {
  const vertexSrc = sh.vertexBody ?? "";
  const fragmentSrc = sh.fragmentBody;
  const stages = scanBuiltinStages(vertexSrc, fragmentSrc);
  const vb = stages.vertex;
  const fb = stages.fragment;

  const parallaxUniform = findParallaxLayerUniform(sh.uniforms);
  const wantsParallax = stages.combined.has("PARALLAX_UV") || parallaxUniform != null;
  const parallaxGlsl = parallaxUniform ? glslUniformName(parallaxUniform.name) : null;

  const vs: string[] = ["#version 300 es", "precision mediump float;"];
  if (vb.has("TIME") || wantsParallax) {
    vs.push("uniform float u_slab_time;");
    vs.push("#define TIME u_slab_time");
  }
  if (vb.has("RESOLUTION")) {
    vs.push("uniform vec2 u_slab_resolution;");
    vs.push("#define RESOLUTION u_slab_resolution");
  }
  if (parallaxGlsl) {
    vs.push(`uniform float ${parallaxGlsl};`);
  }
  vs.push("out vec2 UV;");
  if (wantsParallax) {
    vs.push("out vec2 PARALLAX_UV;");
  }
  vs.push("out vec4 VERTEX_COLOR;");
  vs.push("void main() {");
  vs.push(
    "  vec2 slab_pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;",
  );
  vs.push("  UV = slab_pos * 0.5 + 0.5;");
  if (wantsParallax) {
    if (parallaxGlsl) {
      vs.push(
        `  PARALLAX_UV = UV + vec2(${parallaxGlsl} * TIME * ${PARALLAX_TIME_SCALE}, 0.0);`,
      );
    } else {
      vs.push(`  PARALLAX_UV = UV + vec2(TIME * ${PARALLAX_TIME_SCALE}, 0.0);`);
    }
  }
  vs.push("  VERTEX_COLOR = vec4(1.0);");
  vs.push("  gl_Position = vec4(slab_pos, 0.0, 1.0);");
  if (vertexSrc.trim() !== "") {
    vs.push(vertexSrc);
  }
  vs.push("}");
  const vertexGlsl = vs.join("\n");

  const userUniforms = buildUniformBlock(sh.uniforms, 0);
  const uniformMeta = userUniforms.meta;
  const userUniformDeclFs = userUniforms.decls;
  let texUnit = userUniforms.nextTexUnit;

  const fs: string[] = ["#version 300 es", "precision mediump float;", "in vec2 UV;"];
  if (wantsParallax) {
    fs.push("in vec2 PARALLAX_UV;");
  }
  fs.push("in vec4 VERTEX_COLOR;", "out vec4 fragColor;");
  for (const line of userUniformDeclFs) {
    fs.push(line);
  }
  if (fb.has("TIME")) {
    fs.push("uniform float u_slab_time;");
    fs.push("#define TIME u_slab_time");
  }
  if (fb.has("RESOLUTION")) {
    fs.push("uniform vec2 u_slab_resolution;");
    fs.push("#define RESOLUTION u_slab_resolution");
  }
  let textureBuiltinUnit: number | null = null;
  if (fb.has("TEXTURE")) {
    textureBuiltinUnit = texUnit++;
    fs.push("uniform sampler2D u_slab_texture_builtin;");
    fs.push("#define TEXTURE u_slab_texture_builtin");
  }
  fs.push("void main() {");
  fs.push("  vec4 COLOR = vec4(0.0);");
  for (const line of fragmentSrc.split("\n")) {
    fs.push(line);
  }
  fs.push("  fragColor = COLOR;");
  fs.push("}");
  const fragmentGlsl = fs.join("\n");

  const referenced = [...stages.combined].filter((b) =>
    ["UV", "PARALLAX_UV", "COLOR", "TEXTURE", "VERTEX_COLOR", "TIME", "RESOLUTION"].includes(b),
  );
  if (wantsParallax && !referenced.includes("PARALLAX_UV")) {
    referenced.push("PARALLAX_UV");
  }

  const metadata: ShaderRuntimeMetadata = {
    shaderType: "canvas_item",
    referencedBuiltins: referenced,
    uniforms: uniformMeta,
    blendMode: pickBlend(sh.renderModes),
    cullDisabled: sh.renderModes.includes("cull_disabled"),
    textureBuiltinUnit,
  };

  return {
    id: sh.id,
    exportName: sh.id,
    vertexGlsl,
    fragmentGlsl,
    metadata,
  };
}
