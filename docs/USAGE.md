# ShaderLab — usage guide (versioned)

This document describes **how to adopt ShaderLab in web projects** and **what you should expect from each shipped generation** of the package. Later sections read somewhat like a **changelog oriented toward integrators**: skim your installed semver band instead of comparing commits.

Companion detail on grammar and diagnostics lives in **[LANGUAGE.md](./LANGUAGE.md)**.

---

## Is ShaderLab a good fit?

ShaderLab targets teams already shipping **Vite-built front ends** who want **declarative, typed** `.slab` sources compiled into **GLSL + thin WebGL2 glue**, without adopting a game engine.

Reasonable examples:

- Full-screen or inset **canvas effects**, typography overlays, image manipulation passes on quads.
- **Multi-pass setups**: **`canvas_item` → spatial (augment) → `postprocess`** on one canvas — **`useShader`** on Schema **1.0** (`latest`), or **`shader_frame` + augments** on Schema **2.0** (`@testing`).

Poor fits:

- Projects needing **WebGPU-first**, a robust scene graph, skeletal animation, or asset-heavy shading pipelines — ShaderLab is intentionally narrow.

Constraints worth accepting upfront:

- **Vite-first** integration — Node-side compilation assumes Vite during dev/build.
- **`WebGL2` browsers only** for the bundled runtime path (`@yoruxiii/shaderlab` main export).

---

## Version guide for adopters

Use **`npm ls @yoruxiii/shaderlab`** (and **`peerDependency`** warnings from npm) as ground truth for **your** tree; tables below describe upstream ShaderLab releases.

### 0.4.x — Schema 2.0 (`shader_frame`, `@testing`)

> **Schema 2.0 (`shader_frame`)** — experimental. Install: `npm install @yoruxiii/shaderlab@testing`. Blurb: [NEW_API.md](../NEW_API.md).

| Topic | Behaviour |
|-------|-----------|
| **Slab** | Root `version="2.0"`; `<shader_frame id="…">` units (library, many per file). Legacy `<shader>` → **`E0401`**. |
| **Page** | `shader_frame.<id>(importedLibrary) { … }` → `ShaderFrameInstance`; then **`mount` / `unmount` / `set`**. |
| **Options `{}`** | Only **mutable** / **deferred** uniforms + positional **`augment.*`** entries. |
| **Diagnostics** | **`E04xx` / `W04xx`** — see [API.md](./API.md). **`E05xx` / `<contract>`** are **not** in this release. |
| **Types** | `.d.ts` options include mutable (and special cases like `mouse_position`) only. |

**Adoption sketch:**

1. Add the Vite plugin (same as 1.0).
2. Author slabs under Schema 2.0.
3. `import lib from "./fx.slab"`; `const fx = shader_frame.waves(lib) { speed: 2 }; fx.mount(canvas)`.
4. Framework adapters: pass the **instance**, not the slab module.

Full reference: [API.md](./API.md). Release notes: [CHANGELOG.md](../CHANGELOG.md).

### 0.3.x — Schema 1.0 (`<shader>`, npm **`latest`**)

| Topic | Behaviour |
|--------|-----------|
| **Peer tooling** | Vite **`^5` or `^6`**, Node **`≥18`**. |
| **Compiled shader kinds** | **`canvas_item`**, **`postprocess`**, and **`spatial`** (`<shader type="…">`). |
| **`spatial`** | **Standalone:** no **`CANVAS_*`** — fullscreen pass like **`canvas_item`**. **Augment:** **`CANVAS_TEXTURE`** / **`CANVAS_UV`** → **`requiresCanvasFeed`**; **`attach(canvas, { feedFrom: upstream })`** where upstream is **`canvas_item`** or a prior canvas-fed **`spatial`**. |
| **`useShader` auto-wiring** | **`canvas_item → spatial (augment)×N → postprocess`** (compile emission order, max **8** spatials). Ignores XML `<shader>` order. |
| **Parallax / 2.5D** | **`PARALLAX_UV`** + **`hint="parallax_layer"`** on **`float`** uniforms (**`canvas_item`** only); user `<vertex>` after default setup for custom 2.5D (see [LANGUAGE.md](./LANGUAGE.md)). |
| **Runtime** | Default WebGL context **`depth: false`**; 2D paths disable depth testing. **First `attach` on a canvas wins** context attributes for that canvas. |
| **Emitted artefacts** | One ES module per `.slab` import (`__shaders` + named exports). Optional **`*.slab.d.ts`** via plugin **`dts`**. |

### 0.2.x — previous generation

| Topic | Behaviour |
|--------|-----------|
| **Shader kinds** | **`canvas_item`** and **`postprocess`** only (no **`spatial`**). |
| **Install pin** | `@yoruxiii/shaderlab@0.2.1-testing.0` or older **`0.2.x-testing`** lines if you must stay on prerelease builds. |

See [CHANGELOG.md](../CHANGELOG.md) for migration notes from **0.2.x-testing** to **0.3.0**.

---

## Installation & plugin wiring

Install from **npm** (package scope **`@yoruxiii/shaderlab`** — all lowercase on the registry):

```bash
npm install @yoruxiii/shaderlab
```

Pin the current stable release:

```bash
npm install @yoruxiii/shaderlab@0.3.0
```

Alternatively, install from a **GitHub tag**:

```bash
npm install github:YelenaTor/ShaderLab#v0.3.0
```

Register once per **Vite** configuration (`vite.config.ts` / `.mts`):

```ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

Optional plugin shape (defaults remain backward-compatible until listed otherwise under **Version guide**):

```ts
shaderlab({
  /** Emit sibling `*.slab.d.ts` after each successful compile */
  dts: true,
});
```

See **[README.md](../README.md)** for framework entrypoints (`@yoruxiii/shaderlab/react`, `@yoruxiii/shaderlab/vue`, `@yoruxiii/shaderlab/nuxt`, …).

---

## TypeScript & editors

Add ambient typings so bare **`*.slab`** imports resolve before emitted declaration files land:

```json
{ "compilerOptions": { "types": ["@yoruxiii/shaderlab/client"] } }
```

Or use `/// <reference types="@yoruxiii/shaderlab/client" />` in a shared `.d.ts` entry point.

---

## CLI scaffolding

```bash
npx shaderlab init
```

Safe-by-default writers patch recognised configs without deleting manual edits; **`--dry-run`** prints unified diffs without writing. See README for **`--yes`** semantics when scripting installs.

---

## Runtime discipline — Schema 1.0 only (`0.3.x`)

> On **Schema 2.0**, use **`ShaderFrameInstance.mount` / `unmount`** instead of `useShader` / `attach`. Mount options (`visibilityPause`, `maxDevicePixelRatio`, …) apply to **`mount(target, options?)`** the same way they applied to **`attach`**.

- Prefer **`useShader(module)`** when one slab contains multiple shaders — ordering handles **`feedFrom`** wiring for postprocessing automatically.
- Prefer named **`attach`** exports only when you deliberately reorder chains or feed uniforms manually.
- Detach cleanly (`detachAll` / `detach`) before destroying canvases to avoid dangling observers.

### Performance (runtime `attach` options)

ShaderLab attaches **one WebGL2 context per `<canvas>`** and runs **one animation loop per attached root instance** (the `postprocess` pass owns the RAF when chained; the upstream `canvas_item` is driven as a slave and no longer schedules its own loop).

Heavy patterns (many small previews, docs galleries) multiply contexts and loops. Mitigations built into **`ShaderInstance.attach(canvas, options?)`**:

| Option | Purpose |
|--------|---------|
| **`maxDevicePixelRatio`** | Caps effective DPR when sizing the backing store so high-DPR laptops do not allocate oversized render targets / FBOs for tiny preview canvases. |
| **`visibilityPause`** | When `true`, uses **`IntersectionObserver`** to **pause the RAF loop** while the canvas is off-screen (saves CPU/GPU on long doc pages). |
| **`visibilityRootMargin`** | Passed through to `IntersectionObserver` as `rootMargin` when `visibilityPause` is enabled. |
| **`depthBuffer`** | Defaults to **`false`** (no depth buffer; typical 2D slabs). Set **`true`** only if you need depth attachment. Ignored if `webglContextAttributes.depth` is set explicitly. **First `attach` on a canvas wins** — later attaches share that context. |
| **`webglContextAttributes`** | Shallow-merged over ShaderLab’s defaults for `getContext("webgl2", …)` (`depth: false`, `alpha: true`, `premultipliedAlpha: false`). |

Resize handling **coalesces** `ResizeObserver` notifications to **one `syncCanvasSize` per animation frame**; **`detach()`** flushes a final sync so the backing store matches layout before teardown.

**`useShader(importedSlab)`** forwards the same `attach` options object to every shader in the slab (with `feedFrom` injected only for the `postprocess` pass), so you can pass `visibilityPause` / `maxDevicePixelRatio` once for a chain. The Vue and React **`useShader(module, attachOptions?)`** composables accept the same optional second argument (pass a **stable** object reference if you attach in React to avoid effect churn).

For many simultaneous effects in one page, the largest win remains **app architecture**: one canvas and multiple programs from the same `.slab` (or a compositor you own), rather than dozens of full-screen canvases.

Details remain in **[README.md](../README.md)** (“Vanilla runtime”, “Design invariants”).

---

## Where to look next

| Doc | Purpose |
|-----|---------|
| [NEW_API.md](../NEW_API.md) | Short **Schema 2.0** blurb |
| [API.md](./API.md) | Full **Schema 2.0** reference + migration |
| [LANGUAGE.md](./LANGUAGE.md) | **Schema 1.0** grammar (+ 2.0 pointer) |
| [CHANGELOG.md](../CHANGELOG.md) | Version-to-version integrator-facing release notes |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Maintainer workflow & compiler/runtime boundaries |

---

## npm publish notes (maintainers)

### CI (GitHub Actions)

Workflow: **[`.github/workflows/release.yml`](../.github/workflows/release.yml)**.

| Git push | npm |
|----------|-----|
| **`master`** | `npm publish --access public` → **`latest`** |
| **`Testing`** | `npm publish --access public --tag testing` |
| Tag **`v*`** | No npm (GitHub Release + plugin zip only) |

**Secret (required for branch publishes):** In the GitHub repo, open **Settings → Secrets and variables → Actions** and add **`NPM_TOKEN`** (npm granular or classic token with publish access to `@yoruxiii/shaderlab`). The workflow passes it as `NODE_AUTH_TOKEN`. See [Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions).

Each publish needs a **new** semver in `package.json` (npm rejects the same version twice).

### Manual checklist (each release)

1. Ensure version strings are updated in:
   - `package.json`
   - `package-lock.json`
   - `src/cli/index.ts`
2. Update **[CHANGELOG.md](../CHANGELOG.md)** with the new version section.
3. Run local gate:
   - `npm run check:compiler-boundary`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
4. Validate package payload:
   - `npm pack --dry-run`
5. **Push `master` or `Testing`** to trigger CI publish, or publish locally:
   - `npm publish --access public` (stable / `latest`)
   - `npm publish --access public --tag testing` (prerelease line)
