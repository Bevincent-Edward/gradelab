// Cinema looks researched from professional colourists' Instagram work.
//
// "Cinema Print" recreates the Hollywood photochemical pipeline that Dehancer
// creators list in their captions: a motion-picture camera negative, printed to
// a release print stock, then optical effects. The negative comes first as a
// film LUT (CineStill 50D and 800T are Kodak Vision3 50D and 500T respooled),
// and the grade on top models the print stock:
//   Kodak 2383 — dense S-curve, cyan-teal shadows, golden highlights, rich reds
//   Fuji 3513 — softer contrast, cooler shadows, truer greens
// "Pro Looks" additions recreate specific colourists' grades on reference reels.
// Hues are OKLCH degrees: orange≈58, gold≈80, teal≈200, blue≈255.

const PRINT_2383 = {
  contrast: 26, highlights: -22, shadows: -6, blacks: -14, whites: -6, density: 45, saturation: -4,
  shadowHue: 205, shadowAmt: 30, highHue: 78, highAmt: 22,
  mixer: { green: { hue: 18, sat: -18, lum: -8 }, orange: { hue: 0, sat: 8, lum: 0 }, red: { hue: 0, sat: 6, lum: -4 }, blue: { hue: -8, sat: -10, lum: -8 } },
  curves: { rgb: [[0, 0.015], [0.25, 0.19], [0.75, 0.81], [1, 0.965]] },
};
const PRINT_3513 = {
  contrast: 16, highlights: -26, shadows: 2, blacks: -8, density: 32, saturation: -2,
  shadowHue: 190, shadowAmt: 26, highHue: 92, highAmt: 10,
  mixer: { green: { hue: 6, sat: 4, lum: -4 }, red: { hue: 0, sat: -6, lum: 0 }, blue: { hue: -6, sat: -6, lum: -6 } },
  curves: { rgb: [[0, 0.025], [0.25, 0.215], [0.75, 0.79], [1, 0.97]] },
};
const merge = (...parts) => {
  const out = { mixer: {} };
  for (const p of parts) {
    const { mixer, ...rest } = p;
    Object.assign(out, rest);
    Object.assign(out.mixer, mixer ?? {});
  }
  return out;
};

