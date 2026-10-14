import { BANDS, LUT_SIZE, autoCorrect, buildLut, curveTable, defaultParams, hueSwatch, labStats, lutToCube } from "./grade.js";
import { CATEGORIES, PALETTES, PRESETS } from "./presets.js";
import { Renderer } from "./renderer.js";

const $ = (id) => document.getElementById(id);

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_TOUCH = matchMedia("(pointer: coarse)").matches;
// iOS Safari refuses canvases larger than 16.7 MP; desktop browsers allow far more.
const MAX_CANVAS_PIXELS = IS_IOS ? 16_777_216 : 120_000_000;

/** dblclick for mice, plus a double-tap detector, since iOS doesn't fire dblclick reliably. */
function onDoubleTap(el, fn) {
  el.addEventListener("dblclick", fn);
  let last = 0;
  el.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    const now = performance.now();
    if (now - last < 320) { last = 0; fn(e); } else last = now;
  });
}
const canvas = $("canvas");
const video = $("video");

let renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  $("drop").querySelector(".drop-sub").textContent = err.message;
}

const state = {
  params: defaultParams(),
  presetId: null,
  auto: { exposure: 0, temperature: 0, tint: 0 },
  autoOn: false,
  source: null, // { kind: "image" | "video", bitmap?, name, width, height }
  lut: null,
  split: false,
  holdOriginal: false,
  band: BANDS[0].id,
  category: "All",
  peek: null, // params of a look being hovered in the filmstrip
  refStats: null,
  exporting: null,
};

// ---------------------------------------------------------------- sliders

const SLIDERS = {
  intensityRow: [["intensity", "Strength", 0, 100, 1]],
  lightRows: [
    ["exposure", "Exposure", -2, 2, 0.01],
    ["contrast", "Contrast", -100, 100, 1],
    ["highlights", "Highlights", -100, 100, 1],
    ["shadows", "Shadows", -100, 100, 1],
    ["whites", "Whites", -100, 100, 1],
    ["blacks", "Blacks", -100, 100, 1],
    ["fade", "Fade", 0, 100, 1],
  ],
  presenceRows: [
    ["clarity", "Clarity", -100, 100, 1],
    ["dehaze", "Dehaze", -100, 100, 1],
  ],
  calRows: [
    ["calRedHue", "Red hue", -100, 100, 1],
    ["calRedSat", "Red sat", -100, 100, 1],
    ["calGreenHue", "Green hue", -100, 100, 1],
    ["calGreenSat", "Green sat", -100, 100, 1],
    ["calBlueHue", "Blue hue", -100, 100, 1],
    ["calBlueSat", "Blue sat", -100, 100, 1],
  ],
  colorRows: [
    ["temperature", "Temperature", -100, 100, 1],
    ["tint", "Tint", -100, 100, 1],
    ["vibrance", "Vibrance", -100, 100, 1],
    ["saturation", "Saturation", -100, 100, 1],
    ["density", "Film density", 0, 100, 1],
    ["skinProtect", "Protect skin", 0, 100, 1],
  ],
  matchRows: [["matchAmt", "Strength", 0, 100, 1]],
  paletteRows: [["paletteAmt", "Amount", 0, 100, 1]],
  finishRows: [
    ["glow", "Glow", 0, 100, 1],
    ["halation", "Halation", 0, 100, 1],
    ["vignette", "Vignette", 0, 100, 1],
    ["grain", "Film grain", 0, 100, 1],
  ],
};
const WHEELS = [["shadow", "Shadows"], ["mid", "Midtones"], ["high", "Highlights"]];

const rows = new Map(); // key -> { input, output, get, set }

function makeRow(container, key, label, min, max, step, get, set) {
  const row = document.createElement("div");
  row.className = "row";
  const id = `s-${key}`;
  row.innerHTML = `<label for="${id}" title="Double-click to reset">${label}</label>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" />
    <output for="${id}"></output>`;
  const input = row.querySelector("input");
  const output = row.querySelector("output");
  const fmt = (v) => (step < 1 ? (+v).toFixed(2) : String(Math.round(v)));
  const sync = () => { input.value = get(); output.textContent = fmt(get()); };
  input.addEventListener("input", () => {
    set(+input.value);
    output.textContent = fmt(input.value);
    markCustom();
    onParamsChanged();
  });
  const reset = () => {
    set(get.default ?? 0);
    sync();
    onParamsChanged();
  };
  onDoubleTap(row.querySelector("label"), reset);
  input.addEventListener("dblclick", reset);
  container.append(row);
  rows.set(key, { sync, input });
  return { input, row };
}

