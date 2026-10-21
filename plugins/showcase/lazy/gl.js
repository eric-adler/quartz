// Small WebGL2 toolkit shared by the shader pages: programs, a positioned quad, text → texture with a
// signed distance field, render targets, theme colours, and a GLSL noise library.

export const MAX_DPR = 2

export function createContext(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  })
  if (!gl) return null
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  return gl
}

/** Resizes the canvas backing store to its CSS size × device pixel ratio. Returns the ratio. */
export function fit(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  const w = Math.round(canvas.clientWidth * dpr)
  const h = Math.round(canvas.clientHeight * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  return dpr
}

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    const numbered = source
      .split("\n")
      .map((line, i) => `${String(i + 1).padStart(4)} ${line}`)
      .join("\n")
    throw new Error(`Shader compile error:\n${log}\n${numbered}`)
  }
  return shader
}

/** Links a program and returns it with a name → location map of its uniforms. */
export function createProgram(gl, vertex, fragment) {
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment))
  gl.bindAttribLocation(program, 0, "aCorner")
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`)
  }
  const uniforms = {}
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i)
    const name = info.name.replace(/\[0\]$/, "")
    uniforms[name] = { location: gl.getUniformLocation(program, info.name), type: info.type }
  }
  return { program, uniforms }
}

/** Sets uniforms by name; unknown names are ignored, so shaders can skip what they don't use. */
export function setUniforms(gl, { uniforms }, values) {
  let unit = 0
  for (const [name, value] of Object.entries(values)) {
    const u = uniforms[name]
    if (!u || value === undefined) continue
    const v = typeof value === "number" ? [value] : value
    switch (u.type) {
      case gl.FLOAT:
        gl.uniform1fv(u.location, v)
        break
      case gl.FLOAT_VEC2:
        gl.uniform2fv(u.location, v)
        break
      case gl.FLOAT_VEC3:
        gl.uniform3fv(u.location, v)
        break
      case gl.FLOAT_VEC4:
        gl.uniform4fv(u.location, v)
        break
      case gl.INT:
        gl.uniform1iv(u.location, v)
        break
      case gl.SAMPLER_2D:
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, value)
        gl.uniform1i(u.location, unit++)
        break
    }
  }
}

/**
 * Vertex shader for a quad placed at a CSS-pixel rectangle of the viewport. vUv is 0..1 with
 * (0, 0) at the top left, matching how canvas 2D textures are uploaded.
 */
export const QUAD_VERTEX = `#version 300 es
in vec2 aCorner;
uniform vec4 uRect;   // x, y, w, h in CSS px
uniform vec2 uView;   // viewport size in CSS px
out vec2 vUv;
void main() {
  vUv = aCorner;
  vec2 px = uRect.xy + aCorner * uRect.zw;
  vec2 clip = px / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`

export function createQuad(gl) {
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)
  return {
    draw() {
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
  }
}

export function createTexture(gl, source, { filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE } = {}) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  return texture
}

/** A float render target (falls back to 8-bit where float rendering isn't available). */
export function createTarget(gl, width, height) {
  const float = Boolean(gl.getExtension("EXT_color_buffer_float"))
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  if (float)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  for (const [key, value] of [
    [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
    [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ]) {
    gl.texParameteri(gl.TEXTURE_2D, key, value)
  }
  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return {
    texture,
    framebuffer,
    width,
    height,
    float,
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteFramebuffer(framebuffer)
    },
  }
}

// ——— colours ———

const probe = document.createElement("canvas").getContext("2d")

/** Any CSS colour → [r, g, b] in 0..1. */
export function rgb(css) {
  probe.fillStyle = "#000"
  probe.fillStyle = css
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  probe.clearRect(0, 0, 1, 1)
  return [r / 255, g / 255, b / 255]
}

/** The page's current theme colours (they change with dark mode). */
export function themeColors() {
  const style = getComputedStyle(document.documentElement)
  const v = (name) => rgb(style.getPropertyValue(name).trim() || "#888")
  return {
    bg: v("--light"),
    ink: v("--dark"),
    muted: v("--darkgray"),
    accent: v("--secondary"),
    accent2: v("--tertiary"),
    dark: document.documentElement.getAttribute("saved-theme") === "dark",
  }
}

// ——— text → texture with signed distance fields ———

/** 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher). */
function edt1d(f, n, d, v, z) {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) ** 2 + f[v[k]]
  }
}

/** Distance (in pixels) from every pixel to the nearest pixel where `inside` is true. */
function distanceField(inside, w, h) {
  const INF = 1e20
  const grid = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) grid[i] = inside[i] ? 0 : INF
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x])
  }
  return grid
}

/** Signed distance (px, negative inside) from a coverage mask. */
function signedField(alpha, w, h) {
  const inside = new Uint8Array(w * h)
  const outside = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    inside[i] = alpha[i] >= 128 ? 1 : 0
    outside[i] = 1 - inside[i]
  }
  const toInside = distanceField(inside, w, h)
  const toOutside = distanceField(outside, w, h)
  const out = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = inside[i] ? -(toOutside[i] - 0.5) : toInside[i] - 0.5
  return out
}

/**
 * Rasterises a line of text exactly where it sits in the DOM and packs it into one RGBA texture:
 *   R = antialiased coverage, G = signed distance field, B = SDF of a heavier weight, A = 1
 * The SDF is stored as 0.5 - d / (2 * range), so 0.5 is the glyph edge.
 */
export function rasterizeText({
  text,
  font,
  boldFont,
  letterSpacing,
  width,
  height,
  originX,
  baseline,
  dpr,
  range,
}) {
  const w = Math.max(1, Math.round(width * dpr))
  const h = Math.max(1, Math.round(height * dpr))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  const draw = (fontSpec) => {
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.font = fontSpec
    if ("letterSpacing" in ctx) ctx.letterSpacing = letterSpacing
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = "#fff"
    ctx.fillText(text, originX, baseline)
    ctx.restore()
    const data = ctx.getImageData(0, 0, w, h).data
    const alpha = new Uint8ClampedArray(w * h)
    for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3]
    return alpha
  }

  const regular = draw(font)
  const regularSdf = signedField(regular, w, h)
  const bold = boldFont ? signedField(draw(boldFont), w, h) : regularSdf
  const scale = 1 / (2 * range * dpr)
  const out = ctx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    out.data[i * 4] = regular[i]
    out.data[i * 4 + 1] = Math.max(0, Math.min(255, (0.5 - regularSdf[i] * scale) * 255))
    out.data[i * 4 + 2] = Math.max(0, Math.min(255, (0.5 - bold[i] * scale) * 255))
    out.data[i * 4 + 3] = 255
  }
  ctx.putImageData(out, 0, 0)

  // per-letter boxes (CSS px, relative to the texture), for effects that move letters individually
  ctx.font = font
  if ("letterSpacing" in ctx) ctx.letterSpacing = letterSpacing
  const letters = []
  let cursor = originX
  for (const char of text) {
    const advance = ctx.measureText(char).width
    if (char.trim()) letters.push([cursor, cursor + advance])
    cursor += advance
  }
  return { canvas, letters, regularAlpha: regular, pixelWidth: w, pixelHeight: h }
}

// ——— GLSL library ———

export const GLSL_NOISE = `
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * snoise(p); p = r * p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
vec2 curl(vec2 p) {
  float e = 0.1;
  float n1 = snoise(p + vec2(0, e)), n2 = snoise(p - vec2(0, e));
  float n3 = snoise(p + vec2(e, 0)), n4 = snoise(p - vec2(e, 0));
  vec2 v = vec2(n1 - n2, n4 - n3) / (2.0 * e);
  // some GPUs' fast-math noise can blow up here; keep the field finite and bounded
  return any(isnan(v)) || any(isinf(v)) ? vec2(0.0) : clamp(v, -3.0, 3.0);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// 1 at or below lo, 0 at or above hi: the spec-safe form of smoothstep(hi, lo, x)
float fade(float hi, float lo, float x) { return 1.0 - smoothstep(lo, hi, x); }
`
