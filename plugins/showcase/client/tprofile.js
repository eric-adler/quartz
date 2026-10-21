// T-profile navigation (flag: tprofile). Wide: a bar of related notes, closest in the middle.
// Deep: a rail of this page's sections hanging from the bar's centre. Together they form a T in the
// right margin; below 1200px they become a dock with two sheets.
const sc = window.showcase
const MAX_RELATED = 14

/** Related notes for `slug`, scored by links both ways, shared tags and two-step paths. */
async function relatedNotes(slug) {
  const index = await sc.index()
  const self = index[slug]
  if (!self) return []

  const linksOf = (s) => new Set((index[s]?.links ?? []).map(sc.canonicalSlug))
  const isNote = (s) => s !== slug && index[s] && !s.startsWith("tags/") && !s.endsWith("index")
  const outgoing = linksOf(slug)
  const incoming = new Set(Object.keys(index).filter((s) => s !== slug && linksOf(s).has(slug)))

  const tagCounts = new Map()
  for (const entry of Object.values(index)) {
    for (const tag of entry.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }

  const scores = new Map()
  const add = (s, points, reason) => {
    if (!isNote(s)) return
    const entry = scores.get(s) ?? { slug: s, score: 0, reasons: [] }
    entry.score += points
    if (reason && !entry.reasons.includes(reason)) entry.reasons.push(reason)
    scores.set(s, entry)
  }

  for (const s of outgoing) add(s, 3, incoming.has(s) ? "linked both ways" : "linked from here")
  for (const s of incoming) add(s, 3, outgoing.has(s) ? "linked both ways" : "links here")
  for (const tag of self.tags ?? []) {
    const weight = 1.5 / Math.log2(1 + (tagCounts.get(tag) ?? 1))
    for (const [s, entry] of Object.entries(index)) {
      if ((entry.tags ?? []).includes(tag)) add(s, weight, `shares #${tag}`)
    }
  }
  for (const neighbour of new Set([...outgoing, ...incoming])) {
    for (const s of linksOf(neighbour)) {
      if (!outgoing.has(s) && !incoming.has(s))
        add(s, 0.8, `via ${index[neighbour]?.title ?? neighbour}`)
    }
  }

  const visits = sc.memory.visits()
  const ranked = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, MAX_RELATED)
  const best = ranked[0]?.score ?? 1
  return ranked.map((entry) => ({
    ...entry,
    title: index[entry.slug].title,
    strength: entry.score / best,
    minutes: sc.readingMinutes(index[entry.slug].content),
    visit: visits[entry.slug],
  }))
}

/** Closest in the middle: 0 → right of centre, 1 → left, 2 → right, … */
function centreOut(items) {
  const left = []
  const right = []
  items.forEach((item, i) => (i % 2 === 0 ? right : left).push(item))
  return [...left.reverse(), null, ...right]
}

const describe = (note) =>
  [
    note.reasons.slice(0, 2).join(", "),
    `${note.minutes} min read`,
    note.visit ? `visited ${sc.timeAgo(note.visit.last)}` : "not visited yet",
  ].join(" · ")

function buildT(title, notes, sections) {
  const aside = document.createElement("aside")
  aside.className = "sc-t"
  aside.setAttribute("aria-label", "T-profile navigation")

  const wide = document.createElement("nav")
  wide.className = "sc-t-wide"
  wide.setAttribute("aria-label", "Related notes")
  centreOut(notes).forEach((note, i) => {
    if (!note) {
      const self = document.createElement("span")
      self.className = "sc-t-tick self"
      self.style.setProperty("--i", String(i))
      self.innerHTML = `<span class="bar"></span>`
      wide.append(self)
      return
    }
    const tick = document.createElement("a")
    tick.className = `sc-t-tick${note.visit ? " visited" : ""}`
    tick.href = sc.href(note.slug)
    tick.dataset.slug = note.slug
    tick.style.setProperty("--h", note.strength.toFixed(2))
    tick.style.setProperty("--i", String(i))
    tick.setAttribute("aria-label", `${note.title}: ${describe(note)}`)
    tick.innerHTML = `<span class="bar"></span>`
    wide.append(tick)
  })

  const card = document.createElement("div")
  card.className = "sc-t-card"
  card.hidden = true
  card.innerHTML = `<strong></strong><span></span>`

  const junction = document.createElement("div")
  junction.className = "sc-t-junction"
  junction.innerHTML = `<span class="sc-t-kicker">You are here</span><span class="sc-t-title"></span>`
  junction.querySelector(".sc-t-title").textContent = title

  const deep = document.createElement("nav")
  deep.className = "sc-t-deep"
  deep.setAttribute("aria-label", "Sections")
  sections.forEach((section, i) => {
    const link = document.createElement("a")
    link.className = "sc-t-sec"
    link.href = `#${section.id}`
    link.dataset.depth = String(section.depth)
    link.style.setProperty("--i", String(i))
    link.innerHTML = `<span class="fill"></span><span class="label"></span>`
    link.querySelector(".label").textContent = section.text
    deep.append(link)
  })

  const caption = (className, text) => {
    const el = document.createElement("p")
    el.className = `sc-t-caption ${className}`
    el.textContent = text
    return el
  }

  aside.append(
    caption("wide", "Wide · related notes"),
    wide,
    card,
    junction,
    deep,
    caption("deep", "Deep · this page"),
  )
  return aside
}

