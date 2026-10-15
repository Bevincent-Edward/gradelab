import { PRO_LOOKS } from "./prolooks.js";

// Looks are deliberately restrained: each one keeps skin protection on (except
// B&W) and moves colour in OKLab, so subjects stay recognisable and textures
// intact. Values are partial overrides of defaultParams(). Hues are OKLCH
// degrees: red≈25, orange≈58, yellow≈100, green≈140, teal≈200, blue≈255, magenta≈340.

export const CATEGORIES = ["Pro Looks", "All", "Trending", "Signature", "Cinematic", "Film Stock", "Aesthetic", "Film", "Moody", "Nature", "Portrait", "B&W"];

// Curated colour schemes for palette grading (OKLCH hues).
export const PALETTES = [
  { id: "tealcoral", name: "Teal & Coral", hues: [205, 35] },
  { id: "mustardteal", name: "Mustard & Teal", hues: [95, 200] },
  { id: "storybook", name: "Storybook", hues: [15, 95, 190] },
  { id: "sagerose", name: "Sage & Rose", hues: [140, 10] },
  { id: "duskneon", name: "Dusk Neon", hues: [320, 230] },
  { id: "earth", name: "Terracotta Earth", hues: [45, 110] },
  { id: "ocean", name: "Ocean Mono", hues: [225] },
  { id: "amber", name: "Amber Mono", hues: [70] },
  { id: "matcha", name: "Matcha Cream", hues: [125, 80] },
  { id: "berry", name: "Berry & Gold", hues: [350, 85] },
];

