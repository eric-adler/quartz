// Hover lab (flag: hover-lab): 25 shader effects on link hovers, all drawn on one overlay canvas.
//
// Each hovered link becomes an "instance": its text is rasterised (with distance fields) exactly
// where it sits, the DOM text is hidden, and the effect's shader draws the quad around it while the
// hover eases in and out. Effects render plain text at rest, so the hand-over is invisible.
import {
  QUAD_VERTEX,
  createContext,
  createProgram,
  createQuad,
  createTarget,
  createTexture,
  fit,
  rasterizeText,
  setUniforms,
  themeColors,
} from "./gl.js"
import { FRAGMENT_HEADER, effects } from "./effects.js"

const DEFAULT_MARGIN = [0.6, 0.8] // × font size, around the text
const RATE_IN = 5
const RATE_OUT = 3
const TOUCH_HOLD_MS = 1800

const PARTICLE_VERTEX = `#version 300 es
in vec2 aPos;
in float aSeed;
uniform vec4 uRect;
uniform vec2 uView;
uniform vec2 uMouse;
uniform float uHover, uTime, uFont, uDpr;
out float vMove;
void main() {
  vec2 p = aPos;
  vec2 d = p - uMouse;
  float r = length(d);
  float push = uHover * uFont * 1.7 * exp(-r * r / (uFont * uFont * 1.6));
  vec2 dir = r > 0.01 ? d / r : vec2(0.0, 1.0);
  vec2 swirl = vec2(-dir.y, dir.x) * (aSeed - 0.5) * 1.4;
  vec2 jitter = vec2(sin(uTime * 2.3 + aSeed * 40.0), cos(uTime * 1.9 + aSeed * 31.0)) * uHover * 1.2;
  p += (dir + swirl) * push + jitter;
  vMove = clamp(push / (uFont * 0.7), 0.0, 1.0);
  vec2 clip = (uRect.xy + p) / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = (1.6 + vMove * 1.4) * uDpr;
}`

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float vMove;
out vec4 outColor;
uniform vec3 uInk, uAccent;
uniform float uHover;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.25, d) * smoothstep(0.0, 0.35, uHover);
  vec3 c = mix(uInk, uAccent, vMove);
  outColor = vec4(c * a, a);
}`

// simulation passes draw full-target quads without the y flip, so state textures stay upright
const SIM_VERTEX = `#version 300 es
in vec2 aCorner;
out vec2 vUv;
void main() { vUv = aCorner; gl_Position = vec4(aCorner * 2.0 - 1.0, 0.0, 1.0); }`

const RD_INIT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uText;
void main() {
  float c = texture(uText, vUv).r;
  outColor = vec4(1.0, step(0.5, c), 0.0, 1.0);
}`

