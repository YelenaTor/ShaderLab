/**
 * Minimal unified diff (single hunk) for tiny config files — no external deps.
 * Suitable for dry-run previews; shows full old/new line-wise change set.
 */
export function formatUnifiedDiff(displayPath: string, before: string | null, after: string): string {
  const aLabel = before === null ? "/dev/null" : `a/${displayPath}`;
  const bLabel = `b/${displayPath}`;
  const oldLines = before === null ? [] : normalizeLines(before);
  const newLines = normalizeLines(after);
  const ol = oldLines.length;
  const nl = newLines.length;
  const header =
    before === null
      ? `@@ -0,0 +1,${nl} @@`
      : ol === 0 && nl === 0
        ? `@@ -0,0 +0,0 @@`
        : `@@ -1,${ol} +1,${nl} @@`;

  const body: string[] = [`--- ${aLabel}`, `+++ ${bLabel}`, header];
  for (const line of oldLines) body.push(`-${line}`);
  for (const line of newLines) body.push(`+${line}`);
  return body.join("\n");
}

function normalizeLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}
