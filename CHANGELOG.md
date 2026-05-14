# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for public API expectations. Prerelease lines use the `testing` prerelease label (`0.x.x-testing.n`).

## [Unreleased]

- Nothing yet on `main` after the latest tagged release; see [GitHub Releases](https://github.com/YelenaTor/ShaderLab/releases) for tag notes.

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
