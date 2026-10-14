// WebGL2 renderer. Colour grading is a 3D-LUT lookup per pixel; the only
// spatial tools (clarity, dehaze, glow, halation) read from two small blurred
// copies of the source, so the full-resolution pixels underneath are never
// resampled or smoothed. Every output pixel of an export is one source pixel.

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Separable 9-tap Gaussian using linear-filtered taps (5 fetches per pass).
const BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform float uLod;
void main() {
  vec3 c = textureLod(uSrc, vUv, uLod).rgb * 0.2270270270;
  c += textureLod(uSrc, vUv + uDir * 1.3846153846, uLod).rgb * 0.3162162162;
  c += textureLod(uSrc, vUv - uDir * 1.3846153846, uLod).rgb * 0.3162162162;
  c += textureLod(uSrc, vUv + uDir * 3.2307692308, uLod).rgb * 0.0702702703;
  c += textureLod(uSrc, vUv - uDir * 3.2307692308, uLod).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uImg;
uniform sampler3D uLut;
uniform sampler2D uBlurA; // ~1% radius
uniform sampler2D uBlurB; // ~4% radius
uniform float uLutSize;
uniform float uIntensity;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
uniform float uSplit;
uniform float uHalation;
uniform float uClarity;
uniform float uDehaze;
uniform float uGlow;
uniform float uLetterbox;
uniform vec2 uRes;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423) + uSeed);
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 lut(vec3 c) {
  float scale = (uLutSize - 1.0) / uLutSize;
  return texture(uLut, clamp(c, 0.0, 1.0) * scale + 0.5 / uLutSize).rgb;
}

