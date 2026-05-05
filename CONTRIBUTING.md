# Contributing

Thanks for helping improve ShaderLab. This document is the practical checklist maintainers expect from patches.

## Intent

ShaderLab is **declarative slab intent → deterministic macro expansion** into GLSL plus narrow runtime glue. Prefer one obvious lowering path over open-ended escape hatches unless a change is explicitly scoped and documented in **`docs/LANGUAGE.md`** (grammar semantics) and **`docs/USAGE.md`** (integrator-facing versioning notes).

## Project layout

| Area | Role |
|------|------|
| `src/compiler/` | Parse, validate, codegen, diagnostics, `*.slab.d.ts` emission — **must not** import Vite, adapters, or CLI code |
| `src/vite/` | Vite plugin and WebGL runtime (`ShaderLabRuntime`, `createShaderInstance`) |
| `src/runtime/` | `useShader` orchestration (browser-safe relative to compiler) |
| `src/cli/` | `shaderlab` bin (`init`, detection, config writers) |
| `src/adapters/` | Thin Nuxt / SvelteKit / Remix entrypoints |
| `src/react`, `src/vue`, `src/svelte` | Framework bindings |
| `test/` | Vitest unit + integration tests; fixtures in `test/fixtures/` |

## Local development

From the repo root:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:compiler-boundary
```

Use Node **18+** (see `package.json` `engines`). The compiler boundary script enforces that `src/compiler/` stays free of `vite/`, `adapters/`, and `cli/` imports.

**GitHub Actions:** `.github/workflows/ci.yml` and `release.yml` are currently **disabled stubs** (manual `workflow_dispatch` only). Uncomment the template blocks in those files when you want push/PR CI or tag-based npm publishes.

## Diagnostics and error codes

When you add or change a diagnostic:

1. Register it in [`src/compiler/errors.ts`](src/compiler/errors.ts) under **`ERROR_CODES`** with the correct **Warn / Hazard / Error** tier.
2. Emit it via **`diagnostic(...)`** from that module so severity always matches the registry.
3. Set **`filename`** and **`line`** (use `1` when there is no finer location).
4. Add or extend a **`.slab` fixture** under `test/fixtures/` and assertions in [`test/compiler/compile.test.ts`](test/compiler/compile.test.ts) or a focused test file.
5. Keep **[`test/compiler/error-registry-coverage.test.ts`](test/compiler/error-registry-coverage.test.ts)** green — every code ID must appear in fixtures or linked test sources.
6. Keep **[`test/compiler/diagnostic-shape.test.ts`](test/compiler/diagnostic-shape.test.ts)** green — shape and registry alignment for fixture diagnostics.

## Runtime changes

The core runtime is intentionally small (see [README.md](./README.md#runtime-minimalism-and-deferred-ideas)). For PRs that expand runtime behavior, briefly cover:

1. **Problem** — what breaks without the change.
2. **Smaller alternative** — what you ruled out (userland helper, codegen-only fix, etc.) and why it failed.
3. **Escape hatch** — how adopters avoid or override the behavior when they do not need it.

## Pull requests

- Keep commits focused; match existing formatting and import style.
- Run **`npm test`**, **`npm run typecheck`**, **`npm run build`**, and **`npm run check:compiler-boundary`** before pushing when your change touches compiled code or CI expectations.
- If you touch CLI config writers, extend or adjust [`test/cli/writers.test.ts`](test/cli/writers.test.ts) so idempotent behavior stays covered.

## Documentation alignment

- **`docs/LANGUAGE.md`** — normative `.slab` grammar & diagnostics summaries for the shipped compiler.
- **`docs/USAGE.md`** — versioned adoption expectations (extended whenever semver-visible behaviour shifts materially).
- **[README.md](./README.md)** — product-facing overview + deliberate divergences (“Spec and docs divergences”).

Keep those three layers coherent whenever compiler-visible semantics move.
