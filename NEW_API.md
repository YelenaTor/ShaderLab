# ShaderLab — Schema 2.0 (`shader_frame`)

> **Schema 2.0 (`shader_frame`)** — `@yoruxiii/shaderlab@testing` (`0.4.0-testing.0+`): slab libraries with `<shader_frame>`, page calls via `shader_frame.<id>(lib)`, lifecycle on `ShaderFrameInstance`.
>
> **Scope:** Consumer and slab schema for this line only.
> Augment **contracts** (`consumes` / `produces`, `exclusive_with`) and **E05xx** codes are **0.5.x**, not implemented here.

---

## Mental model

- **`.slab` file** — shader **library** (many frames per file). Compiled entirely at build time.
- **`shader_frame`** — top-level **call** at the use site: `shader_frame.water(liquids.slab)`.
- **Frame `id`** — callable name: `<shader_frame id="water">` → `shader_frame.water(...)`.
- **`{}` options** — only place the call site may override **mutable** / **deferred** uniforms or declare **augments** (positional, in order).

Legacy **`<shader>`**, **`version="1.0"`**, and **`useShader`** are removed from this release. Multi-pass slabs on the same library are wired internally when you call a **`postprocess`** frame (one **`mount`**, no manual **`feedFrom`**).

---

## Slab schema (`version="2.0"`)

```xml
<shaderlab version="2.0">
  <shader_frame id="water" type="canvas_item">
    <uniforms>
      <uniform name="speed" type="float" mutable="true" default="1.0" />
      <uniform name="tile_size" type="float" mutable="false" default="4.0" />
    </uniforms>
    <fragment><![CDATA[
      COLOR = vec4(UV * tile_size, sin(TIME * speed), 1.0);
    ]]></fragment>
  </shader_frame>
</shaderlab>
```

Spatial augments use `type="spatial" mode="augment"` and sample `CANVAS_TEXTURE` / `CANVAS_UV`.

---

## Consumer calls

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import liquids from "./liquids.slab";

shader_frame.water(liquids);

shader_frame.water(liquids) {
  speed: 1.2,
  augment.ripple(spatials.slab) { amplitude: 0.4 },
  augment.caustics(spatials.slab),
}
```

The Vite plugin transforms `{ … }` blocks into plain option objects. Keep **`import lib from "./file.slab"`** — do not strip the `.slab` extension in imports.

**Minimal page path (single `canvas_item`):**

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import wavesLib from "./waves.slab";

const instance = shader_frame.waves(wavesLib) { speed: 2.0 };
instance.mount(document.querySelector("canvas")!);
// instance.set("speed", 1.0);
// instance.unmount();
```

---

## Multi-pass on one slab

Calling a **`postprocess`** frame (e.g. `shader_frame.chroma(hello)`) auto-wires the first upstream **`canvas_item`** in that slab and any **`augment.*`** entries in `{}`, then returns one instance to **`mount`**.

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import hello from "./hello.slab";

const chroma = shader_frame.chroma(hello);
chroma.mount(canvas);
```

Mutable uniforms for the auto-wired **`canvas_item`** feeder can be set in the **same** `{}` block as the postprocess frame (e.g. `shader_frame.bloom(lib) { speed: 1.2, threshold: 0.7 }`). Keys are routed to the feeder or terminal by each frame’s mutable uniform list.

If you pass **`feedFrom`** to **`mount()`** on a composed postprocess frame, ShaderLab **always warns** and uses the composed chain instead:

`[shaderlab] feedFrom is ignored on a composed frame — the pipeline is wired automatically. Remove feedFrom from your mount() call.`

---

## `ShaderFrameInstance`

Produced by each `shader_frame.*(...)` call:

- **`mount(target)`** — attach to a canvas or container element.
- **`unmount()`** — teardown.
- **`set(name, value)`** — update a mutable uniform at runtime.

Framework adapters (**`ShaderFrame`**, **`useShaderFrame`**, Svelte **`shaderframe`**) receive a **`ShaderFrameInstance`** and only call **`mount` / `unmount`** on lifecycle — they do not handle slab paths, frame ids, or options.

```tsx
import { ShaderFrame } from "@yoruxiii/shaderlab/react";
const chroma = shader_frame.chroma(hello);
<ShaderFrame frame={chroma} />
```

---

## Migration from `0.3.x`

| Before | After |
|--------|--------|
| `<shader id="x">` | `<shader_frame id="x">` |
| `version="1.0"` | `version="2.0"` |
| `import { bg } from "./x.slab"; useShader(mod)` | `shader_frame.bg(x)` |
| `attach(canvas, { feedFrom })` | `shader_frame.post(lib)` + augments in `{}`; one `mount` |

`<shader>` in a file → **`E0401`**. Wrong root version → **`E0402`**.

See [docs/API.md](./docs/API.md) and [SPEC_0.4.0-testing.0.md](./SPEC_0.4.0-testing.0.md).
