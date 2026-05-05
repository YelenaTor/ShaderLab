import type { CompilerOutput, ShaderlabAst } from "./types.js";
import { buildCanvasItemShader } from "./templates/canvas_item.js";
import { buildPostprocessShader } from "./templates/postprocess.js";

export function generate(ast: ShaderlabAst): CompilerOutput {
  const shaders = [];
  for (const sh of ast.shaders) {
    if (sh.typeRaw === "canvas_item") {
      shaders.push(buildCanvasItemShader(sh));
    } else if (sh.typeRaw === "postprocess") {
      shaders.push(buildPostprocessShader(sh));
    }
  }
  return { shaders };
}
