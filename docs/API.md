# ShaderLab — API reference (`shader_frame`)

> **Companion to [`LANGUAGE.md`](./LANGUAGE.md).** That document is the normative
> reference for what the compiler recognises **today** (`0.3.x`). This document covers
> the **`shader_frame` redesign** landing across the `0.4.x` cycle and locking at
> `1.0.0`.
>
> **Status by section:**
> - ✅ **Live in `0.3.1`:** The `<shader>` deprecation warning (`W0401`).
> - 🔬 **Testing channel (`0.4.0-testing.0`+):** Everything else in this document.
>   Do not build production dependencies against testing builds.

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
    void fragment() {
      vec2 uv = UV * tile_size;
      float wave = sin(uv.x + TIME * speed) * 0.5 + 0.5;
      COLOR = vec4(tint * wave, 1.0);
    }
  ]]></fragment>
</shader_frame>
```

**Consuming it (TypeScript):**

```ts
// Use with defaults
shader_frame.water(anime.slab)

// Override mutable parameters at the use site
shader_frame.water(anime.slab) {
  speed: 2.0,
  tint: [0.0, 0.8, 1.0]
}
```

**Attaching augments:** A `canvas_item` frame can attach spatial augments in the options
block. Augments execute in declared order — `ripple` first, `caustics` second:

```ts
shader_frame.water(anime.slab) {
  speed: 2.0,
  augment.ripple(spatials.slab),
  augment.caustics(spatials.slab)
}
```

---

### `postprocess`

A full-screen pass that samples the upstream render via `SCREEN_TEXTURE` / `SCREEN_UV`.
Operates on the output of the `canvas_item` (and any spatial augments that preceded it)
rather than drawing directly to an element.

**Available builtins:** `SCREEN_TEXTURE`, `SCREEN_UV`, `TIME`, `RESOLUTION`.

`postprocess` frames are **not attached to elements** — they apply to the pipeline.
A pipeline containing a `canvas_item` and a `postprocess` in the same slab runs them
in that order automatically.

**No augmentation is valid after a `postprocess`** — the compiler errors if attempted.

**Declaring a frame:**

```xml
<shader_frame id="bloom" type="postprocess">
  <uniforms>
    <uniform name="threshold" type="float" hint="range(0.0, 1.0)" mutable="true" default="0.8" />
    <uniform name="intensity"  type="float" hint="range(0.0, 3.0)" mutable="true" default="1.2" />
  </uniforms>
  <fragment><![CDATA[
    void fragment() {
      vec4 base = texture(SCREEN_TEXTURE, SCREEN_UV);
      float lum = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
      COLOR = lum > threshold ? base * intensity : base;
    }
  ]]></fragment>
</shader_frame>
```

**Consuming it:**

```ts
shader_frame.bloom(fx.slab)

shader_frame.bloom(fx.slab) {
  threshold: 0.75,
  intensity: 1.5
}
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
  <contract>
    <consumes>rgba</consumes>
    <produces>rgba</produces>
  </contract>
  <uniforms>
    <uniform name="amplitude" type="float" hint="range(0.0, 1.0)" mutable="true" default="0.3" />
    <uniform name="frequency" type="float" hint="range(0.1, 10.0)" mutable="true" default="4.0" />
  </uniforms>
  <fragment><![CDATA[
    void fragment() {
      vec2 offset = vec2(sin(CANVAS_UV.y * frequency + TIME) * amplitude, 0.0);
      COLOR = texture(CANVAS_TEXTURE, CANVAS_UV + offset);
    }
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

**Override error codes (`E04xx`):**

| Code | Condition |
|------|-----------|
| `E0401` | Override target not declared in frame |
| `E0402` | Override target exists but is not mutable |
| `E0403` | Type mismatch on override value |
| `W0401` | `<shader>` tag used — deprecated, replace with `<shader_frame>` |

---

## Augment syntax

Augments are attached inside the options block at the use site, using `augment.name(file.slab)`.
They execute in **declared load order** — deterministic, statically known at compile time.

```ts
shader_frame.water(water_effects.slab) {
  speed: 1.2,
  augment.ripple(water_effects.slab),   // runs first
  augment.caustics(water_effects.slab)  // runs second
}
```

The compiler validates the full chain — `canvas_item` output → `ripple` contract →
`caustics` contract — at build time. A broken handoff is a compile error pointing at
the specific link.

---

## Augment contracts

Every `spatial` frame declared as `mode="augment"` carries a **contract** — a declaration
of what it consumes at its input boundary and produces at its output boundary.

```xml
<contract>
  <consumes>rgba</consumes>
  <produces>rgba</produces>
  <exclusive_with>distort_heavy</exclusive_with>  <!-- optional -->
</contract>
```

**Contract fields:**

| Field | Meaning |
|-------|---------|
| `<consumes>` | Data type expected at the input boundary. |
| `<produces>` | Data type delivered at the output boundary. |
| `<exclusive_with>` | Frame IDs this augment cannot coexist with in the same chain. Multiple `<exclusive_with>` elements are allowed. |
| `order_sensitive` attribute | When `true`, A→B and B→A produce meaningfully different results. Compiler warns on known-problematic ordering (`W0501`). |

**Augment chain error codes (`E05xx`):**

| Code | Condition |
|------|-----------|
| `E0501` | Augment input / output type mismatch in chain |
| `E0502` | Mutually exclusive augments declared in the same chain |
| `E0503` | Augment applied to a frame type that does not accept augmentation |
| `W0501` | Order-sensitive augments in a potentially problematic sequence |

> **Note:** `E05xx` codes land in `0.5.x`. They are documented here as a forward
> reference so contract authors can write `<contract>` blocks now and have them
> validated automatically when the release ships.

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
// Full water scene — one slab, composed at the use site
shader_frame.water(water_effects.slab) {
  speed: 1.5,
  augment.ripple(water_effects.slab),
  augment.caustics(water_effects.slab)
}
shader_frame.bloom(water_effects.slab) {
  threshold: 0.7
}
```

---

## TypeScript integration

The compiler emits a `*.slab.d.ts` sibling for every compiled source. In the new design,
the generated types reflect the frame contract directly:

| What | How it appears in the generated type |
|------|--------------------------------------|
| Mutable parameters | Optional properties in the options type |
| Sealed parameters | **Absent** — cannot be set at the use site |
| Deferred parameters | `Deferred \| <base_type>` |
| Augment slots | Typed by the frame's declared augment contract — only compatible frames are assignable |

TypeScript catches most contract violations before the ShaderLab compiler even runs.

---

## Deprecation path

| Version | Change |
|---------|--------|
| **`0.3.1`** | `<shader>` emits `W0401` deprecation warnings pointing at `<shader_frame>` |
| `0.4.0-testing.0` | `shader_frame` API lands on the testing channel |
| `0.4.0` | `shader_frame` stable. `<shader>` removed or hard-errored |
| `0.5.x` | Augment contracts (`E05xx`), coexistence typing, spatial grounding |
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
