import { parseDefaultValue } from "../compiler/hints.js";
import type { ShaderRuntimeMetadata, UniformBindingMeta } from "../compiler/types.js";

export interface ShaderInstanceConfig {
  shaderId: string;
  vertexSource: string;
  fragmentSource: string;
  metadata: ShaderRuntimeMetadata;
}

export interface ShaderInstance<TUniforms = Record<string, unknown>> {
  readonly uniforms: TUniforms;
  attach(canvas: HTMLCanvasElement, options?: AttachOptions): void;
  detach(): void;
  /** @internal Hot module replacement — swaps GL program while preserving compatible uniforms. */
  _slabHotSwap?(next: ShaderInstance<Record<string, unknown>>): void;
}

export interface AttachOptions {
  /** For `postprocess`: canvas_item instance that renders into the scene FBO first. */
  feedFrom?: ShaderInstance<Record<string, unknown>>;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "";
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed:\n${log}\n---\n${src}`);
  }
  return sh;
}

/** sRGB scalar [0,1] to linear (for `color` hint uniforms at bind time). */
function srgbChannelToLinear(s: number): number {
  if (!Number.isFinite(s)) return s;
  const c = Math.min(1, Math.max(0, s));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? "";
    gl.deleteProgram(p);
    throw new Error(`Program link failed:\n${log}`);
  }
  return p;
}

export class ShaderLabRuntime implements ShaderInstance<Record<string, unknown>> {
  readonly uniforms: Record<string, unknown>;
  private cfg: ShaderInstanceConfig;
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private program: WebGLProgram | null = null;
  private locations = new Map<string, WebGLUniformLocation | null>();
  private raf = 0;
  private t0 = 0;
  private resizeObs: ResizeObserver | null = null;
  private onMouse: ((e: MouseEvent) => void) | null = null;
  private slave = false;
  private partner: ShaderLabRuntime | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private sceneTex: WebGLTexture | null = null;
  private fbW = 0;
  private fbH = 0;

  /** @internal Used by HMR to read payload from a fresh instance. */
  get config(): ShaderInstanceConfig {
    return this.cfg;
  }

  constructor(config: ShaderInstanceConfig) {
    this.cfg = config;
    const store: Record<string, unknown> = {};
    this.uniforms = store;
    for (const u of config.metadata.uniforms) {
      Object.defineProperty(store, u.name, {
        enumerable: true,
        configurable: true,
        get: () => store[`__${u.name}`],
        set: (v: unknown) => {
          if (u.mousePosition) return;
          store[`__${u.name}`] = this.clampIfNeeded(u, v);
          if (this.gl && this.program) {
            this.gl.useProgram(this.program);
            this.applyOneUniform(u, store[`__${u.name}`]);
          }
        },
      });
      store[`__${u.name}`] = u.mousePosition ? ([0, 0] as unknown) : undefined;
    }
  }

  private linearizeColorIfNeeded(u: UniformBindingMeta, v: unknown): unknown {
    if (!u.hint || !/\bcolor\b/i.test(u.hint)) return v;
    if (u.slabType === "vec3" && Array.isArray(v) && v.length >= 3) {
      return [
        srgbChannelToLinear(Number(v[0])),
        srgbChannelToLinear(Number(v[1])),
        srgbChannelToLinear(Number(v[2])),
      ];
    }
    if (u.slabType === "vec4" && Array.isArray(v) && v.length >= 4) {
      return [
        srgbChannelToLinear(Number(v[0])),
        srgbChannelToLinear(Number(v[1])),
        srgbChannelToLinear(Number(v[2])),
        Number(v[3]),
      ];
    }
    return v;
  }

  private clampIfNeeded(u: UniformBindingMeta, v: unknown): unknown {
    v = this.linearizeColorIfNeeded(u, v);
    if (u.range && (u.slabType === "float" || u.slabType === "int") && typeof v === "number") {
      const [lo, hi] = u.range;
      if (v < lo || v > hi) {
        console.warn(
          `[shaderlab] H0401 [Hazard] — uniform "${u.name}" out of range; clamped to [${lo}, ${hi}]`,
        );
        return Math.min(hi, Math.max(lo, v));
      }
    }
    return v;
  }

  /** Internal: share GL with a postprocess parent. */
  _ensureSlave(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
    this.slave = true;
    this.gl = gl;
    this.canvas = canvas;
    if (!this.program) {
      this.buildProgram();
    }
  }

  attach(canvas: HTMLCanvasElement, options?: AttachOptions): void {
    if (this.raf !== 0) {
      this.detach();
    }
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      depth: true,
    });
    if (!this.gl) {
      throw new Error("[shaderlab] WebGL2 context not available");
    }
    this.slave = false;
    this.buildProgram();
    this.cacheLocations();
    this.applyDefaults();

    const meta = this.cfg.metadata;
    if (meta.shaderType === "postprocess") {
      const p = options?.feedFrom;
      if (!(p instanceof ShaderLabRuntime)) {
        throw new Error(
          "[shaderlab] postprocess requires attach(canvas, { feedFrom: canvasItemInstance })",
        );
      }
      this.partner = p;
      this.partner._ensureSlave(this.gl, canvas);
      this.ensureFbo();
    }

    this.resizeObs = new ResizeObserver(() => this.syncCanvasSize());
    this.resizeObs.observe(canvas);
    this.syncCanvasSize();

    for (const u of meta.uniforms) {
      if (u.mousePosition) {
        this.onMouse = (e: MouseEvent) => {
          if (!this.canvas || !this.gl || !this.program) return;
          const rect = this.canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = 1.0 - (e.clientY - rect.top) / rect.height;
          (this.uniforms as Record<string, unknown>)[`__${u.name}`] = [x, y];
        };
        canvas.addEventListener("mousemove", this.onMouse);
      }
    }

    this.t0 = performance.now() / 1000;
    const tick = () => {
      this.drawFrame();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.resizeObs && this.canvas) {
      this.resizeObs.unobserve(this.canvas);
    }
    this.resizeObs = null;
    if (this.canvas && this.onMouse) {
      this.canvas.removeEventListener("mousemove", this.onMouse);
    }
    this.onMouse = null;
    if (this.gl) {
      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
      if (this.fbo) {
        this.gl.deleteFramebuffer(this.fbo);
        this.fbo = null;
      }
      if (this.sceneTex) {
        this.gl.deleteTexture(this.sceneTex);
        this.sceneTex = null;
      }
      if (this.whiteTex) {
        this.gl.deleteTexture(this.whiteTex);
        this.whiteTex = null;
      }
    }
    this.gl = null;
    this.canvas = null;
    this.partner = null;
  }

  _slabHotSwap(next: ShaderInstance<Record<string, unknown>>): void {
    if (!this.gl) return;
    const peer = next as unknown as ShaderLabRuntime;
    if (!(peer instanceof ShaderLabRuntime)) return;
    const newCfg = peer.cfg;
    const gl = this.gl;
    const oldUniforms = this.cfg.metadata.uniforms;
    const store = this.uniforms as Record<string, unknown>;
    const saved = new Map<string, unknown>();
    for (const u of oldUniforms) {
      saved.set(`${u.name}\0${u.slabType}`, store[`__${u.name}`]);
    }
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    this.cfg = newCfg;
    this.buildProgram();
    this.cacheLocations();
    for (const u of newCfg.metadata.uniforms) {
      const v = saved.get(`${u.name}\0${u.slabType}`);
      if (v !== undefined) {
        store[`__${u.name}`] = v;
      }
    }
    this.applyDefaults();
    if (this.program) {
      gl.useProgram(this.program);
      this.applyUserUniforms();
    }
    const preserved = [...newCfg.metadata.uniforms].filter((u) =>
      saved.has(`${u.name}\0${u.slabType}`),
    ).length;
    const total = newCfg.metadata.uniforms.length;
    console.debug(`[shaderlab] HMR ${newCfg.shaderId}: swapped, preserved ${preserved}/${total} uniforms`);
  }

  private buildProgram(): void {
    const gl = this.gl!;
    const vs = compileShader(gl, gl.VERTEX_SHADER, this.cfg.vertexSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, this.cfg.fragmentSource);
    this.program = linkProgram(gl, vs, fs);
  }

  private cacheLocations(): void {
    const gl = this.gl!;
    const p = this.program!;
    const meta = this.cfg.metadata;
    const names = new Set<string>();
    if (meta.referencedBuiltins.includes("TIME")) {
      names.add("u_slab_time");
    }
    if (meta.referencedBuiltins.includes("RESOLUTION")) {
      names.add("u_slab_resolution");
    }
    if (meta.shaderType === "canvas_item" && meta.referencedBuiltins.includes("TEXTURE")) {
      names.add("u_slab_texture_builtin");
    }
    if (meta.shaderType === "postprocess") {
      names.add("u_slab_screen_texture");
    }
    for (const u of meta.uniforms) {
      names.add(u.glslName);
    }
    for (const n of names) {
      this.locations.set(n, gl.getUniformLocation(p, n));
    }
  }

  private applyDefaults(): void {
    const store = this.uniforms as Record<string, unknown>;
    for (const u of this.cfg.metadata.uniforms) {
      if (u.mousePosition) continue;
      if (store[`__${u.name}`] !== undefined) continue;
      const dv = parseDefaultValue(u.slabType, u.default);
      if (dv !== undefined) {
        store[`__${u.name}`] = this.clampIfNeeded(u, dv);
      }
    }
  }

  private syncCanvasSize(): void {
    if (!this.canvas || !this.gl) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (this.cfg.metadata.shaderType === "postprocess") {
      this.ensureFbo();
    }
  }

  private ensureFbo(): void {
    const gl = this.gl!;
    const w = this.canvas!.width;
    const h = this.canvas!.height;
    if (this.fbo && w === this.fbW && h === this.fbH) return;
    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo);
      gl.deleteTexture(this.sceneTex!);
    }
    this.fbW = w;
    this.fbH = h;
    this.sceneTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.sceneTex,
      0,
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`[shaderlab] FBO incomplete: ${status}`);
    }
  }

  private drawFrame(): void {
    if (!this.gl || !this.program || !this.canvas) return;
    const gl = this.gl;
    const meta = this.cfg.metadata;
    const t = performance.now() / 1000 - this.t0;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (meta.shaderType === "postprocess" && this.partner && this.fbo && this.sceneTex) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.partner.drawScenePass(t, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      this.applyBlend(meta);
      this.applyCull(meta);
      this.applyBuiltinUniforms(t, w, h);
      this.applyUserUniforms();
      const unit = meta.screenTextureUnit ?? 0;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      const loc = this.locations.get("u_slab_screen_texture");
      if (loc) gl.uniform1i(loc, unit);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } else if (!this.slave) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      this.applyBlend(meta);
      this.applyCull(meta);
      this.applyBuiltinUniforms(t, w, h);
      this.applyUserUniforms();
      this.bindBuiltinTextures(gl, meta);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  drawScenePass(t: number, w: number, h: number): void {
    if (!this.gl || !this.program) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    const meta = this.cfg.metadata;
    this.applyBlend(meta);
    this.applyCull(meta);
    this.applyBuiltinUniforms(t, w, h);
    this.applyUserUniforms();
    this.bindBuiltinTextures(gl, meta);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private applyBlend(meta: ShaderRuntimeMetadata): void {
    const gl = this.gl!;
    const m = meta.blendMode;
    if (m === "add") {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else if (m === "multiply") {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    } else if (m === "premult_alpha") {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
  }

  private applyCull(meta: ShaderRuntimeMetadata): void {
    const gl = this.gl!;
    if (meta.cullDisabled) {
      gl.disable(gl.CULL_FACE);
    } else {
      gl.enable(gl.CULL_FACE);
    }
  }

  private applyBuiltinUniforms(t: number, w: number, h: number): void {
    const gl = this.gl!;
    const meta = this.cfg.metadata;
    if (meta.referencedBuiltins.includes("TIME")) {
      const loc = this.locations.get("u_slab_time");
      if (loc) gl.uniform1f(loc, t);
    }
    if (meta.referencedBuiltins.includes("RESOLUTION")) {
      const loc = this.locations.get("u_slab_resolution");
      if (loc) gl.uniform2f(loc, w, h);
    }
  }

  private applyUserUniforms(): void {
    const store = this.uniforms as Record<string, unknown>;
    for (const u of this.cfg.metadata.uniforms) {
      const v = store[`__${u.name}`];
      this.applyOneUniform(u, v);
    }
  }

  private applyOneUniform(u: UniformBindingMeta, v: unknown): void {
    const gl = this.gl!;
    const loc = this.locations.get(u.glslName);
    if (loc == null) return;
    switch (u.slabType) {
      case "float":
        if (typeof v === "number") gl.uniform1f(loc, v);
        break;
      case "int":
        if (typeof v === "number") gl.uniform1i(loc, Math.trunc(v));
        break;
      case "bool":
        gl.uniform1i(loc, v ? 1 : 0);
        break;
      case "vec2": {
        if (Array.isArray(v) && v.length >= 2) {
          gl.uniform2f(loc, Number(v[0]), Number(v[1]));
        }
        break;
      }
      case "vec3": {
        if (Array.isArray(v) && v.length >= 3) {
          gl.uniform3f(loc, Number(v[0]), Number(v[1]), Number(v[2]));
        }
        break;
      }
      case "vec4": {
        if (Array.isArray(v) && v.length >= 4) {
          gl.uniform4f(loc, Number(v[0]), Number(v[1]), Number(v[2]), Number(v[3]));
        }
        break;
      }
      case "sampler2D":
        if (v instanceof HTMLImageElement || v instanceof HTMLCanvasElement || v instanceof ImageBitmap) {
          const unit = u.textureUnit ?? 0;
          gl.activeTexture(gl.TEXTURE0 + unit);
          const tex = this.ensureTextureForImage(gl, v);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1i(loc, unit);
        }
        break;
      default:
        break;
    }
  }

  private textureCache = new WeakMap<object, WebGLTexture>();

  private ensureTextureForImage(
    gl: WebGL2RenderingContext,
    img: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  ): WebGLTexture {
    let t = this.textureCache.get(img);
    if (t) return t;
    t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.textureCache.set(img, t);
    return t;
  }

  private bindBuiltinTextures(gl: WebGL2RenderingContext, meta: ShaderRuntimeMetadata): void {
    if (meta.shaderType !== "canvas_item") return;
    if (!meta.referencedBuiltins.includes("TEXTURE")) return;
    const unit = meta.textureBuiltinUnit ?? 0;
    const loc = this.locations.get("u_slab_texture_builtin");
    if (!loc) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    const white = this.get1x1White(gl);
    gl.bindTexture(gl.TEXTURE_2D, white);
    gl.uniform1i(loc, unit);
  }

  private whiteTex: WebGLTexture | null = null;

  private get1x1White(gl: WebGL2RenderingContext): WebGLTexture {
    if (this.whiteTex) return this.whiteTex;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    const pixel = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.whiteTex = t;
    return t;
  }
}

export function createShaderInstance(config: ShaderInstanceConfig): ShaderInstance<Record<string, unknown>> {
  return new ShaderLabRuntime(config);
}

export { useShader } from "../runtime/use-shader.js";
export type { SlabModule } from "../runtime/use-shader.js";
