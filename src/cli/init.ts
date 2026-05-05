import type { DetectedFramework } from "./detect.js";
import type { WriterReport, WriterRunOptions } from "./writers/types.js";
import { writeViteConfig } from "./writers/vite.js";
import { writeNuxtConfig } from "./writers/nuxt.js";
import { writeSvelteKitConfig } from "./writers/sveltekit.js";
import { writeRemixConfig } from "./writers/remix.js";
import { writeNextStub } from "./writers/next.js";
import { scaffoldHelloSlab } from "./writers/scaffold.js";

export function runInitForFramework(
  framework: DetectedFramework,
  projectRoot: string,
  opts?: WriterRunOptions,
): WriterReport {
  switch (framework) {
    case "vite":
      return writeViteConfig(projectRoot, opts);
    case "nuxt":
      return writeNuxtConfig(projectRoot, opts);
    case "sveltekit":
      return writeSvelteKitConfig(projectRoot, opts);
    case "remix":
      return writeRemixConfig(projectRoot, opts);
    case "next":
      return writeNextStub(projectRoot, opts);
    case "unknown":
    default:
      return scaffoldHelloSlab(projectRoot, opts);
  }
}
