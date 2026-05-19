# ShaderLab

[![npm](https://img.shields.io/npm/v/@yoruxiii/shaderlab.svg?logo=npm&label=npm)](https://www.npmjs.com/package/@yoruxiii/shaderlab)
[![license](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](./LICENSE-MIT)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](./package.json)

> [!IMPORTANT]
> **Attention!** **`0.4.0-testing.0`** (npm dist-tag **`testing`**) uses **Schema 2.0 (`shader_frame`)** — not the stable **Schema 1.0** (`<shader>`, `useShader`) on **`latest`**.
>
> - **Start here:** [NEW_API.md](./NEW_API.md) (short overview)
> - **Full reference:** [docs/API.md](./docs/API.md)
> - **Adoption / version guide:** [docs/USAGE.md](./docs/USAGE.md) → *0.4.x — Schema 2.0*
>
> Install: `npm install @yoruxiii/shaderlab@testing`

Vite-first toolchain for **`.slab`** shader modules: declarative metadata plus GLSL snippets compile to WebGL2 programs and typed ES modules — not a full game engine or scene graph.

**Requirements:** Node **18+**, Vite **5 or 6**, WebGL2 in the browser.

| npm dist-tag | Package line | Slab / consumer API |
|--------------|--------------|---------------------|
| **`latest`** | `0.3.x` stable | Schema **1.0** — `<shader>`, `useShader`, `attach` |
| **`testing`** | `0.4.0-testing.0+` | **Schema 2.0 (`shader_frame`)** — see [NEW_API.md](./NEW_API.md) |

```bash
npm install @yoruxiii/shaderlab          # stable 0.3.x
npm install @yoruxiii/shaderlab@testing  # Schema 2.0 (shader_frame)
```

**Docs:** [NEW_API.md](./NEW_API.md) · [CHANGELOG.md](./CHANGELOG.md) · [Usage](./docs/USAGE.md) · [Language](./docs/LANGUAGE.md) · [API](./docs/API.md)

---

## Quick start — Schema 2.0 (`shader_frame`, `@testing`)

**1. Vite** — `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({ plugins: [shaderlab()] });
```

**2. Slab** — one frame per callable name (`id` → `shader_frame.<id>`):

```xml
<shaderlab version="2.0">
  <shader_frame id="waves" type="canvas_item">
    <uniforms>
      <uniform name="speed" type="float" default="1.0" mutable="true" />
    </uniforms>
    <fragment><![CDATA[
COLOR = vec4(UV, sin(TIME * speed) * 0.5 + 0.5, 0.7, 1.0);
    ]]></fragment>
  </shader_frame>
</shaderlab>
```

**3. Page** — import the compiled **library** module, call, mount:

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import wavesLib from "./waves.slab";

const canvas = document.querySelector("canvas")!;
const fx = shader_frame.waves(wavesLib) { speed: 2.0 };
fx.mount(canvas);
// fx.set("speed", 1.0); fx.unmount();
```

Each `.slab` file is a **shader library** (many frames allowed). Details: [NEW_API.md](./NEW_API.md), [docs/API.md](./docs/API.md).

---

## Quick start — Schema 1.0 (`<shader>`, npm `latest`)

```ts
import hello from "./hello.slab";
import { useShader } from "@yoruxiii/shaderlab";

const canvas = document.querySelector("canvas")!;
const { attach, detachAll } = useShader(hello);
attach(canvas);
```

Emitted modules expose **`__shaders`** and named exports per `<shader id="…">`. See [docs/USAGE.md](./docs/USAGE.md).

---

## Shader types

| `type` | Role |
|--------|------|
| **`canvas_item`** | Draw to the canvas; builtins like `TEXTURE`, `UV`, `TIME`, optional **`PARALLAX_UV`**. |
| **`postprocess`** | Full-screen pass via `SCREEN_TEXTURE` / `SCREEN_UV`. |
| **`spatial`** | Standalone fullscreen, or **augment** mode with `CANVAS_TEXTURE` / `CANVAS_UV`. |

Multi-pass wiring: **`useShader`** on **1.0** slabs; **`shader_frame` + augments** (and `mount` options) on **2.0** — [LANGUAGE.md](./docs/LANGUAGE.md).

## Entry points

| Import | Use |
|--------|-----|
| `@yoruxiii/shaderlab` | **2.0:** `shader_frame`, `ShaderFrameInstance` |
| `@yoruxiii/shaderlab/vite` | Vite plugin |
| `@yoruxiii/shaderlab/react`, `/vue`, `/svelte` | **`ShaderFrame`** + **`frame`** prop, **`useShaderFrame`**, Svelte **`shaderframe`** |
| `@yoruxiii/shaderlab/client` | Ambient types for `*.slab` imports |

## Frameworks

On **Schema 2.0**, use **`ShaderFrame`** with a **`frame`** prop (or **`useShaderFrame`** / Svelte **`shaderframe`**) for a `ShaderFrameInstance` from `shader_frame.*(...)`.

## CLI

```bash
npx shaderlab init
npx shaderlab init --dry-run
```

`init` scaffolds **Schema 2.0** slabs when targeting the testing line.

## Typing

```json
{ "compilerOptions": { "types": ["@yoruxiii/shaderlab/client"] } }
```

The plugin can emit sibling **`*.slab.d.ts`** (`shaderlab({ dts: true })`, default on).

## Documentation

| Doc | Contents |
|-----|----------|
| [NEW_API.md](./NEW_API.md) | Short **Schema 2.0** consumer guide |
| [API.md](./docs/API.md) | Full **2.0** frame reference + migration |
| [USAGE.md](./docs/USAGE.md) | Version guide (1.0 vs 2.0) |
| [LANGUAGE.md](./docs/LANGUAGE.md) | **1.0** grammar (+ 2.0 pointer) |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |

## Examples

- [examples/vanilla-vite](./examples/vanilla-vite) — **Schema 2.0** demo (`shader_frame`, two-frame post chain)

## License

Dual licensed under [MIT](./LICENSE-MIT) or [Apache-2.0](./LICENSE-APACHE).
