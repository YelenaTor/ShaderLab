# Contributing

## Development

```bash
npm install
npm run typecheck
npm run check:compiler-boundary
npm test
npm run build
```

The package is TypeScript and ESM-only. Source lives under `src/`; tests live under `test/`; example projects live under `examples/`.

## Architecture

ShaderLab is split into layers:

- `src/compiler`: parses, validates, and emits GLSL/runtime metadata from `.slab`.
- `src/vite`: Vite plugin, call-site transform, HMR, and browser runtime.
- `src/adapters`: framework registration helpers.
- `src/react`, `src/vue`, `src/svelte`: lifecycle wrappers around `ShaderFrameInstance`.
- `src/cli`: project detection and scaffolding.

The compiler must not import Vite, runtime, adapters, or CLI code. `npm run check:compiler-boundary` enforces that rule.

## Changing The Slab Language

When changing syntax, frame types, builtins, hints, or diagnostics:

1. Update compiler types, parser, validator, and codegen together.
2. Add or update fixtures under `test/fixtures`.
3. Add compiler tests for valid and invalid cases.
4. Update `docs/LANGUAGE.md`, `docs/AGENTS.md` (if agent-facing behavior changed), and any relevant usage examples.
5. Run the full verification commands.

## Changing Runtime Behavior

When changing mount, uniform, texture, FBO, HMR, or composition behavior:

1. Add focused runtime or integration tests.
2. Keep framework helpers thin; they should only mount and unmount instances.
3. Preserve `ShaderFrameInstance` behavior unless the change is intentional and documented.

## Changing The Transform

`shader_frame.<id>(lib) { ... }` is custom pre-JS syntax. The Vite transform must:

- ignore strings, comments, and template literals
- preserve `.slab` import paths
- rewrite only ShaderLab call arguments
- throw clear errors instead of silently dropping unsupported entries

Add tests in `test/compiler/shader-frame-transform.test.ts` for every transform edge case.

## Release Checklist

Before publishing:

```bash
npm run typecheck
npm run check:compiler-boundary
npm test
npm run build
```

Check that generated package exports match `package.json`, docs do not link to deleted files, and the vanilla Vite example still builds.
