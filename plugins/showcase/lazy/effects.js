// The hover lab's 25 effects. Each fragment shader draws one link's quad. Invariant: at uHover = 0
// every effect renders exactly the plain text (premultiplied ink × coverage), so handing the link
// over from the DOM to the canvas, and back, is invisible.
import { GLSL_NOISE } from "./gl.js"

export const FRAGMENT_HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uText;   // r: coverage, g: SDF, b: SDF of a heavier weight
uniform vec2 uSize;        // quad size, CSS px
uniform vec2 uMouse;       // cursor in quad space, CSS px
uniform vec2 uVel;         // cursor velocity, px/s (smoothed)
uniform float uHover;      // 0..1, eased
uniform float uTime;       // seconds since the hover began
uniform float uFont;       // font size, px
uniform float uRange;      // SDF range, px
uniform vec3 uInk, uAccent, uAccent2, uBg;
uniform float uDark;
${GLSL_NOISE}
bool inside(vec2 px) { return px.x >= 0.0 && px.y >= 0.0 && px.x <= uSize.x && px.y <= uSize.y; }
float cov(vec2 px) { return inside(px) ? texture(uText, px / uSize).r : 0.0; }
float sdf(vec2 px) { return (0.5 - texture(uText, clamp(px / uSize, 0.0, 1.0)).g) * 2.0 * uRange; }
float sdfBold(vec2 px) { return (0.5 - texture(uText, clamp(px / uSize, 0.0, 1.0)).b) * 2.0 * uRange; }
float aa(float d) { return clamp(0.5 - d / max(fwidth(d), 1e-3), 0.0, 1.0); }
vec4 col(vec3 c, float a) { return vec4(c * a, a); }
vec4 over(vec4 top, vec4 bottom) { return top + bottom * (1.0 - top.a); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// coverage of three channels → colour that is plain ink when they agree, and splits RGB when they don't
vec4 splitRGB(float r, float g, float b) {
  float lo = min(r, min(g, b));
  float a = max(r, max(g, b));
  vec3 c = uInk * lo + vec3(1.0, 0.22, 0.38) * (r - lo) + vec3(0.2, 0.95, 0.55) * (g - lo) + vec3(0.3, 0.45, 1.0) * (b - lo);
  return vec4(c, a);
}
float heightField(vec2 px, float bevel) { return smoothstep(0.0, bevel, -sdf(px)); }
vec3 bevelNormal(vec2 px, float bevel, float strength) {
  vec2 e = vec2(1.0, 0.0);
  vec2 g = vec2(heightField(px + e.xy, bevel) - heightField(px - e.xy, bevel),
                heightField(px + e.yx, bevel) - heightField(px - e.yx, bevel));
  return normalize(vec3(-g * strength, 1.0));
}
`

const POISSON = `const vec2 POISSON[16] = vec2[](
  vec2(-0.94, -0.40), vec2(0.95, -0.77), vec2(-0.09, -0.93), vec2(0.34, 0.29),
  vec2(-0.92, 0.46), vec2(-0.82, -0.88), vec2(-0.38, 0.28), vec2(-0.57, 0.81),
  vec2(0.10, 0.06), vec2(0.16, 0.55), vec2(0.73, 0.34), vec2(0.21, -0.39),
  vec2(0.53, -0.88), vec2(0.88, 0.85), vec2(-0.16, 0.95), vec2(0.65, -0.20));`

export const effects = {
  ripple: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      vec2 d = p - uMouse; float r = length(d);
      vec2 dir = r > 0.001 ? d / r : vec2(0.0);
      float wave = sin(r * 0.32 - uTime * 9.0) * exp(-r * 0.016) * uHover;
      vec2 off = dir * wave * 7.0;
      float a = cov(p + off);
      float ghost = max(cov(p + off * 1.8), cov(p + off * 0.3)) * abs(wave);
      vec3 c = mix(uInk, uAccent, clamp(abs(wave) * 1.3, 0.0, 1.0));
      outColor = over(col(c, a), col(uAccent2, ghost * 0.5));
    }`,
  },

  smear: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      vec2 v = uVel * 0.014;
      float len = min(length(v), uFont * 1.4);
      v = len > 0.001 ? normalize(v) * len : vec2(0.0);
      v += vec2(sin(uTime * 3.1), cos(uTime * 2.3)) * 2.5;
      v *= uHover;
      float r = 0.0, g = 0.0, b = 0.0;
      for (int i = 0; i < 10; i++) {
        float t = float(i) / 9.0;
        float w = 1.0 - t * 0.6;
        r = max(r, cov(p + v * t) * w);
        g = max(g, cov(p + v * t * 0.5) * w);
        b = max(b, cov(p - v * t * 0.25) * w);
      }
      vec4 s = splitRGB(r, g, b);
      outColor = vec4(s.rgb, s.a);
    }`,
  },

  melt: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float column = floor(p.x);
      float n = vnoise(vec2(column * 0.21, 3.7));
      float n2 = vnoise(vec2(column * 0.05, uTime * 0.6));
      float len = uHover * (4.0 + n * n * uFont * 1.6) * (0.55 + 0.45 * n2);
      float a = cov(p);
      float drip = 0.0; float depth = 0.0;
      for (int i = 1; i <= 32; i++) {
        float s = float(i) / 32.0 * len;
        if (cov(vec2(column + 0.5, p.y - s)) > 0.5) { drip = 1.0 - s / max(len, 1.0); depth = s / max(len, 1.0); break; }
      }
      drip *= step(0.001, len);
      vec3 dc = mix(uInk, mix(uAccent, uAccent2, depth), smoothstep(0.0, 0.25, depth));
      outColor = over(col(uInk, a), col(dc, drip * 0.95));
    }`,
  },

  ink: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float d = sdf(p);
      float fiber = fbm(p * 0.08 + vec2(0.0, uTime * 0.05)) * 0.5 + 0.5;
      float grain = vnoise(p * 0.7);
      float grow = uHover * uFont * 0.24;
      float field = d - grow * (0.25 + 0.95 * fiber);
      float bled = aa(field);
      float rim = fade(2.5, 0.0, abs(field)) * uHover;
      float inGlyph = cov(p);
      vec3 wash = mix(uAccent, uInk, 0.35);
      vec3 c = mix(wash, uInk, inGlyph);
      c = mix(c, uInk * 0.6, rim * 0.7);
      float a = mix(inGlyph, max(inGlyph, bled * (0.72 + 0.28 * grain)), smoothstep(0.0, 0.12, uHover));
      outColor = col(mix(uInk, c, uHover), a);
    }`,
  },

  dither: {
    frag: `float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
    void main() {
      vec2 p = vUv * uSize;
      vec2 cell = floor(p / 2.0);
      float t = bayer8(cell);
      float a = cov(p);
      float reach = length(p - uMouse) / (uSize.x * 0.75);
      float front = uHover * 1.35 - reach;
      float zone = step(0.001, front);
      float dith = step(t, cov(cell * 2.0 + 1.0) * 0.95);
      float halo = step(t, exp(-max(sdf(cell * 2.0 + 1.0), 0.0) / 5.0) * 0.45) * (1.0 - dith);
      float edge = fade(0.08, 0.0, abs(front)) * step(t, 0.6) * uHover;
      vec4 plain = col(uInk, a);
      vec4 bits = over(col(uAccent, dith), col(uAccent2, halo * 0.8));
      outColor = over(col(uAccent2, edge * 0.9), mix(plain, bits, zone));
    }`,
  },

  halftone: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float cell = max(4.0, uFont * 0.13);
      mat2 R = rot(0.785398);
      vec2 q = R * p;
      vec2 id = floor(q / cell) + 0.5;
      vec2 centre = transpose(R) * (id * cell);
      float c = clamp(0.5 - sdf(centre) / (cell * 0.9), 0.0, 1.0);
      float pulse = 1.0 + 0.4 * sin(length(centre - uMouse) * 0.11 - uTime * 5.0);
      float r = sqrt(c) * cell * 0.72 * pulse;
      float dotA = aa(length(q - id * cell) - r);
      float a = mix(cov(p), dotA, smoothstep(0.0, 0.6, uHover));
      outColor = col(mix(uInk, uAccent, uHover * 0.85), a);
    }`,
  },

  inflate: {
    frag: `float puff(vec2 px) {
      float R = uFont * 0.14;
      float d = sdf(px) - uHover * uFont * 0.045;
      return sqrt(clamp(-d / R, 0.0, 1.0));
    }
    void main() {
      vec2 p = vUv * uSize;
      float d = sdf(p) - uHover * uFont * 0.045;
      float a = mix(cov(p), aa(d), smoothstep(0.0, 0.15, uHover));
      vec2 e = vec2(1.0, 0.0);
      vec2 g = vec2(puff(p + e.xy) - puff(p - e.xy), puff(p + e.yx) - puff(p - e.yx));
      vec3 n = normalize(vec3(-g * uFont * 0.18, 1.0));
      vec3 L = normalize(vec3(uMouse - p, uFont * 1.2));
      float diff = max(dot(n, L), 0.0);
      float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
      vec3 shade = uAccent * (0.35 + 0.8 * diff) + vec3(spec * 0.85);
      outColor = col(mix(uInk, shade, uHover), a);
    }`,
  },

  particles: {
    // drawn as points by a custom pass; the quad shader fades the plain text out underneath
    frag: `void main() {
      vec2 p = vUv * uSize;
      outColor = col(uInk, cov(p) * (1.0 - smoothstep(0.0, 0.35, uHover)));
    }`,
    particles: true,
  },

  goo: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float d = sdf(p);
      float R = uFont * 0.24 * uHover;
      vec2 m = uMouse;
      float b1 = length(p - m) - R;
      float b2 = length(p - (m + vec2(cos(uTime * 2.1), sin(uTime * 2.7)) * uFont * 0.55)) - R * 0.55;
      float b3 = length(p - (m + vec2(cos(-uTime * 1.6 + 2.0), sin(uTime * 1.9 + 1.0)) * uFont * 0.75)) - R * 0.4;
      float blobs = min(b1, min(b2, b3));
      float g = smin(d, blobs, uFont * 0.38 * uHover + 0.001);
      float a = mix(cov(p), aa(g), smoothstep(0.0, 0.12, uHover));
      float body = smoothstep(-1.0, 3.0, d);
      vec3 c = mix(uInk, mix(uInk, uAccent, body), uHover);
      outColor = col(c, a);
    }`,
  },

  burn: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float a = cov(p);
      float n = fbm(p * 0.045 + 3.1) * 0.5 + 0.5 + vnoise(p * 0.35) * 0.1;
      // smoulders in over a couple of seconds and settles with about half the word burnt
      float progress = uHover * (0.25 + 0.35 * smoothstep(0.0, 2.5, uTime));
      float threshold = progress * 1.3 - 0.15;
      float edge = n - threshold;
      float alive = smoothstep(0.0, 0.025, edge);
      float hot = (1.0 - smoothstep(0.0, 0.1, edge)) * step(0.0, edge) * step(0.01, uHover);
      vec3 fire = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.92, 0.6), 1.0 - smoothstep(0.0, 0.05, edge));
      vec3 charred = mix(uInk, vec3(0.12, 0.06, 0.03), (1.0 - smoothstep(0.0, 0.2, edge)) * uHover);
      vec4 text = col(charred, a * alive);
      vec4 glow = col(fire, a * hot);
      float sparks = 0.0;
      for (int L = 0; L < 2; L++) {
        float size = 7.0 + float(L) * 5.0;
        float speed = uFont * (0.9 + float(L) * 0.4);
        vec2 g = (p + vec2(0.0, uTime * speed)) / size;
        vec2 id = floor(g);
        vec2 r = hash22(id + float(L) * 17.0);
        vec2 pos = (id + 0.5 + (r - 0.5) * 0.7) * size - vec2(0.0, uTime * speed);
        pos.x += sin(uTime * 3.0 + r.y * 6.28) * 2.0;
        float life = fract(r.y * 3.7 + uTime * 0.4);
        float travel = life * uFont * 1.4;
        float gate = fade(uFont * 0.12, 0.0, sdf(pos + vec2(0.0, travel)));
        sparks += fade(1.6, 0.2, length(p - pos)) * (1.0 - life) * gate * step(0.55, r.x);
      }
      sparks *= smoothstep(0.05, 0.4, uHover) * (1.0 - smoothstep(0.85, 1.0, uHover) * 0.5);
      outColor = over(col(vec3(1.0, 0.6, 0.2), min(sparks, 1.0)), over(glow, text));
    }`,
  },

  lens: {
    margin: [1.4, 1.3],
    frag: `void main() {
      vec2 p = vUv * uSize;
      float R = uFont * 1.15 * uHover;
      vec2 d = p - uMouse; float r = length(d);
      float inLens = fade(R, R - 1.5, r) * step(0.5, R);
      float k = r / max(R, 1.0);
      vec2 dir = r > 0.001 ? d / r : vec2(0.0);
      vec2 sp = uMouse + d * mix(1.0, 0.5 + 0.5 * k * k, inLens);
      float ca = 0.06 * k * k * R * inLens;
      vec4 text = splitRGB(cov(sp + dir * ca), cov(sp), cov(sp - dir * ca));
      float rim = fade(2.5, 0.0, abs(r - R)) * uHover;
      float spec = fade(0.35, 0.0, length(d / max(R, 1.0) - vec2(-0.35, -0.42))) * inLens;
      float shadow = fade(R + 10.0, R, r) * (1.0 - inLens) * 0.18 * uHover;
      vec4 glass = col(mix(uBg, uAccent, 0.12), 0.16 * inLens);
      vec4 lensTop = over(col(vec3(1.0), rim * 0.55 + spec * 0.4), text);
      outColor = over(lensTop, over(glass, col(vec3(0.0), shadow)));
    }`,
  },

  crt: {
    margin: [0.7, 0.75],
    frag: `void main() {
      vec2 c = vUv * 2.0 - 1.0;
      float k = 0.14 * uHover;
      c *= 1.0 + k * dot(c, c);
      vec2 uv = c * 0.5 + 0.5;
      vec2 q = uv * uSize;
      float roll = fract(uTime * 0.3);
      float bandY = (uv.y - roll) * 7.0;
      float band = exp(-bandY * bandY);
      q.x += (band * 5.0 + sin(q.y * 0.9 + uTime * 30.0) * 0.4) * uHover;
      float shift = 1.4 * uHover;
      float r = cov(q + vec2(shift, 0.0)), g = cov(q), b = cov(q - vec2(shift, 0.0));
      float bloom = 0.0;
      for (int i = 0; i < 8; i++) { float an = float(i) * 0.785; bloom += cov(q + vec2(cos(an), sin(an)) * 3.0); }
      bloom /= 8.0;
      vec3 phosphor = mix(vec3(0.55, 1.0, 0.75), uAccent2 * 1.4, 0.35);
      float scan = 0.72 + 0.28 * sin(q.y * 3.14159 * 0.85);
      float m = mod(floor(gl_FragCoord.x), 3.0);
      vec3 mask = m < 1.0 ? vec3(1.0, 0.75, 0.75) : m < 2.0 ? vec3(0.75, 1.0, 0.75) : vec3(0.75, 0.75, 1.0);
      float flicker = 0.94 + 0.06 * sin(uTime * 55.0);
      vec3 lit = (vec3(r, g, b) * phosphor + bloom * phosphor * 0.45 + band * 0.06) * scan * mask * flicker;
      vec2 box = abs(c);
      float screen = (1.0 - smoothstep(0.92, 1.0, max(box.x, box.y))) * uHover;
      float vignette = 1.0 - dot(c, c) * 0.35;
      vec4 tube = vec4(vec3(0.02, 0.035, 0.03) * screen + lit * vignette * screen, screen * 0.94 + max(r, max(g, b)) * screen * 0.06);
      vec4 plain = col(uInk, cov(vUv * uSize));
      outColor = mix(plain, tube, smoothstep(0.0, 0.3, uHover));
    }`,
  },

  datamosh: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float t = floor(uTime * 12.0);
      vec2 block = vec2(uFont * 0.4, uFont * 0.2);
      vec2 id = floor(p / block);
      float r = hash21(id + t * 0.37);
      float moshed = step(1.0 - 0.5 * uHover, r) * step(0.01, uHover);
      vec2 shift = (hash22(id + t) - 0.5) * vec2(uFont * 0.9, uFont * 0.3) * moshed;
      float slice = floor(p.y / (uFont * 0.12));
      float rs = hash21(vec2(slice, t * 1.3));
      shift.x += step(0.85, rs) * (rs - 0.5) * uFont * 1.4 * uHover;
      vec2 q = p + shift;
      if (hash21(id * 1.7 + t) > 1.0 - 0.18 * uHover) q.y = (id.y * block.y) - shift.y;  // smear the block's top row down
      float split = 2.5 * moshed;
      vec4 s = splitRGB(cov(q + vec2(split, 0.0)), cov(q), cov(q - vec2(split, 0.0)));
      vec3 tint = mix(s.rgb, s.rgb * 0.4 + uAccent * s.a * 0.8, moshed * step(0.6, hash21(id + t * 2.1)));
      outColor = vec4(tint, s.a);
    }`,
  },

  wave: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float dx = p.x - uMouse.x;
      float fall = exp(-dx * dx / (uFont * uFont * 5.0));
      float amp = uHover * uFont * 0.26 * (0.3 + 0.7 * fall);
      float phase = p.x * 0.065 - uTime * 5.0;
      float y = sin(phase) * amp + sin(p.x * 0.021 + uTime * 2.0) * amp * 0.4;
      float slope = cos(phase) * amp * 0.065;
      float a = cov(p - vec2(0.0, y));
      vec3 c = mix(uInk, mix(uInk, uAccent, clamp(0.5 + slope * 1.6, 0.0, 1.0)), uHover);
      outColor = col(c, a);
    }`,
  },

  dangle: {
    margin: [0.9, 1.1],
    frag: `uniform vec2 uLetters[24];
    uniform float uAngle[24];
    uniform int uCount;
    uniform float uPivotY;
    void main() {
      vec2 p = vUv * uSize;
      float a = 0.0; float swing = 0.0;
      for (int i = 0; i < 24; i++) {
        if (i >= uCount) break;
        vec2 L = uLetters[i];
        vec2 pivot = vec2((L.x + L.y) * 0.5, uPivotY);
        vec2 q = rot(uAngle[i]) * (p - pivot) + pivot;
        if (q.x >= L.x - 0.5 && q.x <= L.y + 0.5) {
          float c = cov(q);
          if (c > a) { a = c; swing = abs(uAngle[i]); }
        }
      }
      // letters are clipped to their advance boxes while swinging; at rest show the untouched text
      a = mix(cov(p), a, smoothstep(0.0, 0.05, uHover));
      outColor = col(mix(uInk, uAccent, clamp(swing * 3.0, 0.0, 1.0) * uHover), a);
    }`,
  },

  weight: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float dx = (p.x - uMouse.x) / (uFont * 1.5);
      float w = uHover * exp(-dx * dx);
      float d = mix(sdf(p), sdfBold(p), w) - w * uFont * 0.012;
      float a = mix(cov(p), aa(d), smoothstep(0.0, 0.08, uHover));
      outColor = col(mix(uInk, uAccent, w * 0.9), a);
    }`,
  },

  smoke: {
    margin: [0.8, 2.2],
    frag: `void main() {
      vec2 p = vUv * uSize;
      float rise = uFont * 1.9 * uHover;
      float density = 0.0;
      vec3 tint = vec3(0.0);
      for (int i = 1; i <= 10; i++) {
        float age = float(i) / 10.0;
        vec2 src = p + vec2(0.0, age * rise);
        src += curl(src * 0.03 + vec2(0.0, uTime * 0.35)) * age * uFont * 0.3 * uHover;
        float soft = 1.0 - smoothstep(-1.0, age * uFont * 0.28 + 1.0, sdf(src));
        float w = (1.0 - age) * sqrt(1.0 - age) * 0.32;
        density += soft * w;
      }
      density *= uHover;
      vec3 smokeColor = mix(uInk, mix(uBg, uAccent2, 0.4), 0.55);
      float a = cov(p) * (1.0 - 0.75 * uHover);
      outColor = over(col(uInk, a), col(smokeColor, min(density, 0.85)));
    }`,
  },

  shatter: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float cell = uFont * 0.3;
      vec2 gid = floor(p / cell);
      float a = 0.0; float crack = 0.0; float energy = 0.0;
      for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
        vec2 c = gid + vec2(x, y);
        vec2 site = (c + hash22(c)) * cell;
        vec2 away = site - uMouse; float dist = length(away);
        float force = uHover * exp(-dist / (uFont * 1.1));
        vec2 D = normalize(away + 1e-4) * force * uFont * 0.7 + vec2(0.0, force * force * uFont * 0.6);
        vec2 q = p - D;
        vec2 qid = floor(q / cell);
        float best = 1e9, second = 1e9; vec2 bestC = vec2(0.0);
        for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) {
          vec2 cc = qid + vec2(xx, yy);
          float dd = length(q - (cc + hash22(cc)) * cell);
          if (dd < best) { second = best; best = dd; bestC = cc; } else if (dd < second) { second = dd; }
        }
        if (bestC == c) {
          float cv = cov(q);
          if (cv > a) { a = cv; crack = 1.0 - smoothstep(0.0, 1.6, second - best); energy = force; }
        }
      }
      vec3 c = mix(uInk, uAccent, clamp(crack * uHover * 1.2 + energy * 0.6, 0.0, 1.0));
      outColor = col(c, a);
    }`,
  },

  ascii: {
    frag: `uniform sampler2D uAtlas;
    const float GLYPHS = 12.0;
    void main() {
      vec2 p = vUv * uSize;
      vec2 cellSize = vec2(uFont * 0.17, uFont * 0.28);
      vec2 id = floor(p / cellSize);
      vec2 centre = (id + 0.5) * cellSize;
      float lum = 0.0;
      for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) lum += cov(centre + (vec2(x, y) - 0.5) * cellSize * 0.5);
      lum /= 4.0;
      lum = max(lum, exp(-max(sdf(centre), 0.0) / (uFont * 0.18)) * 0.28);
      float reach = length(centre - uMouse) / (uSize.x * 0.85);
      float front = uHover * 1.3 - reach;
      float zone = smoothstep(0.0, 0.05, front);
      float scramble = step(abs(front), 0.08) * step(0.01, uHover);
      float idx = floor(clamp(lum, 0.0, 0.999) * GLYPHS);
      idx = mix(idx, floor(hash21(id + floor(uTime * 20.0)) * GLYPHS), scramble);
      vec2 g = fract(p / cellSize);
      float glyph = texture(uAtlas, vec2((idx + g.x) / GLYPHS, g.y)).a;
      vec4 plain = col(uInk, cov(p));
      vec4 ascii = col(mix(uAccent, uAccent2, scramble), glyph * step(0.02, lum));
      outColor = mix(plain, ascii, zone);
    }`,
  },

  elastic: {
    frag: `uniform vec2 uAnchor;
    uniform vec2 uPull;
    void main() {
      vec2 p = vUv * uSize;
      float sigma = uFont * 1.1;
      vec2 d = p - uAnchor;
      float w = exp(-dot(d, d) / (sigma * sigma));
      vec2 q = p - uPull * w;
      float stretch = length(uPull) / uFont;
      float a = cov(q);
      outColor = col(mix(uInk, uAccent, clamp(w * stretch * 1.5, 0.0, 1.0)), a);
    }`,
  },

  rope: {
    frag: `uniform vec2 uRope[28];
    uniform float uEnergy;
    void main() {
      vec2 p = vUv * uSize;
      float dist = 1e9;
      for (int i = 0; i < 27; i++) {
        vec2 a = uRope[i], b = uRope[i + 1];
        vec2 ab = b - a;
        float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
        dist = min(dist, length(p - a - ab * t));
      }
      float line = fade(1.7, 0.6, dist) * uHover;
      float glow = exp(-dist * 0.3) * 0.5 * uHover * clamp(uEnergy, 0.0, 1.0);
      vec4 text = col(mix(uInk, uAccent, uHover * 0.3), cov(p));
      outColor = over(text, col(uAccent, min(line + glow, 1.0)));
    }`,
  },

  chrome: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float a = cov(p);
      float d = sdf(p);
      // reflection of a sky and a desert floor, split by a horizon that tilts with the cursor
      float y = (vUv.y - 0.5) * uSize.y / uFont;
      float x = (vUv.x - 0.5) * uSize.x / uFont;
      float horizon = 0.08 + (uMouse.x / uSize.x - 0.5) * 0.3 + x * 0.04;
      vec3 sky = mix(vec3(0.98, 0.99, 1.0), mix(vec3(0.3, 0.4, 0.62), uAccent, 0.35), smoothstep(-0.55, horizon, y));
      vec3 ground = mix(vec3(0.1, 0.07, 0.05), vec3(0.95, 0.78, 0.55), smoothstep(horizon, 0.6, y));
      vec3 c = y < horizon ? sky : ground;
      // bevel: light the outline's upper-left side, shade its lower-right
      float edge = smoothstep(-uFont * 0.07, 0.0, d);
      vec2 g = vec2(dFdx(d), dFdy(d));
      vec2 n = length(g) > 1e-4 ? normalize(g) : vec2(0.0);
      c += edge * max(dot(n, normalize(vec2(-0.6, -1.0))), 0.0) * 0.6;
      c -= edge * max(dot(n, normalize(vec2(0.6, 1.0))), 0.0) * 0.35;
      float sweep = (uMouse.x / uSize.x - 0.5) * uSize.x / uFont;
      c += fade(0.09, 0.0, abs(x + y * 0.5 - sweep)) * 0.8;
      outColor = col(mix(uInk, c, uHover), a);
    }`,
  },

  coral: {
    margin: [0.9, 1.0],
    frag: `uniform sampler2D uState;
    void main() {
      vec2 p = vUv * uSize;
      float v = texture(uState, vUv).g;
      float pattern = smoothstep(0.12, 0.32, v) * uHover;
      vec3 c = mix(uAccent2, uAccent, smoothstep(0.2, 0.5, v));
      vec4 text = col(uInk, cov(p) * (1.0 - 0.55 * uHover));
      outColor = over(text, col(c, pattern * 0.95));
    }`,
    simulation: true,
  },

  focus: {
    frag: `${POISSON}
    void main() {
      vec2 p = vUv * uSize;
      float dist = length((p - uMouse) * vec2(1.0, 1.6));
      float radius = uHover * clamp(dist * 0.06 - 0.8, 0.0, 7.0);
      float r = 0.0, g = 0.0, b = 0.0;
      for (int i = 0; i < 16; i++) {
        vec2 o = POISSON[i] * radius;
        r += cov(p + o * 1.15); g += cov(p + o); b += cov(p + o * 0.85);
      }
      r /= 16.0; g /= 16.0; b /= 16.0;
      float sharp = cov(p);
      float k = smoothstep(0.0, 0.6, radius);
      vec4 blurred = splitRGB(r, g, b);
      vec4 plain = col(uInk, sharp);
      vec4 focused = col(mix(uInk, uAccent, fade(30.0, 0.0, dist) * uHover * 0.6), sharp);
      outColor = mix(focused, blurred, k);
    }`,
  },

  film: {
    frag: `void main() {
      vec2 p = vUv * uSize;
      float d = sdf(p);
      float a = cov(p);
      vec3 n = bevelNormal(p, uFont * 0.09, uFont * 0.12);
      vec3 V = normalize(vec3((uMouse - p) / uSize.x * 0.9, 1.0));
      float cosT = clamp(dot(n, V), 0.0, 1.0);
      float thickness = 360.0 + 240.0 * (fbm(p * 0.018 + uTime * 0.08) * 0.5 + 0.5) + 180.0 * (1.0 - cosT);
      vec3 lambda = vec3(650.0, 532.0, 450.0);
      vec3 film = 0.5 + 0.5 * cos(6.28318 * 2.0 * 1.33 * thickness * cosT / lambda);
      float scan = 0.88 + 0.12 * sin(p.y * 1.9 + uTime * 6.0);
      float sweep = mod(uTime * uSize.x * 0.7, uSize.x * 2.2) - uSize.x * 0.4;
      float glint = fade(7.0, 0.0, abs(p.x + p.y * 0.6 - sweep));
      vec3 holo = film * scan * 1.05 + glint * 0.8;
      float halo = exp(-max(d, 0.0) / 3.5) * 0.45 * uHover * (1.0 - a);
      outColor = over(col(mix(uInk, holo, uHover), a), col(film, halo));
    }`,
  },
}
