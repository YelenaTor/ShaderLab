# ShaderLab — vanilla Vite example

## Run locally

Requires the parent `shaderlab` package to be built first:

```bash
cd ../..
npm install
npm run build
cd examples/vanilla-vite
npm install
npm run dev
```

Open the URL Vite prints. You should see an animated background with a light chromatic-style full-screen postprocess pass driven by `hello.slab`.

With `npm run dev`, editing `hello.slab` hot-reloads the WebGL programs via Vite HMR; uniform values are preserved when names and types match across reloads. A `hello.slab.d.ts` sidecar is emitted next to the slab for TypeScript (listed in `.gitignore` here).

## API shape

This demo imports **named shader exports** (`chroma`, `bg`) and calls `chroma.attach(canvas, { feedFrom: bg })`. Equivalently you can `import hello from "./hello.slab"` and use `useShader(hello)` from `shaderlab` to attach the feeder and postprocess in one call—see the root package [README](../../README.md).

For ambient `*.slab` typing in your own project, add `"types": ["shaderlab/client"]` to `tsconfig.json` or a `/// <reference types="shaderlab/client" />` directive.
