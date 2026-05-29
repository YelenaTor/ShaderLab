# AGENTS.md — ShaderLab for AI Coding Agents

> This file is written for AI coding assistants (Copilot, Cursor, Claude, Gemini, etc.)
> that are helping a developer use the `@yoruxiii/shaderlab` Vite plugin.
> It ships inside the npm package so you can read it from `node_modules`.

---

## ⚠️ CRITICAL: Custom Block Syntax

ShaderLab uses a **non-standard call-site syntax** that the Vite plugin compiles away.
**You will be tempted to "fix" it. Do not.**

```ts
// ✅ Block syntax — the idiomatic form, compiled by the Vite plugin
const clouds = shader_frame.clouds(fx) {
  depth: 0.5,
  parallax: 0.08,
};
```

The plugin lowers this to:

```ts
// ✅ Standard form — always valid JS/TS, works without the plugin transform
const clouds = shader_frame.clouds(fx, {
  depth: 0.5,
  parallax: 0.08,
});
```

**Both forms are correct.** When generating code, **prefer the standard two-argument form**
to avoid syntax errors in linters, formatters, and type-checkers that run before the
Vite transform. The block syntax is the preferred authoring style for humans but is
not valid JavaScript until the plugin processes it.

### Augment sub-blocks

The same rule applies to augments:

```ts
// Block syntax (compiled by plugin)
const frame = shader_frame.grade(fx) {
  gain: 1.2,
  augment.ripple(fx) {
    strength: 0.4,
  },
  augment.caustics(fx),
};

// Standard form (always valid)
const frame = shader_frame.grade(fx, {
  gain: 1.2,
  augments: [
    { frameId: "ripple", slab: fx, loadIndex: 0, options: { strength: 0.4 } },
    { frameId: "caustics", slab: fx, loadIndex: 1 },
  ],
});
```

---

## npm Tracks

ShaderLab publishes **two separate npm dist-tags**. They are not interchangeable.

| Tag | Schema | Install | Status |
| --- | --- | --- | --- |
| `latest` (release) | Schema 1.0 | `npm install @yoruxiii/shaderlab` | Legacy. Uses `<shader>` elements and the old `useShader` API. |
| `testing` | **Schema 2.0** | `npm install @yoruxiii/shaderlab@testing` | Current development line. Uses `<shader_frame>` elements and `shader_frame.*` API. |

**Schema 1.0 and 2.0 are incompatible.**

- Schema 2.0 rejects `<shader>` elements and `version="1.0"`.
- Schema 1.0 does not support `<shader_frame>`, `canvas_25d`, augments, or auto-composed pipelines.

When a user asks you to add ShaderLab:

1. **Ask which track they want**, or check their existing `package.json`.
2. If the project has no existing ShaderLab install, **default to `@testing`** (Schema 2.0) — it is the actively developed line.
3. If the project has `@yoruxiii/shaderlab` without `@testing`, it is on Schema 1.0. Do **not** mix Schema 2.0 patterns into a Schema 1.0 project.

The rest of this document describes **Schema 2.0** (`@testing`) only.

---

## Quick Setup (Schema 2.0)

### 1. Install

```bash
npm install @yoruxiii/shaderlab@testing
```

### 2. Register the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

Plugin options:

```ts
interface ShaderlabPluginOptions {
  /** Emit sibling *.slab.d.ts files. Default: true */
  dts?: boolean | { outDir?: string };
}
```

### 3. Add ambient types for `.slab` imports

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["@yoruxiii/shaderlab/client"]
  }
}
```

The plugin also auto-generates precise `*.slab.d.ts` sidecars with per-frame option
interfaces during dev and build.

### 4. Create a `.slab` file

```xml
<shaderlab version="2.0">
  <shader_frame id="bg" type="canvas_25d">
    <uniforms>
      <uniform name="depth" type="float" hint="layer_depth" mutable="true" default="0.35" />
      <uniform name="parallax" type="float" hint="parallax_strength" mutable="true" default="0.05" />
    </uniforms>
    <fragment><![CDATA[
vec2 uv = PARALLAX_UV;
COLOR = vec4(uv, LAYER_DEPTH, 1.0);
    ]]></fragment>
  </shader_frame>
