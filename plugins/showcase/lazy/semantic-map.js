// Semantic map (flag: semantic-map): the demo notes laid out by meaning rather than by links, from
// data computed at build time (lib/semantic.js). Hover a note to see its nearest neighbours in
// meaning; toggle the real links on top to compare; browse "related but unlinked" suggestions.
const SVG = "http://www.w3.org/2000/svg"
const W = 1000
const H = 680
const PAD = 70

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  parent?.append(node)
  return node
}

export function mount(article) {
  const sc = window.showcase
  const host = article.querySelector('.sc-mount[data-widget="semantic-map"]')
  if (!host) return () => {}
  let disposed = false

  Promise.all([
    fetch(new URL("static/showcase/semantic-map.json", sc.root())).then((res) => res.json()),
    sc.index(),
  ])
    .then(([data, index]) => {
      if (!disposed) render(host, data, index, sc)
    })
    .catch((error) => {
      host.textContent = "The semantic map couldn't be loaded."
      console.error(error)
    })

  return () => {
    disposed = true
  }
}

function render(host, data, index, sc) {
  const pos = new Map(
    data.nodes.map((n) => [n.slug, [PAD + n.x * (W - PAD * 2), PAD + n.y * (H - PAD * 2)]]),
  )
  const visits = sc.memory.visits()

  const figure = document.createElement("figure")
  figure.className = "sc-semantic"
  const svg = el(
    "svg",
    { viewBox: `0 0 ${W} ${H}`, class: "sc-semantic-svg", role: "group" },
    figure,
  )
  svg.setAttribute("aria-label", "Map of the demo notes arranged by similarity of meaning")

  // soft cluster territories: a blurred disc under every note, so regions follow the notes' shape
  const defs = el("defs", {}, svg)
  const blur = el(
    "filter",
    { id: "sc-territory-blur", x: "-20%", y: "-20%", width: "140%", height: "140%" },
    defs,
  )
  el("feGaussianBlur", { stdDeviation: 22 }, blur)
  const territories = el("g", { class: "territories", filter: "url(#sc-territory-blur)" }, svg)
  for (const node of data.nodes) {
    const [x, y] = pos.get(node.slug)
    el("circle", { cx: x, cy: y, r: 46, class: `territory c${node.cluster % 6}` }, territories)
  }
  const clusterLabels = el("g", { class: "cluster-labels" }, svg)
  for (const cluster of data.clusters) {
    const members = data.nodes.filter((n) => n.cluster === cluster.id).map((n) => pos.get(n.slug))
    if (members.length === 0) continue
    const cx = members.reduce((s, p) => s + p[0], 0) / members.length
    const cy = members.reduce((s, p) => s + p[1], 0) / members.length
    const label = el(
      "text",
      { x: cx, y: cy, class: `cluster-label c${cluster.id % 6}` },
      clusterLabels,
    )
    label.textContent = cluster.terms.join(" · ")
  }

  // the actual wikilinks, hidden until toggled on
  const linkLayer = el("g", { class: "real-links" }, svg)
  for (const node of data.nodes) {
    for (const raw of index[node.slug]?.links ?? []) {
      const target = sc.canonicalSlug(raw)
      if (!pos.has(target) || target <= node.slug) continue
      const [x1, y1] = pos.get(node.slug)
      const [x2, y2] = pos.get(target)
      el("line", { x1, y1, x2, y2 }, linkLayer)
    }
  }

  const neighbourLayer = el("g", { class: "neighbours" }, svg)
  const nodeLayer = el("g", { class: "nodes" }, svg)
  const nodeEls = new Map()
  data.nodes.forEach((node, i) => {
    const [x, y] = pos.get(node.slug)
    const g = el(
      "g",
      {
        class: `node c${node.cluster % 6}`,
        transform: `translate(${x} ${y})`,
        tabindex: 0,
        role: "link",
      },
      nodeLayer,
    )
    g.setAttribute("aria-label", node.title)
    g.style.setProperty("--i", String(i))
    el("circle", { r: 14, class: "hit" }, g)
    el(
      "circle",
      { r: visits[node.slug] ? 7 : 5.5, class: `dot${visits[node.slug] ? " seen" : ""}` },
      g,
    )
    const label = el("text", { y: -12, class: "label" }, g)
    label.textContent = node.title
    nodeEls.set(node.slug, g)
  })

  const tip = document.createElement("div")
  tip.className = "sc-semantic-tip"
  tip.hidden = true
  figure.append(tip)

  const focus = (slug, pair) => {
    neighbourLayer.replaceChildren()
    svg.classList.toggle("focused", Boolean(slug))
    for (const g of nodeEls.values()) g.classList.remove("hot", "self")
    tip.hidden = true
    if (!slug) return
    const near = pair ? [[pair, 1]] : (data.neighbours[slug] ?? [])
    nodeEls.get(slug)?.classList.add("self", "hot")
    const [x1, y1] = pos.get(slug)
    for (const [other, sim] of near) {
      if (!pos.has(other)) continue
      nodeEls.get(other)?.classList.add("hot")
      const [x2, y2] = pos.get(other)
      const mx = (x1 + x2) / 2 - (y2 - y1) * 0.15
      const my = (y1 + y2) / 2 + (x2 - x1) * 0.15
      const path = el(
        "path",
        { d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`, pathLength: 1 },
        neighbourLayer,
      )
      path.style.setProperty("--w", String(0.6 + sim * 2.4))
      if (!pair) {
        const t = el(
          "text",
          { x: mx * 0.5 + (x1 + x2) * 0.25, y: my * 0.5 + (y1 + y2) * 0.25, class: "sim" },
          neighbourLayer,
        )
        t.textContent = `${Math.round(sim * 100)}%`
      }
    }
    const node = data.nodes.find((n) => n.slug === slug)
    tip.hidden = false
    tip.innerHTML = `<strong></strong><span></span>`
    tip.querySelector("strong").textContent = node.title
    tip.querySelector("span").textContent = pair
      ? "Similar in meaning, but not linked"
      : `Closest in meaning: ${near
          .slice(0, 3)
          .map(([s]) => data.nodes.find((n) => n.slug === s)?.title)
          .join(", ")}`
    tip.style.left = `${(x1 / W) * 100}%`
    tip.style.top = `${(y1 / H) * 100}%`
  }

  const slugOf = (target) => [...nodeEls].find(([, g]) => g === target.closest?.(".node"))?.[0]
  svg.addEventListener("pointerover", (e) => focus(slugOf(e.target)))
  svg.addEventListener("pointerleave", () => focus(null))
  svg.addEventListener("focusin", (e) => focus(slugOf(e.target)))
  svg.addEventListener("focusout", () => focus(null))
  const go = (slug) => {
    const url = new URL(sc.href(slug), location.origin)
    if (window.spaNavigate) window.spaNavigate(url)
    else location.assign(url)
  }
  svg.addEventListener("click", (e) => {
    const slug = slugOf(e.target)
    if (slug) go(slug)
  })
  svg.addEventListener("keydown", (e) => {
    const slug = slugOf(e.target)
    if (slug && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      go(slug)
    }
  })

  // controls and suggestions
  const controls = document.createElement("div")
  controls.className = "sc-semantic-controls"
  controls.innerHTML = `
    <label class="sc-switch"><input type="checkbox"><span>Show the actual links</span></label>
    <span class="sc-semantic-method"></span>`
  controls.querySelector(".sc-semantic-method").textContent =
    `Computed at build time: ${data.method}`
  controls
    .querySelector("input")
    .addEventListener("change", (e) => svg.classList.toggle("show-links", e.target.checked))

  const title = (slug) => data.nodes.find((n) => n.slug === slug)?.title ?? slug
  const suggestions = document.createElement("section")
  suggestions.className = "sc-semantic-suggestions"
  suggestions.innerHTML = `<h3>Related but unlinked</h3><p>Pairs of notes that use similar language but don't link to each other: candidates for a new link.</p><ol></ol>`
  const list = suggestions.querySelector("ol")
  for (const [a, b, sim] of data.unlinked) {
    const li = document.createElement("li")
    li.innerHTML = `<span class="pair"><a></a><span aria-hidden="true">↔</span><a></a></span><span class="bar"><span></span></span>`
    const [la, lb] = li.querySelectorAll("a")
    la.href = sc.href(a)
    la.textContent = title(a)
    lb.href = sc.href(b)
    lb.textContent = title(b)
    li.querySelector(".bar > span").style.width = `${Math.round(sim * 100)}%`
    li.addEventListener("pointerenter", () => focus(a, b))
    li.addEventListener("pointerleave", () => focus(null))
    list.append(li)
  }

  host.replaceChildren(controls, figure, suggestions)
}
