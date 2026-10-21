// Annotated case study (flag: case-study). `[!pins]` puts numbered pins on an image, linked to the
// notes beside it. `[!compare]` stacks two images under a draggable before/after divider.
const sc = window.showcase

function setupPins(figure) {
  const media = figure.querySelector(".sc-pins-media")
  const notes = [...figure.querySelectorAll(".sc-pin-note")]
  if (!media || notes.length === 0) return () => {}

  const stage = document.createElement("div")
  stage.className = "sc-pins-stage"
  stage.append(...media.childNodes)
  media.append(stage)

  const pins = notes.map((note, i) => {
    const pin = document.createElement("button")
    pin.type = "button"
    pin.className = "sc-pin"
    pin.innerHTML = `<span>${i + 1}</span>`
    pin.style.left = `${note.dataset.x}%`
    pin.style.top = `${note.dataset.y}%`
    pin.style.setProperty("--i", String(i))
    pin.setAttribute("aria-label", `Note ${i + 1}: ${note.textContent.trim()}`)
    note.style.setProperty("--n", `"${i + 1}"`)
    stage.append(pin)
    return pin
  })

  const bubble = document.createElement("div")
  bubble.className = "sc-pin-bubble"
  bubble.hidden = true
  stage.append(bubble)

  let pinned = -1
  const highlight = (index, { sticky = false } = {}) => {
    if (sticky) pinned = pinned === index ? -1 : index
    const shown = sticky ? pinned : index === -1 ? pinned : index
    pins.forEach((pin, i) => pin.classList.toggle("active", i === shown))
    notes.forEach((note, i) => note.classList.toggle("active", i === shown))
    bubble.hidden = shown === -1
    if (shown === -1) return
    bubble.textContent = notes[shown].textContent.trim()
    const x = Number(notes[shown].dataset.x)
    bubble.style.left = `${Math.min(Math.max(x, 18), 82)}%`
    bubble.style.top = `${notes[shown].dataset.y}%`
    bubble.dataset.side = Number(notes[shown].dataset.y) > 55 ? "above" : "below"
  }

  const indexOf = (target) => {
    const pin = target.closest(".sc-pin")
    if (pin) return pins.indexOf(pin)
    const note = target.closest(".sc-pin-note")
    return note ? notes.indexOf(note) : -1
  }
  const onOver = (event) => {
    const i = indexOf(event.target)
    if (i !== -1) highlight(i)
  }
  const onOut = (event) => {
    if (indexOf(event.target) !== -1 && indexOf(event.relatedTarget ?? document.body) === -1)
      highlight(-1)
  }
  const onClick = (event) => {
    const i = indexOf(event.target)
    if (i !== -1 && event.target.closest(".sc-pin")) highlight(i, { sticky: true })
  }
  figure.addEventListener("pointerover", onOver)
  figure.addEventListener("pointerout", onOut)
  figure.addEventListener("focusin", onOver)
  figure.addEventListener("focusout", () => highlight(-1))
  figure.addEventListener("click", onClick)

  // pins drop in when the image first scrolls into view
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      stage.classList.add("in")
      observer.disconnect()
    },
    { threshold: 0.35 },
  )
  observer.observe(stage)
  return () => observer.disconnect()
}

function setupCompare(figure) {
  const images = [...figure.querySelectorAll("img, object")]
  if (images.length < 2) return () => {}
  const [before, after] = images

  const stage = document.createElement("div")
  stage.className = "sc-compare-stage"
  const overlay = document.createElement("div")
  overlay.className = "sc-compare-after"
  overlay.append(after)
  stage.append(before, overlay)
  stage.insertAdjacentHTML(
    "beforeend",
    `<span class="sc-compare-label before"></span><span class="sc-compare-label after"></span>
     <div class="sc-compare-handle" aria-hidden="true"><span></span></div>
     <input type="range" min="0" max="100" step="0.5" value="50" class="sc-compare-range">`,
  )
  stage.querySelector(".sc-compare-label.before").textContent = figure.dataset.before
  stage.querySelector(".sc-compare-label.after").textContent = figure.dataset.after
  const range = stage.querySelector("input")
  range.setAttribute("aria-label", `${figure.dataset.before} and ${figure.dataset.after} divider`)
  figure.replaceChildren(stage)

  const set = (value) => {
    stage.style.setProperty("--split", `${value}%`)
    range.value = String(value)
  }
  set(50)
  range.addEventListener("input", () => set(Number(range.value)))

  // one gentle sweep the first time it's seen, so readers know it moves
  let frame = 0
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting || sc.reducedMotion()) return
      observer.disconnect()
      const start = performance.now()
      const sweep = (now) => {
        const k = Math.min(1, (now - start) / 1800)
        set(50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k))
        if (k < 1) frame = requestAnimationFrame(sweep)
      }
      frame = requestAnimationFrame(sweep)
    },
    { threshold: 0.6 },
  )
  observer.observe(stage)
  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
  }
}

sc.onPage("case-study", (article) => {
  const disposers = [
    ...[...article.querySelectorAll(".sc-pins")].map(setupPins),
    ...[...article.querySelectorAll(".sc-compare")].map(setupCompare),
  ]
  return () => disposers.forEach((dispose) => dispose())
})