void main() {
  // Rows are uploaded top-first for every source type (ImageBitmap ignores
  // UNPACK_FLIP_Y), so flip here instead.
  vec2 st = vec2(vUv.x, 1.0 - vUv.y);
  vec3 src = texture(uImg, st).rgb;
  if (uSplit >= 0.0 && vUv.x < uSplit) {
    float line = step(abs(vUv.x - uSplit) * uRes.x, 1.0);
    outColor = vec4(mix(src, vec3(1.0), line), 1.0);
    return;
  }
  vec3 bA = texture(uBlurA, st).rgb;
  vec3 bB = texture(uBlurB, st).rgb;
  vec3 base = src;

  if (uClarity != 0.0) {
    // Midtone local contrast: push each pixel away from (or toward) its
    // neighbourhood average, strongest in the midtones like Lightroom.
    float ls = luma(base), lb = luma(bA);
    float mid = 1.0 - pow(abs(2.0 * ls - 1.0), 2.0);
    float nl = clamp(ls + uClarity * 0.9 * (ls - lb) * mid, 0.0, 1.0);
    base = clamp(base * (nl / max(ls, 1e-3)), 0.0, 1.0);
  }
  if (uDehaze > 0.0) {
    // Dark-channel dehaze: haze lifts the darkest channel of a region, so
    // subtracting it restores depth, contrast and colour in hazy areas.
    float dc = min(bB.r, min(bB.g, bB.b));
    float t = 1.0 - uDehaze * 0.85 * dc;
    base = clamp((base - 0.95 * (1.0 - t)) / max(t, 0.35), 0.0, 1.0);
  } else if (uDehaze < 0.0) {
    // Negative dehaze: an airy veil that builds up in bright, distant areas
    // far more than in the dark foreground, like real atmospheric mist.
    float lb = luma(bB);
    float depth = smoothstep(0.12, 0.7, lb);
    // Like the graduated mask editors pair with negative dehaze: mist lives in
    // the distance (upper frame) and thins out over the near foreground.
    float far = mix(1.0, 0.18, smoothstep(0.35, 0.9, st.y));
    float w = min(0.92, -uDehaze * (0.12 + 0.88 * depth * depth) * far * 1.3);
    base = mix(base, vec3(0.94, 0.955, 0.96) * mix(0.85, 1.0, lb), w);
  }

  vec3 col = mix(src, lut(base), uIntensity);

  if (uGlow > 0.0) {
    // Orton-style glow: screen a graded, blurred copy over the image.
    vec3 g = lut(bA * 0.6 + bB * 0.4);
    float w = uGlow * 0.6 * smoothstep(0.25, 1.0, luma(g));
    col = 1.0 - (1.0 - col) * (1.0 - g * w);
  }
  if (uHalation > 0.0) {
    // Film halation: light scattering back through the film base leaves a warm
    // red-orange fringe *around* bright objects — where the neighbourhood is
    // brighter than the pixel itself — not a tint over every bright area.
    vec3 g = bA * 0.55 + bB * 0.45;
    float around = smoothstep(0.55, 1.0, max(g.r, max(g.g, g.b)));
    float self = smoothstep(0.55, 1.0, max(src.r, max(src.g, src.b)));
    float halo = max(around - self * 0.9, 0.0);
    col += halo * uHalation * vec3(1.0, 0.32, 0.12) * 1.1;
  }
  if (uVignette > 0.0) {
    vec2 d = (vUv - 0.5) * vec2(uRes.x / max(uRes.x, uRes.y), uRes.y / max(uRes.x, uRes.y));
    float v = smoothstep(0.85, 0.2, length(d) * 1.25);
    col *= mix(1.0, v, uVignette);
  }
  if (uGrain > 0.0) {
    float y = luma(col);
    // Film grain is strongest in the midtones and fades out in deep shadows and
    // highlights, so it adds texture without muddying detail.
    float n = hash(vUv * uRes) + hash(vUv * uRes + 17.0) - 1.0;
    col += n * uGrain * 0.09 * (4.0 * y * (1.0 - y));
  }
  if (uLetterbox > 0.0) {
    float aspect = uRes.x / uRes.y;
    float bar = aspect < uLetterbox ? (1.0 - aspect / uLetterbox) * 0.5 : 0.0;
    if (vUv.y < bar || vUv.y > 1.0 - bar) col = vec3(0.0);
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const MAIN_UNIFORMS = ["uImg", "uLut", "uBlurA", "uBlurB", "uLutSize", "uIntensity", "uVignette", "uGrain", "uSeed",
  "uSplit", "uHalation", "uClarity", "uDehaze", "uGlow", "uLetterbox", "uRes"];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.blurProg = this.#link(VERT, BLUR);
    this.bu = {};
    for (const name of ["uSrc", "uDir", "uLod"]) this.bu[name] = gl.getUniformLocation(this.blurProg, name);

    this.program = this.#link(VERT, FRAG);
    gl.useProgram(this.program);
    this.u = {};
    for (const name of MAIN_UNIFORMS) this.u[name] = gl.getUniformLocation(this.program, name);

    this.imgTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    // Exports render at source size, where every output pixel is exactly one
    // source pixel (mip level 0); mipmaps serve the downscaled preview and the
    // blur pyramid.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.lutTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R])
      gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);

    gl.uniform1i(this.u.uImg, 0);
    gl.uniform1i(this.u.uLut, 1);
    gl.uniform1i(this.u.uBlurA, 2);
    gl.uniform1i(this.u.uBlurB, 3);
    this.srcW = 1;
    this.srcH = 1;
    this.targets = null;
  }

  #link(vs, fs) {
    const gl = this.gl;
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    return prog;
  }

  #target(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  /** Two blur levels sized relative to the image, so effects look the same in preview and export. */
  #ensureTargets(width, height) {
    const fit = (max) => {
      const s = Math.min(1, max / Math.max(width, height));
      return [Math.max(1, Math.round(width * s)), Math.max(1, Math.round(height * s))];
    };
    const [aw, ah] = fit(384), [bw, bh] = fit(96);
    const t = this.targets;
    if (t && t.a1.w === aw && t.a1.h === ah && t.b1.w === bw && t.b1.h === bh) return;
    const gl = this.gl;
    if (t) for (const x of Object.values(t)) { gl.deleteTexture(x.tex); gl.deleteFramebuffer(x.fb); }
    this.targets = { a1: this.#target(aw, ah), a2: this.#target(aw, ah), b1: this.#target(bw, bh), b2: this.#target(bw, bh) };
  }

  #blurPass(srcTex, dst, dir, lod) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, dst.w, dst.h);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.bu.uSrc, 4);
    gl.uniform2f(this.bu.uDir, dir[0], dir[1]);
    gl.uniform1f(this.bu.uLod, lod);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  #buildBlurs() {
    const gl = this.gl;
    const { a1, a2, b1, b2 } = this.targets;
    gl.useProgram(this.blurProg);
    // Level A: downsample through the mip chain, then two H+V Gaussian rounds.
    const lodA = Math.max(0, Math.log2(Math.max(this.srcW, this.srcH) / Math.max(a1.w, a1.h)));
    this.#blurPass(this.imgTex, a1, [1 / a1.w, 0], lodA);
    this.#blurPass(a1.tex, a2, [0, 1 / a1.h], 0);
    this.#blurPass(a2.tex, a1, [1 / a1.w, 0], 0);
    this.#blurPass(a1.tex, a2, [0, 1 / a1.h], 0);
    // Level B: a wider blur built from level A.
    this.#blurPass(a2.tex, b1, [1 / b1.w, 0], 0);
    this.#blurPass(b1.tex, b2, [0, 1 / b1.h], 0);
    this.#blurPass(b2.tex, b1, [1 / b1.w, 0], 0);
    this.#blurPass(b1.tex, b2, [0, 1 / b1.h], 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.program);
  }

  setLut(data, size) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, size, size, size, 0, gl.RGB, gl.FLOAT, data);
    this.lutSize = size;
  }

  /** Uploads an image, video frame or canvas as the source. */
  setSource(source, width, height) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.srcW = width;
    this.srcH = height;
    this.#ensureTargets(width, height);
    this.#buildBlurs();
  }

  render(opts) {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.program);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.a2.tex);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.b2.tex);
    gl.uniform1f(this.u.uLutSize, this.lutSize);
    gl.uniform1f(this.u.uIntensity, opts.intensity);
    gl.uniform1f(this.u.uVignette, opts.vignette);
    gl.uniform1f(this.u.uGrain, opts.grain);
    gl.uniform1f(this.u.uSeed, opts.seed ?? 0);
    gl.uniform1f(this.u.uSplit, opts.split ?? -1);
    gl.uniform1f(this.u.uHalation, opts.halation ?? 0);
    gl.uniform1f(this.u.uClarity, opts.clarity ?? 0);
    gl.uniform1f(this.u.uDehaze, opts.dehaze ?? 0);
    gl.uniform1f(this.u.uGlow, opts.glow ?? 0);
    gl.uniform1f(this.u.uLetterbox, opts.letterbox ?? 0);
    gl.uniform2f(this.u.uRes, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
