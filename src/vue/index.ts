import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  type PropType,
  type Ref,
} from "vue";
import type { SlabModule } from "../runtime/use-shader.js";
import type { AttachOptions, ShaderInstance } from "../vite/runtime.js";
import { useShader as useShaderCore } from "../runtime/use-shader.js";

export type { SlabModule } from "../runtime/use-shader.js";
export type { AttachOptions, ShaderInstance } from "../vite/runtime.js";

/**
 * Vue composable — attaches all shaders in a `.slab` module to a canvas ref on mount.
 * Pass the **imported** module (with `__shaders`), not a string path.
 */
export function useShader<T extends Record<string, ShaderInstance>>(mod: SlabModule<T>): {
  canvasRef: Ref<HTMLCanvasElement | null>;
  shaders: T;
} {
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const api = useShaderCore(mod);

  onMounted(() => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    api.attach(canvas);
  });

  onBeforeUnmount(() => {
    api.detachAll();
  });

  return { canvasRef, shaders: api.shaders };
}

export const ShaderLab = defineComponent({
  name: "ShaderLab",
  props: {
    module: {
      type: Object as PropType<SlabModule<Record<string, ShaderInstance>>>,
      required: true,
    },
    attachOptions: {
      type: Object as PropType<AttachOptions | undefined>,
      default: undefined,
    },
  },
  setup(props, { attrs }) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const api = useShaderCore(props.module);

    onMounted(() => {
      const c = canvasRef.value;
      if (c) api.attach(c, props.attachOptions);
    });
    onBeforeUnmount(() => api.detachAll());

    return () =>
      h("canvas", {
        ref: canvasRef,
        ...attrs,
      });
  },
});
