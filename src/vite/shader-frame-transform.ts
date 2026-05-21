/**
 * Lowers `shader_frame.water(liquids.slab) { ... }` surface syntax to valid JS.
 * The scanner is intentionally small and dependency-free because this syntax is
 * not valid JavaScript until this pre-transform runs.
 */

const SHADER_FRAME_PREFIX = "shader_frame.";
const AUGMENT_PREFIX = "augment.";

export function transformShaderFrameCalls(source: string, id: string): { code: string } {
  let out = "";
  let i = 0;

  while (i < source.length) {
    const skipped = readSkippedSyntax(source, i);
    if (skipped > i) {
      out += source.slice(i, skipped);
      i = skipped;
      continue;
    }

    if (startsWithAt(source, i, SHADER_FRAME_PREFIX) && isIdentifierBoundary(source, i - 1)) {
      const parsed = parseShaderFrameCall(source, i, id);
      out += parsed.code;
      i = parsed.end;
      continue;
    }

    out += source[i]!;
    i++;
  }

  return { code: out };
}

interface ParsedChunk {
  code: string;
  end: number;
}

interface ParsedAugment {
  frameId: string;
  slab: string;
  options: string;
}

function parseShaderFrameCall(source: string, start: number, id: string): ParsedChunk {
  let pos = start + SHADER_FRAME_PREFIX.length;
  const frame = readIdentifier(source, pos);
  if (!frame) {
    throw transformError(id, source, pos, "Expected frame id after `shader_frame.`");
  }
  pos = frame.end;
  pos = skipTrivia(source, pos);
  if (source[pos] !== "(") {
    throw transformError(id, source, pos, "Expected `(` after `shader_frame.<id>`");
  }

  const closeParen = findMatching(source, pos, "(", ")", id);
  const args = stripSlabMemberRefs(source.slice(pos + 1, closeParen));
  pos = skipTrivia(source, closeParen + 1);

  if (source[pos] !== "{") {
    return {
      code: `shader_frame.${frame.name}(${args})`,
      end: closeParen + 1,
    };
  }

  const closeBlock = findMatching(source, pos, "{", "}", id);
  const options = parseOptionsBlock(source.slice(pos + 1, closeBlock), id);
  return {
    code: `shader_frame.${frame.name}(${args}, ${options})`,
    end: closeBlock + 1,
  };
}

function parseOptionsBlock(body: string, id: string): string {
  const parts = splitTopLevel(body, id);
  const fields: string[] = [];
  const augments: string[] = [];
  let loadIndex = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || isCommentOnly(trimmed)) continue;

    const augment = parseAugmentEntry(trimmed, id);
    if (augment) {
      augments.push(
        `{ frameId: ${JSON.stringify(augment.frameId)}, slab: ${augment.slab}, loadIndex: ${loadIndex}, options: ${augment.options} }`,
      );
      loadIndex++;
      continue;
    }

    if (hasTopLevelColon(trimmed, id)) {
      fields.push(trimmed);
      continue;
    }

    throw new Error(
      `[shaderlab] Unsupported shader_frame options entry in ${id}: ${summarize(trimmed)}`,
    );
  }

  if (augments.length) {
    fields.push(`augments: [${augments.join(", ")}]`);
  }
  return `{ ${fields.join(", ")} }`;
}

function parseAugmentEntry(entry: string, id: string): ParsedAugment | null {
  let pos = skipTrivia(entry, 0);
  if (!startsWithAt(entry, pos, AUGMENT_PREFIX)) return null;
  pos += AUGMENT_PREFIX.length;

  const frame = readIdentifier(entry, pos);
  if (!frame) {
    throw new Error(`[shaderlab] Expected augment id after \`augment.\` in ${id}: ${summarize(entry)}`);
  }
  pos = skipTrivia(entry, frame.end);
  if (entry[pos] !== "(") {
    throw new Error(`[shaderlab] Expected \`(\` after \`augment.${frame.name}\` in ${id}`);
  }

  const closeParen = findMatching(entry, pos, "(", ")", id);
  const slab = stripSlabMemberRefs(entry.slice(pos + 1, closeParen).trim());
  pos = skipTrivia(entry, closeParen + 1);

  let options = "{}";
  if (entry[pos] === "{") {
    const closeBlock = findMatching(entry, pos, "{", "}", id);
    options = parseOptionsBlock(entry.slice(pos + 1, closeBlock), id);
    pos = skipTrivia(entry, closeBlock + 1);
  }

  if (pos !== entry.length) {
    throw new Error(`[shaderlab] Unexpected content after augment call in ${id}: ${summarize(entry.slice(pos))}`);
  }

  return { frameId: frame.name, slab, options };
}

