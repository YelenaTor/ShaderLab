/** Options threaded through init writers (e.g. dry-run). */
export interface WriterRunOptions {
  dryRun?: boolean;
  example?: InitExample;
  config?: boolean;
}

export type UiFramework = "react" | "vue" | "svelte" | "vanilla" | "unknown";
export type InitExample = Exclude<UiFramework, "unknown"> | "none";

/** Populated in dry-run mode for unified-diff-style previews. */
export interface FileChangePreview {
  path: string;
  before: string | null;
  after: string;
}

export interface WriterReport {
  modifiedFiles: string[];
  createdFiles: string[];
  skipped: string[];
  messages: string[];
  /** Unified-diff inputs for changes that would be written (dry-run only). */
  fileDiffs?: FileChangePreview[];
}

export function emptyReport(): WriterReport {
  return { modifiedFiles: [], createdFiles: [], skipped: [], messages: [] };
}

export function mergeReports(a: WriterReport, b: WriterReport): WriterReport {
  const fileDiffs = [...(a.fileDiffs ?? []), ...(b.fileDiffs ?? [])];
  return {
    modifiedFiles: [...a.modifiedFiles, ...b.modifiedFiles],
    createdFiles: [...a.createdFiles, ...b.createdFiles],
    skipped: [...a.skipped, ...b.skipped],
    messages: [...a.messages, ...b.messages],
    ...(fileDiffs.length ? { fileDiffs } : {}),
  };
}

/** Record a dry-run preview for a path that would be created or modified. */
export function appendFilePreview(
  r: WriterReport,
  path: string,
  before: string | null,
  after: string,
  dryRun: boolean,
): void {
  if (!dryRun) return;
  const next = r.fileDiffs ?? [];
  next.push({ path, before, after });
  r.fileDiffs = next;
}
