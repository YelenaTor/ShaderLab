# ShaderLab Usage

## Install

```bash
npm install @yoruxiii/shaderlab@testing
```

Schema 2.0 is on the **`testing`** dist-tag. **`latest`** is Schema 1.0 (legacy) — do not mix APIs in one project.

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
npx shaderlab init -y
```

`init` detects both the project platform (Nuxt, SvelteKit, Remix, Next, Vite, or unknown) and UI layer (React, Vue, Svelte, vanilla, or unknown). It prompts before patching supported Vite-style config and creating example files. Use `-y` / `--yes` for non-interactive defaults.

Supported init output:

- `src/shaders/hello.slab` when missing.
- scoped Vite/Nuxt config imports such as `@yoruxiii/shaderlab/vite`.
- optional React, Vue, Svelte, or vanilla example files.

Next.js is detected, but ShaderLab does not patch `next.config` because ShaderLab is currently a Vite plugin.

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

See [example/README.md](./example/README.md) for a minimal `canvas_25d` + postprocess reference (`hello.slab` + `main.ts`). This folder ships in the npm package.

The runnable Vite project in the ShaderLab repository is [examples/vanilla-vite](../examples/vanilla-vite).
