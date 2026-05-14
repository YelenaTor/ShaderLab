import type { CompilerOutput, ShaderlabAst } from "./types.js";
import { buildCanvasItemShader } from "./templates/canvas_item.js";
import { buildPostprocessShader } from "./templates/postprocess.js";
import { buildSpatialShader } from "./templates/spatial.js";

export function generate(ast: ShaderlabAst): CompilerOutput {
  const shaders = [];
  for (const sh of ast.shaders) {
    switch (sh.type) {
      case "canvas_item":
        shaders.push(buildCanvasItemShader(sh));
        break;
      case "postprocess":
        shaders.push(buildPostprocessShader(sh));
        break;
      case "spatial":
        shaders.push(buildSpatialShader(sh));
        break;
      default: {
        const _exhaustive: never = sh.type;
        void _exhaustive;
        break;
      }
    }
  }
  return { shaders };
}
