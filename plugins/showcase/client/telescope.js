// Telescopic text (flag: telescope). Click a phrase to expand it in place; click expanded text to fold
// it back. A detail slider expands everything up to a depth, and a counter shows how the text grows.
const sc = window.showcase

const own = (tele, selector) => tele.querySelector(`:scope > ${selector}`)

function setOpen(tele, open, animate) {
  const phrase = own(tele, ".sc-tele-phrase")
  const more = own(tele, ".sc-tele-more")
  if (more.hidden === !open) return
  phrase.hidden = open
  more.hidden = !open
  phrase.setAttribute("aria-expanded", String(open))
  tele.classList.toggle("open", open)
  if (!open)
    for (const inner of more.querySelectorAll(".sc-tele.open")) setOpen(inner, false, false)
  if (open && animate && !sc.reducedMotion()) {
    more.classList.add("sc-tele-enter")
    more.addEventListener("animationend", () => more.classList.remove("sc-tele-enter"), {
      once: true,
    })
  }
}

const countWords = (el) => (el.innerText.trim().match(/\S+/g) ?? []).length

sc.onPage("telescope", (article) => {
  const blocks = [...article.querySelectorAll(".sc-telescope")]
  const disposers = []

  for (const block of blocks) {
    const maxDepth = Number(block.dataset.maxDepth)
    const controls = document.createElement("div")
    controls.className = "sc-tele-controls"
    controls.innerHTML = `
      <label><span>Detail</span>
        <input type="range" min="0" max="${maxDepth}" step="1" value="0">
      </label>
      <output class="sc-tele-count"></output>`
    block.before(controls)
    const slider = controls.querySelector("input")
    const counter = controls.querySelector("output")
    const baseWords = countWords(block)

    const refresh = () => {
      const deepest = Math.max(
        0,
        ...[...block.querySelectorAll(".sc-tele.open")].map((t) => Number(t.dataset.depth)),
      )
      slider.value = String(deepest)
      const words = countWords(block)
      counter.textContent = words === baseWords ? `${words} words` : `${baseWords} → ${words} words`
    }

    const onInput = () => {
      const depth = Number(slider.value)
      // open outer levels first so inner ones become visible in order
      const teles = [...block.querySelectorAll(".sc-tele")].sort(
        (a, b) => a.dataset.depth - b.dataset.depth,
      )
      for (const tele of teles) setOpen(tele, Number(tele.dataset.depth) <= depth, true)
      refresh()
    }

    const onClick = (event) => {
      const phrase = event.target.closest(".sc-tele-phrase")
      if (phrase) {
        setOpen(phrase.parentElement, true, true)
        own(phrase.parentElement, ".sc-tele-more")
          .querySelector(".sc-tele-phrase:not([hidden])")
          ?.focus({ preventScroll: true })
        return refresh()
      }
      const more = event.target.closest(".sc-tele-more")
      if (more && window.getSelection()?.isCollapsed !== false) {
        setOpen(more.parentElement, false, false)
        own(more.parentElement, ".sc-tele-phrase").focus({ preventScroll: true })
        refresh()
      }
    }

    const onKey = (event) => {
      if (event.key !== "Escape") return
      const more = event.target.closest(".sc-tele-more")
      if (!more) return
      setOpen(more.parentElement, false, false)
      own(more.parentElement, ".sc-tele-phrase").focus()
      refresh()
    }

    slider.addEventListener("input", onInput)
    block.addEventListener("click", onClick)
    block.addEventListener("keydown", onKey)
    refresh()
    disposers.push(() => {
      block.removeEventListener("click", onClick)
      block.removeEventListener("keydown", onKey)
    })
  }

  return () => disposers.forEach((dispose) => dispose())
})
