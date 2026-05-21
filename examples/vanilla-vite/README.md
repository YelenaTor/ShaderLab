# ShaderLab Vanilla Vite Example

This example demonstrates the current Schema 2.0 flow:

- `hello.slab` defines a `canvas_25d` background frame named `bg`.
- `hello.slab` also defines a `postprocess` frame named `chroma`.
- `main.ts` calls `shader_frame.chroma(hello) { ... }`.
- ShaderLab auto-wires `bg -> chroma` and mounts one `ShaderFrameInstance`.

## Run

From the repository root:

```bash
npm install
npm run build
cd examples/vanilla-vite
npm install
npm run dev
```

Open the URL printed by Vite.

## API Shape

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import hello from "./hello.slab";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const chroma = shader_frame.chroma(hello) {
  depth: 0.55,
  parallax: 0.07,
  strength: 0.012,
};

chroma.mount(canvas);
```

`depth` and `parallax` route to the upstream `canvas_25d` frame. `strength` routes to the terminal `postprocess` frame.

Typing is enabled through `"types": ["@yoruxiii/shaderlab/client"]` in `tsconfig.json`. The Vite plugin also emits a local `hello.slab.d.ts` sidecar during dev/build.
