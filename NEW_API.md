# ShaderLab — New API Design (v0.4.0 → v1.0)

> **Status:** In progress. This document describes the redesigned shader authoring system
> landing across the `0.4.x` testing cycle and stabilising at `1.0.0`. The existing
> `<shader>` / `useShader` / `attach` API is **deprecated as of `0.3.1`** and will be
> removed in `0.4.0`. See the deprecation warnings emitted by the compiler for migration
> guidance.

---

## Why the redesign

The original API treated the `.slab` file as a **compiler input** and the consumer script
as the place where everything was wired together — imports, feeder chains, attach calls,
uniform management. That model works for small projects but it puts the structural burden
in the wrong place.

The problems that motivated the change:

- **Wiring lives outside the shader.** The relationship between a `canvas_item` and the
  `spatial` augmenting it had to be managed manually in userland. Nothing in the slab
  expressed that relationship.
- **No reuse primitive.** A shader was a module you imported. To use it on multiple
  elements you had to manage instances yourself.
- **Augment ordering was implicit.** Multi-pass spatial chains had no declared order,
  which made pipeline behaviour hard to reason about and impossible to validate at compile
  time.
- **The consumer API was too large.** `useShader`, `attach`, `feedFrom`, `detachAll`,
  `createShaderInstance` — too many moving parts for what should be a simple operation.

The redesign moves **intent back into the slab** and reduces the consumer API to the
minimum required to express what differs per use site.

---

## Core concept: `shader_frame`

`shader_frame` is the new top-level unit in a `.slab` file. It replaces `<shader>`.

A frame is a **named, self-contained shader definition**. It declares everything the
shader needs to run: its type, its uniforms, its GLSL, and — for augment-capable types —
its contract with adjacent stages. The compiler validates the frame completely at build
time. The consumer gets a typed, callable function.

A `.slab` file is a **shader library**. One file can contain multiple frames. Consumers
cherry-pick what they need.

### Calling a frame

```ts
// use a frame exactly as authored — no overrides
shader_frame.liq_metal(metallics.slab)

// override mutable parameters at the use site
shader_frame.water(anime.slab) {
  speed: 1.2,
  tint: [0.1, 0.4, 0.8]
}
```

That is the entire consumer API for the common case. One line mounts a fully configured
shader onto an element.

### Mutable vs sealed parameters

Parameters declared **mutable** in the slab can be overridden at the use site.
Parameters that are not declared mutable are **sealed** — the compiler rejects any attempt
to override them.

```xml
<uniform name="speed"     type="float" mutable="true"  default="1.0" />
<uniform name="tint"      type="vec3"  mutable="true"  default="1.0 1.0 1.0" />
<uniform name="tile_size" type="float" mutable="false" default="4.0" />
```

Mutable parameters appear in the generated TypeScript options type. Sealed parameters do
not. TypeScript catches most contract violations before ShaderLab's error system fires.

**Deferred parameters** — parameters that are intentionally left unset at declaration time
and configured entirely at the use site — use a sentinel value (`0` or a named constant)
in place of a default. The compiler recognises the sentinel and skips the initial upload,
waiting for the consumer to supply a value.

### The slab as schema

The `.slab` file is the schema. The options object must conform to it. Attempting to
override a parameter that does not exist in the frame, or one that exists but is sealed,
is a compiler error.

New error codes for frame contract violations (`E04xx`):

| Code | Condition |
|------|-----------|
| `E0401` | Override target not declared in frame |
| `E0402` | Override target exists but is not mutable |
| `E0403` | Type mismatch on override value |
| `W0401` | Mutable parameter declared but never overridden (intent unfulfilled) |

Suggestion hints follow the same Rust-style pattern as the rest of the compiler — if you
name a parameter that doesn't exist, the compiler checks for close matches and surfaces
them.

---

## Shader types

The three shader types — `canvas_item`, `postprocess`, and `spatial` — are preserved from
the previous design. Their semantics are unchanged. What changes is how they are declared,
related to each other, and consumed.

---

### canvas_item

A `canvas_item` frame renders directly to a page element — a panel, a button, a div, a
canvas. It is the primary authoring type and the anchor point for the rendering pipeline.

**Builtins available:** `TEXTURE`, `UV`, `TIME`, `RESOLUTION`, `PARALLAX_UV`
(with `hint="parallax_layer"`).

