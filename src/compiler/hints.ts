import type { UniformType } from "./types.js";

export interface ParsedRangeHint {
  kind: "range";
  min: number;
  max: number;
}

export type ParsedHint = ParsedRangeHint | { kind: "named"; name: string } | { kind: "invalid"; raw: string };

/** Recognized non-range hints (verbatim). */
export const KNOWN_HINTS = new Set([
  "color",
  "texture",
  "albedo",
  "normal_map",
  "mouse_position",
  "parallax_layer",
]);

export function parseHint(raw: string | null): ParsedHint | null {
  if (raw == null || raw.trim() === "") return null;
  const s = raw.trim();
  const rangeMatch = /^range\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*$/i.exec(s);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { kind: "range", min, max };
    }
  }
  if (KNOWN_HINTS.has(s)) {
    return { kind: "named", name: s };
  }
  return { kind: "invalid", raw: s };
}

export function isHintRecognized(raw: string | null): boolean {
  if (raw == null || raw.trim() === "") return true;
  const p = parseHint(raw);
  if (!p) return true;
  if (p.kind === "range") return true;
  if (p.kind === "named") return true;
  return false;
}

/** Parse default string per uniform type; returns `undefined` if invalid. */
export function parseDefaultValue(
  type: UniformType,
  raw: string | null,
): unknown | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const s = raw.trim();
  switch (type) {
    case "float":
    case "int": {
      const n = Number(s);
      if (!Number.isFinite(n)) return undefined;
      return type === "int" ? Math.trunc(n) : n;
    }
    case "bool": {
      if (s === "true" || s === "1") return true;
      if (s === "false" || s === "0") return false;
      return undefined;
    }
    case "vec2":
    case "vec3":
    case "vec4": {
      const parts = s.split(",").map((x) => Number(x.trim()));
      const n = type === "vec2" ? 2 : type === "vec3" ? 3 : 4;
      if (parts.length !== n || parts.some((x) => !Number.isFinite(x))) return undefined;
      return parts;
    }
    default:
      return undefined;
  }
}

export function valueInRange(
  type: UniformType,
  value: unknown,
  min: number,
  max: number,
): boolean {
  if (type === "float" || type === "int") {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    return value >= min && value <= max;
  }
  return true;
}