export const CINEMA_LOOKS = [
  // ---------------------------------------------------------------- Cinema Print
  {
    id: "cine-50d-2383", cat: "Cinema Print", name: "Hollywood Daylight", lut: "glassmeter-cinestill-50d",
    note: "Vision3 50D negative, Kodak 2383 print, bloom + grain + halation",
    p: merge(PRINT_2383, { extLutFirst: true, extLutAmt: 85, glow: 14, grain: 14, halation: 22, skinProtect: 35 }),
  },
  {
    id: "cine-250d-2383", cat: "Cinema Print", name: "Golden Print", lut: "glassmeter-cinestill-400d",
    note: "Warm daylight negative on Kodak 2383, grain + halation",
    p: merge(PRINT_2383, { extLutFirst: true, extLutAmt: 70, temperature: 8, highAmt: 30, grain: 18, halation: 24, skinProtect: 35 }),
  },
  {
    id: "cine-250d-3513", cat: "Cinema Print", name: "Fuji Print", lut: "glassmeter-cinestill-50d",
    note: "Daylight negative on Fuji 3513 print, bloom + grain + halation",
    p: merge(PRINT_3513, { extLutFirst: true, extLutAmt: 80, glow: 16, grain: 16, halation: 18, skinProtect: 40 }),
  },
  {
    id: "cine-500t-endura", cat: "Cinema Print", name: "Tungsten Night", lut: "glassmeter-cinestill-800t",
    note: "Vision3 500T tungsten negative on glossy photo paper",
    p: merge(PRINT_3513, { extLutFirst: true, extLutAmt: 75, contrast: 22, saturation: 8, density: 25, temperature: -6, grain: 20, halation: 30, skinProtect: 45 }),
  },
  {
    id: "cine-800t-2383", cat: "Cinema Print", name: "Neon Halation", lut: "glassmeter-cinestill-800t",
    note: "CineStill 800T on Kodak 2383, glowing red halation around lights",
    p: merge(PRINT_2383, { extLutFirst: true, extLutAmt: 95, glow: 20, grain: 22, halation: 60, skinProtect: 30 }),
  },
  {
    id: "cine-portra-3513", cat: "Cinema Print", name: "Portra Print", lut: "glassmeter-kodak-portra-160",
    note: "Portra 160 negative on Fuji 3513, soft skin, halation",
    p: merge(PRINT_3513, { extLutFirst: true, extLutAmt: 90, contrast: 8, highlights: -30, halation: 16, grain: 10, skinProtect: 50 }),
  },
  {
    id: "cine-50d-linear", cat: "Cinema Print", name: "Linear Scan", lut: "glassmeter-cinestill-50d",
    note: "Vision3 50D with a flat linear print: raw film scan, grain + halation",
    p: { extLutFirst: true, extLutAmt: 100, contrast: -6, blacks: 8, highlights: -18, saturation: -8, grain: 16, halation: 20, skinProtect: 40,
      curves: { rgb: [[0, 0.04], [0.5, 0.51], [1, 0.95]] } },
  },

  // ---------------------------------------------------------------- Pro Looks (colourists)
  {
    id: "pro-duneamber", cat: "Pro Looks", name: "Dune Amber", note: "Epic desert amber with deep teal-brown shadows (colourist reel)",
    p: {
      temperature: 22, contrast: 30, highlights: -28, shadows: -10, blacks: -18, density: 40, saturation: -10,
      shadowHue: 195, shadowAmt: 22, midHue: 62, midAmt: 22, highHue: 80, highAmt: 30,
      mixer: { blue: { hue: 0, sat: -55, lum: -5 }, aqua: { hue: 0, sat: -45, lum: 0 }, green: { hue: -30, sat: -45, lum: -10 }, orange: { hue: -4, sat: 18, lum: -4 }, red: { hue: 6, sat: 12, lum: -6 } },
      curves: { rgb: [[0, 0.02], [0.25, 0.18], [0.75, 0.82], [1, 0.96]] },
      skinProtect: 35, grain: 12, vignette: 28, halation: 12,
    },
  },
  {
    id: "pro-upsidedown", cat: "Pro Looks", name: "Upside Down", note: "Warm, contrasted 80s TV look: green-cyan mids and shadows, yellow highlights",
    p: {
      contrast: 28, highlights: -18, shadows: -8, density: 30, vibrance: 8,
      shadowHue: 185, shadowAmt: 34, midHue: 165, midAmt: 14, highHue: 95, highAmt: 30,
      mixer: { orange: { hue: 0, sat: 10, lum: 0 }, red: { hue: 6, sat: 10, lum: -4 }, green: { hue: 10, sat: -10, lum: -8 } },
      skinProtect: 55, grain: 14, vignette: 22,
    },
  },
  {
    id: "pro-riviera", cat: "Pro Looks", name: "Riviera 70s", note: "Sun-faded 70s teal and lipstick red (colourist reel)",
    p: {
      temperature: 6, contrast: 14, highlights: -24, shadows: 10, fade: 12, saturation: -6, density: 28,
      shadowHue: 200, shadowAmt: 24, highHue: 82, highAmt: 18,
      mixer: { aqua: { hue: -6, sat: 18, lum: 0 }, green: { hue: 26, sat: -20, lum: 4 }, red: { hue: -4, sat: 22, lum: -6 }, blue: { hue: -12, sat: -10, lum: 0 } },
      skinProtect: 55, grain: 16, halation: 10,
    },
  },
  {
    id: "pro-16mmdawn", cat: "Pro Looks", name: "16mm Dawn", note: "Super 16 sunrise: soft, grainy, peach and teal (ARRI 16SR3 reel)",
    p: {
      temperature: 12, contrast: 4, highlights: -30, shadows: 14, blacks: 12, fade: 10, saturation: -10, density: 22,
      shadowHue: 205, shadowAmt: 26, highHue: 55, highAmt: 22,
      curves: { rgb: [[0, 0.05], [0.5, 0.52], [1, 0.95]] },
      skinProtect: 45, grain: 40, halation: 30, glow: 16, vignette: 20,
    },
  },
  {
    id: "pro-autumnmood", cat: "Pro Looks", name: "Autumn Intimate", note: "Warm amber window light, deep velvet shadows (RED colourist reel)",
    p: {
      exposure: -0.15, temperature: 16, contrast: 24, highlights: -26, shadows: -14, blacks: -16, density: 38, saturation: -12,
      shadowHue: 45, shadowAmt: 16, midHue: 60, midAmt: 16, highHue: 75, highAmt: 18,
      mixer: { green: { hue: -25, sat: -40, lum: -15 }, blue: { hue: 0, sat: -45, lum: -10 }, orange: { hue: 0, sat: 6, lum: 2 } },
      skinProtect: 50, grain: 12, vignette: 30, glow: 10,
    },
  },
];
