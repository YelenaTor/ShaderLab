# ShaderLab Usage

## Install

```bash
npm install @yoruxiii/shaderlab@testing
```

## Vite

```ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

The plugin:

- compiles `.slab` imports
- transforms `shader_frame.<id>(lib) { ... }` blocks
- emits sibling `*.slab.d.ts` files by default
- participates in Vite HMR for `.slab` modules

Disable sidecar types:

```ts
shaderlab({ dts: false });
```

Emit sidecar types into a directory:

```ts
shaderlab({ dts: { outDir: ".shaderlab" } });
```

## TypeScript

Add the ambient client type:

```json
{
  "compilerOptions": {
    "types": ["@yoruxiii/shaderlab/client"]
  }
}
```

Then import slabs normally:

```ts
import fx from "./fx.slab";
```

## Framework Setup

Nuxt:

```ts
export default defineNuxtConfig({
  modules: ["@yoruxiii/shaderlab/nuxt"],
});
```

SvelteKit:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import shaderlab from "@yoruxiii/shaderlab/sveltekit";

export default defineConfig({
  plugins: [sveltekit(), shaderlab()],
});
```

Remix:

```ts
import { vitePlugin as remix } from "@remix-run/dev";
import shaderlab from "@yoruxiii/shaderlab/remix";

export default defineConfig({
  plugins: [remix(), shaderlab()],
});
```

React, Vue, and Svelte helpers mount an existing `ShaderFrameInstance`. Build the frame yourself with `shader_frame.<id>(lib)`.

## CLI

```bash
npx shaderlab init
npx shaderlab init --dry-run
```

`init` detects the current project, patches supported Vite-style config where possible, and creates `src/shaders/hello.slab` when missing.

## Common Patterns

Single 2D frame:

```ts
const bg = shader_frame.bg(fx);
bg.mount(canvas);
```

First-class 2.5D frame:

```ts
const clouds = shader_frame.clouds(fx) {
  depth: 0.45,
  parallax: 0.08,
};
clouds.mount(canvas);
```

Canvas plus ordered spatial augments:

```ts
const water = shader_frame.water(fx) {
  speed: 1.2,
  augment.ripple(fx) {
    strength: 0.4,
  },
  augment.caustics(fx),
};
water.mount(canvas);
```

Auto-composed postprocess:

```ts
const finalFrame = shader_frame.grade(fx) {
  depth: 0.4,
  gain: 1.15,
  augment.ripple(fx),
};
finalFrame.mount(canvas);
```

In that last example, `grade` is a `postprocess` frame. ShaderLab automatically wires the upstream `canvas_item` or `canvas_25d` from the same slab, then applies augments before the terminal pass.

## Example

See [examples/vanilla-vite](../examples/vanilla-vite) for a minimal Vite project using `canvas_25d` and `postprocess` composition.