const defaults = defaultParams();
for (const [containerId, list] of Object.entries(SLIDERS)) {
  const container = $(containerId);
  for (const [key, label, min, max, step] of list) {
    const get = () => state.params[key];
    get.default = defaults[key];
    makeRow(container, key, label, min, max, step, get, (v) => (state.params[key] = v));
  }
}

for (const [prefix, label] of WHEELS) {
  const container = $("wheelRows");
  const head = document.createElement("div");
  head.className = "sub";
  head.innerHTML = `<span class="swatch"></span>${label}`;
  container.append(head);
  const swatch = head.querySelector(".swatch");
  const hueKey = `${prefix}Hue`, amtKey = `${prefix}Amt`;
  const hueGet = () => state.params[hueKey];
  hueGet.default = defaults[hueKey];
  const { input: hueInput } = makeRow(container, hueKey, "Hue", 0, 359, 1, hueGet, (v) => (state.params[hueKey] = v));
  const amtGet = () => state.params[amtKey];
  makeRow(container, amtKey, "Amount", 0, 100, 1, amtGet, (v) => (state.params[amtKey] = v));
  const stops = Array.from({ length: 13 }, (_, i) => hueSwatch(i * 30)).join(",");
  hueInput.style.setProperty("--track", `linear-gradient(90deg, ${stops})`);
  const paint = () => (swatch.style.background = hueSwatch(state.params[hueKey]));
  hueInput.addEventListener("input", paint);
  rows.set(`${prefix}-swatch`, { sync: paint });
}

// colour mixer: one set of sliders bound to the selected band
const bandButtons = new Map();
for (const band of BANDS) {
  const b = document.createElement("button");
  b.className = "band";
  b.title = band.label;
  b.setAttribute("aria-label", band.label);
  b.style.background = hueSwatch(band.center, 0.68, 0.15);
  b.addEventListener("click", () => { state.band = band.id; syncAll(); });
  $("bands").append(b);
  bandButtons.set(band.id, b);
}
for (const [key, label] of [["hue", "Hue"], ["sat", "Saturation"], ["lum", "Luminance"]]) {
  makeRow($("mixerRows"), `mixer-${key}`, label, -100, 100, 1,
    () => state.params.mixer[state.band][key],
    (v) => (state.params.mixer[state.band][key] = v));
}
rows.set("bands", {
  sync() {
    for (const [id, btn] of bandButtons) {
      const m = state.params.mixer[id];
      btn.classList.toggle("active", id === state.band);
      btn.classList.toggle("edited", !!(m.hue || m.sat || m.lum));
    }
  },
});

function syncAll() {
  for (const r of rows.values()) r.sync();
  drawCurve();
  document.querySelectorAll(".preset").forEach((el) => el.classList.toggle("active", el.dataset.id === (state.presetId ?? "")));
  $("auto").classList.toggle("active", state.autoOn);
  $("lookName").textContent = PRESETS.find((p) => p.id === state.presetId)?.name ?? (state.presetId === "custom" ? "Custom" : "Original");
  const key = state.params.palette.join(",");
  document.querySelectorAll(".palette").forEach((el) =>
    el.classList.toggle("active", el.dataset.hues === key && (state.params.paletteAmt > 0 || !key)));
  $("letterbox").value = String(state.params.letterbox);
}

// ---------------------------------------------------------------- tone curve

const CURVE_CHANNELS = [["rgb", "RGB", "#e6e6e6"], ["r", "R", "#ff6b6b"], ["g", "G", "#5fd38d"], ["b", "B", "#6ba8ff"]];
let curveCh = "rgb";
let dragIndex = -1;
const curveCanvas = $("curve");

for (const [id, label] of CURVE_CHANNELS) {
  const b = document.createElement("button");
  b.className = "curve-tab";
  b.textContent = label;
  b.setAttribute("role", "tab");
  b.addEventListener("click", () => { curveCh = id; drawCurve(); });
  $("curveTabs").append(b);
}

function drawCurve() {
  const ctx = curveCanvas.getContext("2d");
  const { width: W, height: H } = curveCanvas;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo((W * i) / 4, 0); ctx.lineTo((W * i) / 4, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (H * i) / 4); ctx.lineTo(W, (H * i) / 4); ctx.stroke();
  }
  ctx.strokeStyle = "#3a3a3a";
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke();
  // other channels faintly, the active one bold
  for (const [id, , color] of CURVE_CHANNELS) {
    const pts = state.params.curves[id];
    const active = id === curveCh;
    if (!active && pts.length === 2 && pts[0][1] === 0 && pts[1][1] === 1) continue;
    const t = curveTable(pts);
    ctx.strokeStyle = color;
    ctx.globalAlpha = active ? 1 : 0.35;
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const y = t[Math.round((x / W) * 1023)];
      if (x === 0) ctx.moveTo(x, H - y * H); else ctx.lineTo(x, H - y * H);
    }
    ctx.stroke();
    if (active) {
      ctx.fillStyle = color;
      for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px * W, H - py * H, 9, 0, 7); ctx.fill(); }
    }
  }
  ctx.globalAlpha = 1;
  document.querySelectorAll(".curve-tab").forEach((el, i) => el.setAttribute("aria-selected", CURVE_CHANNELS[i][0] === curveCh));
}

