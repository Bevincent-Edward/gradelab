// Colour-grading math. Everything here is a pure per-colour function, baked into
// a 3D LUT, so a grade can never blur, sharpen or move pixels — detail is kept
// exactly as shot. Colour work happens in OKLab so hue, lightness and chroma can
// be changed independently (a tone change does not shift skin hue, etc).

export const LUT_SIZE = 33;

export const BANDS = [
  { id: "red", label: "Red", center: 25 },
  { id: "orange", label: "Orange", center: 58 },
  { id: "yellow", label: "Yellow", center: 100 },
  { id: "green", label: "Green", center: 140 },
  { id: "aqua", label: "Aqua", center: 195 },
  { id: "blue", label: "Blue", center: 255 },
  { id: "purple", label: "Purple", center: 300 },
  { id: "magenta", label: "Magenta", center: 340 },
];

export function defaultParams() {
  return {
    exposure: 0, // stops, -2..2
    contrast: 0, // -100..100
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    fade: 0, // 0..100
    temperature: 0, // -100..100
    tint: 0,
    vibrance: 0,
    saturation: 0,
    density: 0, // 0..100, film-style subtractive richness
    // camera calibration: shift the red/green/blue primaries (-100..100)
    calRedHue: 0, calRedSat: 0,
    calGreenHue: 0, calGreenSat: 0,
    calBlueHue: 0, calBlueSat: 0,
    // tone curves as [x, y] points in display space, applied last
    curves: { rgb: [[0, 0], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] },
    shadowHue: 220, shadowAmt: 0, // OKLCH hue degrees, amount 0..100
    midHue: 40, midAmt: 0,
    highHue: 60, highAmt: 0,
    mixer: Object.fromEntries(BANDS.map((b) => [b.id, { hue: 0, sat: 0, lum: 0 }])),
    skinProtect: 60, // 0..100
    // palette grading: pull every hue toward the nearest palette hue
    palette: [], // OKLCH hues
    paletteAmt: 0, // 0..100
    // look transfer from a reference image: { src, ref } from labStats()
    match: null,
    matchAmt: 70, // 0..100
    // spatial / blend settings, applied in the shader rather than the LUT
    intensity: 100,
    vignette: 0,
    grain: 0,
    halation: 0,
    clarity: 0, // -100..100 midtone local contrast
    dehaze: 0, // -100..100: negative adds airy haze, positive cuts it
    glow: 0, // 0..100 soft dreamy bloom
    rays: 0, // 0..100 light rays from the brightest light source
    letterbox: 0, // target aspect ratio, 0 = off
  };
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

export function linearToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-5 && v <= 1 + 1e-5);

// Pull out-of-gamut colours back by reducing chroma at constant lightness and
// hue, instead of hard-clipping channels (which shifts hue and flattens detail).
function gamutMap(L, a, b) {
  L = clamp(L, 0, 1);
  let rgb = oklabToLinear(L, a, b);
  if (!inGamut(rgb)) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear(L, a * mid, b * mid))) lo = mid;
      else hi = mid;
    }
    rgb = oklabToLinear(L, a * lo, b * lo);
  }
  return rgb.map((v) => clamp(v, 0, 1));
}

/** CSS-ready sRGB swatch for an OKLCH hue, used to paint the UI wheels. */
export function hueSwatch(hue, L = 0.72, C = 0.13) {
  const h = (hue * Math.PI) / 180;
  const rgb = gamutMap(L, C * Math.cos(h), C * Math.sin(h));
  return `rgb(${rgb.map((v) => Math.round(toSrgb(v) * 255)).join(",")})`;
}

function whiteBalanceGains(p) {
  const k = p.temperature / 100;
  const m = p.tint / 100;
  const gains = [1 + 0.18 * k, 1 - 0.15 * m, 1 - 0.18 * k];
  const y = 0.2126 * gains[0] + 0.7152 * gains[1] + 0.0722 * gains[2];
  return gains.map((g) => g / y);
}

function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

/**
 * Camera-calibration style primary shifts (as in Lightroom's Calibration
 * panel): each of the pure red, green and blue primaries is rotated in hue and
 * scaled in chroma, and the resulting matrix is normalised so white stays
 * white. Returns null when nothing changes.
 */
function calibrationMatrix(p) {
  const shifts = [[p.calRedHue, p.calRedSat], [p.calGreenHue, p.calGreenSat], [p.calBlueHue, p.calBlueSat]];
  if (shifts.every(([h, s]) => !h && !s)) return null;
  const cols = shifts.map(([hue, sat], i) => {
    const e = [0, 0, 0];
    e[i] = 1;
    const [L, a, b] = linearToOklab(...e);
    const C = Math.hypot(a, b) * (1 + (sat / 100) * 0.5);
    const h = Math.atan2(b, a) + ((hue / 100) * 30 * Math.PI) / 180;
    return oklabToLinear(L, C * Math.cos(h), C * Math.sin(h));
  });
  // row-major M with the shifted primaries as columns
  const M = [0, 1, 2].flatMap((r) => cols.map((c) => c[r]));
  const inv = invert3(M);
  const scale = [0, 1, 2].map((r) => inv[r * 3] + inv[r * 3 + 1] + inv[r * 3 + 2]);
  return M.map((v, i) => v * scale[i % 3]);
}

