# ShaderLab — usage guide (versioned)

This document describes **how to adopt ShaderLab in web projects** and **what you should expect from each shipped generation** of the package. Later sections read somewhat like a **changelog oriented toward integrators**: skim your installed semver band instead of comparing commits.

Companion detail on grammar and diagnostics lives in **[LANGUAGE.md](./LANGUAGE.md)**.

---

## Is ShaderLab a good fit?

ShaderLab targets teams already shipping **Vite-built front ends** who want **declarative, typed** `.slab` sources compiled into **GLSL + thin WebGL2 glue**, without adopting a game engine.

Reasonable examples:

- Full-screen or inset **canvas effects**, typography overlays, image manipulation passes on quads.
- **Multi-pass setups**: draw into **`canvas_item`**, optionally **`spatial`** (augment), then **`postprocess`** — all on one canvas via **`useShader`** from **0.3.1** (see version guide).

Poor fits:

- Projects needing **WebGPU-first**, a robust scene graph, skeletal animation, or asset-heavy shading pipelines — ShaderLab is intentionally narrow.

Constraints worth accepting upfront:

- **Vite-first** integration — Node-side compilation assumes Vite during dev/build.
- **`WebGL2` browsers only** for the bundled runtime path (`@yoruxiii/shaderlab` main export).

---

## Version guide for adopters

Use **`npm ls @yoruxiii/shaderlab`** (and **`peerDependency`** warnings from npm) as ground truth for **your** tree; tables below describe upstream ShaderLab releases.

### 0.3.x testing (`@yoruxiii/shaderlab@^0.3`)

| Topic | Behaviour |
|--------|-----------|
| **Peer tooling** | Unchanged from 0.2.x — Vite **`^5` or `^6`**, Node **`≥18`**. |
| **Compiled shader kinds** | **`canvas_item`**, **`postprocess`**, and **`spatial`** (`<shader type="…">`). |
| **`spatial`** | **Standalone:** no **`CANVAS_*`** builtins — fullscreen pass like **`canvas_item`**. **Augment:** references **`CANVAS_TEXTURE`** / **`CANVAS_UV`** → metadata **`requiresCanvasFeed`**; runtime **`attach(canvas, { feedFrom: canvasItem \| priorSpatial })`**. Uses the same offscreen FBO draw pattern as **`postprocess`**. |
| **`useShader` auto-wiring** | Sorted pipeline: **`canvas_item` → spatial (augment)×N → postprocess`**. **`useShader` ignores `<shader>` order** in the file; multiple canvas-fed spatials run in **compile emission order** (up to **8**). |
| **Vertex 2.5D / parallax** | Documented for **`canvas_item`**: user `<vertex>` after default setup, or **`PARALLAX_UV`** + **`hint="parallax_layer"`** (see [LANGUAGE.md](./LANGUAGE.md)). Layered “floating” looks combine parallax background + **`spatial`** augment + optional **`postprocess`**. |

### 0.3.2-testing (`@yoruxiii/shaderlab@0.3.2-testing.0`)

**Parallax** on **`canvas_item`** (`PARALLAX_UV`, `parallax_layer` hint). **Multi-spatial** chains and **`spatial` → `spatial`** `feedFrom` in runtime / **`useShader`**.

### 0.3.1-testing (`@yoruxiii/shaderlab@0.3.1-testing.0`)

Adds the **three-stage compositor**: **`postprocess`** may **`feedFrom`** a canvas-fed **`spatial`**; **`SCREEN_TEXTURE`** samples spatial’s output, not the raw canvas pass.

### 0.2.x testing (`@yoruxiii/shaderlab@^0.2`)

Prior-generation behaviour (still accurate for older pins):

| Topic | Behaviour |
|--------|-----------|
| **Peer tooling** | Vite **`^5` or `^6`** (`@yoruxiii/shaderlab/vite`); optional peers only when importing bindings (`react`, `vue`, `svelte`, `@nuxt/kit`). Node **`≥18`**. |
| **Compiled shader kinds** | Only **`canvas_item`** and **`postprocess`** (`<shader type="…">`). Unknown kinds fail with **`E0203`**. |
| **Emitted artefacts** | One ES module per `.slab` import (`__shaders` plus named exports). Optional sibling **`*.slab.d.ts`** via plugin option **`dts`** (defaults documented with package README). |
| **Runtime API** | `useShader(importedModule)` takes the **bundler-produced module**, never a filesystem path string. Post-process shaders attach with **`feedFrom`** pointing at the upstream **`canvas_item`** instance produced by the same tooling stack. |
| **Recent quality changes** | Shared template helpers; diagnostic line mapping for `<shader>` / `<uniform>`; strict `BlendMode`; runtime attach options (DPR cap, visibility pause, debounced resize, uniform dirty uploads) — see [CHANGELOG.md](../CHANGELOG.md). |
| **CLI** | `shaderlab init` detects stacks and patches configs (`--dry-run`, `-y` / `--yes` documented in README). |
| **Editor typings** | `@yoruxiii/shaderlab/client` ambient typings until sibling **`*.slab.d.ts`** exists beside sources. |

Planned documentation hygiene:

- Each subsequent **minor / major** that materially changes integration guarantees gets its own subsection above (“### `0.2.x`”, …), preserving historical compatibility expectations without rewriting older bullets silently.

---

## Installation & plugin wiring

Install from **npm** (package scope **`@yoruxiii/shaderlab`** — all lowercase on the registry):

```bash
npm install @yoruxiii/shaderlab
```

For a specific prerelease or to follow the `testing` dist-tag:

```bash
npm install @yoruxiii/shaderlab@0.3.2-testing.0
```

Alternatively, install from a **GitHub tag** (same tree as the release tag):

```bash
npm install github:YelenaTor/ShaderLab#v0.3.2-testing.0
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

## Runtime discipline (0.2.x recap)

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
| **`depthBuffer`** | Set to `false` for typical 2D slabs to avoid allocating a depth buffer (ignored if `webglContextAttributes.depth` is set explicitly). |
| **`webglContextAttributes`** | Shallow-merged over ShaderLab’s defaults for `getContext("webgl2", …)`. |

Resize handling **coalesces** `ResizeObserver` notifications to **one `syncCanvasSize` per animation frame**; **`detach()`** flushes a final sync so the backing store matches layout before teardown.

**`useShader(importedSlab)`** forwards the same `attach` options object to every shader in the slab (with `feedFrom` injected only for the `postprocess` pass), so you can pass `visibilityPause` / `maxDevicePixelRatio` once for a chain. The Vue and React **`useShader(module, attachOptions?)`** composables accept the same optional second argument (pass a **stable** object reference if you attach in React to avoid effect churn).

For many simultaneous effects in one page, the largest win remains **app architecture**: one canvas and multiple programs from the same `.slab` (or a compositor you own), rather than dozens of full-screen canvases.

Details remain in **[README.md](../README.md)** (“Vanilla runtime”, “Design invariants”).

---

## Where to look next

| Doc | Purpose |
|-----|---------|
| [LANGUAGE.md](./LANGUAGE.md) | `.slab` grammar, builtins, hints, `render_mode`, diagnostic codes |
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
