import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
  type Ref,
} from "vue";
import type { MountOptions, ShaderFrameInstance } from "../vite/runtime.js";

function applyUniforms(
  frame: ShaderFrameInstance,
  uniforms: Record<string, unknown> | undefined,
): void {
  if (!uniforms) return;
  for (const [key, value] of Object.entries(uniforms)) {
    frame.set(key, value);
  }
}

/** Mounts a `ShaderFrameInstance` to a canvas ref on mount. */
export function useShaderFrame(
  frame: ShaderFrameInstance,
  mountOptions?: MountOptions,
): {
  canvasRef: Ref<HTMLCanvasElement | null>;
} {
  const canvasRef = ref<HTMLCanvasElement | null>(null);

  onMounted(() => {
    // Vue does not run onMounted during SSR, so WebGL setup stays browser-only.
    const canvas = canvasRef.value;
    if (!canvas) return;
    frame.mount(canvas, mountOptions);
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
    mountOptions: {
      type: Object as PropType<MountOptions>,
      default: undefined,
    },
    uniforms: {
      type: Object as PropType<Record<string, unknown>>,
      default: undefined,
    },
  },
  setup(props, { attrs }) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);

    const mountCurrent = () => {
      const canvas = canvasRef.value;
      if (!canvas) return;
      props.frame.mount(canvas, props.mountOptions);
      applyUniforms(props.frame, props.uniforms);
    };

    onMounted(mountCurrent);

    watch(
      () => props.frame,
      (next, previous) => {
        previous.unmount();
        const canvas = canvasRef.value;
        if (!canvas) return;
        next.mount(canvas, props.mountOptions);
        applyUniforms(next, props.uniforms);
      },
    );

    watch(
      () => props.mountOptions,
      () => {
        props.frame.unmount();
        mountCurrent();
      },
    );

    watch(
      () => props.uniforms,
      (uniforms) => applyUniforms(props.frame, uniforms),
      { deep: true },
    );

    onBeforeUnmount(() => props.frame.unmount());

    return () =>
      h("canvas", {
        ref: canvasRef,
        ...attrs,
      });
  },
});
