# ShaderLab — API reference (Schema 2.0, `shader_frame`)

> **Schema 2.0 (`shader_frame`)** — testing channel (`npm install @yoruxiii/shaderlab@testing`).
> Short overview: [NEW_API.md](../NEW_API.md). **Schema 1.0** (`<shader>`, `useShader`): [LANGUAGE.md](./LANGUAGE.md), [USAGE.md](./USAGE.md).
>
> **Live in `0.4.0-testing.0`:** `<shader_frame>`, `version="2.0"`, uniform `mutable` / `deferred`, spatial `mode`, `shader_frame.*` call sites, augment lists in `{}`, `ShaderFrameInstance` (`mount` / `unmount` / `set`), **`E04xx` / `W04xx`**, mutable-only `.d.ts` options.
>
> **Not in `0.4.0-testing.0` (planned `0.5.x`):** `<contract>` blocks, **`E05xx`** augment-contract validation, typed augment slots in `.d.ts`.

---

## Consumer lifecycle

Each call `shader_frame.<id>(libraryModule, options?)` returns a **`ShaderFrameInstance`**.

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import fx from "./effects.slab";

const water = shader_frame.water(fx) {
  speed: 1.5,
  augment.ripple(fx),
};

water.mount(document.querySelector("#hero")!); // canvas or container
water.set("speed", 2.0);
water.unmount();
```

| Method | Role |
|--------|------|
| **`mount(target)`** | Attach to an `HTMLCanvasElement` or an `HTMLElement` (creates a child canvas). |
| **`unmount()`** | Stop the loop, detach observers, release WebGL resources. |
| **`set(name, value)`** | Update a **mutable** uniform at runtime. |

Framework adapters (**`ShaderFrame`**, **`useShaderFrame`**, Svelte **`shaderframe`**) receive a **`ShaderFrameInstance`** and only call **`mount` / `unmount`** — they do not import slab paths or build option objects.

```tsx
import { ShaderFrame } from "@yoruxiii/shaderlab/react";
const chroma = shader_frame.chroma(hello);
<ShaderFrame frame={chroma} />
```

**Multi-pass on one slab:** Calling a **`postprocess`** frame auto-wires the slab’s upstream **`canvas_item`** and any **`augment.*`** entries in `{}`. You **`mount`** the returned instance once — no app-level **`feedFrom`**. Mutable uniforms for the feeder and terminal can share one `{}` block (e.g. `shader_frame.bloom(lib) { speed: 1.2, threshold: 0.7 }`); keys route by each frame’s mutable uniform list.

Passing **`feedFrom`** to **`mount()`** on a composed postprocess frame always emits a **console warning** and uses the composed pipeline. See [examples/vanilla-vite](../examples/vanilla-vite).

---

## The `<shader_frame>` element

`<shader_frame>` replaces `<shader>` as the top-level unit inside a `.slab` file.
A frame is a **named, self-contained shader definition** — it declares everything the
shader needs to run: its type, its uniforms, its GLSL, and (for augment-capable types)
its contract with adjacent pipeline stages.

The compiler validates the frame completely at build time. The consumer gets a typed,
callable result.

**Core attributes:**

| Attribute | Required | Meaning |
|-----------|----------|---------|
| `id` | Yes | Identifier exported from the emitted JS module (`^[a-zA-Z_][a-zA-Z0-9_]*$`). |
| `type` | Yes | `canvas_item`, `postprocess`, or `spatial`. |
| `mode` | `spatial` only | `standalone` (default) or `augment`. Determines whether the spatial samples an upstream pass via `CANVAS_TEXTURE`. |

**Document root for `shader_frame` slabs:**

```xml
<shaderlab version="2.0">
  <!-- one or more <shader_frame> elements -->
</shaderlab>
```

> **Note:** `version="2.0"` is required when using `<shader_frame>`. The validator
> will reject `<shader_frame>` content under `version="1.0"`.

---

## Frame types

### `canvas_item`

Renders directly to a page element — a panel, a button, a div, a canvas. Primary
authoring type and the anchor point for the rendering pipeline.

**Available builtins:** `TEXTURE`, `UV`, `TIME`, `RESOLUTION`, `PARALLAX_UV`
(with `hint="parallax_layer"`).

**Declaring a frame:**

```xml
<shader_frame id="water" type="canvas_item">
  <uniforms>
    <uniform name="speed"     type="float" hint="range(0.0, 5.0)" mutable="true"  default="1.0" />
    <uniform name="tint"      type="vec3"  hint="color"           mutable="true"  default="0.2 0.5 0.9" />
    <uniform name="tile_size" type="float"                        mutable="false" default="4.0" />
  </uniforms>
  <fragment><![CDATA[
vec2 uv = UV * tile_size;
float wave = sin(uv.x + TIME * speed) * 0.5 + 0.5;
COLOR = vec4(tint * wave, 1.0);
  ]]></fragment>
