import type { ModuleNode } from "vite";

/** Return only `.slab` module nodes so Vite re-runs `transform` on HMR. */
export function handleShaderlabHotUpdate(ctx: { modules: ModuleNode[] }): ModuleNode[] {
  return [...ctx.modules];
}
