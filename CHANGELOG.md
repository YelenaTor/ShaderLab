# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for public API expectations. Prerelease lines use the `testing` prerelease label (`0.x.x-testing.n`).

## [Unreleased]

- **CI**: GitHub Actions release workflow publishes to npm on push to **`master`** (`latest`) or **`Testing`** (`--tag testing`); tag **`v*`** pushes still build the plugin zip and GitHub Release only. Requires repo secret **`NPM_TOKEN`**. See [README](./README.md) and [USAGE](./docs/USAGE.md) maintainers sections.

## [0.3.1-testing.0] - 2026-05-14

### Added

- **3-stage compositor**: one slab can auto-wire **`canvas_item` → spatial (augment) → `postprocess`** via **`useShader`**. Pipeline order is fixed (XML `<shader>` order does not affect wiring). Only the terminal pass runs the animation loop.

### Changed

- **Runtime**: canvas-fed **`spatial`** `drawScenePass` renders the full augment (feeder → scratch FBO → spatial) into the caller’s bound framebuffer, so **`postprocess`** can use **`feedFrom: spatialInstance`**.
- **`useShader`**: removed the throw that blocked **`postprocess`** and canvas-fed **`spatial`** in the same module.

### Fixed

- **Post chains through spatial**: **`SCREEN_TEXTURE`** now samples the spatial stage output when **`feedFrom`** points at a canvas-fed spatial runtime, not the raw canvas pass.

## [0.3.0-testing.0] - 2026-05-14

### Added

- **`type="spatial"`** shader kind: strict builtin set (`UV`, `COLOR`, `VERTEX_COLOR`, `TIME`, `RESOLUTION`, and augment-only **`CANVAS_UV`** / **`CANVAS_TEXTURE`**). Compiler emits **`requiresCanvasFeed`** / **`canvasTextureUnit`** metadata when augment builtins are referenced.
- **Runtime**: **`spatial`** standalone draws like **`canvas_item`**; **`spatial`** augment reuses the **`postprocess`** offscreen FBO + fullscreen sampling path with **`u_slab_canvas_texture`**.
- **`useShader`**: auto-wires **`canvas_item` + one canvas-fed `spatial`**, **`spatial` only** (standalone), and existing **`canvas_item` + `postprocess`**; **throws** if **`postprocess`** and canvas-fed **`spatial`** appear in the same module (multi-stage compositor deferred).

### Changed

- **Diagnostics**: **`E0203`** suggestions and **`H0101`** / **`H0312`** messaging include **`spatial`**; registry **`H0101`** summary text broadened to all supported shader kinds.

### Documentation

- **[LANGUAGE.md](./docs/LANGUAGE.md)**: **`spatial`** builtins and contracts; **vertex-forward 2.5D** on **`canvas_item`** (worked sketch).
- **[README.md](./README.md)** / **[USAGE.md](./docs/USAGE.md)**: version guide **`0.3.x`**, install pin examples.

## [0.2.1-testing.0] - 2026-05-14

### Added

- **npm**: Scoped package [`@yoruxiii/shaderlab`](https://www.npmjs.com/package/@yoruxiii/shaderlab) published for install from the registry (use dist-tag `testing` as appropriate).
- **Runtime — `attach(canvas, options?)`**: Optional `maxDevicePixelRatio`, `visibilityPause` / `visibilityRootMargin` (IntersectionObserver), `depthBuffer`, `webglContextAttributes`; coalesced `ResizeObserver` → `syncCanvasSize` (one pass per frame); final `syncCanvasSize` on `detach()`.
- **Runtime — performance**: Per-uniform dirty tracking so unchanged user uniforms are not re-uploaded every frame; cached blend/cull/`useProgram` when state unchanged; postprocess feeder no longer keeps its own RAF loop when slaved to a post pass.
- **`useShader` (slab module helper)**: Forwards shared attach options to the feeder and each postprocess shader (`feedFrom` is injected only for post).
- **Vue / React composables**: Optional second argument `useShader(module, attachOptions?)` passed through to `attach`.
- **Docs**: [Usage guide](./docs/USAGE.md) “Performance” subsection for attach options; this changelog.

### Changed

- **Compiler**: Shared uniform/blend helpers in `src/compiler/templates/shared.ts` to deduplicate `canvas_item` / `postprocess` templates.
- **Compiler / diagnostics**: Best-effort line numbers for `<shader>` / `<uniform>` opening tags (raw-source scan) instead of defaulting many diagnostics to line 1.
- **Types**: Strict `BlendMode` (`"add" | "multiply" | "premult_alpha" | null`); removed unused `"normal"` blend literal from metadata typing.

### Fixed

- **Post chains**: Upstream `canvas_item` used as `feedFrom` no longer schedules a redundant animation loop after `_ensureSlave` (only the post root drives the RAF).

## [0.2.0-testing.0] - 2026-05 (internal / tag-era)

Minor bump window for template + diagnostic typing work leading up to `0.2.1-testing.0`. Prefer **`0.2.1-testing.0`** as the reference release for npm + runtime attach options.

## [0.1.0-testing.0] - earlier prerelease

Initial public-shape prerelease: Vite plugin, `.slab` → GLSL + runtime module emission, `canvas_item` / `postprocess`, CLI `init`, core diagnostics registry, and WebGL2 runtime (`useShader`, `feedFrom`). See git history and [README](./README.md) for the full mental model.
