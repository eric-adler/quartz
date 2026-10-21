// Morphing page transitions (flag: morph). A card on this page morphs into the page it opens: its
// title flies into the new page's title and the card grows into the article. Built on the View
// Transitions API around Quartz's own SPA navigation; browsers without it just navigate.
const sc = window.showcase

/** A well-spread hue per note: a string hash stepped around the colour wheel by the golden angle. */
const hue = (slug) => {
  let h = 0
  for (const char of slug) h = (h * 31 + char.codePointAt(0)) >>> 0
  return Math.round((h % 97) * 137.508) % 360
}

sc.onPage("morph", (article) => {
  const gallery = article.querySelector(".sc-morph-gallery")
  if (!gallery) return

  sc.index().then((index) => {
    for (const link of gallery.querySelectorAll(".sc-morph-link")) {
      const entry = index[link.dataset.slug]
      if (!entry) continue
      const h = hue(link.dataset.slug)
      const tag = (entry.tags ?? []).find((t) => t !== "coffee" && t !== "demo") ?? "note"
      const excerpt = (entry.content ?? "").replace(/\s+/g, " ").trim()
      link.classList.add("sc-morph-card")
      link.style.setProperty("--h1", String(h))
      link.style.setProperty("--h2", String((h + 40) % 360))
      link.innerHTML = `<span class="sc-morph-art" aria-hidden="true"></span>
        <span class="sc-morph-tag"></span><span class="sc-morph-title"></span><span class="sc-morph-excerpt"></span>`
      link.querySelector(".sc-morph-tag").textContent = tag
      link.querySelector(".sc-morph-title").textContent = entry.title
      link.querySelector(".sc-morph-excerpt").textContent =
        excerpt.length > 110 ? `${excerpt.slice(0, 110).replace(/\s+\S*$/, "")}…` : excerpt
    }
  })

  const prefetched = new Set()
  const onOver = (event) => {
    const link = event.target.closest(".sc-morph-link")
    if (!link || prefetched.has(link.href)) return
    prefetched.add(link.href)
    fetch(link.href).catch(() => {})
  }

  const onClick = (event) => {
    const link = event.target.closest(".sc-morph-link")
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || !window.spaNavigate) return
    if (!document.startViewTransition || sc.reducedMotion()) return // the router handles it normally
    event.preventDefault()
    event.stopPropagation()

    const title = link.querySelector(".sc-morph-title") ?? link
    title.style.viewTransitionName = "sc-morph-title"
    link.style.viewTransitionName = "sc-morph-card"
    const root = document.documentElement
    root.classList.add("sc-morphing")

    const transition = document.startViewTransition(async () => {
      await window.spaNavigate(new URL(link.href))
      document
        .querySelector("#quartz-body .article-title")
        ?.style.setProperty("view-transition-name", "sc-morph-title")
      document
        .querySelector("#quartz-body .center")
        ?.style.setProperty("view-transition-name", "sc-morph-card")
    })
    transition.finished.finally(() => {
      root.classList.remove("sc-morphing")
      document
        .querySelector("#quartz-body .article-title")
        ?.style.removeProperty("view-transition-name")
      document.querySelector("#quartz-body .center")?.style.removeProperty("view-transition-name")
    })
  }

  gallery.addEventListener("pointerover", onOver)
  // capture, so this runs before Quartz's router sees the click
  gallery.addEventListener("click", onClick, true)
  return () => {
    gallery.removeEventListener("pointerover", onOver)
    gallery.removeEventListener("click", onClick, true)
  }
})
