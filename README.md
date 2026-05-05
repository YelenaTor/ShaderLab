# ShaderLab

[![GitHub](https://img.shields.io/badge/GitHub-YelenaTor%2FShaderLab-181717?logo=github)](https://github.com/YelenaTor/ShaderLab)
[![npm](https://img.shields.io/badge/npm-not%20published-lightgrey)](https://github.com/YelenaTor/ShaderLab)
[![license](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](./LICENSE-MIT)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](./package.json)
[![CI](https://img.shields.io/badge/GitHub%20Actions-disabled-lightgrey)](https://github.com/YelenaTor/ShaderLab/actions)

Automated CI and npm publishing via Actions are **turned off** for now (workflows are manual/no-op stubs). Run **`npm test`**, **`npm run build`**, and **`npm run check:compiler-boundary`** locally — see [CONTRIBUTING.md](./CONTRIBUTING.md).

**Mental model.** A `.slab` file is a **small schema-on-XML container**: declarative shader metadata plus embedded GLSL snippets. The **compiler** parses that intent, validates it, and emits **GLSL**, **runtime glue** (feeders, attach metadata, optional postprocess wiring), and **`*.slab.d.ts`** typings. Your app imports the emitted ES module; **`useShader` / `attach`** connect it to a canvas. Nothing here replaces a full engine pipeline—the toolchain stays narrow on purpose.

ShaderLab is a **shader authoring compiler toolchain**, **Vite-first** for adoption: the default integration is the Vite plugin and generated modules, not “only a plugin” in the sense of a cosmetic bundler tweak.

**`.slab` is not generic XML.** The surface is a minimal, versioned tag set used as carrier syntax. Arbitrary XML features or open-ended schemas are out of scope; the grammar stays tight so tooling stays predictable.

**Docs:** [Usage guide](./docs/USAGE.md) (versioned adoption / changelog-style expectations) · [Slab language reference](./docs/LANGUAGE.md) (grammar, builtins, diagnostics).

### Compile pipeline

1. **Parse** — `.slab` → AST (structure + GLSL bodies).
2. **Validate** — types, uniforms, hints, render modes, builtin/shader-type rules → diagnostics.
3. **Codegen** — vertex/fragment GLSL, runtime metadata, module exports.
4. **Emit** — JS module + optional sibling **`*.slab.d.ts`** (plugin `dts` option).
5. **Attach** — imported module consumed by `useShader` / framework bindings / manual `attach`.

### Glossary

| Term | Meaning |
|------|---------|
| **`.slab`** | ShaderLab source file: one module, multiple `<shader>` entries when needed. |
| **Macro expansion** | Deterministic lowering from declarative slab intent to emitted GLSL + glue (not a user Turing-complete preprocessor). |
| **Builtin** | Compiler-provided symbols (e.g. `SCREEN_TEXTURE`, `TEXTURE`) valid only for certain shader types. |
| **Hint** | Uniform annotation (`hint="..."`) influencing typings and runtime feeding semantics. |
| **`render_mode`** | Declarative raster/blend/depth flags; unknown tokens warn and are ignored. |

### Shader types (0.1.x)

The compiler and runtime **support `canvas_item` and `postprocess` only**. Other profile names you might see in forks or older drafts are **unknown `type` values here** — the compiler fails with **`E0203`** and a suggestion to use the two supported types (see [LANGUAGE.md](./docs/LANGUAGE.md)).

## Install

```bash
npm install shaderlab
```

Peer dependency: **Vite** `^5` or `^6` (the compiler and plugin run in Node during dev/build). Framework packages (`react`, `vue`, `svelte`, `@nuxt/kit`) are optional peers used only when you import those entry points.

## Entry points

| Import | Use |
|--------|-----|
| `shaderlab` | Browser/runtime: `useShader`, `createShaderInstance`, shared types |
| `shaderlab/vite` | **`vite.config` only** — default-export Vite plugin (keeps Node/compiler out of app bundles) |
| `shaderlab/react`, `shaderlab/vue`, `shaderlab/svelte` | Framework hooks/components/actions |
| `shaderlab/nuxt` | Nuxt module (`modules: ["shaderlab/nuxt"]`) |
| `shaderlab/sveltekit`, `shaderlab/remix` | Same Vite plugin re-exported for convenient config imports |
| `shaderlab/client` | Ambient types for `*.slab` (see [Typing](#typing)) |

## Vite setup

Register the plugin in `vite.config.ts` (or `.mts`):

```ts
import { defineConfig } from "vite";
import shaderlab from "shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

Optional plugin options:

```ts
shaderlab({
  /** Emit sibling `*.slab.d.ts` after each successful compile (default: true). Set `false` to skip. */
  dts: true,
});
```

## Importing `.slab` modules

The plugin turns each `.slab` file into an ES module:

- **`__shaders`** — map of every compiled shader instance (what `useShader` consumes).
- **Named exports** — one per `<shader id="…">` (camelCase where applicable), each a `ShaderInstance` you can `.attach()` yourself.

So you either pass the **whole module** into `useShader`, or import specific shaders and wire `attach` / `feedFrom` manually (see the vanilla example’s postprocess chain).

## Vanilla runtime

**Recommended:** import the module and pass it to `useShader` (handles feeder + postprocess ordering).

```ts
import hello from "./hello.slab";
import { useShader } from "shaderlab";

const canvas = document.querySelector("canvas")!;
const { shaders, attach, detachAll } = useShader(hello);

attach(canvas);
// later: detachAll();
```

**Manual:** named imports match shader ids — useful when you need explicit `feedFrom` or non-default attach order:

```ts
import { chroma, bg } from "./hello.slab";

const canvas = document.getElementById("app") as HTMLCanvasElement;
chroma.attach(canvas, { feedFrom: bg });
```

`useShader(mod)` expects the **imported module** (`SlabModule` / `__shaders`), **not** a string path. Spec-style `useShader("./path.slab")` is not supported.

Postprocess shaders require `attach(canvas, { feedFrom: canvasItemInstance })`. See **`AttachOptions`** in the package typings.

## Framework bindings

- **React** (`shaderlab/react`): `useShader(mod)`, `<ShaderLab module={mod} />`.
- **Vue** (`shaderlab/vue`): `useShader(mod)`, `ShaderLab` component (`module` prop).
- **Svelte** (`shaderlab/svelte`): `shaderlab` action — `<canvas use:shaderlab={{ module: mod }} />`. The package also exposes a `ShaderLab` component via the `svelte` export condition on this same entry (see `exports["./svelte"]` in `package.json`).

All of these expect the **imported `.slab` module**, not a path string.

**Nuxt:** `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ["shaderlab/nuxt"],
});
```

Optional module options are forwarded to the Vite plugin (e.g. `shaderlab: { dts: false }`).

**SvelteKit / Remix:** add `import shaderlab from "shaderlab/sveltekit"` or `"shaderlab/remix"` beside the framework’s Vite plugin in `vite.config.ts` (see package JSDoc for snippets).

## CLI

Scaffold config and a starter slab:

```bash
npx shaderlab init
```

Preview changes without writing (same detection and patch logic; unified-diff preview per file):

```bash
npx shaderlab init --dry-run
```

Init is **non-interactive** by default (no prompts). Use `-y` / `--yes` to affirm automation explicitly—today this is documentation-only for CI/scripts; if confirmations are added later, `-y` will skip them.

```bash
npx shaderlab init --yes
```

Detects the project stack and patches Vite (and related) config **safely**:

- **Non-destructive:** nothing is deleted; edits only add imports or insert into matching `plugins` / `modules` arrays when patterns are recognized (see [`test/cli/writers.test.ts`](./test/cli/writers.test.ts)).
- **Idempotent:** re-running `init` skips configs that already reference ShaderLab.

## Typing

For editor support on `*.slab` imports before or alongside emitted sidecars:

```ts
/// <reference types="shaderlab/client" />
```

Or in `tsconfig.json`:

```json
"compilerOptions": {
  "types": ["shaderlab/client"]
}
```

Each successful compile can also emit a precise **`*.slab.d.ts`** next to the slab (enabled by default via the `dts` plugin option).

## Runtime minimalism and deferred ideas

The core runtime intentionally stays **small**: compile artifacts in, WebGL program lifecycle and documented feeders out. Treat anything that smells like a scene graph, asset pipeline, or camera stack as **out of scope** unless explicitly revived later.

**Runtime today — in scope**

- Consume emitted slab modules (`useShader`, `attach` / `detach`, framework wrappers).
- Drive uniforms from hints and feeders (`mouse_position`, textures, etc., as typed).
- Honor declared render modes and blend/cull metadata within WebGL limits.
- Postprocess / FBO chains via **`feedFrom`** and shader ordering you wire in userland (no mandatory scene abstraction).

**Runtime today — not in scope (non-goals)**

- Scene graph, entity/component systems, or retained mesh hierarchies.
- Built-in cameras, animation timelines, or physics.
- Asset loading policies beyond what typings + your app provide.
- “Just add one more engine feature” without going through [CONTRIBUTING.md](./CONTRIBUTING.md) runtime criteria.

**Parked for possible 2.x / userland** (ideas only; not commitments)

- Alternate bundler carriers beside Vite (same compiler, different glue).
- Optional 3D-style slab profiles / scene-graph helpers, likely as a **later major** once scope and tests are pinned down (tracked philosophically in README/TODOs — no standalone spec doc ships with the package).
- Optional higher-level helpers **outside** `shaderlab` core or behind explicit opt-in packages.
- Richer diagnostic surfaces (IDE plugins, structured reporter hooks).

Revisit this boundary when reviewing runtime PRs—see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Design invariants (don’t regress)

- **`useShader(imported module)`** — bundler-safe, typed imports only (see [Spec divergences](#spec-and-docs-divergences)).
- **`mouse_position`** — runtime-managed; typings stay **readonly**.
- **Hints** — semantic contracts (`range`, `color`, textures, etc.); behavior lives in compiler metadata + runtime + tests—avoid treating hints as inert comments.
- **`render_mode`** — parsed as an **unordered set** of flags ([LANGUAGE.md](./docs/LANGUAGE.md#render_mode)); token order must not change behavior.

## Understanding errors

Diagnostics follow a fixed shape where possible: **file**, **line**, **`E…` / `H…` / `W…` code**, **severity**, **message**, optional **suggestion** (see [LANGUAGE.md](./docs/LANGUAGE.md#diagnostics-and-stable-codes)). Compiler diagnostics take **`severity` from the code registry** so Warn/Hazard/Error tiers cannot drift per message.

| Severity | Meaning |
|----------|---------|
| **Warn** | Compile succeeds; something is ignored or questionable (typo’d `render_mode`, unknown `hint`, etc.). |
| **Hazard** | Compile succeeds but behavior may surprise you (wrong shader type for a builtin, contradictory blend flags, lighting-related `render_mode` tokens that do nothing on 2D shader types in 0.1.x, runtime clamp). |
| **Error** | Compile fails; output module is not emitted until fixed. |

Examples (formatted like the compiler):

```
[shaderlab] fx.slab:4
  W0101 [Warn] — Unknown `render_mode` flag "blend_fancy" — will be ignored
```

```
[shaderlab] fx.slab:6
  H0312 [Hazard] — 'SCREEN_TEXTURE' is not available in type="canvas_item"
  → Use type="postprocess" for SCREEN_TEXTURE / SCREEN_UV
```

**Errors** block emission—for instance duplicate shader `id` or missing `<fragment>`—and surface as `CompileError` from the compile path.

## Spec and docs divergences

- Runtime APIs take an **imported module** (`useShader(hello)`), not a **string path** (`useShader("./hello.slab")`).
- `hint="mouse_position"` uniforms are owned by the runtime and surface as readonly tuple types in generated typings.

## Examples

- **`examples/vanilla-vite`** — dev server, HMR, named `attach` usage; build is covered by integration tests.
- **`examples/nuxt`** — placeholder directory only; use `shaderlab/nuxt` in a real Nuxt app (see above).

## License

Dual licensed under [MIT](./LICENSE-MIT) or [Apache-2.0](./LICENSE-APACHE).