function buildDock(notes, sections) {
  const dock = document.createElement("div")
  dock.className = "sc-t-dock"
  dock.innerHTML = `
    <button type="button" data-sheet="deep">Sections <small>${sections.length}</small></button>
    <button type="button" data-sheet="wide">Related <small>${notes.length}</small></button>
    <div class="sc-t-sheet" role="dialog" aria-modal="false" hidden><ol></ol></div>`
  const sheet = dock.querySelector(".sc-t-sheet")
  const list = sheet.querySelector("ol")

  const open = (kind) => {
    const items =
      kind === "deep"
        ? sections.map((s) => ({ href: `#${s.id}`, text: s.text, meta: "", depth: s.depth }))
        : notes.map((n) => ({ href: sc.href(n.slug), text: n.title, meta: describe(n), depth: 0 }))
    list.replaceChildren(
      ...items.map((item) => {
        const li = document.createElement("li")
        li.style.setProperty("--depth", String(item.depth))
        const a = document.createElement("a")
        a.href = item.href
        a.textContent = item.text
        li.append(a)
        if (item.meta) {
          const meta = document.createElement("small")
          meta.textContent = item.meta
          li.append(meta)
        }
        return li
      }),
    )
    sheet.setAttribute("aria-label", kind === "deep" ? "Sections" : "Related notes")
    sheet.hidden = false
    dock.dataset.open = kind
  }
  const close = () => {
    sheet.hidden = true
    delete dock.dataset.open
  }

  dock.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sheet]")
    if (button)
      return dock.dataset.open === button.dataset.sheet ? close() : open(button.dataset.sheet)
    if (event.target.closest(".sc-t-sheet a")) close()
  })
  return { dock, close }
}

sc.onPage("tprofile", (article) => {
  const slug = sc.slug()
  const sections = [...article.querySelectorAll("h2[id], h3[id], h4[id]")].map((heading) => ({
    id: heading.id,
    el: heading,
    depth: Number(heading.tagName[1]) - 2,
    text: heading.textContent.trim(),
  }))
  const title = document.querySelector("#quartz-body .article-title")?.textContent?.trim() ?? ""
  const host = document.querySelector("#quartz-body .sidebar.right")
  let disposed = false
  let teardown = () => {}

  relatedNotes(slug).then((notes) => {
    if (disposed) return
    const t = buildT(title, notes, sections)
    host?.classList.add("sc-t-host")
    host?.prepend(t)
    const { dock, close } = buildDock(notes, sections)
    document.body.append(dock)

    // wide bar: hover card
    const wide = t.querySelector(".sc-t-wide")
    const card = t.querySelector(".sc-t-card")
    const showCard = (tick) => {
      const note = tick && notes.find((n) => n.slug === tick.dataset.slug)
      card.hidden = !note
      wide.querySelectorAll(".active").forEach((el) => el.classList.remove("active"))
      if (!note) return
      tick.classList.add("active")
      card.querySelector("strong").textContent = note.title
      card.querySelector("span").textContent = describe(note)
      const x = tick.offsetLeft + tick.offsetWidth / 2
      card.style.setProperty("--x", `${x}px`)
    }
    wide.addEventListener("pointerover", (e) => showCard(e.target.closest(".sc-t-tick[data-slug]")))
    wide.addEventListener("pointerleave", () => showCard(null))
    wide.addEventListener("focusin", (e) => showCard(e.target.closest(".sc-t-tick[data-slug]")))
    wide.addEventListener("focusout", () => showCard(null))

    // deep rail: which sections are on screen, which one is being read
    const secLinks = [...t.querySelectorAll(".sc-t-sec")]
    let frame = 0
    const update = () => {
      frame = 0
      const tops = sections.map((s) => s.el.getBoundingClientRect().top)
      const readingLine = window.innerHeight * 0.35
      let active = 0
      tops.forEach((top, i) => {
        if (top < readingLine) active = i
      })
      secLinks.forEach((link, i) => {
        const end = tops[i + 1] ?? article.getBoundingClientRect().bottom
        link.classList.toggle("in-view", tops[i] < window.innerHeight && end > 0)
        link.classList.toggle("is-active", i === active)
      })
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    update()

    const onKey = (event) => event.key === "Escape" && close()
    document.addEventListener("keydown", onKey)
    teardown = () => {
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("keydown", onKey)
      cancelAnimationFrame(frame)
      dock.remove()
    }
  })

  return () => {
    disposed = true
    teardown()
  }
})