const RD_STEP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uFeed, uKill;
vec2 s(vec2 o) { return texture(uState, vUv + o * uTexel).rg; }
void main() {
  vec2 c = s(vec2(0.0));
  vec2 lap = -c
    + 0.2 * (s(vec2(1, 0)) + s(vec2(-1, 0)) + s(vec2(0, 1)) + s(vec2(0, -1)))
    + 0.05 * (s(vec2(1, 1)) + s(vec2(-1, 1)) + s(vec2(1, -1)) + s(vec2(-1, -1)));
  float reaction = c.x * c.y * c.y;
  float a = c.x + (1.0 * lap.x - reaction + uFeed * (1.0 - c.x));
  float b = c.y + (0.5 * lap.y + reaction - (uKill + uFeed) * c.y);
  outColor = vec4(clamp(a, 0.0, 1.0), clamp(b, 0.0, 1.0), 0.0, 1.0);
}`

const ASCII_RAMP = " .,:;-=+*#%@"

// ——— per-effect behaviour that lives in JavaScript ———

const behaviours = {
  particles: {
    setup(inst, env) {
      const { gl } = env
      const { regularAlpha, pixelWidth, pixelHeight } = inst.raster
      const step = Math.max(1, Math.round(1.25 * env.dpr))
      const data = []
      for (let y = 0; y < pixelHeight; y += step) {
        for (let x = 0; x < pixelWidth; x += step) {
          if (regularAlpha[y * pixelWidth + x] > 110)
            data.push(x / env.dpr, y / env.dpr, Math.random())
        }
      }
      inst.count = data.length / 3
      inst.vao = gl.createVertexArray()
      gl.bindVertexArray(inst.vao)
      inst.buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, inst.buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
      const program = env.program("particles", PARTICLE_VERTEX, PARTICLE_FRAGMENT)
      const pos = gl.getAttribLocation(program.program, "aPos")
      const seed = gl.getAttribLocation(program.program, "aSeed")
      gl.enableVertexAttribArray(pos)
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 12, 0)
      gl.enableVertexAttribArray(seed)
      gl.vertexAttribPointer(seed, 1, gl.FLOAT, false, 12, 8)
      gl.bindVertexArray(null)
    },
    after(inst, env, uniforms) {
      const { gl } = env
      const program = env.program("particles", PARTICLE_VERTEX, PARTICLE_FRAGMENT)
      gl.useProgram(program.program)
      setUniforms(gl, program, { ...uniforms, uDpr: env.dpr })
      gl.bindVertexArray(inst.vao)
      gl.drawArrays(gl.POINTS, 0, inst.count)
    },
    dispose(inst, { gl }) {
      gl.deleteBuffer(inst.buffer)
      gl.deleteVertexArray(inst.vao)
    },
  },

  dangle: {
    setup(inst) {
      inst.letters = inst.raster.letters.slice(0, 24)
      inst.angle = new Float32Array(24)
      inst.spin = new Float32Array(24)
    },
    update(inst, dt) {
      const [mx, my] = inst.mouse
      const band = Math.abs(my - inst.textMidY) < inst.font * 0.8
      inst.letters.forEach(([x0, x1], i) => {
        const near = band && mx > x0 - 6 && mx < x1 + 6 && inst.target > 0
        const torque = near ? inst.vel[0] * 0.0022 : 0
        const accel = -55 * inst.angle[i] - 3.2 * inst.spin[i] + torque * 60
        inst.spin[i] += accel * dt
        inst.angle[i] = Math.max(-1.3, Math.min(1.3, inst.angle[i] + inst.spin[i] * dt))
      })
    },
    uniforms: (inst) => ({
      uLetters: inst.letters.flat(),
      uAngle: inst.angle,
      uCount: inst.letters.length,
      uPivotY: inst.baseline - inst.font * 0.72,
    }),
    settled: (inst) =>
      inst.angle.every((a, i) => Math.abs(a) < 0.003 && Math.abs(inst.spin[i]) < 0.02),
  },

  rope: {
    setup(inst) {
      const n = 28
      const y = inst.baseline + inst.font * 0.16
      const x0 = inst.margin[0]
      const x1 = inst.margin[0] + inst.textWidth
      inst.rest = y
      inst.points = Array.from({ length: n }, (_, i) => [x0 + ((x1 - x0) * i) / (n - 1), y])
      inst.prev = inst.points.map((p) => [...p])
      inst.segment = (x1 - x0) / (n - 1)
      inst.energy = 0
    },
    update(inst, dt) {
      const { points, prev } = inst
      const last = points.length - 1
      const [mx, my] = inst.mouse
      const [vx, vy] = inst.vel
      for (let i = 1; i < last; i++) {
        const [x, y] = points[i]
        let nx = x + (x - prev[i][0]) * 0.985
        let ny = y + (y - prev[i][1]) * 0.985
        if (inst.target > 0 && Math.hypot(x - mx, y - my) < 14) {
          nx += vx * dt * 0.55
          ny += vy * dt * 0.55
        }
        prev[i] = [x, y]
        points[i] = [nx, ny]
      }
      for (let k = 0; k < 10; k++) {
        for (let i = 0; i < last; i++) {
          const [ax, ay] = points[i]
          const [bx, by] = points[i + 1]
          const dx = bx - ax
          const dy = by - ay
          const d = Math.hypot(dx, dy) || 1
          const diff = (d - inst.segment) / d / 2
          if (i > 0) points[i] = [ax + dx * diff, ay + dy * diff]
          if (i + 1 < last) points[i + 1] = [bx - dx * diff, by - dy * diff]
        }
      }
      inst.energy =
        points.reduce((sum, [, y]) => sum + Math.abs(y - inst.rest), 0) / (points.length * 3)
    },
    uniforms: (inst) => ({ uRope: inst.points.flat(), uEnergy: inst.energy }),
    settled: (inst) => inst.energy < 0.02,
  },

  elastic: {
    setup(inst) {
      inst.anchor = [...inst.mouse]
      inst.pull = [0, 0]
      inst.pullVel = [0, 0]
    },
    update(inst, dt) {
      const limit = inst.font * 1.3
      let tx = 0
      let ty = 0
      if (inst.target > 0) {
        tx = inst.mouse[0] - inst.anchor[0]
        ty = inst.mouse[1] - inst.anchor[1]
        const len = Math.hypot(tx, ty)
        if (len > limit) {
          tx *= limit / len
          ty *= limit / len
        }
      }
      for (const [axis, target] of [
        [0, tx],
        [1, ty],
      ]) {
        const accel = 140 * (target - inst.pull[axis]) - 7 * inst.pullVel[axis]
        inst.pullVel[axis] += accel * dt
        inst.pull[axis] += inst.pullVel[axis] * dt
      }
    },
    uniforms: (inst) => ({ uAnchor: inst.anchor, uPull: inst.pull }),
    settled: (inst) => Math.hypot(...inst.pull) < 0.3 && Math.hypot(...inst.pullVel) < 5,
  },

  ascii: {
    uniforms: (inst, env) => ({ uAtlas: env.asciiAtlas() }),
  },

  coral: {
    setup(inst, env) {
      const { gl } = env
      const w = Math.max(8, Math.round(inst.quad[2] / 2))
      const h = Math.max(8, Math.round(inst.quad[3] / 2))
      inst.state = [createTarget(gl, w, h), createTarget(gl, w, h)]
      const init = env.program("rd-init", SIM_VERTEX, RD_INIT)
      gl.bindFramebuffer(gl.FRAMEBUFFER, inst.state[0].framebuffer)
      gl.viewport(0, 0, w, h)
      gl.disable(gl.BLEND)
      gl.useProgram(init.program)
      setUniforms(gl, init, { uText: inst.texture })
      env.quad.draw()
      gl.enable(gl.BLEND)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    },
    update(inst, dt, env) {
      if (inst.target === 0 && inst.h < 0.4) return
      const { gl } = env
      const step = env.program("rd-step", SIM_VERTEX, RD_STEP)
      const [a] = inst.state
      gl.disable(gl.BLEND)
      gl.useProgram(step.program)
      gl.viewport(0, 0, a.width, a.height)
      for (let i = 0; i < 14; i++) {
        const [from, to] = inst.state
        gl.bindFramebuffer(gl.FRAMEBUFFER, to.framebuffer)
        setUniforms(gl, step, {
          uState: from.texture,
          uTexel: [1 / from.width, 1 / from.height],
          uFeed: 0.0545,
          uKill: 0.062,
        })
        env.quad.draw()
        inst.state.reverse()
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.enable(gl.BLEND)
      env.restoreViewport()
    },
    uniforms: (inst) => ({ uState: inst.state[0].texture }),
    dispose(inst) {
      inst.state.forEach((target) => target.dispose())
    },
  },
}

export function mount(article) {
  const sc = window.showcase
  const grid = article.querySelector(".sc-hoverlab")
  if (!grid) return () => {}
  const links = [...grid.querySelectorAll(".sc-fx-link")]

  const canvas = document.createElement("canvas")
  canvas.className = "sc-fx-canvas"
  canvas.setAttribute("aria-hidden", "true")
  document.body.append(canvas)
  const gl = createContext(canvas)
  if (!gl) {
    grid.classList.add("sc-fx-nogl")
    canvas.remove()
    return () => {}
  }
  grid.classList.add("sc-fx-ready")

  const quad = createQuad(gl)
  const programs = new Map()
  let colors = themeColors()
  let dpr = fit(canvas)
  let atlas = null

  const env = {
    gl,
    quad,
    get dpr() {
      return dpr
    },
    program(key, vertex, fragment) {
      if (!programs.has(key)) programs.set(key, createProgram(gl, vertex, fragment))
      return programs.get(key)
    },
    restoreViewport: () => gl.viewport(0, 0, canvas.width, canvas.height),
    asciiAtlas() {
      if (atlas) return atlas
      const cell = 32
      const c = document.createElement("canvas")
      c.width = cell * ASCII_RAMP.length
      c.height = Math.round(cell * 1.6)
      const ctx = c.getContext("2d")
      ctx.fillStyle = "#fff"
      ctx.font = `700 ${cell * 1.05}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ;[...ASCII_RAMP].forEach((ch, i) => ctx.fillText(ch, i * cell + cell / 2, c.height / 2))
      atlas = createTexture(gl, c)
      return atlas
    },
  }

  const effectProgram = (id) =>
    env.program(`fx:${id}`, QUAD_VERTEX, `${FRAGMENT_HEADER}\n${effects[id].frag}`)

  // ——— text rasters, cached per link ———
  const rasters = new Map()
  const measure = document.createElement("canvas").getContext("2d")

  function rasterFor(link, fx) {
    const style = getComputedStyle(link)
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const fontPx = parseFloat(style.fontSize)
    const range = document.createRange()
    range.selectNodeContents(link)
    const rect = range.getBoundingClientRect()
    const [mxf, myf] = effects[fx].margin ?? DEFAULT_MARGIN
    const margin = [Math.round(fontPx * mxf), Math.round(fontPx * myf)]
    const key = `${fx}|${dpr}|${Math.round(rect.width)}|${font}`
    const cached = rasters.get(link)
    if (cached?.key === key) return cached

    measure.font = font
    const metrics = measure.measureText(link.textContent)
    const ascent = metrics.fontBoundingBoxAscent ?? fontPx * 0.8
    const descent = metrics.fontBoundingBoxDescent ?? fontPx * 0.2
    const baselineOffset = (rect.height - (ascent + descent)) / 2 + ascent
    const size = [rect.width + margin[0] * 2, rect.height + margin[1] * 2]
    const sdfRange = Math.max(10, fontPx * 0.5)
    const raster = rasterizeText({
      text: link.textContent,
      font,
      boldFont: `${style.fontStyle} 900 ${style.fontSize} ${style.fontFamily}`,
      letterSpacing: style.letterSpacing === "normal" ? "0px" : style.letterSpacing,
      width: size[0],
      height: size[1],
      originX: margin[0],
      baseline: margin[1] + baselineOffset,
      dpr,
      range: sdfRange,
    })
    if (cached) gl.deleteTexture(cached.texture)
    const entry = {
      key,
      raster,
      texture: createTexture(gl, raster.canvas),
      margin,
      size,
      fontPx,
      sdfRange,
      baseline: margin[1] + baselineOffset,
      textWidth: rect.width,
      textMidY: margin[1] + rect.height / 2,
    }
    rasters.set(link, entry)
    return entry
  }

  // ——— pointer ———
  const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: performance.now() }
  const onMove = (event) => {
    const now = performance.now()
    const dt = Math.max(1, now - pointer.t) / 1000
    pointer.vx = pointer.vx * 0.7 + ((event.clientX - pointer.x) / dt) * 0.3
    pointer.vy = pointer.vy * 0.7 + ((event.clientY - pointer.y) / dt) * 0.3
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.t = now
  }
  window.addEventListener("pointermove", onMove, { passive: true })

  // ——— instances ———
  const instances = new Map()
  let raf = 0
  let last = performance.now()

  function start(link) {
    const fx = link.closest(".sc-fx-card")?.dataset.fx
    if (!fx || !effects[fx]) return
    const existing = instances.get(link)
    if (existing) {
      existing.target = 1
      return
    }
    let entry
    try {
      entry = rasterFor(link, fx)
    } catch (error) {
      console.error(error)
      return
    }
    const inst = {
      link,
      fx,
      behaviour: behaviours[fx] ?? {},
      raster: entry.raster,
      texture: entry.texture,
      margin: entry.margin,
      size: entry.size,
      font: entry.fontPx,
      range: entry.sdfRange,
      baseline: entry.baseline,
      textWidth: entry.textWidth,
      textMidY: entry.textMidY,
      start: performance.now(),
      h: 0,
      target: 1,
      mouse: [0, 0],
      vel: [0, 0],
      quad: [0, 0, entry.size[0], entry.size[1]],
      live: false,
    }
    locate(inst)
    try {
      inst.behaviour.setup?.(inst, env)
      effectProgram(fx)
    } catch (error) {
      console.error(`[hover lab] ${fx}:`, error)
      return
    }
    instances.set(link, inst)
    if (!raf) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  function stop(link) {
    const inst = instances.get(link)
    if (inst) inst.target = 0
  }

  function locate(inst) {
    const range = document.createRange()
    range.selectNodeContents(inst.link)
    const rect = range.getBoundingClientRect()
    inst.quad = [rect.left - inst.margin[0], rect.top - inst.margin[1], inst.size[0], inst.size[1]]
    inst.mouse = [pointer.x - inst.quad[0], pointer.y - inst.quad[1]]
    if (inst.keyboard) inst.mouse = [inst.size[0] / 2, inst.size[1] / 2]
    inst.vel = [pointer.vx, pointer.vy]
  }

  function finish(inst) {
    inst.behaviour.dispose?.(inst, env)
    inst.link.classList.remove("sc-fx-live")
    instances.delete(inst.link)
  }

  function frame(now) {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    dpr = fit(canvas)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    pointer.vx *= Math.exp(-dt * 5)
    pointer.vy *= Math.exp(-dt * 5)

    for (const inst of [...instances.values()]) {
      const rate = inst.target ? RATE_IN : RATE_OUT
      inst.h += (inst.target - inst.h) * (1 - Math.exp(-dt * rate))
      locate(inst)
      inst.behaviour.update?.(inst, dt, env)

      const eased = inst.h * inst.h * (3 - 2 * inst.h)
      const uniforms = {
        uRect: inst.quad,
        uView: [canvas.clientWidth, canvas.clientHeight],
        uText: inst.texture,
        uSize: inst.size,
        uMouse: inst.mouse,
        uVel: inst.vel,
        uHover: eased,
        uTime: (now - inst.start) / 1000,
        uFont: inst.font,
        uRange: inst.range,
        uInk: colors.ink,
        uAccent: colors.accent,
        uAccent2: colors.accent2,
        uBg: colors.bg,
        uDark: colors.dark ? 1 : 0,
        ...(inst.behaviour.uniforms?.(inst, env) ?? {}),
      }
      const onScreen =
        inst.quad[0] < canvas.clientWidth &&
        inst.quad[1] < canvas.clientHeight &&
        inst.quad[0] + inst.quad[2] > 0 &&
        inst.quad[1] + inst.quad[3] > 0
      if (onScreen) {
        const program = effectProgram(inst.fx)
        gl.useProgram(program.program)
        setUniforms(gl, program, uniforms)
        quad.draw()
        inst.behaviour.after?.(inst, env, uniforms)
      }
      // hide the DOM text only once the canvas has drawn it, in the same frame
      if (!inst.live) {
        inst.link.classList.add("sc-fx-live")
        inst.live = true
      }
      const settled = inst.behaviour.settled?.(inst) ?? true
      // eased < 0.002 is indistinguishable from the plain text
      if (inst.target === 0 && eased < 0.002 && settled) finish(inst)
    }
    if (instances.size) raf = requestAnimationFrame(frame)
  }

  // ——— events ———
  const touchTimers = new Map()
  const armed = new Set()
  const onEnter = (event) => {
    const link = event.target.closest?.(".sc-fx-link")
    if (!link || event.pointerType === "touch") return
    start(link)
  }
  const onLeave = (event) => {
    const link = event.target.closest?.(".sc-fx-link")
    if (link && !link.contains(event.relatedTarget)) stop(link)
  }
  const onFocus = (event) => {
    const link = event.target.closest?.(".sc-fx-link")
    if (!link) return
    start(link)
    const inst = instances.get(link)
    if (inst) inst.keyboard = true
  }
  const onBlur = (event) => {
    const link = event.target.closest?.(".sc-fx-link")
    if (link) stop(link)
  }
  // touch: the first tap plays the effect, a second tap follows the link
  const onClick = (event) => {
    const link = event.target.closest?.(".sc-fx-link")
    if (!link || event.pointerType !== "touch" || armed.has(link)) return
    event.preventDefault()
    armed.add(link)
    const rect = link.getBoundingClientRect()
    pointer.x = event.clientX || rect.left + rect.width / 2
    pointer.y = event.clientY || rect.top + rect.height / 2
    start(link)
    clearTimeout(touchTimers.get(link))
    touchTimers.set(
      link,
      setTimeout(() => {
        stop(link)
        armed.delete(link)
      }, TOUCH_HOLD_MS),
    )
  }
  grid.addEventListener("pointerover", onEnter)
  grid.addEventListener("pointerout", onLeave)
  grid.addEventListener("focusin", onFocus)
  grid.addEventListener("focusout", onBlur)
  grid.addEventListener("click", onClick)

  const themeObserver = new MutationObserver(() => {
    colors = themeColors()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["saved-theme"],
  })

  // warm the caches while the reader looks around, so the first hover is instant
  let warmTimer = 0
  const queue = [...links]
  const warm = () => {
    const link = queue.shift()
    if (!link) return
    const fx = link.closest(".sc-fx-card")?.dataset.fx
    try {
      if (fx && effects[fx]) {
        rasterFor(link, fx)
        effectProgram(fx)
      }
    } catch (error) {
      console.error(`[hover lab] ${fx}:`, error)
    }
    warmTimer = (window.requestIdleCallback ?? setTimeout)(warm)
  }
  document.fonts.ready.then(() => {
    warmTimer = (window.requestIdleCallback ?? setTimeout)(warm)
  })

  return () => {
    cancelAnimationFrame(raf)
    ;(window.cancelIdleCallback ?? clearTimeout)(warmTimer)
    touchTimers.forEach((timer) => clearTimeout(timer))
    window.removeEventListener("pointermove", onMove)
    themeObserver.disconnect()
    for (const inst of instances.values()) finish(inst)
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    canvas.remove()
  }
}
