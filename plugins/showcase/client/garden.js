// Garden maps (flags: memory-graph, trail). Both draw the demo notes with the same deterministic
// layout, so a note sits in the same place on your graph and on your route.
const sc = window.showcase
const SVG = "http://www.w3.org/2000/svg"
const W = 1000
const H = 640
const DAY = 86_400_000
const STALE_AFTER = 14 * DAY
const SESSION_GAP = 45 * 60_000

/** Stable pseudo-random number in [0, 1) for a string. */
const hash = (value) => {
  let h = 2166136261
  for (const char of value) {
    h ^= char.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 2 ** 32
}

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  parent?.append(node)
  return node
}

let cached = null

/** Demo notes, their links, and a force-directed layout that is identical on every visit. */
async function garden() {
  const index = await sc.index()
  const slugs = Object.keys(index)
    .filter((slug) => slug.startsWith("demo/"))
    .sort()
  const key = slugs.join("|")
  if (cached?.key === key) return cached

  const known = new Set(slugs)
  const edgeMap = new Map()
  for (const slug of slugs) {
    for (const raw of index[slug].links ?? []) {
      const target = sc.canonicalSlug(raw)
      if (!known.has(target) || target === slug) continue
      const pair = slug < target ? [slug, target] : [target, slug]
      edgeMap.set(pair.join("|"), pair)
    }
  }
  const edges = [...edgeMap.values()]

  const nodes = slugs.map((slug) => {
    const angle = hash(slug) * Math.PI * 2
    const radius = 120 + hash(`${slug}:r`) * 160
    return {
      slug,
      title: index[slug].title ?? slug,
      x: W / 2 + Math.cos(angle) * radius,
      y: H / 2 + Math.sin(angle) * radius,
      neighbours: new Set(),
    }
  })
  const bySlug = new Map(nodes.map((node) => [node.slug, node]))
  for (const [a, b] of edges) {
    bySlug.get(a).neighbours.add(b)
    bySlug.get(b).neighbours.add(a)
  }
  simulate(nodes, edges, bySlug)
  cached = { key, nodes, edges, bySlug, index }
  return cached
}

function simulate(nodes, edges, bySlug) {
  const steps = 360
  for (let step = 0; step < steps; step++) {
    const temperature = 18 * (1 - step / steps) + 0.5
    const force = nodes.map(() => [0, 0])
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const d2 = Math.max(dx * dx + dy * dy, 36)
        const d = Math.sqrt(d2)
        const push = 7000 / d2
        force[i][0] += (dx / d) * push
        force[i][1] += (dy / d) * push
        force[j][0] -= (dx / d) * push
        force[j][1] -= (dy / d) * push
      }
    }
    for (const [a, b] of edges) {
      const i = nodes.indexOf(bySlug.get(a))
      const j = nodes.indexOf(bySlug.get(b))
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const d = Math.max(Math.hypot(dx, dy), 1)
      const pull = (d - 85) * 0.03
      force[i][0] += (dx / d) * pull
      force[i][1] += (dy / d) * pull
      force[j][0] -= (dx / d) * pull
      force[j][1] -= (dy / d) * pull
    }
    nodes.forEach((node, i) => {
      force[i][0] += (W / 2 - node.x) * 0.008
      force[i][1] += (H / 2 - node.y) * 0.012
      const length = Math.hypot(force[i][0], force[i][1])
      const scale = length > temperature ? temperature / length : 1
      node.x += force[i][0] * scale
      node.y += force[i][1] * scale
    })
  }

  // fit into the viewBox, keeping the aspect ratio
  const pad = 60
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ]
  const scale = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1))
  const offsetX = (W - (maxX - minX) * scale) / 2
  const offsetY = (H - (maxY - minY) * scale) / 2
  for (const node of nodes) {
    node.x = (node.x - minX) * scale + offsetX
    node.y = (node.y - minY) * scale + offsetY
  }
}

const escape = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  )

const learnedCount = (state) =>
  Object.values(state?.cards ?? {}).filter((card) => (card.box ?? 0) >= 1).length

function navigateTo(slug) {
  const url = new URL(sc.href(slug), location.origin)
  if (window.spaNavigate) window.spaNavigate(url)
  else location.assign(url)
}

