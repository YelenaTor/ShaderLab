import { chroma, bg } from "./hello.slab";

const canvas = document.getElementById("app") as HTMLCanvasElement;
chroma.attach(canvas, { feedFrom: bg });
