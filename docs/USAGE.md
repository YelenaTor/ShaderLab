# ShaderLab — usage guide (versioned)

This document describes **how to adopt ShaderLab in web projects** and **what you should expect from each shipped generation** of the package. Later sections read somewhat like a **changelog oriented toward integrators**: skim your installed semver band instead of comparing commits.

Companion detail on grammar and diagnostics lives in **[LANGUAGE.md](./LANGUAGE.md)**.

---

## Is ShaderLab a good fit?

ShaderLab targets teams already shipping **Vite-built front ends** who want **declarative, typed** `.slab` sources compiled into **GLSL + thin WebGL2 glue**, without adopting a game engine.

Reasonable examples:

- Full-screen or inset **canvas effects**, typography overlays, image manipulation passes on quads.
- **Two-tier setups**: draw UI or gameplay-related visuals into one shader-backed canvas (`canvas_item`), then optionally route through a **`postprocess`** shader reading **`SCREEN_TEXTURE`** for grading, blur-ish kernels you maintain yourself, etc.

Poor fits:

- Projects needing **WebGPU-first**, a robust scene graph, skeletal animation, or asset-heavy shading pipelines — ShaderLab is intentionally narrow.

Constraints worth accepting upfront:

- **Vite-first** integration — Node-side compilation assumes Vite during dev/build.
- **`WebGL2` browsers only** for the bundled runtime path (`shaderlab` main export).

---

## Version guide for adopters

Use **`npm ls shaderlab`** (and **`peerDependency`** warnings from npm) as ground truth for **your** tree; tables below describe upstream ShaderLab releases.

### 0.1.x (`shaderlab@^0.1`)

Current-generation behaviour:

| Topic | Behaviour |
|--------|-----------|
| **Peer tooling** | Vite **`^5` or `^6`** (`shaderlab/vite`); optional peers only when importing bindings (`react`, `vue`, `svelte`, `@nuxt/kit`). Node **`≥18`**. |
| **Compiled shader kinds** | Only **`canvas_item`** and **`postprocess`** (`<shader type="…">`). Anything else is a compile-time **`E0203`** with guidance toward supported strings (see [LANGUAGE.md](./LANGUAGE.md)). |
| **Emitted artefacts** | One ES module per `.slab` import (`__shaders` plus named exports). Optional sibling **`*.slab.d.ts`** via plugin option **`dts`** (defaults documented with package README). |
| **Runtime API** | `useShader(importedModule)` takes the **bundler-produced module**, never a filesystem path string. Post-process shaders attach with **`feedFrom`** pointing at the upstream **`canvas_item`** instance produced by the same tooling stack. |
| **CLI** | `shaderlab init` detects stacks and patches configs (`--dry-run`, `-y` / `--yes` documented in README). |
| **Editor typings** | `shaderlab/client` ambient typings until sibling **`*.slab.d.ts`** exists beside sources. |

Planned documentation hygiene:

- Each subsequent **minor / major** that materially changes integration guarantees gets its own subsection above (“### `0.2.x`”, …), preserving historical compatibility expectations without rewriting older bullets silently.

---

## Installation & plugin wiring

```bash
npm install shaderlab
```

Register once per **Vite** configuration (`vite.config.ts` / `.mts`):

```ts
import { defineConfig } from "vite";
import shaderlab from "shaderlab/vite";

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

See **[README.md](../README.md)** for framework entrypoints (`shaderlab/react`, `shaderlab/vue`, `shaderlab/nuxt`, …).

---

## TypeScript & editors

Add ambient typings so bare **`*.slab`** imports resolve before emitted declaration files land:

```json
{ "compilerOptions": { "types": ["shaderlab/client"] } }
```

Or use `/// <reference types="shaderlab/client" />` in a shared `.d.ts` entry point.

---

## CLI scaffolding

```bash
npx shaderlab init
```

Safe-by-default writers patch recognised configs without deleting manual edits; **`--dry-run`** prints unified diffs without writing. See README for **`--yes`** semantics when scripting installs.

---

## Runtime discipline (0.1.x recap)

- Prefer **`useShader(module)`** when one slab contains multiple shaders — ordering handles **`feedFrom`** wiring for postprocessing automatically.
- Prefer named **`attach`** exports only when you deliberately reorder chains or feed uniforms manually.
- Detach cleanly (`detachAll` / `detach`) before destroying canvases to avoid dangling observers.

Details remain in **[README.md](../README.md)** (“Vanilla runtime”, “Design invariants”).

---

## Where to look next

| Doc | Purpose |
|-----|---------|
| [LANGUAGE.md](./LANGUAGE.md) | `.slab` grammar, builtins, hints, `render_mode`, diagnostic codes |
| [README.md](../README.md) | Product overview, framework snippets, quick glossary |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Maintainer workflow & compiler/runtime boundaries |
