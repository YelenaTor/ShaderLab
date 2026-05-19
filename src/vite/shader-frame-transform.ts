/**
 * Lowers `shader_frame.water(liquids.slab) { … }` surface syntax to valid JS.
 * `liquids.slab` → `liquids` (compiled library import).
 * Options blocks → plain object literals with `augments` array.
 */

export function transformShaderFrameCalls(source: string, _id: string): { code: string } {
  let code = transformOptionsBlocks(source);
  // Strip `.slab` only on library bindings inside `shader_frame.*(...)` calls — not import paths.
  code = code.replace(
    /shader_frame\.(\w+)\(([^)]+)\)/g,
    (_, frameId, args) =>
      `shader_frame.${frameId}(${String(args).replace(/\b(\w+)\.slab\b/g, "$1")})`,
  );
  return { code };
}

function transformOptionsBlocks(code: string): string {
  const re = /shader_frame\.(\w+)\(([^)]+)\)\s*\{/g;
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    result += code.slice(last, m.index);
    const frameId = m[1]!;
    const libRef = m[2]!.trim();
    const blockStart = m.index + m[0].length;
    const blockEnd = findMatchingBrace(code, blockStart - 1);
    if (blockEnd < 0) {
      result += m[0];
      last = m.index + m[0].length;
      continue;
    }
    const body = code.slice(blockStart, blockEnd).trim();
    const obj = parseOptionsBlock(body);
    result += `shader_frame.${frameId}(${libRef}, ${obj})`;
    last = blockEnd + 1;
    re.lastIndex = last;
  }
  result += code.slice(last);
  return result;
}

function findMatchingBrace(s: string, openIdx: number): number {
  if (s[openIdx] !== "{") return -1;
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseOptionsBlock(body: string): string {
  const parts = splitTopLevel(body);
  const fields: string[] = [];
  const augments: string[] = [];
  let loadIndex = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const augMatch = /^augment\.(\w+)\(([^)]+)\)(?:\s*\{([\s\S]*)\})?\s*$/.exec(trimmed);
    if (augMatch) {
      const augId = augMatch[1]!;
      const augLib = augMatch[2]!.trim().replace(/\.slab\b/, "");
      const augBody = augMatch[3]?.trim();
      const augOpts = augBody ? parseOptionsBlock(augBody) : "{}";
      augments.push(
        `{ frameId: ${JSON.stringify(augId)}, slab: ${augLib}, loadIndex: ${loadIndex}, options: ${augOpts} }`,
      );
      loadIndex++;
      continue;
    }
    if (/^[\w.]+\s*:/.test(trimmed)) {
      fields.push(trimmed);
    }
  }

  if (augments.length) {
    fields.push(`augments: [${augments.join(", ")}]`);
  }
  return `{ ${fields.join(", ")} }`;
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}
