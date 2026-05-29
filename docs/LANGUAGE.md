# Slab Language

ShaderLab `.slab` files use Schema 2.0.

```xml
<shaderlab version="2.0">
  <shader_frame id="name" type="canvas_item">
    <fragment><![CDATA[
COLOR = vec4(UV, 0.0, 1.0);
    ]]></fragment>
  </shader_frame>
</shaderlab>
```

## Document Shape

The root element must be:

```xml
<shaderlab version="2.0">...</shaderlab>
```

Legacy `<shader>` elements and `version="1.0"` are rejected. A document may contain one or more `<shader_frame>` elements.

## `shader_frame`

Required attributes:

| Attribute | Meaning |
| --- | --- |
| `id` | Callable frame name used by `shader_frame.<id>(library)`. |
| `type` | `canvas_item`, `canvas_25d`, `spatial`, or `postprocess`. |

Optional attributes:

| Attribute | Meaning |
| --- | --- |
| `mode` | `spatial` only: `standalone` or `augment`. |
| `render_mode` | Comma or whitespace separated raster flags. |

Children:

| Element | Meaning |
| --- | --- |
| `<uniforms>` | Optional wrapper for `<uniform>` rows. |
| `<vertex>` | Optional vertex GLSL. Not valid on `postprocess` or spatial augment frames. |
| `<fragment>` | Required fragment GLSL. |

## Uniforms

```xml
<uniform name="speed" type="float" hint="range(0.0, 2.0)" mutable="true" default="1.0" />
```

Attributes:

| Attribute | Meaning |
| --- | --- |
| `name` | GLSL-safe identifier. Runtime uniform name is `u_<name>`. |
| `type` | `float`, `int`, `bool`, `vec2`, `vec3`, `vec4`, or `sampler2D`. |
| `mutable` | `true` means call-site overrides and `.set()` are allowed. |
| `deferred` | `true` means the consumer is expected to provide the value. |
| `default` | Optional initial value. |
| `hint` | Optional semantic metadata. |

Recognized hints:

| Hint | Use |
| --- | --- |
| `range(min,max)` | Numeric range metadata and runtime clamp. |
| `color` | Linearizes `vec3` / `vec4` color input at bind time. |
| `texture`, `albedo`, `normal_map` | Texture semantics for tools and generated types. |
| `mouse_position` | Runtime-owned normalized mouse coordinate. |
| `layer_depth` | `canvas_25d` depth source. Must be `float`. |
| `parallax_strength` | `canvas_25d` parallax scale source. Must be `float`. |
| `parallax_layer` | Legacy alias for `layer_depth`. Must be `float`. |

## Frame Types

### `canvas_item`

2D fullscreen/canvas shader. It draws directly to the mounted canvas unless it feeds a postprocess or spatial augment chain.

Builtins:

```text
UV, PARALLAX_UV, COLOR, TEXTURE, VERTEX_COLOR, TIME, RESOLUTION
```

`PARALLAX_UV` and `hint="parallax_layer"` remain supported for compatibility. New 2.5D work should use `canvas_25d`.

### `canvas_25d`

First-class 2.5D canvas shader. It uses the same fullscreen pass foundation as `canvas_item`, but always generates parallax varyings.

Builtins:

```text
UV, PARALLAX_UV, PARALLAX_OFFSET, LAYER_DEPTH, PARALLAX_STRENGTH,
COLOR, TEXTURE, VERTEX_COLOR, TIME, RESOLUTION
```

Generated vertex behavior:

```glsl
PARALLAX_OFFSET = vec2(LAYER_DEPTH * TIME * PARALLAX_STRENGTH, 0.0);
PARALLAX_UV = UV + PARALLAX_OFFSET;
```

`LAYER_DEPTH` comes from the first `float` uniform with `hint="layer_depth"` or legacy `hint="parallax_layer"`. If absent, it defaults to `1.0`.

`PARALLAX_STRENGTH` comes from the first `float` uniform with `hint="parallax_strength"`. If absent, it defaults to `0.05`.

Example:

```xml
<shader_frame id="clouds" type="canvas_25d">
  <uniforms>
    <uniform name="depth" type="float" hint="layer_depth" mutable="true" default="0.35" />
    <uniform name="parallax" type="float" hint="parallax_strength" mutable="true" default="0.05" />
  </uniforms>
  <fragment><![CDATA[
vec2 uv = PARALLAX_UV;
COLOR = vec4(uv, LAYER_DEPTH, 1.0);
  ]]></fragment>
</shader_frame>
```

### `spatial`

Spatial frames are fullscreen passes with two modes.

`mode="standalone"` draws independently.

`mode="augment"` samples the immediate upstream pass through:

```text
CANVAS_TEXTURE, CANVAS_UV
```

Augments are used from app code:

```ts
shader_frame.clouds(fx) {
  augment.ripple(fx),
}
```

### `postprocess`

Postprocess frames sample the upstream pipeline through:

```text
SCREEN_TEXTURE, SCREEN_UV
```

They run last. Calling a postprocess frame auto-composes the upstream `canvas_item` or `canvas_25d` in the same slab.

## Pipeline

ShaderLab uses a fixed pipeline shape:

```text
canvas_item | canvas_25d -> spatial augment(s) -> postprocess
```

XML order does not create arbitrary graphs. For auto-composed postprocess frames, ShaderLab uses the first upstream `canvas_item` or `canvas_25d` before the postprocess frame in emitted pipeline order.

## Diagnostics

Diagnostics include:

- `code`
- `severity`: `Warn`, `Hazard`, or `Error`
- `message`
- optional `filename`, `line`, and `suggestion`

Common setup failures also include inline `Help:` text in Vite and experimental Next output.
The diagnostic code is the stable identifier; help text is remediation guidance and may become
more specific over time.

Common codes:

| Code | Meaning |
| --- | --- |
| `E0101` | Missing or malformed root document. |
| `E0201` | Missing or invalid frame id. |
| `E0202` | Duplicate frame id. |
| `E0203` | Missing or unknown frame type. |
| `E0301` | Missing or empty fragment block. |
| `E0302`-`E0304` | Uniform shape/type/name errors. |
| `E0401` | Legacy `<shader>` element. |
| `E0402` | Root version is not `2.0`. |
| `E0405`-`E0407` | Invalid vertex/spatial placement. |
| `H0312` | Builtin used in the wrong frame type. |
| `W0201` | Unknown or incompatible hint. |
| `W0202` | Default value outside `range()`. |
