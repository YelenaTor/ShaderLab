<script lang="ts">
  import type { ShaderFrameInstance } from "../vite/runtime.js";
  import { shaderframe } from "./use-shader.js";

  export let frame: ShaderFrameInstance;
</script>

<canvas use:shaderframe={frame} {...$$restProps} />