</shader_frame>
```

**Consuming it (TypeScript):**

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import anime from "./anime.slab";

shader_frame.water(anime);

shader_frame.water(anime) {
  speed: 2.0,
  tint: [0.0, 0.8, 1.0],
}
```

**Attaching augments:** A `canvas_item` frame can attach spatial augments in the options
block. Augments execute in declared order — `ripple` first, `caustics` second:

```ts
shader_frame.water(anime) {
  speed: 2.0,
  augment.ripple(anime),
  augment.caustics(anime),
}
```

---

### `postprocess`

A full-screen pass that samples the upstream render via `SCREEN_TEXTURE` / `SCREEN_UV`.
Operates on the output of the `canvas_item` (and any spatial augments that preceded it)
rather than drawing directly to an element.

**Available builtins:** `SCREEN_TEXTURE`, `SCREEN_UV`, `TIME`, `RESOLUTION`.

`postprocess` samples the upstream pass via **`SCREEN_*`** builtins. Mount the post
instance on the same canvas as the feeder, with the feeder instance passed as
`feedFrom` when wiring manually (see vanilla example).

**No augmentation is valid on or after a `postprocess` frame** — the compiler errors (`E0404`, `E0409`).

**Declaring a frame:**

```xml
<shader_frame id="bloom" type="postprocess">
  <uniforms>
    <uniform name="threshold" type="float" hint="range(0.0, 1.0)" mutable="true" default="0.8" />
    <uniform name="intensity"  type="float" hint="range(0.0, 3.0)" mutable="true" default="1.2" />
  </uniforms>
  <fragment><![CDATA[
vec4 base = texture(SCREEN_TEXTURE, SCREEN_UV);
float lum = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
COLOR = lum > threshold ? base * intensity : base;
  ]]></fragment>
</shader_frame>
```

**Consuming it:**

```ts
import fx from "./fx.slab";

const bloom = shader_frame.bloom(fx) { threshold: 0.75, intensity: 1.5 };
// bloom.mount(canvas, { feedFrom: upstreamInstance });
```

---

### `spatial`

A fullscreen pass that operates in two modes, declared explicitly in the slab:

- **`mode="standalone"`** (default) — runs as an independent pass, does not sample a preceding `canvas_item`.
- **`mode="augment"`** — samples the immediate upstream pass via `CANVAS_TEXTURE` / `CANVAS_UV`
  and transforms it before passing the result downstream.

**Available builtins (augment mode):** `CANVAS_TEXTURE`, `CANVAS_UV`, `TIME`, `RESOLUTION`.

**Declaring a spatial augment frame:**

```xml
<shader_frame id="ripple" type="spatial" mode="augment">
  <uniforms>
    <uniform name="amplitude" type="float" hint="range(0.0, 1.0)" mutable="true" default="0.3" />
    <uniform name="frequency" type="float" hint="range(0.1, 10.0)" mutable="true" default="4.0" />
  </uniforms>
  <fragment><![CDATA[
vec2 offset = vec2(sin(CANVAS_UV.y * frequency + TIME) * amplitude, 0.0);
COLOR = texture(CANVAS_TEXTURE, CANVAS_UV + offset);
  ]]></fragment>
</shader_frame>
```

---

## Uniform mutability

Each `<uniform>` carries a `mutable` attribute that controls whether it can be overridden
at the use site.

| Value | Meaning |
|-------|---------|
| `mutable="true"` | **Mutable** — override is allowed at the use site. Appears in the generated TypeScript options type. |
| `mutable="false"` | **Sealed** — override is rejected by the compiler. Absent from the generated TypeScript options type. |

```xml
<uniform name="speed"     type="float" mutable="true"  default="1.0" />  <!-- overridable -->
<uniform name="tile_size" type="float" mutable="false" default="4.0" />  <!-- locked -->
```

**Deferred parameters** — parameters intentionally left unconfigured at declaration time —
use a sentinel value (`0` or a named constant) in place of a `default`. The compiler
recognises the sentinel and skips the initial upload, waiting for the consumer to supply
a value. Deferred parameters are typed as `Deferred | <base_type>` in the generated
`.d.ts`, distinguishing intent from an accidental zero.

**Schema 2.0 error codes (`E04xx` / `W04xx`):**