/** Shared SVG scaffolding: edges, node groups, tooltip, hover + keyboard behaviour. */
function drawMap(mount, g, { nodeClass, nodeRadius, label, describe }) {
  const figure = document.createElement("figure")
  figure.className = "sc-garden"
  const root = svg(
    "svg",
    { viewBox: `0 0 ${W} ${H}`, class: "sc-garden-svg", role: "group" },
    figure,
  )
  const defs = svg("defs", {}, root)
  const glow = svg("radialGradient", { id: "sc-glow" }, defs)
  svg("stop", { offset: "0%", "stop-color": "var(--secondary)", "stop-opacity": 0.55 }, glow)
  svg("stop", { offset: "100%", "stop-color": "var(--secondary)", "stop-opacity": 0 }, glow)

  const edgeLayer = svg("g", { class: "sc-edges" }, root)
  const extraLayer = svg("g", { class: "sc-extra" }, root)
  const nodeLayer = svg("g", { class: "sc-nodes" }, root)

  const edgeEls = g.edges.map(([a, b]) => {
    const [na, nb] = [g.bySlug.get(a), g.bySlug.get(b)]
    return svg(
      "line",
      { x1: na.x, y1: na.y, x2: nb.x, y2: nb.y, "data-a": a, "data-b": b },
      edgeLayer,
    )
  })

  const tip = document.createElement("div")
  tip.className = "sc-garden-tip"
  tip.hidden = true
  figure.append(tip)

  const nodeEls = new Map()
  g.nodes.forEach((node, i) => {
    const outer = svg("g", { transform: `translate(${node.x} ${node.y})` }, nodeLayer)
    const inner = svg(
      "g",
      {
        class: `sc-node ${nodeClass(node)}`,
        tabindex: 0,
        role: "link",
        "aria-label": `${node.title}. ${describe(node)}`,
        style: `--i: ${i}`,
      },
      outer,
    )
    const r = nodeRadius(node)
    svg("circle", { class: "sc-hit", r: Math.max(r + 6, 12) }, inner)
    svg("circle", { class: "sc-dot", r }, inner)
    svg(
      "text",
      { class: `sc-label${label(node) ? " always" : ""}`, y: r + 15 },
      inner,
    ).textContent = node.title
    nodeEls.set(node.slug, inner)
  })

  const focusNode = (slug) => {
    root.classList.toggle("sc-focus", Boolean(slug))
    const node = slug && g.bySlug.get(slug)
    for (const [s, el] of nodeEls)
      el.classList.toggle("hot", s === slug || Boolean(node?.neighbours.has(s)))
    for (const el of edgeEls)
      el.classList.toggle("hot", Boolean(slug) && (el.dataset.a === slug || el.dataset.b === slug))
    tip.hidden = !node
    if (!node) return
    tip.innerHTML = `<strong></strong><span></span>`
    tip.querySelector("strong").textContent = node.title
    tip.querySelector("span").textContent = describe(node)
    tip.style.left = `${(node.x / W) * 100}%`
    tip.style.top = `${(node.y / H) * 100}%`
  }

  const slugOf = (event) => {
    const el = event.target.closest?.(".sc-node")
    return el ? [...nodeEls].find(([, value]) => value === el)?.[0] : null
  }
  root.addEventListener("pointerover", (event) => focusNode(slugOf(event)))
  root.addEventListener("pointerleave", () => focusNode(null))
  root.addEventListener("focusin", (event) => focusNode(slugOf(event)))
  root.addEventListener("focusout", () => focusNode(null))
  root.addEventListener("click", (event) => {
    const slug = slugOf(event)
    if (slug) navigateTo(slug)
  })
  root.addEventListener("keydown", (event) => {
    const slug = slugOf(event)
    if (slug && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      navigateTo(slug)
    }
  })

  mount.replaceChildren(figure)
  return { figure, root, extraLayer, nodeEls }
}

// ——— Personal graph ———