**Declaring a canvas_item frame:**

```xml
<shader_frame id="water" type="canvas_item">
  <uniforms>
    <uniform name="speed"      type="float" hint="range(0.0, 5.0)" mutable="true" default="1.0" />
    <uniform name="tint"       type="vec3"  hint="color"           mutable="true" default="0.2 0.5 0.9" />
    <uniform name="tile_size"  type="float"                        mutable="false" default="4.0" />
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

**Consuming it:**

```ts
shader_frame.water(anime.slab)

// or with overrides
shader_frame.water(anime.slab) {
  speed: 2.0,
  tint: [0.0, 0.8, 1.0]
}
```

**Attaching augments:** A `canvas_item` frame can declare which spatial augments are
valid for it. At the use site, augments are attached inside the options block:

```ts
shader_frame.water(anime.slab) {
  speed: 2.0,
  augment.ripple(spatials.slab),
  augment.caustics(spatials.slab)
}
```

Augments are resolved in **load order** — the order they appear in the options block.
`ripple` runs first, `caustics` runs second. This is deterministic and statically known.
See the `spatial` section for augment contract details.

---

### postprocess

A `postprocess` frame is a full-screen pass that samples the upstream render via
`SCREEN_TEXTURE` / `SCREEN_UV`. It operates on the output of the `canvas_item` (and any
spatial augments that preceded it) rather than drawing directly to an element.

**Builtins available:** `SCREEN_TEXTURE`, `SCREEN_UV`, `TIME`, `RESOLUTION`.

`postprocess` frames are **not attached to elements.** They are declared in the slab and
applied to the pipeline. A pipeline containing a `canvas_item` and a `postprocess` in
the same slab runs them in that order automatically.

**Declaring a postprocess frame:**

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
// postprocess applies to the full pipeline output — no element target
shader_frame.bloom(fx.slab)

shader_frame.bloom(fx.slab) {
  threshold: 0.75,
  intensity: 1.5
}
```

`postprocess` frames are the terminal stage of the pipeline. No augmentation is valid
after a `postprocess` — the compiler errors if this is attempted.

---

### spatial

A `spatial` frame is a fullscreen pass that can operate in two modes:

- **Standalone** — runs as an independent pass, does not sample a preceding `canvas_item`.
- **Augment** — samples the immediate upstream pass via `CANVAS_TEXTURE` / `CANVAS_UV`
  and transforms it before passing the result downstream.

The mode is **declared in the slab**, not inferred at the use site.

**Builtins available (augment mode):** `CANVAS_TEXTURE`, `CANVAS_UV`, `TIME`, `RESOLUTION`.

#### Augment contracts

This is the significant addition to `spatial` in the new design.

Every `spatial` frame declared as an augment type carries a **contract** — a declaration
of what it consumes at its input boundary and what it produces at its output boundary.
The contract is authored in the slab. The compiler uses it to validate augment chains at
build time, before anything runs in the browser.

The contract system is grounded in the same logic as Substance Designer's typed node
connections: a connection is only valid if the output type of stage N satisfies the input
type of stage N+1. A spatial that writes a modified normal map cannot feed into a spatial
that expects full RGBA colour. The compiler rejects the chain, not the browser.

**Contract fields (on a spatial frame):**

```xml
<shader_frame id="ripple" type="spatial" mode="augment">
  <contract>
    <consumes>rgba</consumes>
    <produces>rgba</produces>
    <exclusive_with>distort_heavy</exclusive_with>
  </contract>
  ...
</shader_frame>
```

**Coexistence rules** enforced by the contract system:

- `consumes` / `produces` — the data type at each boundary. Mismatched handoffs are
  `E05xx` errors.
- `exclusive_with` — named frames this augment cannot coexist with in the same chain.
  Attempting to stack them is an `E05xx` error.
- `order_sensitive` — flag indicating that A→B and B→A produce meaningfully different
  results. The compiler allows both orderings but emits a `W05xx` warning when a
  known-problematic order is detected.

**Augment error codes (`E05xx`):**

| Code | Condition |
|------|-----------|
| `E0501` | Augment input/output type mismatch in chain |
| `E0502` | Mutually exclusive augments declared in same chain |
| `E0503` | Augment applied to a frame type that does not accept augmentation |
| `W0501` | Order-sensitive augments in a potentially problematic sequence |