</shaderlab>
```

### 5. Use from app code

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import fx from "./effects.slab";

const bg = shader_frame.bg(fx, { depth: 0.5, parallax: 0.08 });
bg.mount(document.querySelector("canvas")!);
bg.set("depth", 0.7); // update a mutable uniform at runtime
```

---

## Framework-Specific Setup

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@yoruxiii/shaderlab/nuxt"],
});
```

No separate Vite plugin registration needed — the Nuxt module handles it.

### SvelteKit

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import shaderlab from "@yoruxiii/shaderlab/sveltekit";

export default defineConfig({
  plugins: [sveltekit(), shaderlab()],
});
```

### Remix

```ts
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import shaderlab from "@yoruxiii/shaderlab/remix";

export default defineConfig({
  plugins: [remix(), shaderlab()],
});
```

---

## Entry Points

| Import path | Purpose | Environment |
| --- | --- | --- |
| `@yoruxiii/shaderlab` | `shader_frame` proxy + public types | Browser |
| `@yoruxiii/shaderlab/vite` | Vite plugin (`.slab` compilation + call-site transform) | Node / Vite config |
| `@yoruxiii/shaderlab/client` | Ambient `*.slab` module declaration for TypeScript | Types only |
| `@yoruxiii/shaderlab/react` | `<ShaderFrame>` component + `useShaderFrame` hook | Browser (React ≥18) |
| `@yoruxiii/shaderlab/vue` | `<ShaderFrame>` component + `useShaderFrame` composable | Browser (Vue ≥3.4) |
| `@yoruxiii/shaderlab/svelte` | `shaderframe` action + `ShaderFrame.svelte` | Browser (Svelte 4/5) |
| `@yoruxiii/shaderlab/nuxt` | Nuxt module | Node / Nuxt config |
| `@yoruxiii/shaderlab/sveltekit` | SvelteKit-friendly plugin re-export | Node / Vite config |
| `@yoruxiii/shaderlab/remix` | Remix-friendly plugin re-export | Node / Vite config |

---

## `.slab` File Schema (2.0)

### Root

```xml
<shaderlab version="2.0">
  <!-- one or more <shader_frame> elements -->
</shaderlab>
```

### `<shader_frame>`

| Attribute | Required | Values |
| --- | --- | --- |
| `id` | yes | Identifier used in `shader_frame.<id>(lib)` |
| `type` | yes | `canvas_item`, `canvas_25d`, `spatial`, `postprocess` |
| `mode` | spatial only | `standalone` (default) or `augment` |
| `render_mode` | no | Comma/space-separated raster flags |

Children: `<uniforms>` (optional), `<vertex>` (optional, not valid on postprocess/augment), `<fragment>` (required).

### `<uniform>`

```xml
<uniform name="speed" type="float" hint="range(0.0, 2.0)" mutable="true" default="1.0" />
```

| Attribute | Meaning |
| --- | --- |
| `name` | GLSL-safe identifier. Runtime uniform name is `u_<name>`. |
| `type` | `float`, `int`, `bool`, `vec2`, `vec3`, `vec4`, `sampler2D` |
| `mutable` | `true` = overridable at call site and via `.set()` |
| `deferred` | `true` = consumer must provide the value |
| `default` | Initial value |
| `hint` | Semantic metadata (see below) |

### Uniform Hints

| Hint | Effect |
| --- | --- |
| `range(min,max)` | Numeric clamp at bind time |
| `color` | Linearizes sRGB vec3/vec4 at bind time |
| `texture`, `albedo`, `normal_map` | Texture semantics |
| `mouse_position` | Runtime-owned normalized mouse coordinate |
| `layer_depth` | `canvas_25d` depth source (must be `float`) |
| `parallax_strength` | `canvas_25d` parallax scale (must be `float`) |

---

