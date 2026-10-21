// Names and one-line techniques for the hover lab's effects. Shared by the build (cards render
// without JavaScript) and the lazy WebGL module (lazy/effects.js holds the shaders, keyed by id).
export const effectMeta = [
  {
    id: "ripple",
    name: "Liquid ripple",
    technique: "Radial sine displacement from the cursor, with a chromatic ghost",
  },
  {
    id: "smear",
    name: "Velocity smear",
    technique: "RGB channels trail along the cursor's velocity, motion-blurred",
  },
  {
    id: "melt",
    name: "Pixel melt",
    technique: "Column-wise search upward: pixels below a glyph inherit it, like sorted drips",
  },
  {
    id: "ink",
    name: "Ink bleed",
    technique: "The glyph's distance field grows into fibrous noise, darker at the rim",
  },
  {
    id: "dither",
    name: "Bayer dissolve",
    technique: "An 8×8 ordered-dither threshold sweeps out from the cursor",
  },
  {
    id: "halftone",
    name: "Halftone",
    technique: "Rotated dot grid sized by local coverage, rippling from the cursor",
  },
  {
    id: "inflate",
    name: "Inflate",
    technique: "SDF height field lit from the cursor: the letters puff up like balloons",
  },
  {
    id: "particles",
    name: "Magnetic particles",
    technique: "Glyph pixels become GPU points that the cursor pushes and swirls",
  },
  {
    id: "goo",
    name: "Gooey metaballs",
    technique: "Smooth-minimum of the glyph SDF with blobs orbiting the cursor",
  },
  {
    id: "burn",
    name: "Ember burn",
    technique: "Noise-thresholded dissolve with a white-hot edge and rising sparks",
  },
  {
    id: "lens",
    name: "Glass lens",
    technique: "Barrel-magnifying refraction with chromatic aberration at the rim",
  },
  {
    id: "crt",
    name: "CRT",
    technique: "Curved phosphor screen: scanlines, aperture mask, roll band and bloom",
  },
  {
    id: "datamosh",
    name: "Datamosh",
    technique: "Hash-driven macroblocks and slices jump, smear and split channels",
  },
  {
    id: "wave",
    name: "Wave warp",
    technique: "Travelling sine displacement whose amplitude follows the cursor",
  },
  {
    id: "dangle",
    name: "Dangling letters",
    technique: "Each letter is a damped pendulum; cursor velocity sets them swinging",
  },
  {
    id: "weight",
    name: "Weight wave",
    technique: "Two distance fields (regular and black) blended in a wave under the cursor",
  },
  {
    id: "smoke",
    name: "Smoke",
    technique: "Glyph coverage advected upward through curl noise, blurring with age",
  },
  {
    id: "shatter",
    name: "Voronoi shatter",
    technique: "Voronoi cells fly out from the cursor and fall, with lit cracks",
  },
  {
    id: "ascii",
    name: "ASCII",
    technique: "Coverage per cell picks a glyph from a character ramp atlas",
  },
  {
    id: "elastic",
    name: "Elastic pull",
    technique: "A Gaussian warp follows a spring, snapping back with overshoot",
  },
  {
    id: "rope",
    name: "Rope underline",
    technique: "A Verlet-simulated string: pluck it with the cursor",
  },
  {
    id: "chrome",
    name: "Chrome",
    technique: "A sky-and-ground reflection split by a cursor-tilted horizon, with a lit bevel",
  },
  {
    id: "coral",
    name: "Reaction–diffusion",
    technique: "Gray-Scott simulation seeded by the letters grows coral around them",
  },
  {
    id: "focus",
    name: "Focus pull",
    technique: "Poisson-disk depth-of-field: sharp under the cursor, blurred away from it",
  },
  {
    id: "film",
    name: "Thin-film hologram",
    technique: "Interference colours from film thickness and viewing angle, plus a glint",
  },
]