#### Augment load order

When multiple augments are attached to a `canvas_item`, they execute in the order they
are declared in the options block. This is the single deterministic layer — no runtime
negotiation, no priority system. What is declared first runs first.

```ts
shader_frame.water(anime.slab) {
  speed: 1.2,
  augment.ripple(spatials.slab),    // runs first
  augment.caustics(spatials.slab)   // runs second
}
```

The compiler validates the entire chain — `canvas_item` output → `ripple` contract →
`caustics` contract — at build time. If any handoff is invalid, the build fails with a
specific error pointing at the broken link.

#### Declaring a spatial augment frame:

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

## Pipeline order

The full pipeline order is fixed and enforced by the compiler:

```
canvas_item → spatial (augment) × N → postprocess
```

- `canvas_item` always runs first.
- Spatial augments run in declared load order after the `canvas_item`.
- `postprocess` always runs last.
- Nothing is valid after `postprocess`.
- XML declaration order within the `.slab` file does not affect pipeline order.

---

## One slab, multiple frames

A `.slab` file is a shader library. Multiple frames in one file share a visual theme or
a functional domain. Consumers import only what they need.

```xml
<!-- water-effects.slab -->
<shaderlab version="2.0">
  <shader_frame id="water"    type="canvas_item"> ... </shader_frame>
  <shader_frame id="ripple"   type="spatial" mode="augment"> ... </shader_frame>
  <shader_frame id="caustics" type="spatial" mode="augment"> ... </shader_frame>
  <shader_frame id="bloom"    type="postprocess"> ... </shader_frame>
</shaderlab>
```

```ts
// full water scene — one slab, composed at the use site
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

The compiler continues to emit `*.slab.d.ts` files alongside each source. In the new
design, the generated types reflect the frame contract directly:

- **Mutable parameters** appear as optional properties in the options type.
- **Sealed parameters** do not appear — they cannot be set at the use site.
- **Deferred parameters** are typed as `Deferred | <base_type>`, distinguishing intent
  from an accidental zero.
- **Augment slots** are typed by the frame's declared augment contract — only compatible
  frames are assignable.

This means the vast majority of contract violations are caught by TypeScript before the
ShaderLab compiler even runs.

---

## What is not changing

- The compiler pipeline: parse → validate → codegen → emit. `shader_frame` is a new
  schema for the input, not a new compiler.
- The error system: tier (Warn / Hazard / Error), code registry, Rust-style suggestions.
  New codes are additive.
- The Vite plugin. HMR. The framework adapters (React, Vue, Svelte, Nuxt).
- The compiler boundary: `src/compiler/` still cannot import from `vite/`, `adapters/`,
  or `cli/`. `check:compiler-boundary` still runs.
- The non-goals: no scene graph, no asset pipeline, no camera stack, no physics.
  ShaderLab stays narrow on purpose.

---

## Deprecation path

| Version | Change |
|---------|--------|
| `0.3.1` | `<shader>` emits deprecation warnings pointing at `shader_frame` |
| `0.4.0-testing.0` | `shader_frame` API lands on the testing channel |
| `0.4.0` | `shader_frame` stable. `<shader>` removed or hard-errored |
| `0.5.x` | Augment contracts, coexistence typing, spatial grounding |
| `1.0.0` | Full API contract locked |

The `testing` channel moves independently of stable. Testing versions are experimental —
things appear and are removed. Do not build production dependencies on testing builds.

---

## Toward v2.0

The `shader_frame` design is not just a 1.0 API. It is the data model that v2.0 builds
on.

- **Shader droplets** — `shader_frame` instances made visual and draggable. Drop a frame
  onto a page element in the browser, see it apply live.
- **The shader graph** — the augment contract system made visual. Valid connections are
  the same connections the compiler already validates; you just see them as wires instead
  of error codes.
- **WAL-based live editing** — changes to droplet parameters are staged, previewed, and
  committed. Undo is a first-class citizen.
- **Click element, inspect its graph** — the DOM element becomes the entry point into its
  own shader pipeline view.

Slate (the dev-only live parameter panel) was the first sketch of this direction.
Everything built cleanly in 1.0 makes 2.0 cheaper to build.

All of this lives inside ShaderLab — one package, one plugin, sections that unlock as
the version matures.

---

*This document will be updated as the 0.4.x testing cycle progresses.*
