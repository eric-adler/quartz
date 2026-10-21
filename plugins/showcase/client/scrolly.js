// Scrollytelling (flag: scrolly). A sticky figure beside a column of `[!step|state]` callouts; the
// step crossing the middle of the screen sets the figure's state. Figures register by name.
const sc = window.showcase
const SVG = "http://www.w3.org/2000/svg"

sc.figures ??= {}

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  parent?.append(node)
  return node
}

/**
 * Extraction over time: acids, sugars and bitter compounds dissolve at different speeds, so the
 * same brew passes through sour, sweet and bitter. States add layers; `finer`/`coarser` change the
 * pace of every curve.
 */
sc.figures.extraction = (container) => {
  const W = 520
  const H = 400
  const pad = { l: 44, r: 16, t: 40, b: 50 }
  const T = 1.6 // minutes-ish, unitless
  const zones = [
    { from: 0, to: 0.45, label: "sour", key: "sour" },
    { from: 0.45, to: 0.95, label: "sweet", key: "sweet" },
    { from: 0.95, to: T, label: "bitter", key: "bitter" },
  ]
  const curves = [
    { key: "acids", label: "Acids", tau: 0.12, labelAt: 0.82 },
    { key: "sugars", label: "Sugars", tau: 0.38, labelAt: 0.55 },
    { key: "bitter", label: "Bitter compounds", tau: 1.05, labelAt: 0.28 },
  ]
  const x = (t) => pad.l + (t / T) * (W - pad.l - pad.r)
  const y = (v) => H - pad.b - v * (H - pad.t - pad.b)

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "sc-fig sc-fig-extraction",
    role: "img",
  })
  svg.setAttribute(
    "aria-label",
    "Chart of how acids, sugars and bitter compounds dissolve over brewing time",
  )
  const zoneLayer = el("g", { class: "zones" }, svg)
  for (const zone of zones) {
    const g = el("g", { class: `zone ${zone.key}` }, zoneLayer)
    zone.rect = el("rect", { y: pad.t, height: H - pad.t - pad.b }, g)
    zone.text = el("text", { y: H - pad.b - 12, "text-anchor": "middle" }, g)
    zone.text.textContent = zone.label
  }

  const axes = el("g", { class: "axes" }, svg)
  el("line", { x1: pad.l, y1: H - pad.b, x2: W - pad.r, y2: H - pad.b }, axes)
  el("line", { x1: pad.l, y1: pad.t, x2: pad.l, y2: H - pad.b }, axes)
  el("text", { x: W - pad.r, y: H - pad.b + 40, "text-anchor": "end" }, axes).textContent =
    "Brewing time →"
  const yLabel = el("text", { x: -(H - pad.b), y: pad.l - 14, transform: "rotate(-90)" }, axes)
  yLabel.textContent = "How much has dissolved →"

  const curveLayer = el("g", { class: "curves" }, svg)
  const paths = curves.map((curve) => {
    const g = el("g", { class: `curve ${curve.key}` }, curveLayer)
    const path = el("path", { pathLength: 1 }, g)
    const label = el("text", { class: "curve-label" }, g)
    label.textContent = curve.label
    return { ...curve, g, path, label }
  })

  const cup = el("g", { class: "cup" }, svg)
  el("line", { y1: pad.t, y2: H - pad.b }, cup)
  const cupDot = el("circle", { r: 7 }, cup)
  const cupText = el("text", { "text-anchor": "middle" }, cup)

  const note = el("text", { class: "fig-note", x: pad.l, y: pad.t - 16 }, svg)
  container.append(svg)

  let pace = 1
  let target = 1
  let frame = 0
  let cupAt = null

  const draw = () => {
    // taste zones are stages of extraction, so they stretch and shrink with the pace too
    for (const zone of zones) {
      const from = Math.min(T, zone.from * pace)
      const to = zone.key === "bitter" ? T : Math.min(T, zone.to * pace)
      zone.rect.setAttribute("x", String(x(from)))
      zone.rect.setAttribute("width", String(Math.max(0, x(to) - x(from))))
      zone.text.setAttribute("x", String((x(from) + x(to)) / 2))
      zone.text.style.opacity = to - from < 0.12 ? "0" : ""
    }
    for (const curve of paths) {
      const points = []
      for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * T
        points.push(`${x(t).toFixed(1)},${y(1 - Math.exp(-t / (curve.tau * pace))).toFixed(1)}`)
      }
      curve.path.setAttribute("d", `M${points.join(" L")}`)
      // label each curve at its own height, so the labels never collide however fast the curves rise
      const at = Math.min(T * 0.8, -curve.tau * pace * Math.log(1 - curve.labelAt))
      curve.label.setAttribute("x", String(x(at) + 10))
      curve.label.setAttribute("y", String(y(curve.labelAt) + 5))
    }
    if (cupAt !== null) {
      // the same brew time lands in a different zone when the grind changes the pace
      const effective = cupAt / pace
      const taste = zones.find((z) => effective >= z.from && effective < z.to) ?? zones.at(-1)
      cup.setAttribute("transform", `translate(${x(cupAt)} 0)`)
      cupDot.setAttribute("cy", String(y(1 - Math.exp(-cupAt / (curves[1].tau * pace)))))
      cupText.setAttribute("y", String(H - pad.b + 20))
      cupText.textContent = `your cup: ${taste.label}`
      cup.dataset.taste = taste.key
    }
  }

  const animatePace = () => {
    cancelAnimationFrame(frame)
    const from = pace
    const start = performance.now()
    const duration = sc.reducedMotion() ? 0 : 700
    const step = (now) => {
      const k = duration ? Math.min(1, (now - start) / duration) : 1
      const eased = 1 - (1 - k) ** 3
      pace = from + (target - from) * eased
      draw()
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  const layers = {
    intro: [],
    acids: ["acids"],
    sugars: ["acids", "sugars"],
    bitter: ["acids", "sugars", "bitter"],
    zones: ["acids", "sugars", "bitter", "zones"],
    finer: ["acids", "sugars", "bitter", "zones", "cup"],
    coarser: ["acids", "sugars", "bitter", "zones", "cup"],
    cup: ["acids", "sugars", "bitter", "zones", "cup"],
  }
  const notes = {
    finer: "Finer grind: everything dissolves faster",
    coarser: "Coarser grind: everything slows down",
  }

  draw()
  return {
    set(state) {
      const visible = new Set(layers[state] ?? layers.intro)
      for (const curve of paths) curve.g.classList.toggle("on", visible.has(curve.key))
      zoneLayer.classList.toggle("on", visible.has("zones"))
      cup.classList.toggle("on", visible.has("cup"))
      note.textContent = notes[state] ?? ""
      cupAt = visible.has("cup") ? 0.7 : null
      target = state === "finer" ? 0.55 : state === "coarser" ? 1.7 : 1
      animatePace()
    },
    destroy: () => cancelAnimationFrame(frame),
  }
}

sc.onPage("scrolly", (article) => {
  const disposers = []
  for (const mount of article.querySelectorAll(".sc-scrolly")) {
    const create = sc.figures[mount.dataset.figure]
    // the steps are the `[!step]` callouts that follow the mount, up to the next mount
    const steps = []
    for (
      let node = mount.nextElementSibling;
      node && !node.classList.contains("sc-scrolly");
      node = node.nextElementSibling
    ) {
      if (node.classList.contains("sc-step")) steps.push(node)
    }
    if (!create || steps.length === 0) continue

    const figureBox = document.createElement("div")
    figureBox.className = "sc-scrolly-figure"
    const column = document.createElement("div")
    column.className = "sc-scrolly-steps"
    column.append(...steps)
    mount.append(figureBox, column)
    const figure = create(figureBox)

    let current = null
    const activate = (step) => {
      if (step === current) return
      current = step
      steps.forEach((s) => s.classList.toggle("active", s === step))
      figure.set(step.dataset.state)
    }
    activate(steps[0])

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) activate(entry.target)
      },
      { rootMargin: "-50% 0px -50% 0px" },
    )
    steps.forEach((step) => observer.observe(step))
    disposers.push(() => {
      observer.disconnect()
      figure.destroy?.()
    })
  }
  return () => disposers.forEach((dispose) => dispose())
})
