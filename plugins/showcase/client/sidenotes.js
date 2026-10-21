// Sidenotes (flag: sidenotes). Wide screens: notes sit in the margin and a reference highlights its
// note. Narrow screens: the reference number toggles the note inline instead of jumping away.
const sc = window.showcase

sc.onPage("sidenotes", (article) => {
  const wide = window.matchMedia("(min-width: 1200px)")
  const noteFor = (ref) => article.querySelector(`#${CSS.escape(ref.dataset.sidenote)}`)
  const refFor = (note) => article.querySelector(`a[data-sidenote="${note.id}"]`)

  for (const ref of article.querySelectorAll("a[data-sidenote]")) {
    ref.setAttribute("aria-controls", ref.dataset.sidenote)
    ref.setAttribute("aria-expanded", "false")
  }

  const onClick = (event) => {
    const ref = event.target.closest("a[data-sidenote]")
    if (!ref) return
    event.preventDefault()
    const note = noteFor(ref)
    if (!note) return
    if (wide.matches) {
      note.classList.remove("sc-flash")
      void note.offsetWidth
      note.classList.add("sc-flash")
    } else {
      ref.setAttribute("aria-expanded", String(note.classList.toggle("open")))
    }
  }

  const highlight = (event, on) => {
    const ref = event.target.closest("a[data-sidenote]")
    const note = ref ? noteFor(ref) : event.target.closest(".sidenote")
    const pair = note && (ref ?? refFor(note))
    if (!note || !pair) return
    note.classList.toggle("sc-hl", on)
    pair.classList.toggle("sc-hl", on)
  }
  const onOver = (event) => highlight(event, true)
  const onOut = (event) => highlight(event, false)

  article.addEventListener("click", onClick)
  article.addEventListener("pointerover", onOver)
  article.addEventListener("pointerout", onOut)
  return () => {
    article.removeEventListener("click", onClick)
    article.removeEventListener("pointerover", onOver)
    article.removeEventListener("pointerout", onOut)
  }
})
