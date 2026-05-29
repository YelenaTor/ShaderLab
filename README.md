# ShaderLab

ShaderLab turns `.slab` shader libraries into typed, mountable WebGL2 frames for app frameworks.

```text
.slab library
  -> Vite / experimental Next transform
  -> shader_frame.<id>(library)
  -> ShaderFrameInstance
  -> WebGL2 canvas
```

Use it when you want shader effects to live beside application code without hand-wiring GLSL strings, canvas lifecycle, uniform binding, postprocess passes, or framework-specific mount helpers.

## Install Track

ShaderLab currently has two npm tracks:

| Tag | Schema | API |
| --- | --- | --- |
| `latest` | Schema 1.0 | Legacy `<shader>` and `useShader` API. |
| `testing` | Schema 2.0 | Current `<shader_frame>` and `shader_frame.*` API. |

For new projects, use Schema 2.0:

```bash
npm install @yoruxiii/shaderlab@testing
```

Requirements:

- Node 18+
- Vite 5, 6, 7, or 8, or experimental Next webpack mode
- WebGL2 in the browser

## Why ShaderLab

- **Named shader frames**: each `<shader_frame id="...">` becomes `shader_frame.<id>(fx)`.
- **Typed uniforms**: mutable/deferred uniforms are emitted into `.slab.d.ts` sidecars.
- **Framework helpers**: React, Vue, and Svelte helpers mount existing `ShaderFrameInstance`s.
- **Composable passes**: canvas frames can feed ordered spatial augments and terminal postprocess frames.
- **First-class 2.5D**: `canvas_25d` adds parallax builtins such as `PARALLAX_UV` and `LAYER_DEPTH`.

## First Shader

Register the Vite plugin:

```ts
import { defineConfig } from "vite";
import shaderlab from "@yoruxiii/shaderlab/vite";

export default defineConfig({
  plugins: [shaderlab()],
});
```

Add ambient TypeScript support:

```json
{
  "compilerOptions": {
    "types": ["@yoruxiii/shaderlab/client"]
  }
}
```

Create `src/shaders/hello.slab`:

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

Mount it:

```ts
import { shader_frame } from "@yoruxiii/shaderlab";
import fx from "./shaders/hello.slab";

const clouds = shader_frame.clouds(fx, {
  depth: 0.5,
  parallax: 0.08,
});

clouds.mount(document.querySelector("canvas")!);
clouds.set("depth", 0.7);
```

## Call Syntax

ShaderLab supports standard TypeScript calls and a Vite/Next-transformed block syntax.

| Standard form | Block form |
| --- | --- |
| Always valid TS/JS. Best for generated code, linters, and tooling. | ShaderLab authoring syntax. Compiled away before the app build parses code. |

```ts
const clouds = shader_frame.clouds(fx, {
  depth: 0.5,
  parallax: 0.08,
});
```

```ts
const clouds = shader_frame.clouds(fx) {
  depth: 0.5,
  parallax: 0.08,
};
```

Augments use the same two shapes:

```ts
const finalFrame = shader_frame.grade(fx, {
  gain: 1.2,
  augments: [
    { frameId: "ripple", slab: fx, loadIndex: 0, options: { strength: 0.4 } },
  ],
});
```

```ts
const finalFrame = shader_frame.grade(fx) {
  gain: 1.2,
  augment.ripple(fx) {
    strength: 0.4,
  },
};
```

## Pipeline Model

```text
canvas_item | canvas_25d
  -> spatial mode="augment" pass(es)
  -> postprocess
```

Calling a `postprocess` frame automatically finds the upstream `canvas_item` or `canvas_25d` from the same slab and wires the full chain. Most apps should not pass `feedFrom` manually.

## Framework Setup

| Target | Setup |
| --- | --- |
| Vite | `plugins: [shaderlab()]` from `@yoruxiii/shaderlab/vite`. |
| Nuxt | `modules: ["@yoruxiii/shaderlab/nuxt"]`. |
| SvelteKit | Use `@yoruxiii/shaderlab/sveltekit` beside `sveltekit()`. |
| Remix | Use `@yoruxiii/shaderlab/remix` beside Remix's Vite plugin. |
| React | `ShaderFrame` and `useShaderFrame` from `@yoruxiii/shaderlab/react`. |
| Vue | `ShaderFrame` and `useShaderFrame` from `@yoruxiii/shaderlab/vue`. |
| Svelte | `shaderframe` action and `ShaderFrame.svelte` from `@yoruxiii/shaderlab/svelte`. |
| Next | Experimental webpack-mode support through `withShaderlab` from `@yoruxiii/shaderlab/next`. |

Experimental Next config:

```ts
import { withShaderlab } from "@yoruxiii/shaderlab/next";

export default withShaderlab({});
```

Use webpack mode for Next while Turbopack support is deferred. In Next apps, prefer the standard two-argument call form in `.ts` and `.tsx` files; block syntax is compiled by ShaderLab's webpack loader, but Next's TypeScript checker still parses source files before it understands that custom syntax. Use `.js` or `.jsx` files if you want block syntax in the experimental Next path.

## CLI

```bash
npx shaderlab init
npx shaderlab init --dry-run
npx shaderlab init -y
```

`init` detects Nuxt, SvelteKit, Remix, Next, Vite, and common UI layers. It patches supported configs conservatively and creates a minimal `src/shaders/hello.slab` plus optional framework examples.

## Docs

- [Usage](./docs/USAGE.md)
- [Language](./docs/LANGUAGE.md)
- [API](./docs/API.md)
- [Example](./docs/example/README.md)
- [Agent guide](./docs/AGENTS.md)
- [Changelog](./CHANGELOG.md)

## License

Dual licensed under [MIT](./LICENSE-MIT) or [Apache-2.0](./LICENSE-APACHE).
