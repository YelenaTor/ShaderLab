import { shader_frame } from "@yoruxiii/shaderlab";
import hello from "./hello.slab";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const chroma = shader_frame.chroma(hello) {
  depth: 0.55,
  parallax: 0.07,
  strength: 0.012,
};
chroma.mount(canvas);