| Code | Condition |
|------|-----------|
| `E0401` | Legacy `<shader>` element (hard error) |
| `E0402` | Root `version` is not `"2.0"` |
| `E0403` | `deferred="true"` with `mutable="false"` |
| `E0404` | Augment on a `postprocess` frame |
| `E0405`–`E0409` | Invalid vertex / spatial / pipeline placement |
| `W0401` | Deferred uniform never supplied at a known call site |
| `W0402` | Spatial `mode` omitted (defaults `standalone`) |
| `W0403` | Augment spatial does not reference `CANVAS_*` |

---

## Augment syntax

Augments are attached inside the options block at the use site, using `augment.name(file.slab)`.
They execute in **declared load order** — deterministic, statically known at compile time.

```ts
shader_frame.water(water_effects) {
  speed: 1.2,
  augment.ripple(water_effects),   // runs first
  augment.caustics(water_effects), // runs second
}
```

Augment **order** is validated (`E0404`–`E0409`). **Contract** validation (`<consumes>` / `<produces>`, **`E05xx`**) is **0.5.x** — not implemented in `0.4.0-testing.0`.

---

## Pipeline order

The full pipeline order is fixed and enforced by the compiler:

```
canvas_item → spatial (augment) × N → postprocess
```

Rules:
- `canvas_item` always runs first.
- Spatial augments run in declared load order after the `canvas_item`.
- `postprocess` always runs last. Nothing is valid after it.
- XML declaration order within the `.slab` file does **not** affect pipeline order.

---

## One slab, multiple frames

A `.slab` file is a shader library. Multiple frames in one file share a visual theme or
functional domain. Consumers cherry-pick what they need.

```xml
<!-- water-effects.slab -->
<shaderlab version="2.0">
  <shader_frame id="water"    type="canvas_item"> … </shader_frame>
  <shader_frame id="ripple"   type="spatial" mode="augment"> … </shader_frame>
  <shader_frame id="caustics" type="spatial" mode="augment"> … </shader_frame>
  <shader_frame id="bloom"    type="postprocess"> … </shader_frame>
</shaderlab>
```

```ts
import water_effects from "./water-effects.slab";

const water = shader_frame.water(water_effects) {
  speed: 1.5,
  augment.ripple(water_effects),
  augment.caustics(water_effects),
};
water.mount(canvas);

const bloom = shader_frame.bloom(water_effects) {
  threshold: 0.7,
  augment.ripple(water_effects),
};
bloom.mount(canvas);
```

---

## TypeScript integration

The compiler emits a `*.slab.d.ts` sibling for every compiled source. In the new design,
the generated types reflect the frame contract directly:

| What | How it appears in the generated type |
|------|--------------------------------------|
| Mutable parameters | Optional properties in the options type |
| Sealed parameters | **Absent** — cannot be set at the use site |
| Deferred parameters | `Deferred \| <base_type>` (infrastructure present; wiring incomplete) |
| `readonly` mouse_position | Always present in options when declared |

Augment-contract typing in `.d.ts` is planned for **0.5.x**.

---

## Deprecation path

| Version | Change |
|---------|--------|
| **`0.3.1`** | `<shader>` deprecation warnings on stable (see **0.3.1** changelog) |
| **`0.4.0-testing.0`** | `shader_frame` API lands on the testing channel -- **live** |
| `0.4.0` | `shader_frame` stable. `<shader>` removed or hard-errored |
| `0.5.x` | Coexistence typing, spatial grounding, deferred param wiring |
| `1.0.0` | Full API contract locked |

The **`testing`** channel moves independently of stable. Testing versions are experimental —
things appear and are removed. Do not build production dependencies on testing builds.

---

## Migration from `<shader>` to `<shader_frame>`

**Before (`0.3.x`):**

```xml
<shaderlab version="1.0">
  <shader id="water" type="canvas_item">
    <uniforms>
      <uniform name="speed" type="float" default="1.0" />
    </uniforms>
    <fragment><![CDATA[ … ]]></fragment>
  </shader>
</shaderlab>
```

**After (`0.4.0`+):**

```xml
<shaderlab version="2.0">
  <shader_frame id="water" type="canvas_item">
    <uniforms>
      <uniform name="speed" type="float" mutable="true" default="1.0" />
    </uniforms>
    <fragment><![CDATA[ … ]]></fragment>
  </shader_frame>
</shaderlab>
```

Key differences:
- Root `version` bumps from `"1.0"` to `"2.0"`.
- `<shader>` → `<shader_frame>`.
- Each `<uniform>` gains an explicit `mutable="true"` or `mutable="false"` attribute.
  The compiler **requires** this attribute in `0.4.0`.
