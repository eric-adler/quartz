// Drawer: shows another note beside the current one without leaving the page. Keeps its own
// back-stack, so following links inside the drawer never loses the article underneath.
const sc = window.showcase
const parser = new DOMParser()
const notes = new Map()

/** Fetches and parses a note once per pathname. */
sc.fetchNote = (href) => {
  const url = new URL(href, location.href)
  url.hash = ""
  url.search = ""
  const key = url.pathname
  if (!notes.has(key)) {
    const pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${url}`)
        return res.text()
      })
      .then((html) => {
        const doc = parser.parseFromString(html, "text/html")
        return {
          url: url.href,
          title:
            doc.querySelector("#quartz-body .article-title")?.textContent?.trim() ||
            doc.title.trim(),
          description: doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
          article: doc.querySelector("#quartz-body article"),
        }
      })
    pending.catch(() => notes.delete(key))
    notes.set(key, pending)
  }
  return notes.get(key)
}

let drawer = null

function ensureDrawer() {
  if (drawer?.root.isConnected) return drawer

  const root = document.createElement("aside")
  root.className = "sc-drawer"
  root.hidden = true
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-labelledby", "sc-drawer-title")
  root.innerHTML = `
    <header class="sc-drawer-head">
      <button type="button" class="sc-drawer-back" aria-label="Back" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="sc-drawer-heading">
        <span class="sc-drawer-kicker"></span>
        <h2 id="sc-drawer-title" tabindex="-1"></h2>
      </div>
      <a class="sc-drawer-open" href="">Open page</a>
      <button type="button" class="sc-drawer-close" aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </header>
    <div class="sc-drawer-body"></div>`
  document.body.append(root)

  drawer = {
    root,
    title: root.querySelector("h2"),
    kicker: root.querySelector(".sc-drawer-kicker"),
    body: root.querySelector(".sc-drawer-body"),
    back: root.querySelector(".sc-drawer-back"),
    link: root.querySelector(".sc-drawer-open"),
    stack: [],
    returnFocus: null,
  }

  drawer.back.addEventListener("click", () => sc.drawer.back())
  root.querySelector(".sc-drawer-close").addEventListener("click", () => sc.drawer.close())
  drawer.link.addEventListener("click", () => sc.drawer.close({ instant: true }))
  root.addEventListener("click", (event) => {
    const link = event.target.closest("a")
    if (!link || !drawer.body.contains(link) || event.metaKey || event.ctrlKey) return
    const href = link.getAttribute("href") ?? ""
    if (href.startsWith("#")) {
      event.preventDefault()
      drawer.body
        .querySelector(`#drawer-${CSS.escape(href.slice(1))}`)
        ?.scrollIntoView({ block: "start" })
    } else if (link.classList.contains("internal")) {
      event.preventDefault()
      sc.drawer.open(link.href)
    }
  })

  return drawer
}

const isOpen = () => Boolean(drawer?.root.isConnected && !drawer.root.hidden)

function render(note) {
  const d = drawer
  d.title.textContent = note.title
  d.link.href = note.url
  d.kicker.textContent = d.stack.length > 1 ? `${d.stack.length} notes deep` : "Concept"
  d.back.hidden = d.stack.length <= 1

  const fragment = document.createDocumentFragment()
  for (const child of note.article?.children ?? []) {
    if (child.classList.contains("demo-flags")) continue
    fragment.append(document.importNode(child, true))
  }
  for (const node of fragment.querySelectorAll("[id]")) node.id = `drawer-${node.id}`
  for (const link of fragment.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href")
    if (href.startsWith("#")) continue
    link.href = new URL(href, note.url).href
    if (link.classList.contains("internal")) {
      link.dataset.routerIgnore = ""
      link.dataset.noPopover = "true"
    }
  }
  for (const media of fragment.querySelectorAll("[src]")) {
    media.src = new URL(media.getAttribute("src"), note.url).href
  }

  d.body.replaceChildren(fragment)
  d.body.scrollTop = 0
  d.body.removeAttribute("aria-busy")
  sc.markConcepts?.(d.body)
}

function setPush(open) {
  const html = document.documentElement
  const center = document.querySelector("#quartz-body .center")
  if (!open || !center || window.innerWidth < 1000) {
    html.classList.remove("sc-pushed")
    return
  }
  const drawerWidth = drawer.root.getBoundingClientRect().width
  const rect = center.getBoundingClientRect()
  const overlap = rect.right + 32 - (window.innerWidth - drawerWidth)
  const push = Math.max(0, Math.min(overlap, rect.left - 16))
  html.style.setProperty("--sc-push", `${Math.round(push)}px`)
  html.classList.add("sc-pushed")
}

sc.drawer = {
  isOpen,

  async open(href, { from } = {}) {
    const d = ensureDrawer()
    if (!isOpen()) {
      d.stack = []
      d.returnFocus = from ?? document.activeElement
      d.root.hidden = false
      requestAnimationFrame(() => {
        d.root.classList.add("open")
        setPush(true)
      })
    }
    if (d.stack.at(-1) === href) return

    d.stack.push(href)
    d.body.setAttribute("aria-busy", "true")
    try {
      const note = await sc.fetchNote(href)
      if (d.stack.at(-1) !== href) return
      render(note)
      d.title.focus({ preventScroll: true })
    } catch {
      d.title.textContent = "Couldn't load this note"
      d.body.replaceChildren()
      d.body.removeAttribute("aria-busy")
    }
  },

  async back() {
    const d = drawer
    if (!d || d.stack.length <= 1) return
    d.stack.pop()
    render(await sc.fetchNote(d.stack.at(-1)))
  },

  close({ instant = false } = {}) {
    if (!isOpen()) return
    const d = drawer
    d.root.classList.remove("open")
    setPush(false)
    const hide = () => {
      if (!d.root.classList.contains("open")) d.root.hidden = true
    }
    if (instant || sc.reducedMotion()) hide()
    else d.root.addEventListener("transitionend", hide, { once: true })
    if (!instant) d.returnFocus?.focus?.({ preventScroll: true })
  },
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isOpen()) sc.drawer.close()
})

document.addEventListener("pointerdown", (event) => {
  if (!isOpen()) return
  if (drawer.root.contains(event.target) || event.target.closest?.(".sc-concept")) return
  sc.drawer.close()
})

window.addEventListener("resize", () => isOpen() && setPush(true))

// The drawer element doesn't survive SPA navigation; make sure the page isn't left pushed.
document.addEventListener("prenav", () => {
  if (isOpen()) sc.drawer.close({ instant: true })
  document.documentElement.classList.remove("sc-pushed")
})
