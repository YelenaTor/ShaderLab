import type { CompilerOutput, ShaderRuntimeMetadata } from "../compiler/types.js";

function mutableUniformNames(metadata: ShaderRuntimeMetadata): string[] {
  return metadata.uniforms
    .filter((u) => u.mutable || u.deferred)
    .map((u) => u.name);
}

/** Emits the JS module body for a compiled `.slab` library. */
export function emitSlabModule(output: CompilerOutput): string {
  const pipelineEntries: string[] = [];
  const frameEntries: string[] = [];
  for (let order = 0; order < output.shaders.length; order++) {
    const sh = output.shaders[order]!;
    const mode =
      sh.metadata.shaderType === "spatial"
        ? sh.metadata.requiresCanvasFeed
          ? "augment"
          : "standalone"
        : null;
    const mutableUniforms = mutableUniformNames(sh.metadata);
    pipelineEntries.push(
      `  { id: ${JSON.stringify(sh.id)}, shaderType: ${JSON.stringify(sh.metadata.shaderType)}, mode: ${mode === null ? "null" : JSON.stringify(mode)}, order: ${order}, mutableUniforms: ${JSON.stringify(mutableUniforms)} }`,
    );
    const payload = {
      shaderId: sh.id,
      vertexSource: sh.vertexGlsl,
      fragmentSource: sh.fragmentGlsl,
      metadata: sh.metadata,
    };
    frameEntries.push(
      `  ${JSON.stringify(sh.id)}: ${JSON.stringify(payload)}`,
    );
  }

  const lines: string[] = [];
  lines.push(`import { createShaderInstance } from "@yoruxiii/shaderlab/internal";`);
  lines.push(`const __frameConfigs = {\n${frameEntries.join(",\n")}\n};`);
  lines.push(
    `export const __framePipeline = Object.freeze([\n${pipelineEntries.join(",\n")}\n]);`,
  );
  lines.push(`export const __slabFrameIds = Object.freeze(Object.keys(__frameConfigs));`);
  lines.push(`
export function __invokeSlabFrame(frameId, options) {
  const cfg = __frameConfigs[frameId];
  if (!cfg) {
    throw new Error(\`[shaderlab] Unknown frame "\${frameId}" in this .slab library\`);
  }
  return createShaderInstance(cfg, options ?? {});
}

const __slabLibrary = { __invokeSlabFrame, __slabFrameIds, __framePipeline };
export default __slabLibrary;
`);
  lines.push(`
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    const next = mod?.__frameConfigs;
    if (!next) return;
    Object.assign(__frameConfigs, next);
  });
}
`);
  return lines.join("\n");
}