function curvePos(e) {
  const r = curveCanvas.getBoundingClientRect();
  return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))];
}
function nearestPoint(pts, [x, y]) {
  let best = -1, bd = 0.045;
  pts.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
  return best;
}
curveCanvas.addEventListener("pointerdown", (e) => {
  const pts = state.params.curves[curveCh];
  const pos = curvePos(e);
  dragIndex = nearestPoint(pts, pos);
  if (dragIndex < 0) {
    pts.push(pos);
    pts.sort((a, b) => a[0] - b[0]);
    dragIndex = pts.findIndex((q) => q === pos);
  }
  curveCanvas.setPointerCapture(e.pointerId);
  markCustom();
  drawCurve();
  onParamsChanged();
});
curveCanvas.addEventListener("pointermove", (e) => {
  if (dragIndex < 0 || !e.buttons) return;
  const pts = state.params.curves[curveCh];
  let [x, y] = curvePos(e);
  // end points stay at the edges; inner points stay between their neighbours
  if (dragIndex === 0) x = 0;
  else if (dragIndex === pts.length - 1) x = 1;
  else x = Math.min(pts[dragIndex + 1][0] - 0.01, Math.max(pts[dragIndex - 1][0] + 0.01, x));
  pts[dragIndex] = [x, y];
  drawCurve();
  onParamsChanged();
});
curveCanvas.addEventListener("pointerup", () => (dragIndex = -1));
onDoubleTap(curveCanvas, (e) => {
  const pts = state.params.curves[curveCh];
  const i = nearestPoint(pts, curvePos(e));
  if (i > 0 && i < pts.length - 1) {
    pts.splice(i, 1);
    drawCurve();
    onParamsChanged();
  }
});
$("curveReset").addEventListener("click", () => {
  state.params.curves[curveCh] = [[0, 0], [1, 1]];
  drawCurve();
  onParamsChanged();
});

function markCustom() {
  if (state.presetId && state.presetId !== "custom") {
    state.presetId = "custom";
    $("lookName").textContent = "Custom";
  }
}

// ---------------------------------------------------------------- presets

function paramsForPreset(preset) {
  const p = defaultParams();
  if (preset) {
    const { mixer, palette, curves, ...rest } = preset.p;
    Object.assign(p, rest);
    for (const [id, m] of Object.entries(mixer ?? {})) p.mixer[id] = { ...m };
    for (const [ch, pts] of Object.entries(curves ?? {})) p.curves[ch] = pts.map((q) => [...q]);
    if (palette) p.palette = [...palette];
  }
  // A reference look, framing and strength are the user's choices, not the look's.
  for (const k of ["match", "matchAmt", "letterbox", "intensity"]) p[k] = state.params[k];
  if (state.autoOn) {
    p.exposure += state.auto.exposure;
    p.temperature += state.auto.temperature;
    p.tint += state.auto.tint;
  }
  return p;
}

function applyPreset(preset) {
  state.params = paramsForPreset(preset);
  state.presetId = preset?.id ?? null;
  state.peek = null;
  $("peek").hidden = true;
  syncAll();
  onParamsChanged();
}

const thumbCanvas = document.createElement("canvas");
let thumbRenderer;
const thumbs = new Map();
for (const preset of [null, ...PRESETS]) {
  const btn = document.createElement("button");
  btn.className = "preset";
  btn.dataset.id = preset?.id ?? "";
  btn.dataset.cat = preset?.cat ?? "All";
  btn.title = preset?.note ?? "No grade";
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 225;
  const label = document.createElement("span");
  label.textContent = preset?.name ?? "Original";
  btn.append(c, label);
  btn.addEventListener("click", () => applyPreset(preset));
  // Hovering previews the look full-size on the main canvas.
  btn.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || !state.source) return;
    state.peek = paramsForPreset(preset);
    $("peek").textContent = `Previewing: ${preset?.name ?? "Original"}`;
    $("peek").hidden = false;
    requestDraw();
  });
  btn.addEventListener("pointerleave", () => {
    if (!state.peek) return;
    state.peek = null;
    $("peek").hidden = true;
    requestDraw();
  });
  $("presets").append(btn);
  thumbs.set(preset, c);
}

