# Slab language & compiler reference

Normative reference for **`.slab` documents** and **what the ShaderLab compiler recognizes today**. Implementation lives under `src/compiler/`; tests under `test/compiler/` and `test/fixtures/`.

For integration steps (Vite, CLI, versioning), see **[USAGE.md](./USAGE.md)**.

---

## Document shape

### Root

```xml
<shaderlab version="1.0">
  <!-- one or more <shader> … -->
</shaderlab>
```

| Attribute | Meaning |
|-----------|---------|
| **`version`** | Must be **`1.0`** today. Unknown values emit **`E0102`**. Missing root element / malformed XML emits **`E0101`**. |

### Shader element

Each `<shader>` declares one compiled programme pair plus metadata.

| Attribute | Required | Meaning |
|-----------|----------|---------|
| **`id`** | Yes | Identifier exported from emitted JS (`^[a-zA-Z_][a-zA-Z0-9_]*$`). **`E0201`** / **`E0202`** when missing or duplicated. |
| **`type`** | Yes | **`canvas_item`** or **`postprocess`**. Anything else → **`E0203`**. |
| **`render_mode`** | No | Whitespace or comma separated tokens (unordered set); unknown tokens → **`W0101`**. |

Children:

| Element | Meaning |
|---------|---------|
| `<uniforms> … </uniforms>` | Optional; wraps `<uniform>` rows (see Uniforms). |
| `<vertex>` | Optional CDATA GLSL body template expands into generated vertex shader when relevant to shader kind. |
| `<fragment>` | **Required** non-empty CDATA fragment stage (`E0301` if missing / empty). |

### Uniform rows

```xml
<uniform name="strength" type="float" hint="range(0.0, 1.0)" default="0.5" />
```

| Attribute | Meaning |
|-----------|---------|
| **`name`** | Slab-side uniform identifier (`E0302` if absent). |
| **`type`** | `float`, `int`, `bool`, `vec2`, `vec3`, `vec4`, `sampler2D` (`E0303` when unknown). |
| **`hint`** | Optional semantic annotation (see Hints). Unknown hints → **`W0201`**. |
| **`default`** | Optional textual initializer validated against type / range (`W0202` when range violated). |

---

## Shader types and builtins

Only **`canvas_item`** and **`postprocess`** compile.

The compiler scans vertex + fragment bodies for **builtin identifiers** (identifier boundaries). Usage outside allowed sets triggers **`H0312`**.

### `canvas_item`

Allowed builtins:

`UV`, `COLOR`, `TEXTURE`, `VERTEX_COLOR`, `TIME`, `RESOLUTION`.

Typical role: draw-to-screen fragment passes that sample app-supplied textures (`TEXTURE`) or operate on UV/time.

### `postprocess`

Allowed builtins:

`SCREEN_UV`, `SCREEN_TEXTURE`, `COLOR`, `TIME`, `RESOLUTION`.

Typical role: full-screen passes sampling the companion **`canvas_item`** render target supplied via runtime **`feedFrom`**.

### Names that appear in tooling lists but are invalid here

The lexer recognises additional uppercase tokens for forward-looking grammar parity (for example names familiar from wider ShaderLab roadmaps). **They must not appear** in sources targeting **`canvas_item`** / **`postprocess`** unless/until a future release explicitly allows them — stray mentions produce **`H0312`**.

---

## Hints (`hint="…"`)

Recognised patterns:

| Hint | Notes |
|------|-------|
| **`range(min,max)`** | Numeric clamp metadata + uniform typings (`float` / `int`). |
| **`color`** | Influences emitted typings and runtime linearisation for vec colour tuples. |
| **`texture`**, **`albedo`**, **`normal_map`** | Texture feeder semantics + sampler typings. |
| **`mouse_position`** | Runtime-owned **`vec2`**; typings expose readonly tuples; uniforms ignore manual writes at runtime. |

Unknown literal hints → **`W0201`**.

---

## `render_mode`

Tokens combine as an **unordered set** — reordering equivalent tokens must not change lowered raster state (`test/compiler/compile.test.ts` guards ordering).

Recognised tokens today:

| Token | Compiler/runtime notes (0.1.x) |
|-------|----------------------------------|
| **`blend_add`**, **`blend_multiply`**, **`blend_premult_alpha`** | Mutually exclusive blend prescriptions (`H0201` if multiple combined). |
| **`cull_disabled`** | Disables face culling when emitted runtime applies state. |
| **`unshaded`**, **`depth_draw_never`**, **`diffuse_toon`**, **`specular_disabled`** | Parsed but **no expanding spatial/lighting pipeline ships yet** — combinations with supported shader kinds emit **`H0101`** hazards explaining no runtime effect for 2D paths. |

Unknown tokens → **`W0101`** (ignored).

---

## Diagnostics and stable codes

Diagnostics carry **`code`**, **`severity`**, **`message`**, optional **`suggestion`**, plus **`filename`** / **`line`**.

Severity tiers:

| Tier | Meaning |
|------|---------|
| **Warn** | Emission proceeds; condition logged / ignored per message. |
| **Hazard** | Emission proceeds; likely footgun or contradictory intent. |
| **Error** | Emission blocked (`output === null` from `compileSlab`). |

Registered codes (`ERROR_CODES` in source):

| Code | Severity | Summary |
|------|----------|---------|
| **E0101** | Error | Malformed / missing root `<shaderlab>` context |
| **E0102** | Error | Unknown root `version` |
| **E0201** | Error | Shader `id` missing / invalid pattern |
| **E0202** | Error | Duplicate shader `id` within file |
| **E0203** | Error | Missing / unknown shader `type` |
| **E0301** | Error | Missing / empty `<fragment>` |
| **E0302** | Error | Uniform missing `name` |
| **E0303** | Error | Unknown uniform `type` |
| **H0101** | Hazard | Lighting-style `render_mode` tokens ineffective on supported shader kinds |
| **H0201** | Hazard | Contradictory blend modes combined |
| **H0312** | Hazard | Builtin referenced outside allowed list for shader type |
| **H0401** | Hazard | Runtime clamp when assigning uniforms outside declared numeric range |
| **W0101** | Warn | Unknown `render_mode` token |
| **W0201** | Warn | Unknown `hint` |
| **W0202** | Warn | Default numeric literal outside `range()` |
| **W0301** | Warn | Present but empty `<vertex>` |

Compiler helpers **must** emit via `diagnostic(...)` so severities cannot drift from this registry.

---

## Compilation outputs

Successful compilation yields, per shader:

- Generated **vertex / fragment GLSL** strings (WebGL-targeted templates).
- **`ShaderRuntimeMetadata`** (shader kind, uniforms binding plans, blend/cull flags, builtin references).
- Consumption path emits ES modules plus optional sibling **`*.slab.d.ts`** (see plugin pipeline).

There is **no** separate runtime bytecode — ShaderLab expands slabs into GLSL + JS metadata consumed directly by `ShaderLabRuntime`.

---

## Maintainer alignment

When behaviour changes:

1. Update **this document** and the matching bullet under **`docs/USAGE.md` → Version guide**.
2. Extend fixtures / Vitest coverage (`test/fixtures`, `test/compiler/*`).
3. Surface intentional API divergences in **README** (“Spec and docs divergences”) if user-visible guarantees shift.
