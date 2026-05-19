import { XMLParser } from "fast-xml-parser";
import type { ShaderFrameNode, SlabModule, ShaderType, UniformNode, UniformType } from "./types.js";
import { diagnostic } from "./errors.js";
import type { ShaderlabDiagnostic } from "./errors.js";
import { buildLineIndex, findShaderLines, findUniformLines } from "./source-locations.js";

export interface ParseResult {
  ast: SlabModule;
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

const SHADER_TYPES = new Set<ShaderType>(["canvas_item", "postprocess", "spatial"]);

/** Same shape as shader `id`; uniform names must match so GLSL `u_*` names stay aligned with slab identifiers. */
const UNIFORM_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const VALID_MODES = new Set(["standalone", "augment"]);

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
    return { ast: { version: "", frames: [] }, diagnostics };
  }

  const lab = root.shaderlab ?? root.shaderLab;
  if (!lab || typeof lab !== "object") {
    diagnostics.push(diagnostic("E0101", "Missing root `<shaderlab>` element", filename, 1));
    return { ast: { version: "", frames: [] }, diagnostics };
  }

  const labObj = lab as Record<string, unknown>;
  const versionRaw = labObj["@_version"];
  const version = typeof versionRaw === "string" ? versionRaw.trim() : "";
  if (!version) {
    diagnostics.push(
      diagnostic("E0101", "Missing `version` attribute on root `<shaderlab>` element", filename, 1),
    );
  } else if (version !== "2.0") {
    diagnostics.push(diagnostic("E0402", `\`version="${version}"\` root element. Must be \`version="2.0"\`.`, filename, 1));
  }

  // Check for legacy `<shader>` tags and emit E0401.
  const oldNodes = toArray(labObj.shader);
  if (oldNodes.length > 0) {
    diagnostics.push(
      diagnostic(
        "E0401",
        "`<shader>` element found. Not valid in schema v2.0.",
        filename,
        1,
        "Replace <shader> with <shader_frame> and version=\"2.0\" — see NEW_API.md",
      ),
    );
  }

  const newNodes = toArray(labObj.shader_frame).map((n) => ({ node: n, tagName: "shader_frame" as const }));

  const lineIndex = buildLineIndex(src);
  const shaderLines = findShaderLines(src, lineIndex);
  const uniformLines = findUniformLines(src, lineIndex);

  // Merge in document order using regex-scanned line positions.
  // shaderLines contains lines for ALL <shader…> tags in document order.
  // We pair each tagged node to its scanned line and sort.
  type TaggedEntry = { node: unknown; tagName: "shader" | "shader_frame"; origIndex: number };
  const allEntries: TaggedEntry[] = [];
  let newIdx = 0;

  const tagTypeRe = /<shader_frame\b/g;
  while (tagTypeRe.exec(src) !== null) {
    if (newIdx < newNodes.length) {
      allEntries.push({ node: newNodes[newIdx]!.node, tagName: "shader_frame", origIndex: newIdx });
      newIdx++;
    }
  }

  const frames: ShaderFrameNode[] = [];

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i]!;
    const node = entry.node;
    const scanIndex = entry.origIndex;
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

    // Fallback keeps `ShaderAst.type` populated for invalid `typeRaw`; validator emits E0203 and compile skips codegen.
    const type: ShaderType = SHADER_TYPES.has(typeRaw as ShaderType)
      ? (typeRaw as ShaderType)
      : "canvas_item";

    const shaderLine = shaderLines[scanIndex] ?? 1;

    const uniformsBlock = s.uniforms;
    const uniforms = parseUniforms(
      uniformsBlock,
      filename,
      diagnostics,
      uniformLines[scanIndex] ?? [],
      shaderLine,
    );

    const hasVertexKey = Object.prototype.hasOwnProperty.call(s, "vertex");
    const vertexRaw = extractCDATA(s.vertex);
    const vertexBody = hasVertexKey ? vertexRaw : null;

    const fragmentBody = extractCDATA(s.fragment);

    const renderModeTokens = renderModeStr
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);

    let mode: "standalone" | "augment" | null = null;
    const modeRaw = typeof s["@_mode"] === "string" ? s["@_mode"].trim() : "";
    if (modeRaw && VALID_MODES.has(modeRaw)) {
      mode = modeRaw as "standalone" | "augment";
    } else if (modeRaw) {
      // Unknown mode value — will be caught by validator.
      mode = null;
    } else {
      // Default for spatial is standalone; null for others.
      // Missing mode on spatial is caught by validator W0402.
      mode = type === "spatial" ? "standalone" : null;
    }

    frames.push({
      id,
      typeRaw,
      type,
      mode,
      renderModeTokens,
      renderModes: [],
      uniforms,
      vertexBody,
      fragmentBody,
      line: shaderLine,
    });
  }

  return { ast: { version, frames }, diagnostics };
}

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}



function parseUniforms(
  uniformsBlock: unknown,
  filename: string,
  diagnostics: ShaderlabDiagnostic[],
  linesForThisShader: readonly number[],
  shaderLine: number,
): UniformNode[] {
  if (uniformsBlock == null) return [];
  if (typeof uniformsBlock !== "object") return [];
  const u = uniformsBlock as Record<string, unknown>;
  const rawList = u.uniform;
  const list = toArray(rawList);
  const out: UniformNode[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const uline = linesForThisShader[i] ?? shaderLine ?? 1;
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

    // Parse mutable and deferred attributes.
    const mutableRaw = typeof o["@_mutable"] === "string" ? o["@_mutable"].trim() : "";
    const deferredRaw = typeof o["@_deferred"] === "string" ? o["@_deferred"].trim() : "";
    
    const deferred = deferredRaw === "true";
    // deferred implies mutable: true, otherwise respect the parsed mutable value.
    const mutable = deferred ? true : mutableRaw === "true";

    if (!name) {
      diagnostics.push(diagnostic("E0302", "Missing `name` on `<uniform>`", filename, uline));
      continue;
    }
    if (!UNIFORM_NAME_RE.test(name)) {
      diagnostics.push(
        diagnostic(
          "E0304",
          `Invalid uniform \`name\` "${name}" — use letters, digits, underscore only`,
          filename,
          uline,
        ),
      );
      continue;
    }
    if (!UNIFORM_TYPES.has(typeStr as UniformType)) {
      diagnostics.push(
        diagnostic("E0303", `Unknown uniform \`type\` "${typeStr}"`, filename, uline),
      );
      continue;
    }
    out.push({
      name,
      type: typeStr as UniformType,
      hint: hint && hint.length > 0 ? hint : null,
      default: def && def.length > 0 ? def : null,
      mutable,
      deferred,
      line: uline,
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
