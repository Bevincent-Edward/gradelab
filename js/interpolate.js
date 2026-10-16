// Motion-compensated frame interpolation (optical flow), on the GPU.
//
// For each pair of source frames A and B:
//   1. both are reduced to grey pyramids at a ~480 px working width;
//   2. pyramidal Lucas–Kanade flow is solved coarse-to-fine, A→B and B→A;
//   3. the flow is smoothed edge-aware (it follows image edges, not across them);
//   4. any in-between instant t is synthesised at full resolution by warping A
//      forward and B backward, weighting each by how consistent its forward and
//      backward motion are, so areas that appear or disappear (occlusions) come
//      from whichever frame actually shows them.
// Hard scene cuts are detected and get the nearest real frame instead of a morph.

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
`;

// full-resolution frame -> grey working image (mip-filtered, so no aliasing)
const GREY = HEAD + `
uniform sampler2D uSrc; uniform float uLod;
void main() {
  // no flip: textures hold rows top-first, so the pyramid and flow fields are
  // in image coordinates (origin top-left), matching the synthesis pass
  vec3 c = textureLod(uSrc, vUv, uLod).rgb;
  outColor = vec4(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 0.0, 1.0);
}`;

// 2x box downsample for the pyramid
const DOWN = HEAD + `
uniform sampler2D uSrc; uniform vec2 uTexel;
void main() {
  float a = texture(uSrc, vUv + uTexel * vec2(-0.5, -0.5)).r + texture(uSrc, vUv + uTexel * vec2(0.5, -0.5)).r
          + texture(uSrc, vUv + uTexel * vec2(-0.5, 0.5)).r + texture(uSrc, vUv + uTexel * vec2(0.5, 0.5)).r;
  outColor = vec4(a * 0.25, 0.0, 0.0, 1.0);
}`;

// one Lucas–Kanade iteration; flow is stored in pixels of the current level
const LK = HEAD + `
uniform sampler2D uI0, uI1, uFlow; uniform vec2 uSize; uniform float uScaleIn; uniform int uInit;
void main() {
  vec2 px = 1.0 / uSize;
  vec2 f = uInit == 1 ? texture(uFlow, vUv).rg * uScaleIn : vec2(0.0);
  float gxx = 1e-3, gxy = 0.0, gyy = 1e-3, bx = 0.0, by = 0.0;
  for (int j = -3; j <= 3; j++)
    for (int i = -3; i <= 3; i++) {
      vec2 q = vUv + vec2(float(i), float(j)) * px;
      float w = exp(-float(i * i + j * j) / 8.0);
      float ix = (texture(uI0, q + vec2(px.x, 0.0)).r - texture(uI0, q - vec2(px.x, 0.0)).r) * 0.5;
      float iy = (texture(uI0, q + vec2(0.0, px.y)).r - texture(uI0, q - vec2(0.0, px.y)).r) * 0.5;
      float it = texture(uI1, q + f * px).r - texture(uI0, q).r;
      gxx += w * ix * ix; gxy += w * ix * iy; gyy += w * iy * iy;
      bx += w * ix * it; by += w * iy * it;
    }
  float det = gxx * gyy - gxy * gxy;
  vec2 d = det > 1e-7 ? -vec2(gyy * bx - gxy * by, gxx * by - gxy * bx) / det : vec2(0.0);
  d = clamp(d, vec2(-2.0), vec2(2.0));
  outColor = vec4(f + d, 0.0, 1.0);
}`;

// edge-aware flow smoothing: neighbours with similar brightness count more
const SMOOTH = HEAD + `
uniform sampler2D uFlow, uI0; uniform vec2 uSize;
void main() {
  vec2 px = 1.0 / uSize;
  float c = texture(uI0, vUv).r;
  vec2 acc = vec2(0.0); float ws = 0.0;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) {
      vec2 q = vUv + vec2(float(i), float(j)) * px;
      float dI = texture(uI0, q).r - c;
      float w = exp(-float(i * i + j * j) / 6.0) * exp(-dI * dI * 400.0);
      acc += texture(uFlow, q).rg * w; ws += w;
    }
  outColor = vec4(acc / ws, 0.0, 1.0);
}`;

// synthesise the frame at time uT between A (t=0) and B (t=1)
const SYNTH = HEAD + `
uniform sampler2D uA, uB, uFab, uFba; uniform vec2 uFlowSize; uniform float uT;
vec2 toUv(vec2 f) { return f / uFlowSize; }
void main() {
  // everything below works in image coordinates (origin top-left), the same
  // space the pyramids and flow fields were built in
  vec2 x = vec2(vUv.x, 1.0 - vUv.y);
  vec2 fab = toUv(texture(uFab, x).rg), fba = toUv(texture(uFba, x).rg);
  // the point at x came from A at x - t*v and goes to B at x + (1-t)*v
  vec2 pa = x - uT * fab;
  vec2 pb = x - (1.0 - uT) * fba;
  // forward-backward consistency: small when the motion is trustworthy
  float ea = length(toUv(texture(uFab, pa).rg) + toUv(texture(uFba, pa + toUv(texture(uFab, pa).rg)).rg)) * uFlowSize.x;
  float eb = length(toUv(texture(uFba, pb).rg) + toUv(texture(uFab, pb + toUv(texture(uFba, pb).rg)).rg)) * uFlowSize.x;
  float wa = (1.0 - uT) / (0.35 + ea * ea);
  float wb = uT / (0.35 + eb * eb);
  vec3 ca = texture(uA, pa).rgb;
  vec3 cb = texture(uB, pb).rgb;
  vec3 col = (ca * wa + cb * wb) / (wa + wb);
  // where both sides disagree badly, fall back to a plain cross-fade
  float bad = smoothstep(2.5, 6.0, min(ea, eb));
  vec3 fade = mix(texture(uA, x).rgb, texture(uB, x).rgb, uT);
  outColor = vec4(mix(col, fade, bad), 1.0);
}`;

// straight copy, for t = 0 / t = 1 and scene cuts
const COPY = HEAD + `
uniform sampler2D uA;
void main() { outColor = vec4(texture(uA, vec2(vUv.x, 1.0 - vUv.y)).rgb, 1.0); }`;

export class FrameInterpolator {
  /** width/height: output frame size. Throws if the GPU can't render float textures. */
  constructor(width, height) {
    this.W = width;
    this.H = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) {
      throw new Error("Float render targets unavailable");
    }
    this.gl = gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.p = Object.fromEntries(Object.entries({ GREY, DOWN, LK, SMOOTH, SYNTH, COPY }).map(([k, fs]) => [k, this.#prog(fs)]));

    // working pyramid: level 0 is ~480 px wide
    const w0 = Math.max(16, Math.round(width * Math.min(1, 480 / width)));
    const h0 = Math.max(16, Math.round((height * w0) / width));
    this.levels = [];
    let w = w0, h = h0;
    for (let l = 0; l < 4 && w >= 24 && h >= 16; l++) {
      this.levels.push({ w, h, a: this.#target(w, h), b: this.#target(w, h), f1: this.#target(w, h), f2: this.#target(w, h), r1: this.#target(w, h), r2: this.#target(w, h) });
      w = Math.round(w / 2);
      h = Math.round(h / 2);
    }
    this.srcA = this.#texture(true);
    this.srcB = this.#texture(true);
    this.haveA = false;
    this.flowReady = false;
    this.cut = false;
    this.probe = document.createElement("canvas");
    this.probe.width = 32;
    this.probe.height = 18;
    this.probeCtx = this.probe.getContext("2d", { willReadFrequently: true });
    this.lastProbe = null;
  }

  #prog(fs) {
    const gl = this.gl;
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(prog, i).name; u[name] = gl.getUniformLocation(prog, name); }
    return { prog, u };
  }

  #texture(mip) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  #target(w, h) {
    const gl = this.gl;
    const tex = this.#texture(false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  #pass(name, target, uniforms, textures) {
    const gl = this.gl;
    const { prog, u } = this.p[name];
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
    let unit = 0;
    for (const [k, tex] of Object.entries(textures)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u[k], unit++);
    }
    for (const [k, v] of Object.entries(uniforms)) {
      if (!(k in u)) continue;
      if (Array.isArray(v)) gl.uniform2f(u[k], v[0], v[1]);
      else if (Number.isInteger(v) && k === "uInit") gl.uniform1i(u[k], v);
      else gl.uniform1f(u[k], v);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Adds the next source frame (VideoFrame, canvas or image). The previous one becomes A. */
  push(source) {
    const gl = this.gl;
    [this.srcA, this.srcB] = [this.srcB, this.srcA];
    this.haveA = this.haveB === true;
    gl.bindTexture(gl.TEXTURE_2D, this.srcB);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.haveB = true;
    this.flowReady = false;
    // scene-cut probe: mean brightness change on a tiny thumbnail
    this.probeCtx.drawImage(source, 0, 0, 32, 18);
    const d = this.probeCtx.getImageData(0, 0, 32, 18).data;
    const lum = new Float32Array(32 * 18);
    for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    if (this.lastProbe) {
      let diff = 0;
      for (let i = 0; i < lum.length; i++) diff += Math.abs(lum[i] - this.lastProbe[i]);
      this.cut = diff / lum.length > 38;
    }
    this.lastProbe = lum;
  }

  #grey(src, which) {
    const L0 = this.levels[0];
    const lod = Math.max(0, Math.log2(this.W / L0.w));
    this.#pass("GREY", which === "a" ? L0.a : L0.b, { uLod: lod }, { uSrc: src });
    for (let l = 1; l < this.levels.length; l++) {
      const prev = this.levels[l - 1], cur = this.levels[l];
      this.#pass("DOWN", which === "a" ? cur.a : cur.b, { uTexel: [1 / prev.w, 1 / prev.h] }, { uSrc: which === "a" ? prev.a.tex : prev.b.tex });
    }
  }

  #solve(dir) {
    // dir "f": A→B into f-buffers, "r": B→A into r-buffers
    const n = this.levels.length;
    let prevFlow = null;
    for (let l = n - 1; l >= 0; l--) {
      const L = this.levels[l];
      const I0 = dir === "f" ? L.a.tex : L.b.tex;
      const I1 = dir === "f" ? L.b.tex : L.a.tex;
      let src = dir === "f" ? L.f1 : L.r1, dst = dir === "f" ? L.f2 : L.r2;
      const iters = l === 0 ? 3 : 4;
      for (let it = 0; it < iters; it++) {
        const init = it > 0 || prevFlow ? 1 : 0;
        const flowTex = it === 0 ? (prevFlow ? prevFlow.tex : src.tex) : src.tex;
        const scaleIn = it === 0 && prevFlow ? 2 : 1;
        this.#pass("LK", dst, { uSize: [L.w, L.h], uScaleIn: scaleIn, uInit: init }, { uI0: I0, uI1: I1, uFlow: flowTex });
        [src, dst] = [dst, src];
      }
      this.#pass("SMOOTH", dst, { uSize: [L.w, L.h] }, { uFlow: src.tex, uI0: I0 });
      prevFlow = dst;
      if (dir === "f") { L.fOut = dst; } else { L.rOut = dst; }
    }
  }

  #computeFlow() {
    this.#grey(this.srcA, "a");
    this.#grey(this.srcB, "b");
    this.#solve("f");
    this.#solve("r");
    this.flowReady = true;
  }

  /**
   * Renders the frame at fraction t (0 = previous frame, 1 = newest frame)
   * into this.canvas and returns the canvas.
   */
  render(t) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!this.haveA || t >= 0.999 || this.cut) {
      this.#pass("COPY", null, {}, { uA: !this.haveA || t >= 0.5 || t >= 0.999 ? this.srcB : this.srcA });
      return this.canvas;
    }
    if (t <= 0.001) {
      this.#pass("COPY", null, {}, { uA: this.srcA });
      return this.canvas;
    }
    if (!this.flowReady) this.#computeFlow();
    const L0 = this.levels[0];
    this.#pass("SYNTH", null, { uFlowSize: [L0.w, L0.h], uT: t }, { uA: this.srcA, uB: this.srcB, uFab: L0.fOut.tex, uFba: L0.rOut.tex });
    return this.canvas;
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