const isIdentityCurve = (pts) => pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 1 && pts[1][1] === 1;

/** Monotone cubic (Fritsch–Carlson) curve through the points, as a 1024-entry table. */
export function curveTable(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    m.push((ys[i + 1] - ys[i]) / Math.max(dx[i], 1e-6));
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  const table = new Float32Array(1024);
  let seg = 0;
  for (let j = 0; j < 1024; j++) {
    const x = j / 1023;
    if (x <= xs[0]) { table[j] = ys[0]; continue; }
    if (x >= xs[n - 1]) { table[j] = ys[n - 1]; continue; }
    while (seg < n - 2 && x > xs[seg + 1]) seg++;
    const h = dx[seg], u = (x - xs[seg]) / h;
    const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u;
    const h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
    table[j] = clamp(h00 * ys[seg] + h10 * h * t[seg] + h01 * ys[seg + 1] + h11 * h * t[seg + 1], 0, 1);
  }
  return table;
}

const lookup = (table, x) => {
  const f = clamp(x, 0, 1) * 1023, i = Math.floor(f), r = f - i;
  return i >= 1023 ? table[1023] : table[i] + (table[i + 1] - table[i]) * r;
};

/** Builds the per-LUT constants once, so gradeColor stays cheap. */
function prepare(p) {
  const gains = whiteBalanceGains(p);
  const expo = Math.pow(2, p.exposure);
  // Highest lightness the image can reach after exposure; if it exceeds 1 we
  // roll highlights off smoothly instead of clipping them to flat white.
  const Lmax = Math.max(...[0, 1, 2].map((i) => {
    const c = [0, 0, 0];
    c[i] = gains[i] * expo;
    return linearToOklab(...c)[0];
  }), linearToOklab(gains[0] * expo, gains[1] * expo, gains[2] * expo)[0]);
  const knee = 0.8;
  const d = Lmax - knee;
  const shoulder = Lmax > 1 ? (d / (1 - knee) - 1) / d : 0;
  const wheel = (hue, amt) => {
    const h = (hue * Math.PI) / 180;
    return [Math.cos(h) * amt * 0.0006, Math.sin(h) * amt * 0.0006];
  };
  return {
    gains, expo, knee, shoulder,
    gamma: Math.pow(2, 1.3 * (p.contrast / 100)),
    shadowTint: wheel(p.shadowHue, p.shadowAmt),
    midTint: wheel(p.midHue, p.midAmt),
    highTint: wheel(p.highHue, p.highAmt),
    bands: BANDS.map((b) => ({ center: b.center, ...p.mixer[b.id] }))
      .filter((b) => b.hue || b.sat || b.lum),
    palette: p.paletteAmt > 0 ? p.palette : [],
    paletteAmt: p.paletteAmt / 100,
    match: p.match && p.matchAmt > 0 ? prepareMatch(p.match, p.matchAmt / 100) : null,
    sat: 1 + p.saturation / 100,
    vib: p.vibrance / 100,
    skinProtect: p.skinProtect / 100,
    density: p.density / 100,
    cal: calibrationMatrix(p),
    curves: ["rgb", "r", "g", "b"].map((c) => (isIdentityCurve(p.curves[c]) ? null : curveTable(p.curves[c]))),
  };
}

const zoneWeights = (L) => {
  const ws = (1 - L) ** 2, wh = L ** 2;
  return [ws, 1 - ws - wh, wh];
};

/**
 * Colour statistics of an image in OKLab, split into shadow / midtone /
 * highlight zones. Comparing two of these captures what makes a grade a grade:
 * the tint of each tonal zone, overall contrast and overall saturation.
 */
export function labStats(imageData) {
  const d = imageData.data;
  const zones = [0, 1, 2].map(() => ({ w: 0, a: 0, b: 0 }));
  let n = 0, sumL = 0, sumL2 = 0, sumC = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [L, a, b] = linearToOklab(toLinear(d[i] / 255), toLinear(d[i + 1] / 255), toLinear(d[i + 2] / 255));
    n++; sumL += L; sumL2 += L * L; sumC += Math.hypot(a, b);
    zoneWeights(L).forEach((w, z) => { zones[z].w += w; zones[z].a += w * a; zones[z].b += w * b; });
  }
  const mean = sumL / n;
  return {
    L: mean,
    Lstd: Math.sqrt(Math.max(1e-6, sumL2 / n - mean * mean)),
    C: sumC / n,
    zones: zones.map((z) => ({ a: z.a / Math.max(z.w, 1e-6), b: z.b / Math.max(z.w, 1e-6) })),
  };
}