const BASE_PRESETS = [
  // ---------------------------------------------------------------- Trending
  // Creator-style looks built the way Lightroom presets are: basic panel,
  // presence (clarity/dehaze), HSL, colour grading, calibration and curves.
  {
    id: "mistyforest", cat: "Trending", name: "Misty Forest", note: "Airy bright mist over deep emerald greens",
    p: {
      exposure: 0.15, contrast: 28, highlights: 5, shadows: -10, whites: 45, blacks: -40,
      temperature: -4, vibrance: 30, density: 20, clarity: 15, dehaze: -65,
      shadowHue: 160, shadowAmt: 12,
      mixer: {
        yellow: { hue: 45, sat: 10, lum: -25 }, green: { hue: 12, sat: 30, lum: -28 },
        aqua: { hue: -10, sat: 15, lum: -10 }, orange: { hue: 0, sat: 0, lum: 5 },
      },
      calBlueSat: 25, skinProtect: 70, vignette: 15,
      curves: { rgb: [[0, 0], [0.25, 0.22], [0.75, 0.8], [1, 1]] },
    },
  },
  {
    id: "travelgold", cat: "Trending", name: "Cinematic Travel", note: "Golden backlight, olive greens, soft matte",
    p: {
      exposure: 0.1, temperature: 14, contrast: 8, highlights: -40, shadows: 15, whites: 20, blacks: -5,
      dehaze: -20, glow: 22, density: 15, clarity: 10,
      midHue: 60, midAmt: 18, highHue: 75, highAmt: 25, shadowHue: 40, shadowAmt: 10,
      mixer: { green: { hue: -30, sat: -20, lum: -12 }, yellow: { hue: -10, sat: 0, lum: 5 }, orange: { hue: 0, sat: 15, lum: 0 } },
      calRedHue: 20, calBlueHue: -30, calBlueSat: 20, skinProtect: 60,
      curves: { rgb: [[0, 0.06], [0.3, 0.28], [0.75, 0.79], [1, 0.97]] },
    },
  },
  {
    id: "coldgrey", cat: "Trending", name: "Cold Grey", note: "Desaturated steel-teal cinematic mood",
    p: {
      temperature: -15, saturation: -40, contrast: 15, highlights: -30, blacks: 15, clarity: 15, dehaze: 15, density: 20,
      shadowHue: 205, shadowAmt: 30, highHue: 190, highAmt: 8,
      mixer: { blue: { hue: 0, sat: -20, lum: -20 } },
      skinProtect: 65, vignette: 20,
      curves: { rgb: [[0, 0.06], [0.3, 0.28], [0.75, 0.79], [1, 0.97]] },
    },
  },
  {
    id: "darkmoody", cat: "Trending", name: "Dark & Moody", note: "Deep blues, muted greens, heavy shadows",
    p: {
      exposure: -0.35, temperature: -10, highlights: -60, shadows: 15, whites: -20, blacks: -30, clarity: 25, dehaze: 10, density: 30,
      mixer: { blue: { hue: -28, sat: 26, lum: -50 }, green: { hue: 20, sat: -47, lum: -30 }, orange: { hue: 0, sat: 5, lum: 0 } },
      calBlueSat: 30, skinProtect: 70, vignette: 30,
      curves: { rgb: [[0, 0.06], [0.3, 0.28], [0.75, 0.79], [1, 0.97]] },
    },
  },
  {
    id: "brightairy", cat: "Trending", name: "Bright & Airy", note: "Light, clean, soft-pastel lifestyle",
    p: {
      exposure: 0.45, temperature: 6, contrast: -20, highlights: -45, shadows: 35, whites: 20, blacks: 15,
      clarity: -10, dehaze: -10, vibrance: 10, saturation: -10, glow: 12,
      mixer: {
        orange: { hue: 0, sat: -5, lum: 10 }, green: { hue: 20, sat: -35, lum: 15 },
        yellow: { hue: 0, sat: -25, lum: 10 }, blue: { hue: 0, sat: -15, lum: 10 },
      },
      skinProtect: 75,
    },
  },
  {
    id: "caltealorange", cat: "Trending", name: "Teal Skin Pop", note: "The calibration blue-primary trick",
    p: {
      contrast: 22, highlights: -30, shadows: 10, density: 30, vibrance: 15,
      calBlueHue: -80, calBlueSat: 100, calRedHue: 35, calRedSat: 25,
      shadowHue: 205, shadowAmt: 30, highHue: 60, highAmt: 15,
      mixer: { aqua: { hue: -10, sat: 15, lum: 0 }, blue: { hue: -20, sat: 0, lum: 0 }, green: { hue: 40, sat: -40, lum: -15 } },
      skinProtect: 50,
    },
  },
  {
    id: "browntone", cat: "Trending", name: "Brown Tone", note: "Rich chocolate-brown moody tone",
    p: {
      exposure: -0.15, temperature: 20, saturation: -35, contrast: 20, highlights: -35, blacks: -15, density: 25,
      midHue: 55, midAmt: 25, shadowHue: 45, shadowAmt: 25,
      mixer: {
        orange: { hue: 0, sat: 20, lum: -10 }, green: { hue: -60, sat: -70, lum: -30 }, blue: { hue: 0, sat: -70, lum: -20 },
        aqua: { hue: 0, sat: -60, lum: 0 }, yellow: { hue: -30, sat: -30, lum: -15 },
      },
      skinProtect: 40, vignette: 25,
      curves: { rgb: [[0, 0.06], [0.3, 0.28], [0.75, 0.79], [1, 0.97]] },
    },
  },
  {
    id: "blackorange", cat: "Trending", name: "Black & Orange", note: "Everything muted except warm tones",
    p: {
      contrast: 35, highlights: -30, blacks: -30, clarity: 20, density: 30,
      mixer: {
        red: { hue: 0, sat: -30, lum: 0 }, orange: { hue: 0, sat: 25, lum: 0 }, yellow: { hue: -30, sat: -70, lum: 0 },
        green: { hue: 0, sat: -100, lum: -40 }, aqua: { hue: 0, sat: -100, lum: 0 }, blue: { hue: 0, sat: -100, lum: -30 },
        purple: { hue: 0, sat: -100, lum: 0 }, magenta: { hue: 0, sat: -100, lum: 0 },
      },
      skinProtect: 30, vignette: 30,
    },
  },
  {
    id: "greenblack", cat: "Trending", name: "Green & Black", note: "Deep jungle greens, inky shadows",
    p: {
      exposure: -0.2, contrast: 40, highlights: -35, blacks: -60, whites: -10, clarity: 30, density: 55, dehaze: 15,
      shadowHue: 160, shadowAmt: 30,
      mixer: {
        green: { hue: 20, sat: 45, lum: -45 }, yellow: { hue: 50, sat: 20, lum: -35 }, aqua: { hue: -20, sat: 20, lum: -30 },
        blue: { hue: 0, sat: -60, lum: 0 }, orange: { hue: 0, sat: -10, lum: 0 },
      },
      skinProtect: 65, vignette: 30,
    },
  },
  {
    id: "aquatone", cat: "Trending", name: "Aqua Tone", note: "Clean turquoise-and-white travel look",
    p: {
      temperature: -10, contrast: 15, highlights: -30, shadows: 15, dehaze: 10,
      calBlueHue: -40, calBlueSat: 30,
      mixer: { aqua: { hue: 0, sat: 35, lum: 5 }, blue: { hue: -30, sat: 20, lum: 0 }, green: { hue: 60, sat: -10, lum: 0 }, yellow: { hue: -15, sat: -30, lum: 0 } },
      skinProtect: 75,
    },
  },
  {
    id: "matteblack", cat: "Trending", name: "Matte Black", note: "Faded blacks, muted editorial",
    p: {
      saturation: -30, contrast: 25, blacks: -20, clarity: 15, shadowHue: 220, shadowAmt: 10, skinProtect: 70, grain: 15,
      curves: { rgb: [[0, 0.1], [0.25, 0.18], [0.7, 0.72], [1, 0.94]] },
    },
  },
  {
    id: "dreamyglow", cat: "Trending", name: "Dreamy Glow", note: "Soft focus bloom, warm and hazy",
    p: {
      exposure: 0.2, temperature: 8, tint: 6, contrast: -10, highlights: -20, shadows: 20, fade: 8,
      clarity: -25, dehaze: -15, glow: 45, highHue: 40, highAmt: 15, skinProtect: 70,
    },
  },
  {
    id: "goldenbrown", cat: "Trending", name: "Golden Portrait", note: "Warm glowing skin, muted backgrounds",
    p: {
      temperature: 15, contrast: 15, highlights: -30, shadows: 15, density: 20, glow: 10, calRedHue: 15,
      midHue: 50, midAmt: 15,
      mixer: { orange: { hue: -5, sat: 15, lum: 5 }, green: { hue: -45, sat: -40, lum: 0 }, blue: { hue: 0, sat: -40, lum: 0 } },
      skinProtect: 35, vignette: 20,
    },
  },

  // ---------------------------------------------------------------- Film Stock
  // Emulations of the character of classic stocks (not their exact science):
  // density, roll-off, crossover tints and grain.
  {
    id: "cineprint", cat: "Film Stock", name: "Cine Print", note: "Cinema print-film density and roll-off",
    p: {
      contrast: 32, highlights: -20, blacks: -15, saturation: -5, density: 60, clarity: 8,
      shadowHue: 200, shadowAmt: 40, highHue: 65, highAmt: 30,
      mixer: { orange: { hue: 0, sat: 8, lum: 0 }, blue: { hue: -10, sat: 0, lum: -10 }, green: { hue: -15, sat: -15, lum: 0 } },
      skinProtect: 60, halation: 15, grain: 15,
      curves: { rgb: [[0, 0.02], [0.25, 0.2], [0.75, 0.8], [1, 0.96]] },
    },
  },
  {
    id: "portrait400", cat: "Film Stock", name: "Portrait 400", note: "Soft, warm, flattering skin film",
    p: {
      exposure: 0.15, temperature: 8, contrast: -10, highlights: -35, shadows: 15, saturation: -10, density: 10,
      highHue: 70, highAmt: 12, shadowHue: 200, shadowAmt: 8,
      mixer: {
        orange: { hue: 3, sat: -8, lum: 8 }, red: { hue: 0, sat: -10, lum: 0 },
        green: { hue: 15, sat: -25, lum: 5 }, blue: { hue: -10, sat: -15, lum: 0 },
      },
      skinProtect: 60, grain: 15,
      curves: { rgb: [[0, 0.04], [0.5, 0.52], [1, 0.97]] },
    },
  },
  {
    id: "pastel400", cat: "Film Stock", name: "Pastel 400", note: "Mint-green pastel wedding film",
    p: {
      exposure: 0.2, temperature: -4, tint: -6, contrast: -12, highlights: -30, shadows: 20,
      shadowHue: 175, shadowAmt: 15,
      mixer: { green: { hue: 35, sat: -20, lum: 15 }, aqua: { hue: 0, sat: -10, lum: 10 }, orange: { hue: 0, sat: 0, lum: 8 }, red: { hue: -5, sat: 0, lum: 0 } },
      skinProtect: 70, grain: 12,
      curves: { rgb: [[0, 0.05], [0.5, 0.53], [1, 0.97]] },
    },
  },
  {
    id: "tungsten800", cat: "Film Stock", name: "Tungsten 800", note: "Night-city film with red halation",
    p: {
      temperature: -30, tint: 5, contrast: 20, highlights: -20, blacks: -15, density: 20,
      shadowHue: 210, shadowAmt: 25,
      mixer: { red: { hue: 0, sat: 15, lum: 0 }, aqua: { hue: -10, sat: 20, lum: 0 }, blue: { hue: 0, sat: 10, lum: 0 } },
      skinProtect: 55, halation: 55, glow: 15, grain: 25,
    },
  },
  {
    id: "vividslide", cat: "Film Stock", name: "Vivid Slide", note: "Punchy landscape reversal film",
    p: {
      contrast: 30, highlights: -20, blacks: -15, vibrance: 30, saturation: 10, density: 40, clarity: 10,
      mixer: { blue: { hue: -5, sat: 20, lum: -20 }, green: { hue: 5, sat: 15, lum: -10 }, red: { hue: 0, sat: 10, lum: -5 } },
      skinProtect: 70, grain: 8,
    },
  },
  {
    id: "push3200", cat: "Film Stock", name: "Push 3200 B&W", note: "Pushed, gritty, high-contrast mono",
    p: {
      saturation: -100, contrast: 40, blacks: -20, clarity: 25,
      mixer: { orange: { hue: 0, sat: 0, lum: 10 }, blue: { hue: 0, sat: 0, lum: -25 } },
      skinProtect: 0, grain: 45, vignette: 20,
    },
  },
  // ---------------------------------------------------------------- Signature
  // Palette-graded looks: the frame is art-directed into a deliberate colour
  // scheme, something a filter that only shifts tones cannot do.
  {
    id: "storybook", cat: "Signature", name: "Storybook", note: "Symmetric-film pastel palette: pink, yellow, teal",
    p: {
      exposure: 0.15, contrast: -6, highlights: -20, shadows: 15, fade: 10, vibrance: 15,
      palette: [15, 95, 190], paletteAmt: 55, highHue: 90, highAmt: 10, skinProtect: 75, vignette: 10,
    },
  },
  {
    id: "coralcoast", cat: "Signature", name: "Coral Coast", note: "Everything sorted into teal and coral",
    p: {
      contrast: 16, highlights: -22, shadows: 10, vibrance: 15,
      palette: [205, 35], paletteAmt: 60, shadowHue: 210, shadowAmt: 25, skinProtect: 80, halation: 10,
    },
  },
  {
    id: "mustard", cat: "Signature", name: "Mustard Teal", note: "Retro indie two-tone",
    p: {
      temperature: 8, contrast: 14, highlights: -18, fade: 14, saturation: -8,
      palette: [95, 200], paletteAmt: 65, skinProtect: 75, grain: 14,
    },
  },
  {
    id: "neondusk", cat: "Signature", name: "Neon Dusk", note: "Magenta-blue synthwave night",
    p: {
      exposure: -0.1, contrast: 24, highlights: -12, vibrance: 25,
      palette: [320, 230], paletteAmt: 60, shadowHue: 260, shadowAmt: 35, skinProtect: 65, vignette: 28, halation: 35,
    },
  },
  {
    id: "sagerose", cat: "Signature", name: "Sage & Rose", note: "Soft botanical romance",
    p: {
      exposure: 0.1, contrast: -8, highlights: -22, shadows: 14, fade: 16, saturation: -12,
      palette: [140, 10], paletteAmt: 50, skinProtect: 75, halation: 12,
    },
  },
  {
    id: "terracotta", cat: "Signature", name: "Terracotta", note: "Sun-dried clay and olive",
    p: {
      temperature: 14, contrast: 16, highlights: -25, fade: 10, saturation: -10,
      palette: [45, 110], paletteAmt: 60, midHue: 55, midAmt: 10, skinProtect: 60, grain: 15, vignette: 22,
    },
  },
  {
    id: "oceanmono", cat: "Signature", name: "Blue Mood", note: "Near-monochrome blue world",
    p: {
      temperature: -10, contrast: 20, highlights: -20, saturation: -15,
      palette: [225], paletteAmt: 70, skinProtect: 85, vignette: 25,
    },
  },
  {
    id: "ambermono", cat: "Signature", name: "Amber World", note: "One warm colour, cinematic restraint",
    p: {
      temperature: 15, contrast: 22, highlights: -25, saturation: -10,
      palette: [70], paletteAmt: 70, skinProtect: 60, grain: 15, vignette: 30, halation: 25,
    },
  },
  {
    id: "matcha", cat: "Signature", name: "Matcha Latte", note: "Creamy greens and soft beige",
    p: {
      exposure: 0.15, temperature: 6, contrast: -10, highlights: -22, shadows: 16, fade: 16, saturation: -10,
      palette: [125, 80], paletteAmt: 55, skinProtect: 75,
    },
  },
  {
    id: "berrygold", cat: "Signature", name: "Berry & Gold", note: "Rich jewel-toned editorial",
    p: {
      contrast: 22, highlights: -20, shadows: 5, vibrance: 20,
      palette: [350, 85], paletteAmt: 55, shadowHue: 340, shadowAmt: 20, skinProtect: 75, vignette: 20,
    },
  },
  // ---------------------------------------------------------------- Cinematic
  {
    id: "tealorange", cat: "Cinematic", name: "Teal & Orange", note: "Blockbuster complementary split",
    p: {
      contrast: 18, highlights: -15, shadows: 10, vibrance: 15,
      shadowHue: 215, shadowAmt: 55, highHue: 60, highAmt: 35,
      mixer: { green: { hue: 45, sat: -25, lum: 0 }, aqua: { hue: 10, sat: 20, lum: -10 }, blue: { hue: -15, sat: 10, lum: -10 }, orange: { hue: 0, sat: 12, lum: 4 } },
      skinProtect: 80, density: 25, clarity: 10,
    },
  },
  {
    id: "blockbuster", cat: "Cinematic", name: "Blockbuster", note: "Punchy, glossy summer-movie grade",
    p: {
      contrast: 30, highlights: -30, shadows: 5, vibrance: 22, saturation: 5,
      shadowHue: 205, shadowAmt: 45, midHue: 60, midAmt: 10, highHue: 70, highAmt: 25,
      mixer: { aqua: { hue: 0, sat: 25, lum: -10 }, blue: { hue: -10, sat: 15, lum: -15 }, yellow: { hue: -15, sat: 0, lum: 0 } },
      skinProtect: 75, vignette: 22, halation: 15, density: 20, clarity: 15,
    },
  },
  {
    id: "cool", cat: "Cinematic", name: "Cinematic Cool", note: "Steel blues, crisp contrast",
    p: {
      temperature: -18, contrast: 20, highlights: -22, shadows: 6, saturation: -10,
      shadowHue: 235, shadowAmt: 45, midHue: 200, midAmt: 10, highHue: 210, highAmt: 10,
      skinProtect: 85, vignette: 20,
    },
  },
  {
    id: "desert", cat: "Cinematic", name: "Desert Epic", note: "Sun-baked amber, dusty skies",
    p: {
      temperature: 30, contrast: 24, highlights: -28, shadows: -5, fade: 6, saturation: -12,
      shadowHue: 45, shadowAmt: 25, midHue: 60, midAmt: 20, highHue: 75, highAmt: 30,
      mixer: { blue: { hue: 0, sat: -55, lum: 10 }, aqua: { hue: 0, sat: -50, lum: 5 }, green: { hue: -30, sat: -50, lum: 0 }, orange: { hue: 0, sat: 15, lum: 0 } },
      skinProtect: 55, grain: 12, vignette: 25,
    },
  },
  {
    id: "neonnoir", cat: "Cinematic", name: "Neon Noir", note: "Night city cyan & magenta",
    p: {
      exposure: -0.1, contrast: 26, highlights: -10, shadows: -8, vibrance: 25,
      shadowHue: 200, shadowAmt: 55, midHue: 320, midAmt: 18, highHue: 340, highAmt: 20,
      mixer: { blue: { hue: -15, sat: 25, lum: 0 }, purple: { hue: 10, sat: 25, lum: 5 }, magenta: { hue: 0, sat: 25, lum: 5 }, green: { hue: 35, sat: -20, lum: -10 } },
      skinProtect: 70, vignette: 30, halation: 30,
    },
  },
  {
    id: "thriller", cat: "Cinematic", name: "Thriller", note: "Sickly green-cyan tension",
    p: {
      contrast: 22, highlights: -15, fade: 10, saturation: -30,
      shadowHue: 165, shadowAmt: 40, midHue: 145, midAmt: 18, highHue: 110, highAmt: 15,
      mixer: { orange: { hue: 0, sat: -15, lum: 0 }, red: { hue: 0, sat: -25, lum: -5 } },
      skinProtect: 50, grain: 18, vignette: 32,
    },
  },
  {
    id: "bleach", cat: "Cinematic", name: "Bleach Bypass", note: "Silvery, gritty, low saturation",
    p: {
      contrast: 38, highlights: -10, shadows: -10, saturation: -55,
      shadowHue: 230, shadowAmt: 10,
      skinProtect: 30, grain: 22, vignette: 20,
    },
  },
  {
    id: "scifi", cat: "Cinematic", name: "Sci-Fi Cyan", note: "Clinical future blues",
    p: {
      temperature: -25, tint: -6, contrast: 20, highlights: -20, saturation: -15,
      shadowHue: 210, shadowAmt: 50, midHue: 195, midAmt: 18, highHue: 190, highAmt: 15,
      mixer: { orange: { hue: 0, sat: -30, lum: 0 }, yellow: { hue: 0, sat: -40, lum: 0 } },
      skinProtect: 65, halation: 10,
    },
  },
  {
    id: "romance", cat: "Cinematic", name: "Romance", note: "Warm, soft and glowing",
    p: {
      temperature: 15, tint: 6, contrast: 6, highlights: -30, shadows: 18, fade: 10, vibrance: 12,
      midHue: 40, midAmt: 12, highHue: 30, highAmt: 22,
      skinProtect: 60, halation: 35,
    },
  },
  {
    id: "western", cat: "Cinematic", name: "Western", note: "Dusty sepia frontier",
    p: {
      temperature: 22, contrast: 28, highlights: -20, fade: 12, saturation: -45,
      shadowHue: 50, shadowAmt: 30, highHue: 80, highAmt: 30,
      skinProtect: 30, grain: 28, vignette: 35,
    },
  },
  {
    id: "matrix", cat: "Cinematic", name: "Digital Green", note: "Code-world green cast",
    p: {
      contrast: 25, highlights: -10, saturation: -35, tint: -18,
      shadowHue: 145, shadowAmt: 45, midHue: 140, midAmt: 25, highHue: 120, highAmt: 15,
      skinProtect: 25, vignette: 25,
    },
  },

  // ---------------------------------------------------------------- Aesthetic
  {
    id: "pastel", cat: "Aesthetic", name: "Pastel Dream", note: "Airy, lifted and soft",
    p: {
      exposure: 0.25, contrast: -22, highlights: -15, shadows: 25, fade: 18, saturation: -12, vibrance: 15,
      highHue: 340, highAmt: 12, shadowHue: 200, shadowAmt: 12, skinProtect: 60,
    },
  },
  {
    id: "peach", cat: "Aesthetic", name: "Soft Peach", note: "Warm creamy peach tones",
    p: {
      exposure: 0.15, temperature: 14, tint: 6, contrast: -10, highlights: -25, shadows: 20, fade: 15, saturation: -6,
      midHue: 50, midAmt: 18, highHue: 45, highAmt: 18,
      mixer: { green: { hue: 25, sat: -35, lum: 10 }, blue: { hue: 0, sat: -25, lum: 10 } },
      skinProtect: 55,
    },
  },
  {
    id: "lavender", cat: "Aesthetic", name: "Lavender Haze", note: "Dreamy violet shadows",
    p: {
      exposure: 0.1, contrast: -12, highlights: -20, shadows: 15, fade: 20, saturation: -10,
      shadowHue: 300, shadowAmt: 35, midHue: 320, midAmt: 10, highHue: 350, highAmt: 10,
      mixer: { green: { hue: 30, sat: -40, lum: 5 }, blue: { hue: 20, sat: 0, lum: 5 } },
      skinProtect: 70, halation: 15,
    },
  },
  {
    id: "mint", cat: "Aesthetic", name: "Mint Fresh", note: "Cool clean minty greens",
    p: {
      exposure: 0.15, temperature: -8, contrast: -5, highlights: -18, shadows: 18, fade: 12, vibrance: 10,
      shadowHue: 175, shadowAmt: 25, highHue: 160, highAmt: 10,
      mixer: { green: { hue: 30, sat: -10, lum: 12 }, yellow: { hue: 25, sat: -20, lum: 5 } },
      skinProtect: 75,
    },
  },
  {
    id: "beige", cat: "Aesthetic", name: "Creamy Beige", note: "Minimal neutral earth tones",
    p: {
      temperature: 10, contrast: -6, highlights: -22, shadows: 14, fade: 14, saturation: -30,
      midHue: 70, midAmt: 18, highHue: 80, highAmt: 15, shadowHue: 50, shadowAmt: 10,
      mixer: { blue: { hue: 0, sat: -40, lum: 10 }, green: { hue: 0, sat: -40, lum: 5 } },
      skinProtect: 65,
    },
  },
  {
    id: "pinkdream", cat: "Aesthetic", name: "Rosy Glow", note: "Blush pink highlights",
    p: {
      exposure: 0.15, tint: 10, contrast: -8, highlights: -20, shadows: 12, fade: 10,
      highHue: 355, highAmt: 25, midHue: 10, midAmt: 8,
      mixer: { red: { hue: -10, sat: 10, lum: 5 }, green: { hue: 20, sat: -30, lum: 0 } },
      skinProtect: 75, halation: 20,
    },
  },
  {
    id: "cottoncandy", cat: "Aesthetic", name: "Cotton Candy", note: "Pink & baby-blue pastels",
    p: {
      exposure: 0.2, contrast: -18, highlights: -15, shadows: 22, fade: 20, vibrance: 10,
      shadowHue: 230, shadowAmt: 28, highHue: 350, highAmt: 22,
      skinProtect: 70,
    },
  },
  {
    id: "denim", cat: "Aesthetic", name: "Faded Denim", note: "Washed blue-grey matte",
    p: {
      temperature: -10, contrast: -5, highlights: -18, fade: 30, saturation: -25,
      shadowHue: 245, shadowAmt: 30, highHue: 220, highAmt: 8,
      skinProtect: 70, grain: 10,
    },
  },
  {
    id: "y2k", cat: "Aesthetic", name: "Y2K Flash", note: "Bright, cool, high-shine digicam",
    p: {
      exposure: 0.2, temperature: -12, contrast: 20, highlights: 10, shadows: 10, vibrance: 25,
      highHue: 210, highAmt: 15, shadowHue: 260, shadowAmt: 15,
      skinProtect: 75, vignette: 18, halation: 20,
    },
  },

  // ---------------------------------------------------------------- Film
  {
    id: "warmfilm", cat: "Film", name: "Warm Film", note: "Soft print-film pastels",
    p: {
      temperature: 12, contrast: -8, highlights: -30, shadows: 10, fade: 14, saturation: -8, vibrance: 10,
      shadowHue: 30, shadowAmt: 18, highHue: 85, highAmt: 14,
      mixer: { green: { hue: 20, sat: -15, lum: 5 }, aqua: { hue: 0, sat: -10, lum: 5 } },
      skinProtect: 60, grain: 12,
    },
  },
  {
    id: "vintage", cat: "Film", name: "Vintage", note: "Faded 70s print",
    p: {
      temperature: 18, contrast: 6, fade: 32, saturation: -28,
      shadowHue: 160, shadowAmt: 20, highHue: 80, highAmt: 30,
      mixer: { red: { hue: 10, sat: -10, lum: 0 }, blue: { hue: -20, sat: -30, lum: 5 } },
      skinProtect: 50, grain: 30, vignette: 30,
    },
  },
  {
    id: "super8", cat: "Film", name: "Super 8", note: "Home-movie warmth & glow",
    p: {
      temperature: 25, contrast: 15, highlights: -25, fade: 22, saturation: -10,
      shadowHue: 30, shadowAmt: 25, highHue: 70, highAmt: 25,
      skinProtect: 45, grain: 45, vignette: 45, halation: 45,
    },
  },
  {
    id: "crossproc", cat: "Film", name: "Cross Process", note: "Yellow highs, cyan lows",
    p: {
      contrast: 25, highlights: -10, saturation: 8,
      shadowHue: 195, shadowAmt: 50, highHue: 105, highAmt: 40,
      mixer: { red: { hue: 15, sat: 10, lum: 0 }, green: { hue: -20, sat: 15, lum: 5 } },
      skinProtect: 55, grain: 15,
    },
  },
  {
    id: "slide", cat: "Film", name: "Slide Film", note: "Rich saturated reversal stock",
    p: {
      contrast: 28, highlights: -15, shadows: -6, vibrance: 30, saturation: 10,
      shadowHue: 250, shadowAmt: 15,
      mixer: { blue: { hue: 0, sat: 20, lum: -15 }, red: { hue: 0, sat: 10, lum: -5 } },
      skinProtect: 70, grain: 8,
    },
  },
  {
    id: "coolchrome", cat: "Film", name: "Cool Chrome", note: "Muted classic chrome",
    p: {
      contrast: 16, highlights: -18, shadows: 6, saturation: -22, fade: 6,
      shadowHue: 220, shadowAmt: 18, highHue: 70, highAmt: 8,
      mixer: { blue: { hue: 0, sat: -10, lum: -15 }, red: { hue: 5, sat: -15, lum: -5 }, green: { hue: 10, sat: -20, lum: -5 } },
      skinProtect: 70, grain: 10,
    },
  },
  {
    id: "goldfilm", cat: "Film", name: "Gold Stock", note: "Consumer film gold warmth",
    p: {
      temperature: 20, contrast: 12, highlights: -20, shadows: 8, vibrance: 15, fade: 8,
      midHue: 75, midAmt: 15, highHue: 85, highAmt: 15,
      mixer: { yellow: { hue: -10, sat: 15, lum: 0 }, green: { hue: -15, sat: 0, lum: 0 } },
      skinProtect: 55, grain: 18,
    },
  },

  // ---------------------------------------------------------------- Moody
  {
    id: "moody", cat: "Moody", name: "Moody Film", note: "Matte blacks, muted greens",
    p: {
      exposure: -0.15, contrast: 22, highlights: -20, fade: 28, saturation: -18,
      shadowHue: 210, shadowAmt: 35, highHue: 65, highAmt: 15,
      mixer: { green: { hue: 30, sat: -45, lum: -15 }, yellow: { hue: -10, sat: -25, lum: 0 }, blue: { hue: -10, sat: -20, lum: -10 } },
      skinProtect: 65, grain: 18, vignette: 25, density: 25, dehaze: 10,
    },
  },
  {
    id: "academia", cat: "Moody", name: "Dark Academia", note: "Warm browns, deep shadows",
    p: {
      exposure: -0.2, temperature: 14, contrast: 25, highlights: -30, shadows: -10, fade: 12, saturation: -30,
      shadowHue: 50, shadowAmt: 25, midHue: 60, midAmt: 15, highHue: 75, highAmt: 15,
      mixer: { green: { hue: -25, sat: -40, lum: -15 }, blue: { hue: 0, sat: -50, lum: -10 }, orange: { hue: -5, sat: 10, lum: -5 } },
      skinProtect: 55, grain: 20, vignette: 40,
    },
  },
  {
    id: "rainy", cat: "Moody", name: "Rainy Day", note: "Cool muted overcast",
    p: {
      exposure: -0.1, temperature: -15, contrast: 10, highlights: -25, fade: 18, saturation: -35,
      shadowHue: 225, shadowAmt: 30, midHue: 210, midAmt: 10,
      skinProtect: 70, grain: 12, vignette: 25,
    },
  },
  {
    id: "midnight", cat: "Moody", name: "Midnight Blue", note: "Day-for-night blue hour",
    p: {
      exposure: -0.45, temperature: -35, contrast: 18, highlights: -30, saturation: -25,
      shadowHue: 255, shadowAmt: 45, midHue: 240, midAmt: 20,
      skinProtect: 45, vignette: 35,
    },
  },
  {
    id: "forestmoody", cat: "Moody", name: "Dark Forest", note: "Olive greens, heavy mood",
    p: {
      exposure: -0.15, contrast: 24, highlights: -25, fade: 15, saturation: -20,
      shadowHue: 170, shadowAmt: 30, highHue: 80, highAmt: 12,
      mixer: { green: { hue: -25, sat: -20, lum: -20 }, yellow: { hue: -20, sat: -20, lum: -10 } },
      skinProtect: 65, grain: 15, vignette: 35,
    },
  },

  // ---------------------------------------------------------------- Nature
  {
    id: "golden", cat: "Nature", name: "Golden Hour", note: "Warm low-sun glow",
    p: {
      temperature: 28, tint: 4, contrast: 8, highlights: -25, shadows: 12, fade: 8, vibrance: 18,
      highHue: 70, highAmt: 30, midHue: 50, midAmt: 12, skinProtect: 55, halation: 20, glow: 15, dehaze: -10,
    },
  },
  {
    id: "emerald", cat: "Nature", name: "Emerald Forest", note: "Deep greens for nature",
    p: {
      contrast: 15, highlights: -18, shadows: 8, vibrance: 12,
      shadowHue: 185, shadowAmt: 25,
      mixer: { green: { hue: 25, sat: 10, lum: -18 }, yellow: { hue: 30, sat: -10, lum: -5 }, aqua: { hue: 0, sat: 10, lum: -10 } },
      skinProtect: 75, density: 35, clarity: 10,
    },
  },
  {
    id: "tropical", cat: "Nature", name: "Tropical", note: "Turquoise water, lush colour",
    p: {
      contrast: 15, highlights: -25, shadows: 10, vibrance: 30,
      mixer: { aqua: { hue: 0, sat: 35, lum: 5 }, blue: { hue: -20, sat: 20, lum: -5 }, green: { hue: 15, sat: 15, lum: 0 }, yellow: { hue: -5, sat: 10, lum: 5 } },
      skinProtect: 75,
    },
  },
  {
    id: "autumn", cat: "Nature", name: "Autumn", note: "Rich oranges and reds",
    p: {
      temperature: 15, contrast: 16, highlights: -20, shadows: 6, vibrance: 15,
      midHue: 55, midAmt: 10,
      mixer: { green: { hue: -45, sat: -20, lum: -5 }, yellow: { hue: -30, sat: 20, lum: -5 }, orange: { hue: -5, sat: 25, lum: -5 }, red: { hue: 0, sat: 15, lum: -5 } },
      skinProtect: 65,
    },
  },
  {
    id: "sunset", cat: "Nature", name: "Sunset Glow", note: "Magenta-orange skies",
    p: {
      temperature: 18, tint: 10, contrast: 18, highlights: -30, vibrance: 22,
      shadowHue: 300, shadowAmt: 25, highHue: 50, highAmt: 30,
      mixer: { orange: { hue: 0, sat: 20, lum: 0 }, magenta: { hue: 0, sat: 25, lum: 0 }, blue: { hue: 20, sat: 0, lum: -10 } },
      skinProtect: 60, halation: 25,
    },
  },
  {
    id: "alpine", cat: "Nature", name: "Alpine", note: "Crisp cold mountain air",
    p: {
      temperature: -12, contrast: 20, highlights: -30, shadows: 15, vibrance: 15,
      shadowHue: 235, shadowAmt: 18,
      mixer: { blue: { hue: -5, sat: 15, lum: -15 }, aqua: { hue: 0, sat: 10, lum: -5 }, green: { hue: 15, sat: -10, lum: -5 } },
      skinProtect: 75,
    },
  },

  // ---------------------------------------------------------------- Portrait
  {
    id: "natural", cat: "Portrait", name: "Natural Pop", note: "Clean, true-to-life polish",
    p: { contrast: 12, highlights: -20, shadows: 18, vibrance: 28, skinProtect: 70 },
  },
  {
    id: "cleanbright", cat: "Portrait", name: "Clean Bright", note: "Bright, airy, true whites",
    p: { exposure: 0.25, contrast: 6, highlights: -30, shadows: 25, vibrance: 15, temperature: -4, skinProtect: 80 },
  },
  {
    id: "bronze", cat: "Portrait", name: "Bronze", note: "Sun-kissed warm skin",
    p: {
      temperature: 12, contrast: 18, highlights: -20, shadows: 5, vibrance: 10,
      midHue: 60, midAmt: 15, shadowHue: 40, shadowAmt: 15,
      mixer: { orange: { hue: -4, sat: 12, lum: -6 } },
      skinProtect: 20, vignette: 18,
    },
  },
  {
    id: "editorial", cat: "Portrait", name: "Editorial", note: "Muted magazine fashion",
    p: {
      contrast: 20, highlights: -15, shadows: 5, fade: 8, saturation: -28,
      shadowHue: 220, shadowAmt: 12, highHue: 60, highAmt: 8,
      skinProtect: 80, vignette: 15,
    },
  },

  // ---------------------------------------------------------------- B&W
  {
    id: "noir", cat: "B&W", name: "Rich Noir", note: "Deep tonal black & white",
    p: {
      saturation: -100, contrast: 28, highlights: -12, shadows: 8,
      mixer: { orange: { hue: 0, sat: 0, lum: 15 }, blue: { hue: 0, sat: 0, lum: -25 } },
      skinProtect: 0, grain: 15, vignette: 22,
    },
  },
  {
    id: "mattebw", cat: "B&W", name: "Matte B&W", note: "Soft faded monochrome",
    p: { saturation: -100, contrast: 5, highlights: -20, shadows: 15, fade: 28, skinProtect: 0, grain: 18 },
  },
  {
    id: "highkey", cat: "B&W", name: "High-Key B&W", note: "Bright, clean monochrome",
    p: {
      exposure: 0.35, saturation: -100, contrast: 15, highlights: -35, shadows: 30,
      mixer: { orange: { hue: 0, sat: 0, lum: 20 }, red: { hue: 0, sat: 0, lum: 10 } },
      skinProtect: 0,
    },
  },
  {
    id: "sepia", cat: "B&W", name: "Sepia", note: "Toned antique print",
    p: {
      saturation: -100, contrast: 15, highlights: -15, fade: 15,
      shadowHue: 50, shadowAmt: 30, midHue: 65, midAmt: 35, highHue: 85, highAmt: 25,
      skinProtect: 0, grain: 25, vignette: 35,
    },
  },
];

// Reference-matched looks first, then the hand-built library.
export const PRESETS = [...PRO_LOOKS, ...BASE_PRESETS];
