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