function prepareMatch({ src, ref }, t) {
  return {
    t,
    src, ref,
    // ratios are clamped so an extreme reference can restyle, never wreck, the shot
    Lscale: clamp(ref.Lstd / src.Lstd, 0.75, 1.35),
    Cscale: clamp(ref.C / Math.max(src.C, 1e-4), 0.35, 2.2),
    tints: [0, 1, 2].map((z) => [ref.zones[z].a - src.zones[z].a, ref.zones[z].b - src.zones[z].b]),
  };
}

function applyMatch(L, a, b, m) {
  const Lm = clamp(m.ref.L + (L - m.src.L) * m.Lscale, 0, 1);
  const L2 = L + (Lm - L) * m.t * 0.6;
  const w = zoneWeights(L2);
  const cs = 1 + (m.Cscale - 1) * m.t;
  let a2 = a * cs, b2 = b * cs;
  for (let z = 0; z < 3; z++) {
    a2 += w[z] * m.tints[z][0] * m.t;
    b2 += w[z] * m.tints[z][1] * m.t;
  }
  return [L2, a2, b2];
}

function tone(x, p, k) {
  if (k.shoulder > 0 && x > k.knee) {
    const d = x - k.knee;
    x = k.knee + d / (1 + d * k.shoulder);
  }
  x = clamp(x, 0, 1);
  if (k.gamma !== 1) {
    // S-curve around a mid-grey pivot; stays monotonic and pinned at 0 and 1,
    // so contrast never crushes texture into pure black or white.
    const pivot = 0.55;
    x = x < pivot
      ? pivot * Math.pow(x / pivot, k.gamma)
      : 1 - (1 - pivot) * Math.pow((1 - x) / (1 - pivot), k.gamma);
  }
  x += (p.shadows / 100) * 0.24 * 4 * x * (1 - x) ** 3;
  x += (p.highlights / 100) * 0.24 * 4 * x ** 3 * (1 - x);
  // Whites and blacks move the ends of the range, like Lightroom's sliders.
  x += (p.whites / 100) * 0.16 * x ** 4 * (p.whites > 0 ? 1 - x * 0.5 : 1);
  x += (p.blacks / 100) * 0.16 * (1 - x) ** 4;
  const f = p.fade / 100;
  x = 0.12 * f + x * (1 - 0.15 * f);
  return clamp(x, 0, 1);
}

