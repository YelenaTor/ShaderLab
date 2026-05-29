import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { InitExample, WriterReport, WriterRunOptions } from "./types.js";
import { appendFilePreview, emptyReport, mergeReports } from "./types.js";

/** Minimal example shader (canvas_item) for `src/shaders/hello.slab`. */
export const HELLO_SLAB = `<shaderlab version="2.0">
  <shader_frame id="hello" type="canvas_item">
    <fragment><![CDATA[
COLOR = vec4(UV, sin(TIME) * 0.5 + 0.5, 1.0);
    ]]></fragment>
  </shader_frame>
</shaderlab>
`;

export function scaffoldHelloSlab(projectRoot: string, opts?: WriterRunOptions): WriterReport {
  const dryRun = opts?.dryRun === true;
  const r = emptyReport();
  const dir = join(projectRoot, "src", "shaders");
  const file = join(dir, "hello.slab");
  if (existsSync(file)) {
    r.skipped.push(file);
    return r;
  }
  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, HELLO_SLAB, "utf8");
  }
  r.createdFiles.push(file);
  appendFilePreview(r, file, null, HELLO_SLAB, dryRun);
  return r;
}

function exampleSource(example: InitExample): { path: string[]; source: string } | null {
  switch (example) {
    case "react":
      return {
        path: ["src", "ShaderLabExample.tsx"],
        source: `import { ShaderFrame } from "@yoruxiii/shaderlab/react";
import { shader_frame } from "@yoruxiii/shaderlab";
import fx from "./shaders/hello.slab";

const frame = shader_frame.hello(fx);

export function ShaderLabExample() {
  return (
    <ShaderFrame
      frame={frame}
      mountOptions={{ visibilityPause: true }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
`,
      };
    case "vue":
      return {
        path: ["src", "ShaderLabExample.vue"],
        source: `<script setup lang="ts">
import { ShaderFrame } from "@yoruxiii/shaderlab/vue";
import { shader_frame } from "@yoruxiii/shaderlab";
import fx from "./shaders/hello.slab";

const frame = shader_frame.hello(fx);
</script>

<template>
  <ShaderFrame
    :frame="frame"
    :mount-options="{ visibilityPause: true }"
    style="width: 100%; height: 100%;"
  />
</template>
`,
      };
    case "svelte":
      return {
        path: ["src", "ShaderLabExample.svelte"],
        source: `<script lang="ts">
  import ShaderFrame from "@yoruxiii/shaderlab/svelte/ShaderFrame.svelte";
  import { shader_frame } from "@yoruxiii/shaderlab";
  import fx from "./shaders/hello.slab";

  const frame = shader_frame.hello(fx);
</script>

<ShaderFrame {frame} mountOptions={{ visibilityPause: true }} style="width: 100%; height: 100%;" />
`,
      };
    case "vanilla":
      return {
        path: ["src", "shaderlab-example.ts"],
        source: `import { shader_frame } from "@yoruxiii/shaderlab";
import fx from "./shaders/hello.slab";

const canvas = document.querySelector<HTMLCanvasElement>("#shaderlab");
if (!canvas) {
  throw new Error("Expected a <canvas id=\\"shaderlab\\"> element.");
}

const frame = shader_frame.hello(fx);
frame.mount(canvas, { visibilityPause: true });
`,
      };
    case "none":
      return null;
  }
}

export function scaffoldFrameworkExample(
  projectRoot: string,
  example: InitExample | undefined,
  opts?: WriterRunOptions,
): WriterReport {
  const r = emptyReport();
  if (!example || example === "none") return r;
  const generated = exampleSource(example);
  if (!generated) return r;
  const file = join(projectRoot, ...generated.path);
  if (existsSync(file)) {
    r.skipped.push(file);
    return r;
  }
  if (!opts?.dryRun) {
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    writeFileSync(file, generated.source, "utf8");
  }
  r.createdFiles.push(file);
  appendFilePreview(r, file, null, generated.source, opts?.dryRun === true);
  return r;
}

export function scaffoldShaderlabFiles(
  projectRoot: string,
  opts?: WriterRunOptions,
): WriterReport {
  return mergeReports(
    scaffoldHelloSlab(projectRoot, opts),
    scaffoldFrameworkExample(projectRoot, opts?.example, opts),
  );
}