for (const cat of CATEGORIES) {
  const b = document.createElement("button");
  b.className = "cat";
  b.setAttribute("role", "tab");
  b.textContent = cat;
  b.setAttribute("aria-selected", cat === state.category);
  b.addEventListener("click", () => {
    state.category = cat;
    document.querySelectorAll(".cat").forEach((el) => el.setAttribute("aria-selected", el === b));
    document.querySelectorAll(".preset").forEach((el) => {
      el.hidden = cat !== "All" && el.dataset.cat !== cat && el.dataset.id !== "";
    });
    $("presets").scrollLeft = 0;
  });
  $("cats").append(b);
}

// ---------------------------------------------------------------- palette grade

for (const pal of [{ id: "none", name: "None", hues: [] }, ...PALETTES]) {
  const b = document.createElement("button");
  b.className = "palette";
  b.dataset.hues = pal.hues.join(",");
  b.innerHTML = `<span class="dots">${pal.hues.map((h) => `<i style="background:${hueSwatch(h, 0.7, 0.14)}"></i>`).join("")}</span>${pal.name}`;
  b.addEventListener("click", () => {
    state.params.palette = [...pal.hues];
    state.params.paletteAmt = pal.hues.length ? state.params.paletteAmt || 60 : 0;
    if (state.presetId) state.presetId = "custom";
    syncAll();
    onParamsChanged();
  });
  $("palettes").append(b);
}

$("letterbox").addEventListener("change", (e) => {
  state.params.letterbox = +e.target.value;
  requestDraw();
});

// ---------------------------------------------------------------- copy a look

function imageDataOf(source, w, h, maxSide = 200) {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function sourceStats() {
  const src = state.source.kind === "image" ? state.source.bitmap : video;
  return labStats(imageDataOf(src, state.source.width, state.source.height));
}

$("refFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    alert("That reference image format is not supported by your browser.");
    return;
  }
  state.refStats = labStats(imageDataOf(bmp, bmp.width, bmp.height));
  bmp.close();
  const thumb = $("refThumb");
  if (thumb.src) URL.revokeObjectURL(thumb.src);
  thumb.src = URL.createObjectURL(file);
  thumb.hidden = false;
  $("refClear").hidden = false;
  $("refPick").textContent = "Change…";
  if (state.source) {
    state.params.match = { src: sourceStats(), ref: state.refStats };
    onParamsChanged();
    renderThumbnails();
  }
});

$("refClear").addEventListener("click", () => {
  state.refStats = null;
  state.params.match = null;
  $("refThumb").hidden = true;
  $("refClear").hidden = true;
  $("refPick").textContent = "Choose reference…";
  onParamsChanged();
  renderThumbnails();
});

/** Small cover-cropped copy of the current source, for thumbnails and auto. */
function sampleSource(w = 240, h = 180) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const src = state.source.kind === "image" ? state.source.bitmap : video;
  const sw = state.source.width, sh = state.source.height;
  const s = Math.max(w / sw, h / sh);
  ctx.drawImage(src, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s);
  return c;
}

function renderThumbnails() {
  if (!state.source) return;
  const sample = sampleSource();
  thumbRenderer ??= new Renderer(thumbCanvas);
  thumbCanvas.width = sample.width;
  thumbCanvas.height = sample.height;
  thumbRenderer.setSource(sample, sample.width, sample.height);
  for (const [preset, target] of thumbs) {
    const p = paramsForPreset(preset);
    thumbRenderer.setLut(buildLut(p, 17), 17);
    thumbRenderer.render({ ...shaderOpts(p), intensity: 1, grain: 0, letterbox: 0 });
    target.getContext("2d").drawImage(thumbCanvas, 0, 0, target.width, target.height);
  }
}

$("auto").addEventListener("click", () => {
  if (!state.source) return;
  const prev = state.autoOn ? state.auto : { exposure: 0, temperature: 0, tint: 0 };
  state.autoOn = !state.autoOn;
  if (state.autoOn) {
    const s = sampleSource(256, 192);
    state.auto = autoCorrect(s.getContext("2d").getImageData(0, 0, s.width, s.height));
  }
  const next = state.autoOn ? state.auto : { exposure: 0, temperature: 0, tint: 0 };
  for (const k of ["exposure", "temperature", "tint"])
    state.params[k] = Math.round((state.params[k] - prev[k] + next[k]) * 100) / 100;
  syncAll();
  onParamsChanged();
  renderThumbnails();
});

$("reset").addEventListener("click", () => {
  state.autoOn = false;
  if (state.refStats) $("refClear").click();
  state.params = defaultParams();
  state.presetId = null;
  syncAll();
  onParamsChanged();
  renderThumbnails();
});

// ---------------------------------------------------------------- rendering

let lutDirty = true;
let frameQueued = false;

function onParamsChanged() {
  lutDirty = true;
  requestDraw();
}