/** Grades one sRGB colour (0..1 components) and returns graded sRGB. */
export function gradeColor(r, g, b, p, k = prepare(p)) {
  let lr = toLinear(r) * k.gains[0] * k.expo;
  let lg = toLinear(g) * k.gains[1] * k.expo;
  let lb = toLinear(b) * k.gains[2] * k.expo;
  if (k.cal) {
    const M = k.cal;
    [lr, lg, lb] = [
      Math.max(0, M[0] * lr + M[1] * lg + M[2] * lb),
      Math.max(0, M[3] * lr + M[4] * lg + M[5] * lb),
      Math.max(0, M[6] * lr + M[7] * lg + M[8] * lb),
    ];
  }
  let [L0, a0, b0] = linearToOklab(lr, lg, lb);
  // Skin is detected on the shot as captured, before any look is applied.
  const Cs = Math.hypot(a0, b0);
  let hs = (Math.atan2(b0, a0) * 180) / Math.PI;
  if (hs < 0) hs += 360;
  const skin =
    Math.max(0, 1 - hueDist(hs, 58) / 28) *
    smoothstep(0.02, 0.04, Cs) * (1 - smoothstep(0.16, 0.22, Cs)) *
    smoothstep(0.3, 0.45, L0) * (1 - smoothstep(0.9, 0.97, L0));
  const aSkin = a0, bSkin = b0;

  if (k.match) [L0, a0, b0] = applyMatch(L0, a0, b0, k.match);
  const L1 = tone(L0, p, k);
  const C0 = Math.hypot(a0, b0);
  let h = (Math.atan2(b0, a0) * 180) / Math.PI;
  if (h < 0) h += 360;

  // Colour mixer: smooth cosine windows per band, ignored for near-neutrals so
  // whites and greys never pick up a cast.
  let L = L1, C = C0, hue = h;
  if (k.bands.length) {
    const guard = smoothstep(0.008, 0.04, C0);
    let dh = 0, ds = 0, dl = 0;
    for (const band of k.bands) {
      const d = hueDist(h, band.center);
      if (d >= 50) continue;
      const w = Math.cos((d / 50) * (Math.PI / 2)) ** 2 * guard;
      dh += w * (band.hue / 100) * 30;
      ds += w * (band.sat / 100);
      dl += w * (band.lum / 100) * 0.12 * smoothstep(0, 0.12, C0);
    }
    hue += dh;
    C *= Math.max(0, 1 + ds);
    L = clamp(L + dl, 0, 1);
  }

  // Palette grading: each hue drifts toward its nearest palette colour, so the
  // whole frame reads as one designed colour scheme.
  if (k.palette.length) {
    let bestDist = 999;
    for (const ph of k.palette) {
      const d = ((ph - hue + 540) % 360) - 180;
      if (Math.abs(d) < Math.abs(bestDist)) bestDist = d;
    }
    hue += bestDist * k.paletteAmt * 0.85 * smoothstep(0.01, 0.05, C);
  }

  // Vibrance boosts muted colours more than vivid ones, and spares skin.
  C *= 1 + k.vib * (1 - smoothstep(0, 0.2, C)) * (1 - 0.7 * skin);
  C *= k.sat;

  const hr = (hue * Math.PI) / 180;
  let a = C * Math.cos(hr);
  let bb = C * Math.sin(hr);

  // Three-way colour wheels, weighted by the graded lightness.
  const ws = (1 - L) ** 2, wh = L ** 2, wm = 1 - ws - wh;
  a += ws * k.shadowTint[0] + wm * k.midTint[0] + wh * k.highTint[0];
  bb += ws * k.shadowTint[1] + wm * k.midTint[1] + wh * k.highTint[1];

  // Skin tones sit in a narrow orange band; pulling them back toward their
  // captured colour keeps faces natural whatever the look does elsewhere.
  const protect = skin * k.skinProtect;
  if (protect > 0) {
    a += (aSkin - a) * protect;
    bb += (bSkin - bb) * protect;
  }

  // Film density: like dye layers on film, more colour means less light, so
  // saturated colours get deeper and richer instead of glowing neon.
  if (k.density > 0) L = clamp(L - k.density * 0.45 * Math.min(Math.hypot(a, bb), 0.25), 0, 1);

  let out = gamutMap(L, a, bb).map(toSrgb);
  const [master, cr, cg, cb] = k.curves;
  if (master) out = out.map((v) => lookup(master, v));
  if (cr) out[0] = lookup(cr, out[0]);
  if (cg) out[1] = lookup(cg, out[1]);
  if (cb) out[2] = lookup(cb, out[2]);
  return out;
}

/** Bakes the grade into an N³ RGB float table, red varying fastest (.cube order). */
export function buildLut(p, size = LUT_SIZE) {
  const k = prepare(p);
  const out = new Float32Array(size * size * size * 3);
  let i = 0;
  for (let bi = 0; bi < size; bi++)
    for (let gi = 0; gi < size; gi++)
      for (let ri = 0; ri < size; ri++) {
        const c = gradeColor(ri / (size - 1), gi / (size - 1), bi / (size - 1), p, k);
        out[i++] = c[0]; out[i++] = c[1]; out[i++] = c[2];
      }
  return out;
}

export function lutToCube(lut, size, title) {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${size}`, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"];
  for (let i = 0; i < lut.length; i += 3)
    lines.push(`${lut[i].toFixed(6)} ${lut[i + 1].toFixed(6)} ${lut[i + 2].toFixed(6)}`);
  return lines.join("\n") + "\n";
}

/**
 * Suggests a neutral starting point from image statistics: gray-world white
 * balance and a gentle exposure nudge, both applied only partially so the
 * original mood of the shot survives.
 */
export function autoCorrect(imageData) {
  const d = imageData.data;
  let sr = 0, sg = 0, sb = 0, n = 0;
  const lums = [];
  for (let i = 0; i < d.length; i += 16) {
    const r = toLinear(d[i] / 255), g = toLinear(d[i + 1] / 255), b = toLinear(d[i + 2] / 255);
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lums.push(y);
    if (y > 0.02 && y < 0.8) { sr += r; sg += g; sb += b; n++; }
  }
  lums.sort((x, y) => x - y);
  const median = lums[Math.floor(lums.length / 2)] || 0.18;
  const result = { exposure: 0, temperature: 0, tint: 0 };
  if (n > 50) {
    const q = sb / sr;
    result.temperature = Math.round(clamp(((q - 1) / (0.18 * (q + 1))) * 100 * 0.6, -40, 40));
    const target = (sr + sb) / 2 / sg;
    result.tint = Math.round(clamp(((1 - target) / 0.15) * 100 * 0.6, -30, 30));
  }
  result.exposure = +clamp(Math.log2(0.18 / Math.max(median, 1e-4)) * 0.5, -1, 1).toFixed(2);
  return result;
}