## Frame Types and Builtins

### `canvas_item` — 2D fullscreen shader

Builtins: `UV`, `COLOR`, `TEXTURE`, `VERTEX_COLOR`, `TIME`, `RESOLUTION`

### `canvas_25d` — 2.5D parallax shader

Builtins: everything in `canvas_item` plus `PARALLAX_UV`, `PARALLAX_OFFSET`, `LAYER_DEPTH`, `PARALLAX_STRENGTH`

Generated vertex behavior:
```glsl
PARALLAX_OFFSET = vec2(LAYER_DEPTH * TIME * PARALLAX_STRENGTH, 0.0);
PARALLAX_UV = UV + PARALLAX_OFFSET;
```

### `spatial` — fullscreen pass

- `mode="standalone"`: independent pass.
- `mode="augment"`: samples upstream via `CANVAS_TEXTURE`, `CANVAS_UV`.

### `postprocess` — terminal pass

Samples upstream via `SCREEN_TEXTURE`, `SCREEN_UV`. Auto-wires the upstream `canvas_item` or `canvas_25d` from the same slab.

### Pipeline order (fixed)

```
canvas_item | canvas_25d → spatial augment(s) → postprocess
```

---

## Runtime API

### `shader_frame`

A proxy object. `shader_frame.<id>(slab, options?)` returns a `ShaderFrameInstance`.

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import fx from "./fx.slab";

const instance = shader_frame.clouds(fx, { depth: 0.4 });
```

### `ShaderFrameInstance`

```ts
interface ShaderFrameInstance {
  readonly type: "canvas_item" | "canvas_25d" | "spatial" | "postprocess";
  readonly id: string;
  readonly uniforms: Record<string, unknown>;
  mount(target: HTMLElement | HTMLCanvasElement, options?: MountOptions): void;
  unmount(): void;
  set(param: string, value: unknown): void;
}
```

- `mount(target)` — creates or finds a canvas, inits WebGL2, starts rendering. `target` can be a `<canvas>` or any HTML container (ShaderLab creates a child canvas).
- `unmount()` — stops rendering, disconnects observers, releases GL resources.
- `set(name, value)` — updates a mutable uniform. Throws on sealed (non-mutable) uniforms.

### `MountOptions`

```ts
interface MountOptions {
  feedFrom?: ShaderFrameInstance;
  augments?: ShaderFrameInstance[];
  maxDevicePixelRatio?: number;
  visibilityPause?: boolean;
  visibilityRootMargin?: string;
  depthBuffer?: boolean;
  webglContextAttributes?: Partial<WebGLContextAttributes>;
}
```

Most apps should **not** pass `feedFrom` directly. Postprocess frames auto-wire upstream.

---

## Framework Helper APIs

### React

```tsx
import { ShaderFrame, useShaderFrame } from "@yoruxiii/shaderlab/react";

// Component — renders a <canvas>, mounts the frame, and can apply mutable uniforms
<ShaderFrame
  frame={instance}
  mountOptions={{ visibilityPause: true }}
  uniforms={{ depth: 0.7 }}
  className="my-canvas"
/>

// Hook — returns a ref to attach to your own canvas
const canvasRef = useShaderFrame(instance, { visibilityPause: true });
<canvas ref={canvasRef} />
```

### Vue

```vue
<script setup>
import { ShaderFrame, useShaderFrame } from "@yoruxiii/shaderlab/vue";

// Component
// <ShaderFrame :frame="instance" :mount-options="{ visibilityPause: true }" :uniforms="{ depth: 0.7 }" />

// Composable
const { canvasRef } = useShaderFrame(instance, { visibilityPause: true });
</script>
<template>
  <canvas ref="canvasRef" />
</template>
```

### Svelte

```svelte
<script>
  import { shaderframe } from "@yoruxiii/shaderlab/svelte";
  import ShaderFrame from "@yoruxiii/shaderlab/svelte/ShaderFrame.svelte";
</script>

