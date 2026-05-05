import { scanBuiltinStages } from "../builtins.js";
import type { CompiledShader, ShaderAst, ShaderRuntimeMetadata, UniformBindingMeta } from "../types.js";
import { parseHint } from "../hints.js";

function glslUniformName(userName: string): string {
  const safe = userName.replace(/[^a-zA-Z0-9_]/g, "_");
  return `u_${safe}`;
}

function pickBlend(
  modes: import("../types.js").RenderMode[],
): "normal" | "add" | "multiply" | "premult_alpha" | null {
  if (modes.includes("blend_add")) return "add";
  if (modes.includes("blend_multiply")) return "multiply";
  if (modes.includes("blend_premult_alpha")) return "premult_alpha";
  return null;
}

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

  let texUnit = 0;
  const uniformMeta: UniformBindingMeta[] = [];
  const userUniformDeclFs: string[] = [];

  for (const u of sh.uniforms) {
    const glsl = glslUniformName(u.name);
    const glslType =
      u.type === "sampler2D"
        ? "sampler2D"
        : u.type === "bool"
          ? "bool"
          : u.type;
    userUniformDeclFs.push(`uniform ${glslType} ${glsl};`);
    const hintParsed = parseHint(u.hint);
    const range =
      hintParsed && hintParsed.kind === "range"
        ? ([hintParsed.min, hintParsed.max] as const)
        : null;
    const tu = u.type === "sampler2D" ? texUnit++ : null;
    const mousePosition =
      hintParsed?.kind === "named" && hintParsed.name === "mouse_position";
    uniformMeta.push({
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

  const screenUnit = texUnit++;
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
