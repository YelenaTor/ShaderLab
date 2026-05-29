# Minimal Schema 2.0 example (reference)

These files ship inside the npm package under `docs/example/`. Copy them into a Vite app (or compare with your own project).

## What it shows

- `hello.slab` — `canvas_25d` feeder (`bg`) + `postprocess` terminal (`chroma`) in one library.
- `main.ts` — call the **terminal** frame; ShaderLab auto-wires `bg → chroma`. Uniform keys in the options object route to the feeder (`depth`, `parallax`) or terminal (`strength`).

## Vite setup

```ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

```html
<canvas id="app" width="800" height="600"></canvas>
<script type="module" src="/main.ts"></script>
```

Add to `tsconfig.json`:

```json
{ "compilerOptions": { "types": ["@yoruxiii/shaderlab/client"] } }
```

## Runnable copy in the repo

The full Vite project (with `package.json` and dev server) lives at [examples/vanilla-vite](../../examples/vanilla-vite) in the ShaderLab repository.