function requestDraw() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => {
    frameQueued = false;
    draw();
  });
}

function shaderOpts(p = state.params) {
  return {
    intensity: p.intensity / 100,
    vignette: p.vignette / 100,
    grain: p.grain / 100,
    halation: p.halation / 100,
    clarity: p.clarity / 100,
    dehaze: p.dehaze / 100,
    glow: p.glow / 100,
    letterbox: p.letterbox,
  };
}

let lutParams = null; // the params object the uploaded LUT was built from

function draw() {
  if (!state.source || !renderer) return;
  const p = state.peek ?? state.params;
  if (lutDirty || lutParams !== p) {
    renderer.setLut(buildLut(p), LUT_SIZE);
    lutParams = p;
    lutDirty = false;
  }
  fitCanvas();
  const split = state.holdOriginal ? 1.01 : state.split ? +(canvas.dataset.split ?? 0.5) : -1;
  renderer.render({ ...shaderOpts(p), seed: video.currentTime % 1, split });
}

// Fill the stage: the largest size that fits with a small margin, centred,
// then apply the user's zoom and pan. The backing store matches device pixels
// (capped at the source size) so zooming in shows real detail, not blur.
const view = { zoom: 1, panX: 0, panY: 0 };

function fitCanvas() {
  const stage = $("stage");
  const pad = IS_TOUCH ? 4 : 16;
  const SW = stage.clientWidth, SH = stage.clientHeight;
  const bw = Math.max(1, SW - pad * 2), bh = Math.max(1, SH - pad * 2);
  const { width: sw, height: sh } = state.source;
  const fit = Math.min(bw / sw, bh / sh);
  const cssScale = fit * view.zoom;
  const cw = sw * cssScale, ch = sh * cssScale;
  const maxX = Math.max(0, (cw - SW) / 2), maxY = Math.max(0, (ch - SH) / 2);
  view.panX = Math.min(maxX, Math.max(-maxX, view.panX));
  view.panY = Math.min(maxY, Math.max(-maxY, view.panY));
  Object.assign(canvas.style, {
    width: `${cw}px`, height: `${ch}px`,
    left: `${(SW - cw) / 2 + view.panX}px`, top: `${(SH - ch) / 2 + view.panY}px`,
  });
  let px = Math.min(cssScale * (window.devicePixelRatio || 1), 1);
  px = Math.min(px, Math.sqrt(MAX_CANVAS_PIXELS / 2 / (sw * sh)));
  const w = Math.max(1, Math.round(sw * px)), h = Math.max(1, Math.round(sh * px));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
new ResizeObserver(requestDraw).observe($("stage"));

function setZoom(zoom, cx, cy) {
  // keep the point under (cx, cy) — relative to the stage centre — fixed
  const z = Math.min(8, Math.max(1, zoom));
  const k = z / view.zoom;
  view.panX = cx - (cx - view.panX) * k;
  view.panY = cy - (cy - view.panY) * k;
  view.zoom = z;
  if (z === 1) view.panX = view.panY = 0;
  requestDraw();
}

const setSplitFromEvent = (e) => {
  const r = canvas.getBoundingClientRect();
  canvas.dataset.split = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  requestDraw();
};
$("splitToggle").addEventListener("click", (e) => {
  state.split = !state.split;
  e.currentTarget.setAttribute("aria-pressed", state.split);
  $("stage").style.cursor = state.split ? "ew-resize" : "";
  requestDraw();
});
const hold = (on) => { state.holdOriginal = on; requestDraw(); };

// Stage gestures, phone-editor style:
//   press & hold       → show the original (like VSCO / Lightroom mobile)
//   pinch / wheel      → zoom up to 8×, to check fine detail
//   drag when zoomed   → pan
//   double-tap         → toggle fit / 2.5×
//   drag in split view → move the before/after divider
{
  const stage = $("stage");
  const pts = new Map();
  let mode = null, holdTimer = 0, pinch = null, moved = 0, lastTap = { t: 0, x: 0, y: 0 };
  const rel = (x, y) => {
    const r = stage.getBoundingClientRect();
    return [x - r.left - r.width / 2, y - r.top - r.height / 2];
  };
  const endHold = () => { clearTimeout(holdTimer); if (state.holdOriginal) hold(false); };

  stage.addEventListener("pointerdown", (e) => {
    if (!state.source) return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    moved = 0;
    if (pts.size === 2) {
      endHold();
      const [[x1, y1], [x2, y2]] = [...pts.values()];
      pinch = { d: Math.hypot(x2 - x1, y2 - y1), zoom: view.zoom, mid: rel((x1 + x2) / 2, (y1 + y2) / 2), pan: [view.panX, view.panY] };
      mode = "pinch";
    } else if (pts.size === 1) {
      if (state.split && view.zoom === 1) { mode = "split"; setSplitFromEvent(e); }
      else if (view.zoom > 1) mode = "pan";
      else { mode = "hold"; holdTimer = setTimeout(() => hold(true), 160); }
    }
  });
  stage.addEventListener("pointermove", (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
    if (mode === "pinch" && pts.size === 2) {
      const [[x1, y1], [x2, y2]] = [...pts.values()];
      const z = Math.min(8, Math.max(1, pinch.zoom * (Math.hypot(x2 - x1, y2 - y1) / pinch.d)));
      const mid = rel((x1 + x2) / 2, (y1 + y2) / 2);
      const k = z / pinch.zoom;
      view.zoom = z;
      view.panX = mid[0] - (pinch.mid[0] - pinch.pan[0]) * k;
      view.panY = mid[1] - (pinch.mid[1] - pinch.pan[1]) * k;
      if (z === 1) view.panX = view.panY = 0;
      requestDraw();
    } else if (mode === "pan") {
      view.panX += e.clientX - prev[0];
      view.panY += e.clientY - prev[1];
      requestDraw();
    } else if (mode === "split") setSplitFromEvent(e);
    else if (mode === "hold" && moved > 12) endHold();
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    endHold();
    if (pts.size === 0) {
      if (mode !== "pinch" && moved < 10 && e.type === "pointerup") {
        const now = performance.now();
        if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
          const [cx, cy] = rel(e.clientX, e.clientY);
          setZoom(view.zoom > 1 ? 1 : 2.5, cx, cy);
          lastTap.t = 0;
        } else lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
      mode = null;
    } else if (pts.size === 1) mode = view.zoom > 1 ? "pan" : null;
  };
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) stage.addEventListener(ev, up);
  stage.addEventListener("wheel", (e) => {
    if (!state.source) return;
    e.preventDefault();
    const [cx, cy] = rel(e.clientX, e.clientY);
    setZoom(view.zoom * Math.exp(-e.deltaY * 0.0015), cx, cy);
  }, { passive: false });
  stage.addEventListener("contextmenu", (e) => e.preventDefault());
}

// ---------------------------------------------------------------- phone tabs

document.querySelectorAll("#mtabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.body.dataset.mtab = b.dataset.tab;
    document.querySelectorAll("#mtabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("panel").scrollTop = 0;
  }),
);
$("holdOriginal").addEventListener("pointerdown", () => hold(true));
for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $("holdOriginal").addEventListener(ev, () => hold(false));
window.addEventListener("keydown", (e) => { if (e.key === "\\" && !e.repeat) hold(true); });
window.addEventListener("keyup", (e) => { if (e.key === "\\") hold(false); });