<canvas use:shaderframe={{ frame: instance, mountOptions: { visibilityPause: true } }}></canvas>
<ShaderFrame frame={instance} mountOptions={{ visibilityPause: true }} uniforms={{ depth: 0.7 }} />
```

Framework helpers mount/unmount an existing `ShaderFrameInstance`, forward mount options,
and can apply mutable uniforms. Build the `ShaderFrameInstance` yourself with
`shader_frame.<id>(slab, options)`.

---

## CLI

```bash
npx shaderlab init              # auto-detect framework, patch config, create hello.slab
npx shaderlab init --dry-run    # preview changes without writing files
npx shaderlab init -y           # non-interactive defaults
npx shaderlab --help
npx shaderlab --version
```

`init` detects both the project framework (Nuxt, SvelteKit, Remix, Next, Vite, or unknown)
and UI layer (React, Vue, Svelte, vanilla, or unknown). It prompts before patching config
and creating example files; `-y` uses detected defaults for CI.

Detected frameworks: `nuxt`, `sveltekit`, `remix`, `next`, `vite`, `unknown`.
Detected UI layers: `react`, `vue`, `svelte`, `vanilla`, `unknown`.

---

## Common Patterns

### Simple 2D shader

```ts
const bg = shader_frame.bg(fx);
bg.mount(canvas);
```

### 2.5D parallax shader

```ts
const clouds = shader_frame.clouds(fx, { depth: 0.45, parallax: 0.08 });
clouds.mount(canvas);
```

### Canvas + spatial augments + postprocess

```ts
const frame = shader_frame.grade(fx, {
  depth: 0.4,
  gain: 1.15,
  augments: [
    { frameId: "ripple", slab: fx, loadIndex: 0 },
    { frameId: "caustics", slab: fx, loadIndex: 1, options: { intensity: 0.3 } },
  ],
});
frame.mount(canvas);
```

Calling a `postprocess` frame auto-wires the upstream `canvas_item` or `canvas_25d`
from the same slab, plus any augments, forming the full pipeline.

### Updating uniforms at runtime

```ts
frame.set("depth", 0.7);
```

Only `mutable="true"` uniforms can be updated. Sealed uniforms throw.

---

## Diagnostic Error Codes

When a `.slab` file fails to compile, the Vite plugin emits diagnostics with these codes:

| Code | Meaning |
| --- | --- |
| `E0101` | Missing or malformed root `<shaderlab>` document |
| `E0201` | Missing or invalid frame `id` |
| `E0202` | Duplicate frame `id` |
| `E0203` | Missing or unknown frame `type` |
| `E0301` | Missing or empty `<fragment>` block |
| `E0302`–`E0304` | Uniform shape, type, or name errors |
| `E0401` | Legacy `<shader>` element used (Schema 1.0 — rejected in 2.0) |
| `E0402` | Root `version` is not `"2.0"` |
| `E0405`–`E0407` | Invalid vertex or spatial placement |
| `H0312` | Builtin used in the wrong frame type |
| `W0201` | Unknown or incompatible hint |
| `W0202` | Default value outside declared `range()` |

---

## Checklist for Agents

When helping a user with ShaderLab:

- [ ] Confirm which npm track (`latest` vs `@testing`) the project uses
- [ ] Use the **standard two-argument call form** when generating code
- [ ] Register the Vite plugin in the project's Vite config (or use the Nuxt module)
- [ ] Add `"types": ["@yoruxiii/shaderlab/client"]` to `tsconfig.json`
- [ ] Place `.slab` files anywhere in the project `src/` tree (not in `node_modules`, `dist`, or `test`)
- [ ] Use `<shaderlab version="2.0">` as root — never `<shader>` or `version="1.0"`
- [ ] Only `mutable="true"` uniforms can be overridden at the call site or via `.set()`
- [ ] `postprocess` frames auto-wire upstream — do not manually pass `feedFrom` unless you have a specific reason
- [ ] WebGL2 is required in the browser

Reference files (ship in npm): [example/hello.slab](./example/hello.slab), [example/main.ts](./example/main.ts).
