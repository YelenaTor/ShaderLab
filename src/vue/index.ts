import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  type PropType,
  type Ref,
} from "vue";
import type { ShaderFrameInstance } from "../vite/runtime.js";

/** Mounts a `ShaderFrameInstance` to a canvas ref on mount. */
export function useShaderFrame(
  frame: ShaderFrameInstance,
): {
  canvasRef: Ref<HTMLCanvasElement | null>;
} {
  const canvasRef = ref<HTMLCanvasElement | null>(null);

  onMounted(() => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    frame.mount(canvas);
  });

  onBeforeUnmount(() => {
    frame.unmount();
  });

  return { canvasRef };
}

export const ShaderFrame = defineComponent({
  name: "ShaderFrame",
  props: {
    frame: {
      type: Object as PropType<ShaderFrameInstance>,
      required: true,
    },
  },
  setup(props, { attrs }) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);

    onMounted(() => {
      const c = canvasRef.value;
      if (c) props.frame.mount(c);
    });

    onBeforeUnmount(() => props.frame.unmount());

    return () =>
      h("canvas", {
        ref: canvasRef,
        ...attrs,
      });
  },
});