// ---------------------------------------------------------------- loading

$("file").addEventListener("change", (e) => e.target.files[0] && load(e.target.files[0]));
const drop = $("viewer");
drop.addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("dragging"); });
drop.addEventListener("dragleave", () => $("drop").classList.remove("dragging"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  $("drop").classList.remove("dragging");
  const f = e.dataTransfer.files[0];
  if (f) load(f);
});

/**
 * Decodes with EXIF orientation applied. Safari may reject createImageBitmap
 * options or some formats, so fall back to an <img>, which always honours
 * orientation (and decodes HEIC on recent iOS).
 */
async function decodeImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img;
  }
}

const once = (el, ev) => new Promise((res) => el.addEventListener(ev, res, { once: true }));

/**
 * iOS Safari won't hand over video frames until playback has started, so
 * briefly play muted (allowed without a gesture), then seek to a nice frame.
 */
async function primeVideo(url) {
  video.muted = true;
  video.src = url;
  await new Promise((res, rej) => {
    video.onloadedmetadata = res;
    video.onerror = () => rej(new Error("This video format is not supported by your browser."));
  });
  try { await video.play(); } catch { /* autoplay blocked: frames still arrive after seeking */ }
  video.pause();
  video.currentTime = Math.min(1, video.duration * 0.2);
  await once(video, "seeked");
  if (video.readyState < 2) await Promise.race([once(video, "loadeddata"), new Promise((r) => setTimeout(r, 1500))]);
  video.muted = false;
}

