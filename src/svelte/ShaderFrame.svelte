<script lang="ts">
  import type { MountOptions, ShaderFrameInstance } from "../vite/runtime.js";
  import { shaderframe } from "./use-shader.js";

  export let frame: ShaderFrameInstance;
  export let mountOptions: MountOptions | undefined = undefined;
  export let uniforms: Record<string, unknown> | undefined = undefined;
</script>

<canvas use:shaderframe={{ frame, mountOptions, uniforms }} {...$$restProps} />
