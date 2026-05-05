import { XMLParser } from "fast-xml-parser";
import type { ShaderAst, ShaderlabAst, ShaderType, UniformAst, UniformType } from "./types.js";
import { diagnostic } from "./errors.js";
import type { ShaderlabDiagnostic } from "./errors.js";

export interface ParseResult {
  ast: ShaderlabAst;
  diagnostics: ShaderlabDiagnostic[];
}

const UNIFORM_TYPES = new Set<UniformType>([
  "float",
  "int",
  "bool",
  "vec2",
  "vec3",
  "vec4",
  "sampler2D",
]);

const SHADER_TYPES = new Set<ShaderType>(["canvas_item", "postprocess"]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  allowBooleanAttributes: true,
});

export function parse(src: string, filename = "input.slab"): ParseResult {
  const diagnostics: ShaderlabDiagnostic[] = [];
  let root: Record<string, unknown>;
  try {
    root = xmlParser.parse(src) as Record<string, unknown>;
  } catch {
    diagnostics.push(diagnostic("E0101", "Malformed XML document", filename, 1));
    return { ast: { version: "", shaders: [] }, diagnostics };
  }

  const lab = root.shaderlab ?? root.shaderLab;
  if (!lab || typeof lab !== "object") {
    diagnostics.push(diagnostic("E0101", "Missing root `<shaderlab>` element", filename, 1));
    return { ast: { version: "", shaders: [] }, diagnostics };
  }

  const labObj = lab as Record<string, unknown>;
  const versionRaw = labObj["@_version"];
  const version = typeof versionRaw === "string" ? versionRaw.trim() : "";
  if (!version) {
    diagnostics.push(
      diagnostic("E0101", "Missing `version` attribute on root `<shaderlab>` element", filename, 1),
    );
  }

  const shadersRaw = labObj.shader;
  const shaderNodes = toArray(shadersRaw);
  const shaders: ShaderAst[] = [];

  for (const node of shaderNodes) {
    if (!node || typeof node !== "object") continue;
    const s = node as Record<string, unknown>;
    const id = typeof s["@_id"] === "string" ? s["@_id"].trim() : "";
    const typeRaw = typeof s["@_type"] === "string" ? s["@_type"].trim() : "";
    const renderModeStr =
      typeof s["@_render_mode"] === "string"
        ? s["@_render_mode"]
        : typeof s["@_renderMode"] === "string"
          ? s["@_renderMode"]
          : "";

    const type: ShaderType = SHADER_TYPES.has(typeRaw as ShaderType)
      ? (typeRaw as ShaderType)
      : "canvas_item";

    const uniformsBlock = s.uniforms;
    const uniforms = parseUniforms(uniformsBlock, filename, diagnostics);

    const hasVertexKey = Object.prototype.hasOwnProperty.call(s, "vertex");
    const vertexRaw = extractCDATA(s.vertex);
    const vertexBody = hasVertexKey ? vertexRaw : null;

    const fragmentBody = extractCDATA(s.fragment);

    const renderModeTokens = renderModeStr
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);

    shaders.push({
      id,
      typeRaw,
      type,
      renderModeTokens,
      renderModes: [],
      uniforms,
      vertexBody,
      fragmentBody,
      line: 1,
    });
  }

  return { ast: { version, shaders }, diagnostics };
}

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function parseUniforms(
  uniformsBlock: unknown,
  filename: string,
  diagnostics: ShaderlabDiagnostic[],
): UniformAst[] {
  if (uniformsBlock == null) return [];
  if (typeof uniformsBlock !== "object") return [];
  const u = uniformsBlock as Record<string, unknown>;
  const rawList = u.uniform;
  const list = toArray(rawList);
  const out: UniformAst[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o["@_name"] === "string" ? o["@_name"].trim() : "";
    const typeStr = typeof o["@_type"] === "string" ? o["@_type"].trim() : "";
    const hint = typeof o["@_hint"] === "string" ? o["@_hint"].trim() : null;
    const def =
      typeof o["@_default"] === "string"
        ? o["@_default"].trim()
        : o["@_default"] != null
          ? String(o["@_default"])
          : null;

    if (!name) {
      diagnostics.push(diagnostic("E0302", "Missing `name` on `<uniform>`", filename, 1));
      continue;
    }
    if (!UNIFORM_TYPES.has(typeStr as UniformType)) {
      diagnostics.push(
        diagnostic("E0303", `Unknown uniform \`type\` "${typeStr}"`, filename, 1),
      );
      continue;
    }
    out.push({
      name,
      type: typeStr as UniformType,
      hint: hint && hint.length > 0 ? hint : null,
      default: def && def.length > 0 ? def : null,
    });
  }
  return out;
}

function extractCDATA(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node !== "object") return "";
  const o = node as Record<string, unknown>;
  if (typeof o["#text"] === "string") return o["#text"];
  if (Array.isArray(o["#text"])) {
    return o["#text"].map((x) => (typeof x === "string" ? x : String(x))).join("");
  }
  return "";
}