async function load(file) {
  if (!renderer || state.exporting) return;
  const isVideo = file.type.startsWith("video/");
  video.pause();
  if (video.src) URL.revokeObjectURL(video.src);
  state.source?.bitmap?.close?.();

  if (isVideo) {
    try {
      await primeVideo(URL.createObjectURL(file));
    } catch (err) {
      alert(err.message);
      return;
    }
    state.source = { kind: "video", name: file.name, width: video.videoWidth, height: video.videoHeight };
    renderer.setSource(video, video.videoWidth, video.videoHeight);
  } else {
    let bitmap;
    try {
      bitmap = await decodeImage(file);
    } catch {
      alert("This image format is not supported by your browser.");
      return;
    }
    const width = bitmap.naturalWidth || bitmap.width, height = bitmap.naturalHeight || bitmap.height;
    const max = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
    if (width > max || height > max) {
      alert(`This image is larger than your device's GPU supports (${max}px per side).`);
      return;
    }
    state.source = { kind: "image", bitmap, name: file.name, width, height };
    renderer.setSource(bitmap, width, height);
  }
  view.zoom = 1;
  view.panX = view.panY = 0;

  document.body.classList.remove("empty");
  $("drop").hidden = true;
  $("stage").hidden = false;
  $("strip").hidden = false;
  $("viewerBar").hidden = false;
  $("videoControls").hidden = !isVideo;
  $("export").disabled = false;
  $("exportLut").disabled = false;
  $("exportLutMobile").disabled = false;
  $("dims").textContent = `${state.source.width} × ${state.source.height}`;
  if (state.autoOn) {
    state.autoOn = false;
    state.params = paramsForPreset(PRESETS.find((p) => p.id === state.presetId));
    syncAll();
  }
  if (state.refStats) state.params.match = { src: sourceStats(), ref: state.refStats };
  renderThumbnails();
  onParamsChanged();
  updateTime();
}

// ---------------------------------------------------------------- video playback

function onVideoFrame() {
  if (state.source?.kind === "video") {
    renderer.setSource(video, video.videoWidth, video.videoHeight);
    draw();
    updateTime();
  }
  video.requestVideoFrameCallback(onVideoFrame);
}
video.requestVideoFrameCallback(onVideoFrame);

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function updateTime() {
  if (!video.duration) return;
  $("time").textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
  if (!seeking) $("seek").value = (video.currentTime / video.duration) * 1000;
}
let seeking = false;
$("seek").addEventListener("input", (e) => {
  seeking = true;
  video.currentTime = (e.target.value / 1000) * video.duration;
});
$("seek").addEventListener("change", () => (seeking = false));
$("play").addEventListener("click", () => {
  ensureAudioGraph();
  if (video.paused) video.play(); else video.pause();
});
video.addEventListener("play", () => ($("play").textContent = "❚❚"));
video.addEventListener("pause", () => ($("play").textContent = "▶"));
video.addEventListener("ended", () => ($("play").textContent = "▶"));

// Routing audio through Web Audio lets the export tap the soundtrack too.
let audio;
function ensureAudioGraph() {
  if (!audio) {
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(video);
    const rec = ctx.createMediaStreamDestination();
    src.connect(ctx.destination);
    src.connect(rec);
    audio = { ctx, rec };
  }
  audio.ctx.resume();
  return audio;
}

// ---------------------------------------------------------------- export

const baseName = () => state.source.name.replace(/\.[^.]+$/, "");
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/**
 * On phones, hand the file to the share sheet so "Save Image" / "Save Video"
 * puts it straight into Photos. Sharing needs a fresh tap, so the export ends
 * with a one-button "Save" dialog.
 */
function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (!(IS_TOUCH && navigator.canShare?.({ files: [file] }))) return download(blob, name);
  const isVideo = blob.type.startsWith("video/");
  $("saveHint").textContent = `Tap Save, then choose “${isVideo ? "Save Video" : "Save Image"}” to add it to your Photos.`;
  $("saveGo").onclick = (e) => {
    e.preventDefault();
    navigator.share({ files: [file] }).catch((err) => { if (err.name !== "AbortError") download(blob, name); });
    $("saveDialog").close();
  };
  $("saveDialog").showModal();
}

/** Output size: full resolution, unless the browser's canvas limit forces a cap. */
function exportSize() {
  const { width: w, height: h } = state.source;
  const s = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)));
  return { w: Math.round(w * s), h: Math.round(h * s), capped: s < 1 };
}

$("exportLutMobile").addEventListener("click", () => $("exportLut").click());
$("exportLut").addEventListener("click", () => {
  // The .cube carries the colour grade at the chosen strength; vignette and
  // grain are spatial and can't live in a LUT.
  const t = state.params.intensity / 100;
  const lut = buildLut(state.params);
  const n = LUT_SIZE;
  let i = 0;
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++)
        for (const c of [r, g, b]) { lut[i] = c / (n - 1) + (lut[i] - c / (n - 1)) * t; i++; }
  const name = PRESETS.find((p) => p.id === state.presetId)?.name ?? "Custom";
  download(new Blob([lutToCube(lut, n, `GradeLab ${name}`)], { type: "text/plain" }), `${baseName()}-${name.replace(/\W+/g, "-").toLowerCase()}.cube`);
});

