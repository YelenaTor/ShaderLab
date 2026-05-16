# ShaderLab

[![npm](https://img.shields.io/npm/v/@yoruxiii/shaderlab.svg?logo=npm&label=npm)](https://www.npmjs.com/package/@yoruxiii/shaderlab)
[![license](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](./LICENSE-MIT)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](./package.json)

Vite-first toolchain for **`.slab`** shader modules: declarative XML-ish metadata plus GLSL snippets compile to WebGL2 programs and typed ES modules. Use **`useShader`** or **`attach`** on a canvas — not a full game engine or scene graph.

**Requirements:** Node **18+**, Vite **5 or 6**, WebGL2 in the browser.

Published on npm as **`@yoruxiii/shaderlab`** on the **`latest`** dist-tag (see badge above). Prerelease builds use the **`testing`** dist-tag: `npm install @yoruxiii/shaderlab@testing`.

**Docs:** [CHANGELOG.md](./CHANGELOG.md) · [Usage guide](./docs/USAGE.md) · [Slab language reference](./docs/LANGUAGE.md)

## Install

```bash
npm install @yoruxiii/shaderlab
```

Pin a version for reproducible builds:

```bash
npm install @yoruxiii/shaderlab@0.3.0
# or
npm install @yoruxiii/shaderlab@^0.3
```

**From GitHub** (same sources as a release tag):

```bash
npm install github:YelenaTor/ShaderLab#v0.3.0
```

## Quick start

**1. Vite** — add the plugin in `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

**2. Slab + canvas** — import the compiled module (not a path string):

```ts
import hello from "./hello.slab";
import { useShader } from "@yoruxiii/shaderlab";

const canvas = document.querySelector("canvas")!;
const { attach, detachAll } = useShader(hello);

attach(canvas);
```

Each `.slab` file becomes an ES module with **`__shaders`** (all instances) and named exports per `<shader id="…">`.

## Shader types

| `type` | Role |
|--------|------|
| **`canvas_item`** | Draw to the canvas; builtins like `TEXTURE`, `UV`, `TIME`, and optional **`PARALLAX_UV`** with `hint="parallax_layer"`. |
| **`postprocess`** | Full-screen pass sampling upstream via `SCREEN_TEXTURE` / `SCREEN_UV` (`feedFrom`). |
| **`spatial`** | Standalone fullscreen pass, or augment mode with `CANVAS_TEXTURE` / `CANVAS_UV` (samples the immediate upstream pass). |

`useShader` wires multi-pass slabs in pipeline order: **`canvas_item` → spatial (augment)×N → `postprocess`** (XML order in the file does not matter). Details: [LANGUAGE.md](./docs/LANGUAGE.md), [USAGE.md](./docs/USAGE.md).

## Entry points

| Import | Use |
|--------|-----|
| `@yoruxiii/shaderlab` | Runtime: `useShader`, `createShaderInstance` |
| `@yoruxiii/shaderlab/vite` | Vite plugin (`vite.config` only) |
| `@yoruxiii/shaderlab/react`, `/vue`, `/svelte` | Framework hooks / components |
| `@yoruxiii/shaderlab/nuxt` | Nuxt module |
| `@yoruxiii/shaderlab/sveltekit`, `/remix` | Vite plugin re-exports for those stacks |
| `@yoruxiii/shaderlab/client` | Ambient types for `*.slab` imports |

Optional plugin option: `shaderlab({ dts: true })` emits sibling `*.slab.d.ts` (default on).

## Frameworks

- **React:** `useShader(mod, attachOptions?)` or `<ShaderLab module={mod} />` from `@yoruxiii/shaderlab/react`
- **Vue:** `useShader(mod, attachOptions?)` or `ShaderLab` from `@yoruxiii/shaderlab/vue`
- **Svelte:** `<canvas use:shaderlab={{ module: mod }} />` from `@yoruxiii/shaderlab/svelte`
- **Nuxt:** `modules: ["@yoruxiii/shaderlab/nuxt"]` in `nuxt.config.ts`

All bindings expect the **imported slab module**, not a filesystem path.

**Manual chains** (when you need explicit control):

```ts
import { chroma, bg } from "./hello.slab";

chroma.attach(canvas, { feedFrom: bg });
```

## CLI

Scaffold Vite config and a starter slab:

```bash
npx shaderlab init
npx shaderlab init --dry-run   # preview patches
```

## Typing

```ts
/// <reference types="@yoruxiii/shaderlab/client" />
```

Or `"types": ["@yoruxiii/shaderlab/client"]` in `tsconfig.json`. Compiled slabs can also emit `*.slab.d.ts` beside the source.

## Documentation

| Doc | Contents |
|-----|----------|
| [USAGE.md](./docs/USAGE.md) | Adoption, `attach` options, version guide |
| [LANGUAGE.md](./docs/LANGUAGE.md) | Grammar, builtins, diagnostics |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development and PR expectations |

## Examples

- [examples/vanilla-vite](./examples/vanilla-vite) — dev server and manual `feedFrom` wiring

## License

Dual licensed under [MIT](./LICENSE-MIT) or [Apache-2.0](./LICENSE-APACHE).