function splitTopLevel(source: string, id: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const skipped = readSkippedSyntax(source, i);
    if (skipped > i) {
      i = skipped - 1;
      continue;
    }
    const c = source[i]!;
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth < 0) {
        throw transformError(id, source, i, `Unexpected closing delimiter \`${c}\``);
      }
    } else if (c === "," && depth === 0) {
      out.push(source.slice(start, i));
      start = i + 1;
    }
  }
  if (depth !== 0) {
    throw new Error(`[shaderlab] Unmatched delimiter in shader_frame options block in ${id}`);
  }
  out.push(source.slice(start));
  return out;
}

function hasTopLevelColon(source: string, id: string): boolean {
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const skipped = readSkippedSyntax(source, i);
    if (skipped > i) {
      i = skipped - 1;
      continue;
    }
    const c = source[i]!;
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth < 0) {
        throw transformError(id, source, i, `Unexpected closing delimiter \`${c}\``);
      }
    } else if (c === ":" && depth === 0) {
      return true;
    }
  }
  return false;
}

function stripSlabMemberRefs(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const skipped = readSkippedSyntax(source, i);
    if (skipped > i) {
      out += source.slice(i, skipped);
      i = skipped;
      continue;
    }
    if (
      startsWithAt(source, i, ".slab") &&
      i > 0 &&
      isIdentifierChar(source[i - 1]!) &&
      isIdentifierBoundary(source, i + ".slab".length)
    ) {
      i += ".slab".length;
      continue;
    }
    out += source[i]!;
    i++;
  }
  return out.trim();
}

function findMatching(
  source: string,
  openIndex: number,
  open: "{" | "(" | "[",
  close: "}" | ")" | "]",
  id: string,
): number {
  if (source[openIndex] !== open) {
    throw transformError(id, source, openIndex, `Expected \`${open}\``);
  }
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const skipped = readSkippedSyntax(source, i);
    if (skipped > i) {
      i = skipped - 1;
      continue;
    }
    const c = source[i]!;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw transformError(id, source, openIndex, `Unmatched \`${open}\``);
}

function skipTrivia(source: string, start: number): number {
  let pos = start;
  for (;;) {
    while (pos < source.length && /\s/.test(source[pos]!)) pos++;
    if (startsWithAt(source, pos, "//")) {
      pos = readLineComment(source, pos);
      continue;
    }
    if (startsWithAt(source, pos, "/*")) {
      pos = readBlockComment(source, pos);
      continue;
    }
    return pos;
  }
}

function readSkippedSyntax(source: string, start: number): number {
  const c = source[start];
  if (c === '"' || c === "'") return readQuoted(source, start, c);
  if (c === "`") return readTemplate(source, start);
  if (startsWithAt(source, start, "//")) return readLineComment(source, start);
  if (startsWithAt(source, start, "/*")) return readBlockComment(source, start);
  return start;
}

function readQuoted(source: string, start: number, quote: string): number {
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i]!;
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === quote) return i + 1;
  }
  return source.length;
}

function readTemplate(source: string, start: number): number {
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i]!;
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") return i + 1;
  }
  return source.length;
}

function readLineComment(source: string, start: number): number {
  const end = source.indexOf("\n", start + 2);
  return end === -1 ? source.length : end + 1;
}

function readBlockComment(source: string, start: number): number {
  const end = source.indexOf("*/", start + 2);
  return end === -1 ? source.length : end + 2;
}

function readIdentifier(source: string, start: number): { name: string; end: number } | null {
  if (!isIdentifierStart(source[start])) return null;
  let end = start + 1;
  while (end < source.length && isIdentifierChar(source[end]!)) end++;
  return { name: source.slice(start, end), end };
}

function isIdentifierStart(c: string | undefined): boolean {
  return c != null && /[A-Za-z_$]/.test(c);
}

function isIdentifierChar(c: string | undefined): boolean {
  return c != null && /[A-Za-z0-9_$]/.test(c);
}

function isIdentifierBoundary(source: string, index: number): boolean {
  if (index < 0 || index >= source.length) return true;
  return !isIdentifierChar(source[index]!);
}

function startsWithAt(source: string, start: number, needle: string): boolean {
  return source.startsWith(needle, start);
}

function isCommentOnly(source: string): boolean {
  return skipTrivia(source, 0) === source.length;
}

function summarize(source: string): string {
  const compact = source.replace(/\s+/g, " ").trim();
  return compact.length > 90 ? `${compact.slice(0, 87)}...` : compact;
}

function transformError(id: string, source: string, index: number, message: string): Error {
  const line = source.slice(0, index).split("\n").length;
  return new Error(`[shaderlab] ${id}:${line}: ${message}`);
}
