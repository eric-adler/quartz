// Shader showcase (flag: shaders): full-screen scenes on one background canvas behind the page.
// Cursor- and scroll-reactive, theme-aware, paused while the tab is hidden, static with reduced motion.
import { GLSL_NOISE, createContext, createProgram, setUniforms, themeColors } from "./gl.js"

const VERTEX = `#version 300 es
in vec2 aCorner;
void main() { gl_Position = vec4(aCorner * 2.0 - 1.0, 0.0, 1.0); }`

const HEADER = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;        // drawing buffer size, px
uniform vec2 uMouse;      // px, origin bottom left
uniform float uTime, uScroll, uStir, uDark;
uniform vec3 uBg, uInk, uAccent, uAccent2;
uniform vec3 uDrops[10];  // ripple sources: x, y (px), start time
${GLSL_NOISE}
vec2 frame(vec2 px) { return (px - 0.5 * uRes) / uRes.y; }
`

const scenes = {
  crema: {
    name: "Crema",
    caption: "Domain-warped noise, folded twice into itself. Move to stir.",
    scale: 0.5,
    frag: `void main() {
      vec2 uv = frame(gl_FragCoord.xy);
      vec2 m = frame(uMouse);
      float t = uTime * 0.035 + uScroll * 1.2;
      vec2 d = uv - m;
      float r = length(d);
      uv = m + rot(uStir * exp(-r * r * 5.0) * 2.6) * d;
      uv *= 0.8 + uScroll * 0.3;
      vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(5.2, 1.3) - t));
      vec2 w = vec2(fbm(uv + 1.6 * q + vec2(1.7, 9.2) + t * 1.2), fbm(uv + 1.6 * q + vec2(8.3, 2.8) - t));
      float f = fbm(uv + 1.8 * w);
      vec3 espresso = vec3(0.16, 0.08, 0.04);
      vec3 caramel = vec3(0.58, 0.34, 0.16);
      vec3 cream = vec3(0.93, 0.83, 0.67);
      vec3 c = mix(espresso, caramel, smoothstep(-0.6, 0.25, f));
      c = mix(c, cream, smoothstep(0.2, 0.75, f + 0.25 * length(w)));
      // fine golden lines where the foam folds over itself
      c = mix(c, vec3(0.78, 0.52, 0.27), 0.3 * fade(0.06, 0.0, abs(f - 0.12)));
      // soft light from the foam's slope
      float e = 0.01;
      float slope = fbm(uv + 1.8 * w + vec2(e, e)) - f;
      c *= 0.9 + clamp(slope * 6.0, -0.15, 0.25);
      c *= 1.0 - 0.3 * dot(uv * 0.7, uv * 0.7);
      outColor = vec4(c, 1.0);
    }`,
  },

  ripples: {
    name: "Ripples",
    caption:
      "Analytic waves summed into a height field, lit with Fresnel reflections. Click to drop.",
    scale: 0.75,
    frag: `float surface(vec2 p) {
      float h = 0.0;
      for (int i = 0; i < 10; i++) {
        vec3 drop = uDrops[i];
        float age = uTime - drop.z;
        if (drop.z <= 0.0 || age < 0.0 || age > 6.0) continue;
        float d = length(p - frame(drop.xy));
        float front = age * 0.45;
        float env = fade(front, front - 0.25, d) * exp(-age * 0.7) * exp(-d * 1.5);
        h += sin(d * 48.0 - age * 22.0) * env * 0.012;
      }
      h += snoise(p * 3.0 + uTime * 0.05) * 0.0005 + snoise(p * 9.0 - uTime * 0.08) * 0.00012;
      return h;
    }
    void main() {
      vec2 p = frame(gl_FragCoord.xy);
      float e = 1.5 / uRes.y;
      float h = surface(p);
      vec3 n = normalize(vec3(-(surface(p + vec2(e, 0.0)) - h) / e, -(surface(p + vec2(0.0, e)) - h) / e, 1.0));
      vec3 view = normalize(vec3(-p * 0.25, 1.0));
      float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, view), 0.0), 5.0);
      vec3 r = reflect(-view, n);
      // a soft window light and a warm room, reflected in the coffee
      float window = fade(0.35, 0.3, abs(r.x - 0.25)) * fade(0.25, 0.2, abs(r.y - 0.35));
      vec3 sky = mix(vec3(0.25, 0.18, 0.12), vec3(0.95, 0.9, 0.82), smoothstep(-0.2, 0.8, r.y));
      vec3 coffee = vec3(0.09, 0.045, 0.02) * (1.0 + h * 25.0);
      vec3 c = mix(coffee, sky, fresnel) + window * 0.9 * fresnel * 3.0;
      float cup = length(p);
      vec3 porcelain = mix(uBg, vec3(0.97, 0.96, 0.94), 0.6);
      c = mix(c, porcelain * (0.9 + 0.1 * cos(atan(p.y, p.x) * 2.0)), smoothstep(0.92, 0.95, cup / 0.55));
      c = mix(c, uBg, smoothstep(1.1, 1.15, cup / 0.55));
      outColor = vec4(c, 1.0);
    }`,
  },

  steam: {
    name: "Steam",
    caption:
      "Layers of curl-noise wisps rising, pushed aside by the cursor. Scrolling speeds the rise.",
    scale: 0.5,
    frag: `void main() {
      vec2 uv = frame(gl_FragCoord.xy);
      vec2 m = frame(uMouse);
      vec2 away = uv - m;
      uv += away * exp(-dot(away, away) * 8.0) * 0.5;  // a smooth bulge around the cursor
      float t = uTime * (0.12 + uScroll * 0.3);
      float density = 0.0;
      for (int i = 0; i < 4; i++) {
        float layer = float(i);
        vec2 p = uv * (1.2 + layer * 0.35) + vec2(layer * 7.3, -t * (1.0 + layer * 0.25));
        p += curl(p * 0.6 + t * 0.2) * 0.35;
        float w = fbm(p * vec2(1.6, 0.8));
        float spread = (uv.x + sin(uv.y * 2.0 + layer + t) * 0.15) * (2.2 + layer * 0.4);
        float column = exp(-spread * spread);
        density += smoothstep(0.0, 0.8, w) * column * (0.55 - layer * 0.1);
      }
      density *= smoothstep(-0.65, 0.1, uv.y);
      vec3 steam = mix(uInk, uAccent2, 0.3);
      vec3 c = mix(uBg, steam, clamp(density, 0.0, 1.0) * 0.55);
      outColor = vec4(c, 1.0);
    }`,
  },

  beans: {
    name: "Beans",
    caption: "Signed-distance coffee beans with domed normals and a crease, lit from the cursor.",
    scale: 0.75,
    frag: `vec4 bean(vec2 p, float cell, float layer, out float shade) {
      vec2 id = floor(p / cell);
      vec4 best = vec4(0.0); float top = -1.0; shade = 0.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 c = id + vec2(x, y);
        vec2 r = hash22(c + layer * 31.0);
        vec2 centre = (c + 0.5 + (r - 0.5) * 0.6) * cell;
        float size = cell * (0.32 + 0.1 * r.x);
        vec2 q = rot(r.y * 6.2831 + uTime * 0.05 * (r.x - 0.5)) * (p - centre);
        q /= vec2(size, size * 0.72);
        float d = length(q);
        if (d < 1.0 && r.x > top) {
          float dome = sqrt(1.0 - d * d);
          float crease = fade(0.08, 0.0, abs(q.x - 0.18 * sin(q.y * 2.6))) * dome;
          top = r.x;
          shade = hash21(c * 1.37 + layer);
          best = vec4(q, dome, crease);
        }
      }
      return best;
    }
    void main() {
      vec2 uv = frame(gl_FragCoord.xy);
      vec2 m = frame(uMouse);
      vec3 c = mix(uBg, vec3(0.08, 0.05, 0.03), 0.92);
      for (int i = 2; i >= 0; i--) {
        float layer = float(i);
        float depth = 1.0 - layer * 0.28;
        vec2 p = uv + vec2(0.0, uScroll * (0.6 + layer * 0.5)) + (m * 0.04) * (layer + 1.0);
        float shade;
        vec4 b = bean(p, 0.24 - layer * 0.04, layer, shade);
        if (b.z <= 0.0) continue;
        vec3 n = normalize(vec3(b.xy * 0.9, b.z));
        vec3 L = normalize(vec3(m - uv, 0.6));
        float diff = max(dot(n, L), 0.0);
        float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
        vec3 roast = mix(vec3(0.32, 0.17, 0.08), vec3(0.18, 0.09, 0.04), shade);
        vec3 bc = roast * (0.25 + 0.95 * diff) + spec * 0.35;
        bc *= 1.0 - b.w * 0.7;
        bc *= depth;
        c = mix(c, bc, smoothstep(0.0, 0.08, b.z));
      }
      c *= 1.0 - 0.3 * dot(uv, uv);
      outColor = vec4(c, 1.0);
    }`,
  },
}

export function mount(article) {
  const sc = window.showcase
  const controlsMount = article.querySelector('.sc-mount[data-widget="shader-stage"]')
  const canvas = document.createElement("canvas")
  canvas.className = "sc-shader-canvas"
  canvas.setAttribute("aria-hidden", "true")
  document.body.prepend(canvas)
  const gl = createContext(canvas)
  if (!gl) {
    canvas.remove()
    if (controlsMount)
      controlsMount.textContent = "This browser can't run WebGL2, so the scenes can't be shown."
    return () => {}
  }
  gl.disable(gl.BLEND)
  document.documentElement.classList.add("sc-shader-page")

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const programs = new Map()
  const program = (id) => {
    if (!programs.has(id))
      programs.set(id, createProgram(gl, VERTEX, `${HEADER}\n${scenes[id].frag}`))
    return programs.get(id)
  }

  const slug = sc.slug()
  let current = sc.memory.get(slug, "scene") in scenes ? sc.memory.get(slug, "scene") : "crema"
  let colors = themeColors()
  const reduced = sc.reducedMotion()
  const start = performance.now()
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0 }
  let stir = 0
  const drops = Array.from({ length: 10 }, () => [0, 0, -1])
  let dropIndex = 0
  let lastDrop = 0
  let raf = 0

  const now = () => (reduced ? 12 : (performance.now() - start) / 1000)
  const addDrop = (x, y) => {
    drops[dropIndex] = [x, y, now()]
    dropIndex = (dropIndex + 1) % drops.length
  }

  // ——— controls ———
  const bar = document.createElement("div")
  bar.className = "sc-shader-bar"
  bar.innerHTML = `
    <div class="sc-shader-scenes" role="radiogroup" aria-label="Scene">
      ${Object.entries(scenes)
        .map(
          ([id, s]) => `<button type="button" role="radio" data-scene="${id}">${s.name}</button>`,
        )
        .join("")}
    </div>
    <button type="button" class="sc-shader-immersive" aria-pressed="false">Immersive</button>
    <p class="sc-shader-caption" aria-live="polite"></p>`
  if (controlsMount) controlsMount.replaceChildren(bar)
  else article.append(bar)

  const select = (id) => {
    current = id
    sc.memory.set(slug, "scene", id)
    bar
      .querySelectorAll("[data-scene]")
      .forEach((b) => b.setAttribute("aria-checked", String(b.dataset.scene === id)))
    bar.querySelector(".sc-shader-caption").textContent = scenes[id].caption
    if (id === "ripples") addDrop(canvas.width / 2, canvas.height / 2)
    request()
  }
  const setImmersive = (on) => {
    document.documentElement.classList.toggle("sc-immersive", on)
    bar.querySelector(".sc-shader-immersive").setAttribute("aria-pressed", String(on))
  }
  bar.addEventListener("click", (event) => {
    const scene = event.target.closest("[data-scene]")
    if (scene) return select(scene.dataset.scene)
    if (event.target.closest(".sc-shader-immersive")) {
      setImmersive(!document.documentElement.classList.contains("sc-immersive"))
    }
  })

  // ——— rendering ———
  function render() {
    raf = 0
    const scene = scenes[current]
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * scene.scale
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    stir *= 0.97
    const scrollable = document.documentElement.scrollHeight - innerHeight
    let prog
    try {
      prog = program(current)
    } catch (error) {
      console.error(error)
      return
    }
    gl.useProgram(prog.program)
    setUniforms(gl, prog, {
      uRes: [w, h],
      uMouse: [pointer.x * dpr, (canvas.clientHeight - pointer.y) * dpr],
      uTime: now(),
      uScroll: scrollable > 0 ? scrollY / scrollable : 0,
      uStir: stir,
      uDark: colors.dark ? 1 : 0,
      uBg: colors.bg,
      uInk: colors.ink,
      uAccent: colors.accent,
      uAccent2: colors.accent2,
      uDrops: drops.flat(),
    })
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    if (!reduced && !document.hidden) request()
  }
  const request = () => {
    if (!raf) raf = requestAnimationFrame(render)
  }

  // ——— input ———
  const onMove = (event) => {
    pointer.vx = event.clientX - pointer.x
    pointer.vy = event.clientY - pointer.y
    pointer.x = event.clientX
    pointer.y = event.clientY
    stir = Math.min(1.6, stir + Math.hypot(pointer.vx, pointer.vy) * 0.004)
    const t = performance.now()
    if (current === "ripples" && t - lastDrop > 140 && Math.hypot(pointer.vx, pointer.vy) > 4) {
      lastDrop = t
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * scenes.ripples.scale
      addDrop(pointer.x * dpr, (canvas.clientHeight - pointer.y) * dpr)
    }
    if (reduced) request()
  }
  const onDown = (event) => {
    if (current !== "ripples" || event.target.closest("a, button, input, select")) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * scenes.ripples.scale
    addDrop(event.clientX * dpr, (canvas.clientHeight - event.clientY) * dpr)
    request()
  }
  const onKey = (event) => {
    if (event.key === "Escape") setImmersive(false)
  }
  const onVisibility = () => !document.hidden && request()
  const themeObserver = new MutationObserver(() => {
    colors = themeColors()
    request()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["saved-theme"],
  })
  window.addEventListener("pointermove", onMove, { passive: true })
  window.addEventListener("pointerdown", onDown)
  window.addEventListener("keydown", onKey)
  window.addEventListener("resize", request)
  window.addEventListener("scroll", request, { passive: true })
  document.addEventListener("visibilitychange", onVisibility)

  select(current)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerdown", onDown)
    window.removeEventListener("keydown", onKey)
    window.removeEventListener("resize", request)
    window.removeEventListener("scroll", request)
    document.removeEventListener("visibilitychange", onVisibility)
    themeObserver.disconnect()
    document.documentElement.classList.remove("sc-shader-page", "sc-immersive")
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    canvas.remove()
  }
}
