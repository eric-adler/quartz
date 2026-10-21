// Shared client foundation for the showcase demo pages: page flags, per-page setup and reader memory.
const sc = (window.showcase ??= {})

sc.slug = () => document.body.dataset.slug ?? ""

/** Flags of the current page, read from the marker the build stamps into the article. */
sc.flags = () => {
  const marker = document.querySelector("#quartz-body .demo-flags")
  return new Set((marker?.dataset.demo ?? "").split(/\s+/).filter(Boolean))
}

/** Runs `setup(article)` after every navigation to a page with `flag`; a returned function is cleanup. */
sc.onPage = (flag, setup) => {
  document.addEventListener("nav", () => {
    if (!sc.flags().has(flag)) return
    const article = document.querySelector("#quartz-body article")
    if (!article) return
    const cleanup = setup(article)
    if (typeof cleanup === "function") window.addCleanup(cleanup)
  })
}

sc.reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

// Reader memory: everything stays in this browser's localStorage.
const MEMORY_KEY = "showcase:memory:v1"
const TRAIL_LIMIT = 500
const REVISIT_GRACE_MS = 30_000

const emptyMemory = () => ({ visits: {}, trail: [], state: {} })

function readMemory() {
  try {
    return { ...emptyMemory(), ...JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "{}") }
  } catch {
    return emptyMemory()
  }
}

function writeMemory(memory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory))
  } catch {
    // storage full or blocked: memory is a nicety, never a requirement
  }
}

sc.memory = {
  /** Full snapshot: `{ visits, trail, state }`. */
  all: () => readMemory(),
  visits: () => readMemory().visits,
  trail: () => readMemory().trail,
  get(slug, key) {
    return readMemory().state[slug]?.[key]
  },
  set(slug, key, value) {
    const memory = readMemory()
    memory.state[slug] = { ...memory.state[slug], [key]: value }
    writeMemory(memory)
  },
  forget() {
    try {
      localStorage.removeItem(MEMORY_KEY)
    } catch {}
  },
}

// Content index: Quartz's own `fetchData` promise (slug → { title, links, tags, content }).
sc.index = async () => {
  const data = await (typeof fetchData !== "undefined" ? fetchData : Promise.resolve({}))
  return data?.content && typeof data.content === "object" ? data.content : (data ?? {})
}

/** Normalises a link target from the index: folder links ("demo/coffee/") point at their index. */
sc.canonicalSlug = (slug) => {
  const bare = slug.split("#")[0]
  return bare === "" || bare.endsWith("/") ? `${bare}index` : bare
}

/** URL path for a slug, resolved from the current page so it works under any base path. */
sc.href = (slug) => {
  const depth = sc.slug().split("/").length - 1
  const root = new URL("../".repeat(depth) || "./", location.href)
  return new URL(slug.replace(/(^|\/)index$/, "$1"), root).pathname
}

sc.readingMinutes = (text = "") => Math.max(1, Math.round((text.match(/\S+/g)?.length ?? 0) / 230))

sc.timeAgo = (t) => {
  const minutes = Math.round((Date.now() - t) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}

// Only demo pages are remembered.
document.addEventListener("nav", () => {
  const slug = sc.slug()
  if (!slug.startsWith("demo/")) return

  const now = Date.now()
  const memory = readMemory()
  const visit = memory.visits[slug] ?? { count: 0, first: now }
  const last = memory.trail.at(-1)
  const isReload = last?.slug === slug && now - last.t < REVISIT_GRACE_MS

  if (!isReload) {
    visit.count += 1
    memory.trail.push({ slug, t: now })
    if (memory.trail.length > TRAIL_LIMIT) memory.trail.splice(0, memory.trail.length - TRAIL_LIMIT)
  }
  visit.last = now
  memory.visits[slug] = visit
  writeMemory(memory)
})
