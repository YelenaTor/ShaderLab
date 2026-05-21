# ShaderLab

ShaderLab is a Vite-first toolchain for `.slab` shader libraries. A `.slab` file declares named shader frames, the Vite plugin compiles those frames into WebGL2-ready modules, and app code creates mountable runtime instances with `shader_frame.<id>(library)`.

Requirements:

- Node 18+
- Vite 5 or 6
- WebGL2 in the browser

```bash
npm install @yoruxiii/shaderlab@testing
```

## Mental Model

```text
effects.slab
  -> <shader_frame id="clouds" type="canvas_25d">
  -> import effects from "./effects.slab"
  -> shader_frame.clouds(effects) { ... }
  -> ShaderFrameInstance
  -> mount(canvas)
```

A `.slab` file is a shader library. Each `<shader_frame id="...">` becomes callable through `shader_frame.<id>(importedLibrary)`. The call returns a `ShaderFrameInstance` with `mount`, `unmount`, and `set`.

## Quick Start

Register the Vite plugin:

```ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

Create a slab:

```xml
<shaderlab version="2.0">
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
</shaderlab>
```

Use it from app code:

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import effects from "./effects.slab";

const clouds = shader_frame.clouds(effects) {
  depth: 0.5,
  parallax: 0.08,
};

clouds.mount(document.querySelector("canvas")!);
clouds.set("depth", 0.7);
```

The block syntax is compiled by the Vite plugin into a normal options object before the TypeScript/JavaScript pipeline sees it.

## Frame Types

| Type | Job |
| --- | --- |
| `canvas_item` | 2D fullscreen/canvas shader. Use `UV`, `TIME`, `RESOLUTION`, `TEXTURE`, `COLOR`. |
| `canvas_25d` | First-class 2.5D canvas shader. Adds `PARALLAX_UV`, `PARALLAX_OFFSET`, `LAYER_DEPTH`, and `PARALLAX_STRENGTH`. |
| `spatial` | Standalone fullscreen pass or `mode="augment"` pass that samples `CANVAS_TEXTURE` / `CANVAS_UV`. |
| `postprocess` | Terminal pass that samples upstream output through `SCREEN_TEXTURE` / `SCREEN_UV`. |

Composition order is fixed:

```text
canvas_item | canvas_25d -> spatial augment(s) -> postprocess
```

Calling a `postprocess` frame automatically finds the upstream `canvas_item` or `canvas_25d` in the same slab and wires the pipeline. Augments declared in the call block run in order.

```ts
const finalFrame = shader_frame.grade(effects) {
  depth: 0.45,
  gain: 1.2,
  augment.ripple(effects) {
    strength: 0.4,
  },
};

finalFrame.mount(canvas);
```

## TypeScript

Add the ambient client types when importing `.slab` files:

```json
{
  "compilerOptions": {
    "types": ["@yoruxiii/shaderlab/client"]
  }
}
```

The Vite plugin emits sibling `*.slab.d.ts` files by default for frame-specific options.

## Docs

- [Usage](./docs/USAGE.md)
- [Language](./docs/LANGUAGE.md)
- [API](./docs/API.md)
- [Contributing](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

## License

Dual licensed under [MIT](./LICENSE-MIT) or [Apache-2.0](./LICENSE-APACHE).
