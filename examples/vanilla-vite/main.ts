import { shader_frame } from "@yoruxiii/shaderlab";
import hello from "./hello.slab";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const chroma = shader_frame.chroma(hello);
chroma.mount(canvas);
