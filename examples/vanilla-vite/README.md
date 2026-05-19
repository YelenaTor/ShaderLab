# ShaderLab — vanilla Vite example

**Schema 2.0 (`shader_frame`)** demo: `hello.slab` defines `bg` + `chroma`; `main.ts` calls `shader_frame.*` and mounts a post chain.

## Run locally

Build the parent package first:

```bash
cd ../..
npm install
npm run build
cd examples/vanilla-vite
npm install
npm run dev
```

Open the URL Vite prints. You should see an animated background with a chromatic-style post pass.

With `npm run dev`, editing `hello.slab` hot-reloads WebGL programs. A `hello.slab.d.ts` sidecar is emitted for TypeScript (gitignored in this folder).

## API shape

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import hello from "./hello.slab";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const chroma = shader_frame.chroma(hello);
chroma.mount(canvas);
```

For a single `canvas_item` with no post chain, one call plus `mount` is enough — see [NEW_API.md](../../NEW_API.md).

Typing: `"types": ["@yoruxiii/shaderlab/client"]` in `tsconfig.json`.