async function renderGraph(mount) {
  const g = await garden()
  const memory = sc.memory.all()
  const now = Date.now()
  const visit = (node) => memory.visits[node.slug]

  // entrance order: most recent first
  g.nodes.sort((a, b) => (visit(b)?.last ?? 0) - (visit(a)?.last ?? 0))
  const top = new Set(
    [...g.nodes]
      .filter(visit)
      .sort((a, b) => visit(b).count - visit(a).count)
      .slice(0, 5)
      .map((n) => n.slug),
  )

  const { root, extraLayer } = drawMap(mount, g, {
    nodeClass: (node) => {
      const v = visit(node)
      if (!v) return "unvisited"
      return now - v.last > STALE_AFTER ? "visited stale" : "visited"
    },
    nodeRadius: (node) => (visit(node) ? 5 + 3.2 * Math.sqrt(visit(node).count) : 3.5),
    label: (node) => top.has(node.slug) || node.slug === sc.slug(),
    describe: (node) => {
      const v = visit(node)
      const learned = learnedCount(memory.state[node.slug])
      const parts = [v ? `Visited ${v.count}× · last ${sc.timeAgo(v.last)}` : "Not visited yet"]
      if (learned) parts.push(`${learned} card${learned === 1 ? "" : "s"} learned`)
      return parts.join(" · ")
    },
  })
  root.setAttribute("aria-label", "Graph of the demo notes, sized by how often you visited them")

  // glow for recency, ring for learned cards, drawn behind the nodes
  for (const node of g.nodes) {
    const v = visit(node)
    if (!v) continue
    const recency = Math.exp(-(now - v.last) / (2 * DAY))
    if (recency > 0.05) {
      const r = (5 + 3.2 * Math.sqrt(v.count)) * 4.5
      const glowEl = svg(
        "circle",
        { cx: node.x, cy: node.y, r, fill: "url(#sc-glow)", class: "sc-glow" },
        extraLayer,
      )
      glowEl.style.opacity = String(recency)
      if (recency > 0.8) glowEl.classList.add("fresh")
    }
    if (learnedCount(memory.state[node.slug])) {
      const r = 5 + 3.2 * Math.sqrt(v.count) + 5
      svg("circle", { cx: node.x, cy: node.y, r, class: "sc-learned" }, extraLayer)
    }
  }

  const visited = g.nodes.filter(visit)
  const stats = document.createElement("div")
  stats.className = "sc-garden-stats"
  stats.innerHTML = `
    <dl>
      <div><dt>Notes visited</dt><dd>${visited.length} <small>of ${g.nodes.length}</small></dd></div>
      <div><dt>Page views</dt><dd>${visited.reduce((sum, n) => sum + visit(n).count, 0)}</dd></div>
      <div><dt>Cards learned</dt><dd>${g.nodes.reduce((sum, n) => sum + learnedCount(memory.state[n.slug]), 0)}</dd></div>
    </dl>
    <ul class="sc-legend" aria-label="Legend">
      <li><span class="sw size"></span>Size: how often</li>
      <li><span class="sw glow"></span>Glow: how recently</li>
      <li><span class="sw stale"></span>Grey: not in two weeks</li>
      <li><span class="sw unvisited"></span>Hollow: not yet</li>
      <li><span class="sw learned"></span>Ring: cards learned</li>
    </ul>
    <button type="button" class="sc-forget">Forget me</button>`
  stats.querySelector(".sc-forget").addEventListener("click", (event) => {
    const button = event.currentTarget
    if (button.dataset.confirm !== "yes") {
      button.dataset.confirm = "yes"
      button.textContent = "Erase everything this site remembers about you?"
      return
    }
    sc.memory.forget()
    renderGraph(mount)
  })
  mount.append(stats)
}

// ——— Your path ———

const formatDuration = (ms) => {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} s`
  if (ms > 30 * 60_000) return "30+ min"
  return `${Math.round(ms / 60_000)} min`
}

const formatClock = (t) =>
  new Date(t).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })

async function renderTrail(mount) {
  const g = await garden()
  const memory = sc.memory.all()
  const trail = memory.trail.filter((step) => g.bySlug.has(step.slug)).slice(-120)

  if (trail.length < 2) {
    mount.innerHTML = `<div class="sc-trail-empty"><p>Your path starts here.</p>
      <p>Wander through a few notes, then come back to see the route you took.</p></div>`
    return
  }

  const visitedSlugs = new Set(trail.map((step) => step.slug))
  const { root, extraLayer, figure } = drawMap(mount, g, {
    nodeClass: (node) => (visitedSlugs.has(node.slug) ? "visited on-route" : "unvisited"),
    nodeRadius: (node) => (visitedSlugs.has(node.slug) ? 6 : 3),
    label: (node) => node.slug === trail[0].slug || node.slug === trail.at(-1).slug,
    describe: (node) => {
      const count = trail.filter((step) => step.slug === node.slug).length
      return count ? `On your route ${count}×` : "Not on your route yet"
    },
  })
  root.setAttribute("aria-label", "Map of your route through the demo notes")
  root.classList.add("sc-trail-map")

  // Route: curved segments, older ones fainter; repeated hops bend apart so loops stay readable.
  const pairUses = new Map()
  const stepDelay = Math.min(90, 2600 / trail.length)
  for (let i = 1; i < trail.length; i++) {
    const a = g.bySlug.get(trail[i - 1].slug)
    const b = g.bySlug.get(trail[i].slug)
    if (a === b) continue
    const pair = [a.slug, b.slug].sort().join("|")
    const uses = pairUses.get(pair) ?? 0
    pairUses.set(pair, uses + 1)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    const bend = (0.14 + uses * 0.12) * (uses % 2 ? -1 : 1) * length
    const cx = (a.x + b.x) / 2 - (dy / length) * bend
    const cy = (a.y + b.y) / 2 + (dx / length) * bend
    const segment = svg(
      "path",
      { d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`, pathLength: 1, class: "sc-route" },
      extraLayer,
    )
    segment.style.setProperty("--age", String(i / (trail.length - 1)))
    segment.style.setProperty("--delay", `${Math.round(i * stepDelay)}ms`)
  }

  const start = g.bySlug.get(trail[0].slug)
  const end = g.bySlug.get(trail.at(-1).slug)
  svg("circle", { cx: start.x, cy: start.y, r: 11, class: "sc-start" }, extraLayer)
  const pin = svg("g", { transform: `translate(${end.x} ${end.y})`, class: "sc-here" }, extraLayer)
  pin.style.setProperty("--delay", `${Math.round(trail.length * stepDelay)}ms`)
  svg("circle", { r: 16, class: "sc-here-pulse" }, pin)
  svg("circle", { r: 8, class: "sc-here-dot" }, pin)

  const replay = document.createElement("button")
  replay.type = "button"
  replay.className = "sc-replay"
  replay.textContent = "Replay route"
  replay.addEventListener("click", () => {
    root.classList.remove("sc-play")
    void root.getBoundingClientRect()
    root.classList.add("sc-play")
  })
  figure.append(replay)
  requestAnimationFrame(() => root.classList.add("sc-play"))

  mount.append(timeline(g, trail, memory))
}

