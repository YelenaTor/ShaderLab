import type { ShaderType } from "./types.js";

/** Builtin token names — semantics per shader kind: docs/LANGUAGE.md (“Shader types and builtins”). Longest match first for scanning. */
export const ALL_BUILTINS_ORDERED = [
  "SCREEN_TEXTURE",
  "CANVAS_TEXTURE",
  "SCREEN_UV",
  "CANVAS_UV",
  "VERTEX_COLOR",
  "WORLD_POSITION",
  "VIEW_DIRECTION",
  "NORMAL_MAP",
  "RESOLUTION",
  "ROUGHNESS",
  "METALLIC",
  "EMISSION",
  "ALBEDO",
  "NORMAL",
  "TANGENT",
  "TEXTURE",
  "COLOR",
  "TIME",
  "UV",
] as const;

const CANVAS_ITEM = new Set<string>([
  "UV",
  "COLOR",
  "TEXTURE",
  "VERTEX_COLOR",
  "TIME",
  "RESOLUTION",
]);

const POSTPROCESS = new Set<string>(["SCREEN_UV", "SCREEN_TEXTURE", "COLOR", "TIME", "RESOLUTION"]);

const SPATIAL = new Set<string>([
  "UV",
  "COLOR",
  "VERTEX_COLOR",
  "TIME",
  "RESOLUTION",
  "CANVAS_UV",
  "CANVAS_TEXTURE",
]);

/** Returns referenced builtins found in source (word-boundary scan). */
export function scanBuiltins(source: string): Set<string> {
  const found = new Set<string>();
  for (const name of ALL_BUILTINS_ORDERED) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`);
    if (re.test(source)) {
      found.add(name);
    }
  }
  return found;
}

export function scanBuiltinStages(vertexBody: string, fragmentBody: string): {
  vertex: Set<string>;
  fragment: Set<string>;
  combined: Set<string>;
} {
  const v = scanBuiltins(vertexBody);
  const f = scanBuiltins(fragmentBody);
  const combined = new Set<string>([...v, ...f]);
  return { vertex: v, fragment: f, combined };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function builtinsAllowedForType(type: ShaderType): Set<string> {
  if (type === "canvas_item") return CANVAS_ITEM;
  if (type === "postprocess") return POSTPROCESS;
  if (type === "spatial") return SPATIAL;
  throw new Error(`unsupported shader type: ${type}`);
}

/** Hazards for builtins used in wrong shader type (H0312). */
export function findBuiltinMisuse(type: ShaderType, vertexBody: string, fragmentBody: string): string[] {
  const combined = `${vertexBody}\n${fragmentBody}`;
  const used = scanBuiltins(combined);
  const allowed = builtinsAllowedForType(type);
  const bad: string[] = [];
  for (const b of used) {
    if (!allowed.has(b)) {
      bad.push(b);
    }
  }
  return bad.sort();
}
