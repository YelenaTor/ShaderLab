import { writeViteConfig } from "./vite.js";
import type { WriterReport, WriterRunOptions } from "./types.js";

/** SvelteKit uses Vite at the project root — same plugin insertion as vanilla Vite. */
export function writeSvelteKitConfig(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  return writeViteConfig(projectRoot, opts);
}
