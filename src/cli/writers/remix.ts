import { writeViteConfig } from "./vite.js";
import type { WriterReport, WriterRunOptions } from "./types.js";

/** Remix v2 with Vite — same root vite.config patch. */
export function writeRemixConfig(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  return writeViteConfig(projectRoot, opts);
}