function timeline(g, trail, memory) {
  const sessions = []
  trail.forEach((step, i) => {
    if (i === 0 || step.t - trail[i - 1].t > SESSION_GAP) sessions.push([])
    sessions.at(-1).push({ ...step, i })
  })

  const seen = new Map()
  let longest = null
  const wrapper = document.createElement("div")
  wrapper.className = "sc-timeline"

  for (const session of sessions.reverse()) {
    const section = document.createElement("section")
    const span = session.at(-1).t - session[0].t
    const heading = document.createElement("h3")
    heading.textContent = `${formatClock(session[0].t)} · ${session.length} stop${session.length === 1 ? "" : "s"}${span > 0 ? ` · ${formatDuration(span)}` : ""}`
    const list = document.createElement("ol")
    for (const step of session) {
      const next = trail[step.i + 1]
      const stay = next && next.t - step.t <= SESSION_GAP ? next.t - step.t : null
      const visitNumber = trail.slice(0, step.i + 1).filter((s) => s.slug === step.slug).length
      if (stay !== null && (!longest || stay > longest.stay)) longest = { slug: step.slug, stay }
      seen.set(step.slug, (seen.get(step.slug) ?? 0) + 1)

      const item = document.createElement("li")
      const link = document.createElement("a")
      link.href = sc.href(step.slug)
      link.textContent = g.bySlug.get(step.slug).title
      const meta = document.createElement("span")
      meta.className = "sc-stop-meta"
      meta.textContent = [
        stay !== null
          ? formatDuration(stay)
          : step.i === trail.length - 1
            ? "you are here"
            : "left",
        visitNumber > 1 ? `visit ${visitNumber}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
      item.append(link, meta)
      list.append(item)
    }
    section.append(heading, list)
    wrapper.append(section)
  }

  const mostVisited = Object.entries(memory.visits)
    .filter(([slug]) => g.bySlug.has(slug))
    .sort((a, b) => b[1].count - a[1].count)[0]
  const stats = document.createElement("dl")
  stats.className = "sc-garden-stats sc-trail-stats"
  const stat = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`
  const title = (slug) => escape(g.bySlug.get(slug)?.title ?? slug)
  stats.innerHTML = [
    stat("Started at", title(trail[0].slug)),
    stat("Notes explored", `${seen.size} <small>of ${g.nodes.length}</small>`),
    mostVisited
      ? stat("Most visited", `${title(mostVisited[0])} <small>${mostVisited[1].count}×</small>`)
      : "",
    longest
      ? stat(
          "Longest stay",
          `${title(longest.slug)} <small>${formatDuration(longest.stay)}</small>`,
        )
      : "",
  ].join("")
  wrapper.prepend(stats)
  return wrapper
}

const widgets = { "memory-graph": ["graph", renderGraph], trail: ["trail", renderTrail] }
for (const [flag, [kind, render]] of Object.entries(widgets)) {
  sc.onPage(flag, (article) => {
    for (const mount of article.querySelectorAll(`.sc-mount[data-widget="${kind}"]`)) render(mount)
  })
}
