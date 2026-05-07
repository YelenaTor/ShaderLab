/**
 * Best-effort line mapping from raw slab source (regex on tags, not full XML).
 * When tag counts diverge from the XML parser, callers fall back to line `1`.
 */

/** Sorted byte offsets where each line begins (0-indexed offsets, 1-indexed lines). */
export function buildLineIndex(src: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10 /* \n */) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** 1-indexed line number for a byte offset in `src`. */
export function offsetToLine(lineIndex: number[], offset: number): number {
  let lo = 0;
  let hi = lineIndex.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineIndex[mid]! <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

/** For each `<shader …>` opening tag in source order, return its starting line. */
export function findShaderLines(src: string, lineIndex: number[]): number[] {
  const re = /<shader\b/g;
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push(offsetToLine(lineIndex, m.index));
  }
  return out;
}

/**
 * For each shader (source order), lines of every `<uniform …>` opening tag between that
 * shader's opening tag and the next `<shader>` (or EOF).
 */
export function findUniformLines(src: string, lineIndex: number[]): number[][] {
  const shaderOffsets: number[] = [];
  const shaderRe = /<shader\b/g;
  let sm: RegExpExecArray | null;
  while ((sm = shaderRe.exec(src)) !== null) {
    shaderOffsets.push(sm.index);
  }
  if (shaderOffsets.length === 0) return [];

  const result: number[][] = [];
  for (let i = 0; i < shaderOffsets.length; i++) {
    const from = shaderOffsets[i]!;
    const to = i + 1 < shaderOffsets.length ? shaderOffsets[i + 1]! : src.length;
    const chunk = src.slice(from, to);
    const lines: number[] = [];
    const uniformRe = /<uniform\b/g;
    let um: RegExpExecArray | null;
    while ((um = uniformRe.exec(chunk)) !== null) {
      lines.push(offsetToLine(lineIndex, from + um.index));
    }
    result.push(lines);
  }
  return result;
}
