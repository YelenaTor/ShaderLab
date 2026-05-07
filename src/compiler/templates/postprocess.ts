import { scanBuiltinStages } from "../builtins.js";
import type { CompiledShader, ShaderAst, ShaderRuntimeMetadata } from "../types.js";
import { buildUniformBlock, pickBlend } from "./shared.js";

export function buildPostprocessShader(sh: ShaderAst): CompiledShader {
  const vertexSrc = sh.vertexBody ?? "";
  const fragmentSrc = sh.fragmentBody;
  const stages = scanBuiltinStages(vertexSrc, fragmentSrc);
  const vb = stages.vertex;
  const fb = stages.fragment;

  const vs: string[] = ["#version 300 es", "precision mediump float;"];
  if (vb.has("TIME")) {
    vs.push("uniform float u_slab_time;");
    vs.push("#define TIME u_slab_time");
  }
  if (vb.has("RESOLUTION")) {
    vs.push("uniform vec2 u_slab_resolution;");
    vs.push("#define RESOLUTION u_slab_resolution");
  }
  vs.push("out vec2 UV;");
  vs.push("void main() {");
  vs.push(
    "  vec2 slab_pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;",
  );
  vs.push("  UV = slab_pos * 0.5 + 0.5;");
  vs.push("  gl_Position = vec4(slab_pos, 0.0, 1.0);");
  if (vertexSrc.trim() !== "") {
    vs.push(vertexSrc);
  }
  vs.push("}");
  const vertexGlsl = vs.join("\n");

  const userUniforms = buildUniformBlock(sh.uniforms, 0);
  const uniformMeta = userUniforms.meta;
  const userUniformDeclFs = userUniforms.decls;
  const screenUnit = userUniforms.nextTexUnit;
  const fs: string[] = [
    "#version 300 es",
    "precision mediump float;",
    "in vec2 UV;",
    "out vec4 fragColor;",
    "#define SCREEN_UV UV",
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
  fs.push("uniform sampler2D u_slab_screen_texture;");
  fs.push("#define SCREEN_TEXTURE u_slab_screen_texture");
  fs.push("void main() {");
  fs.push("  vec4 COLOR = vec4(0.0);");
  for (const line of fragmentSrc.split("\n")) {
    fs.push(line);
  }
  fs.push("  fragColor = COLOR;");
  fs.push("}");
  const fragmentGlsl = fs.join("\n");

  const referenced = [...stages.combined].filter((b) =>
    ["SCREEN_UV", "SCREEN_TEXTURE", "COLOR", "TIME", "RESOLUTION", "UV"].includes(b),
  );

  const metadata: ShaderRuntimeMetadata = {
    shaderType: "postprocess",
    referencedBuiltins: referenced,
    uniforms: uniformMeta,
    blendMode: pickBlend(sh.renderModes),
    cullDisabled: sh.renderModes.includes("cull_disabled"),
    screenTextureUnit: screenUnit,
  };

  return {
    id: sh.id,
    exportName: sh.id,
    vertexGlsl,
    fragmentGlsl,
    metadata,
  };
}