$("export").addEventListener("click", () => {
  const isVideo = state.source.kind === "video";
  const { w, h, capped } = exportSize();
  $("photoOpts").hidden = isVideo;
  $("exportGo").textContent = capped ? "Export" : "Export full resolution";
  $("exportHint").textContent = isVideo
    ? `Renders every frame at ${w}×${h} in real time (${fmtTime(video.duration)}), keeping the audio. Output: ${pickVideoMime().label}. Keep this screen open until it finishes.`
    : capped
      ? `Saved at ${w}×${h} — the largest image this browser allows (original ${state.source.width}×${state.source.height}).`
      : `Saved at the original ${w}×${h} — no resizing or sharpening.`;
  $("exportDialog").showModal();
});
// Started straight from the button tap: iOS only allows audio and playback
// to start inside a user gesture, and the video export needs both.
$("exportGo").addEventListener("click", (e) => {
  e.preventDefault();
  $("exportDialog").close();
  if (state.source.kind === "image") exportPhoto(document.querySelector('input[name="fmt"]:checked').value);
  else exportVideo().catch((err) => { console.error(err); alert(`Export failed: ${err.message}`); endProgress(); });
});

function exportRenderer() {
  const { w, h } = exportSize();
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const r = new Renderer(c);
  r.setLut(buildLut(state.params), LUT_SIZE);
  return { c, r };
}

function exportPhoto(type) {
  const { c, r } = exportRenderer();
  r.setSource(state.source.bitmap, state.source.width, state.source.height);
  r.render({ ...shaderOpts(), seed: 0.37 });
  c.toBlob((blob) => {
    r.gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (!blob) return alert("Export failed: this image is too large for your browser.");
    deliver(blob, `${baseName()}-graded.${type === "image/png" ? "png" : "jpg"}`);
  }, type, 0.95);
}

function pickVideoMime() {
  const options = [
    ["video/mp4;codecs=avc1.640033,mp4a.40.2", "MP4 (H.264)", "mp4"],
    ["video/mp4", "MP4", "mp4"],
    ["video/webm;codecs=vp9,opus", "WebM (VP9)", "webm"],
    ["video/webm", "WebM", "webm"],
  ];
  const found = options.find(([m]) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  return found ? { mime: found[0], label: found[1], ext: found[2] } : { mime: "", label: "browser default", ext: "webm" };
}

function startProgress(label) {
  $("progressLabel").textContent = label;
  $("progressFill").style.width = "0";
  $("progress").hidden = false;
}
function endProgress() {
  $("progress").hidden = true;
  state.exporting = null;
}

async function exportVideo() {
  // Audio graph first, synchronously inside the tap (iOS gesture rule).
  const { rec } = ensureAudioGraph();
  const { c, r } = exportRenderer();
  const { mime, ext } = pickVideoMime();
  // Exact frame-by-frame capture where supported; a fixed 30 fps stream otherwise.
  let stream = c.captureStream(0);
  let track = stream.getVideoTracks()[0];
  if (typeof track.requestFrame !== "function") {
    stream = c.captureStream(30);
    track = stream.getVideoTracks()[0];
  }
  for (const t of rec.stream.getAudioTracks()) stream.addTrack(t);

  const pixels = c.width * c.height;
  const recorder = new MediaRecorder(stream, {
    mimeType: mime || undefined,
    // generous bitrate so compression doesn't eat the detail we preserved
    videoBitsPerSecond: Math.round(Math.min(80e6, Math.max(12e6, pixels * 12))),
    audioBitsPerSecond: 192_000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (recorder.onstop = res));

  const job = { cancelled: false };
  state.exporting = job;
  startProgress("Exporting video — keep this tab visible");
  const cancelled = new Promise((res) => {
    $("cancelExport").onclick = () => { job.cancelled = true; video.pause(); res(); };
  });

  video.pause();
  video.loop = false;
  video.muted = false;
  video.currentTime = 0;

  const opts = shaderOpts();
  const onFrame = () => {
    if (state.exporting !== job || job.cancelled) return;
    r.setSource(video, video.videoWidth, video.videoHeight);
    r.render({ ...opts, seed: video.currentTime % 1 });
    track.requestFrame?.();
    $("progressFill").style.width = `${(video.currentTime / video.duration) * 100}%`;
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
  recorder.start(1000);
  await video.play();
  await Promise.race([new Promise((res) => video.addEventListener("ended", res, { once: true })), cancelled]);
  if (recorder.state !== "inactive") recorder.stop();
  await stopped;
  r.gl.getExtension("WEBGL_lose_context")?.loseContext();
  endProgress();
  if (!job.cancelled) deliver(new Blob(chunks, { type: mime || "video/webm" }), `${baseName()}-graded.${ext}`);
}

syncAll();
