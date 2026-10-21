// Concept links (flag: concepts): dashed underline, hover shows the note's one-line description,
// click opens the full note in the drawer. Mouse, keyboard and touch (tap to peek, tap again to open).
const sc = window.showcase
const SHOW_DELAY_MS = 90

let tip = null
let activeLink = null
let armedLink = null
let showTimer = 0
let lastPointerType = "mouse"

/** Turns every internal link under `root` into a concept link. */
sc.markConcepts = (root) => {
  for (const link of root.querySelectorAll("a.internal:not(.tag-link)")) {
    const url = new URL(link.href, location.href)
    if (url.pathname === location.pathname) continue
    link.classList.add("sc-concept")
    link.dataset.noPopover = "true"
    link.dataset.routerIgnore = ""
  }
}

function ensureTip() {
  if (tip?.isConnected) return tip
  tip = document.createElement("div")
  tip.className = "sc-tip"
  tip.id = "sc-tip"
  tip.setAttribute("role", "tooltip")
  tip.innerHTML = `<span class="sc-tip-title"></span><span class="sc-tip-desc"></span><span class="sc-tip-hint"></span>`
  document.body.append(tip)
  return tip
}

function placeTip(t, link) {
  const rect = link.getClientRects()[0] ?? link.getBoundingClientRect()
  const margin = 12
  const width = t.offsetWidth
  const height = t.offsetHeight
  const x = Math.min(
    Math.max(margin, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - margin,
  )
  let y = rect.top - height - 10
  const below = y < margin
  if (below) y = rect.bottom + 10
  t.dataset.side = below ? "below" : "above"
  t.style.setProperty("--arrow-x", `${rect.left + rect.width / 2 - x}px`)
  t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
}

async function showTip(link) {
  activeLink = link
  let note
  try {
    note = await sc.fetchNote(link.href)
  } catch {
    return
  }
  if (activeLink !== link || !link.isConnected) return

  const t = ensureTip()
  t.querySelector(".sc-tip-title").textContent = note.title
  t.querySelector(".sc-tip-desc").textContent = note.description
  t.querySelector(".sc-tip-hint").textContent =
    lastPointerType === "touch" ? "Tap again to read more" : "Click to read more"
  link.setAttribute("aria-describedby", "sc-tip")
  placeTip(t, link)
  t.classList.add("visible")
}

function hideTip() {
  clearTimeout(showTimer)
  activeLink?.removeAttribute("aria-describedby")
  activeLink = null
  tip?.classList.remove("visible")
}

const conceptFrom = (target) => target?.closest?.("a.sc-concept")

document.addEventListener("pointerdown", (event) => {
  lastPointerType = event.pointerType
})

document.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return
  const link = conceptFrom(event.target)
  if (!link || link === activeLink) return
  clearTimeout(showTimer)
  showTimer = setTimeout(() => showTip(link), SHOW_DELAY_MS)
})

document.addEventListener("pointerout", (event) => {
  const link = conceptFrom(event.target)
  if (!link || link.contains(event.relatedTarget)) return
  hideTip()
})

document.addEventListener("focusin", (event) => {
  const link = conceptFrom(event.target)
  if (link) showTip(link)
})

document.addEventListener("focusout", (event) => {
  if (conceptFrom(event.target)) hideTip()
})

document.addEventListener("click", (event) => {
  const link = conceptFrom(event.target)
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
  // links inside the drawer are handled by the drawer itself
  if (link.closest(".sc-drawer")) return hideTip()
  event.preventDefault()

  if (lastPointerType === "touch" && armedLink !== link) {
    armedLink = link
    showTip(link)
    return
  }
  armedLink = null
  hideTip()
  sc.drawer.open(link.href, { from: link })
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideTip()
})

window.addEventListener("scroll", hideTip, { passive: true })

sc.onPage("concepts", (article) => {
  sc.markConcepts(article)
  // warm the cache so the first hover is instant
  const prefetch = () => {
    for (const link of article.querySelectorAll("a.sc-concept"))
      sc.fetchNote(link.href).catch(() => {})
  }
  const idle = window.requestIdleCallback?.(prefetch) ?? setTimeout(prefetch, 300)
  return () => {
    window.cancelIdleCallback?.(idle)
    hideTip()
    armedLink = null
  }
})
