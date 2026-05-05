<script lang="ts">
  import type { SlabModule } from "../runtime/use-shader.js";
  import type { AttachOptions, ShaderInstance } from "../vite/runtime.js";
  import { shaderlab } from "./use-shader.js";

  type T = Record<string, ShaderInstance>;

  export let module: SlabModule<T>;
  export let attachOptions: AttachOptions | undefined = undefined;
</script>

<canvas use:shaderlab={{ module, attachOptions }} {...$$restProps} />
