import { scanBuiltinStages } from "../builtins.js";
import type { ShaderFrameNode, UniformNode, CompiledShader, ShaderRuntimeMetadata } from "../types.js";
import { glslUniformName, buildUniformBlock, pickBlend } from "./shared.js";

const DEFAULT_LAYER_DEPTH = "1.0";
const DEFAULT_PARALLAX_STRENGTH = "0.05";

function findLayerDepthUniform(uniforms: readonly UniformNode[]): UniformNode | undefined {
  return uniforms.find((u) => {
    const hint = u.hint?.trim();
    return u.type === "float" && (hint === "layer_depth" || hint === "parallax_layer");
  });
}

function findParallaxStrengthUniform(uniforms: readonly UniformNode[]): UniformNode | undefined {
  return uniforms.find((u) => u.type === "float" && u.hint?.trim() === "parallax_strength");
}

export function buildCanvas25dShader(ast: ShaderFrameNode): CompiledShader {
  const vertexSrc = ast.vertexBody ?? "";
  const fragmentSrc = ast.fragmentBody;
  const stages = scanBuiltinStages(vertexSrc, fragmentSrc);
  const vb = stages.vertex;
  const fb = stages.fragment;

  const layerDepthUniform = findLayerDepthUniform(ast.uniforms);
  const parallaxStrengthUniform = findParallaxStrengthUniform(ast.uniforms);
  const layerDepthExpr = layerDepthUniform ? glslUniformName(layerDepthUniform.name) : DEFAULT_LAYER_DEPTH;
  const parallaxStrengthExpr = parallaxStrengthUniform
    ? glslUniformName(parallaxStrengthUniform.name)
    : DEFAULT_PARALLAX_STRENGTH;

  const vs: string[] = ["#version 300 es", "precision mediump float;"];
  vs.push("uniform float u_slab_time;");
  vs.push("#define TIME u_slab_time");
  if (vb.has("RESOLUTION")) {
    vs.push("uniform vec2 u_slab_resolution;");
    vs.push("#define RESOLUTION u_slab_resolution");
  }
  if (layerDepthUniform) {
    vs.push(`uniform float ${layerDepthExpr};`);
  }
  if (parallaxStrengthUniform) {
    vs.push(`uniform float ${parallaxStrengthExpr};`);
  }
  vs.push("out vec2 UV;");
  vs.push("out vec2 PARALLAX_UV;");
  vs.push("out vec2 PARALLAX_OFFSET;");
  vs.push("out float LAYER_DEPTH;");
  vs.push("out float PARALLAX_STRENGTH;");
  vs.push("out vec4 VERTEX_COLOR;");
  vs.push("void main() {");
  vs.push(
    "  vec2 slab_pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;",
  );
  vs.push("  UV = slab_pos * 0.5 + 0.5;");
  vs.push(`  LAYER_DEPTH = ${layerDepthExpr};`);
  vs.push(`  PARALLAX_STRENGTH = ${parallaxStrengthExpr};`);
  vs.push("  PARALLAX_OFFSET = vec2(LAYER_DEPTH * TIME * PARALLAX_STRENGTH, 0.0);");
  vs.push("  PARALLAX_UV = UV + PARALLAX_OFFSET;");
  vs.push("  VERTEX_COLOR = vec4(1.0);");
  vs.push("  gl_Position = vec4(slab_pos, 0.0, 1.0);");
  if (vertexSrc.trim() !== "") {
    vs.push(vertexSrc);
  }
  vs.push("}");
  const vertexGlsl = vs.join("\n");

  const userUniforms = buildUniformBlock(ast.uniforms, 0);
  const uniformMeta = userUniforms.meta;
  const userUniformDeclFs = userUniforms.decls;
  let texUnit = userUniforms.nextTexUnit;

  const fs: string[] = [
    "#version 300 es",
    "precision mediump float;",
    "in vec2 UV;",
    "in vec2 PARALLAX_UV;",
    "in vec2 PARALLAX_OFFSET;",
    "in float LAYER_DEPTH;",
    "in float PARALLAX_STRENGTH;",
    "in vec4 VERTEX_COLOR;",
    "out vec4 fragColor;",
  ];
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
    [
      "UV",
      "PARALLAX_UV",
      "PARALLAX_OFFSET",
      "LAYER_DEPTH",
      "PARALLAX_STRENGTH",
      "COLOR",
      "TEXTURE",
      "VERTEX_COLOR",
      "TIME",
      "RESOLUTION",
    ].includes(b),
  );
  for (const builtin of ["PARALLAX_UV", "PARALLAX_OFFSET", "LAYER_DEPTH", "PARALLAX_STRENGTH", "TIME"]) {
    if (!referenced.includes(builtin)) {
      referenced.push(builtin);
    }
  }

  const metadata: ShaderRuntimeMetadata = {
    shaderType: "canvas_25d",
    referencedBuiltins: referenced,
    uniforms: uniformMeta,
    blendMode: pickBlend(ast.renderModes),
    cullDisabled: ast.renderModes.includes("cull_disabled"),
    textureBuiltinUnit,
  };

  return {
    id: ast.id,
    exportName: ast.id,
    vertexGlsl,
    fragmentGlsl,
    metadata,
  };
}
