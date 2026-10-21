// Reactive document (flag: reactive). Drag a number sideways (or focus it and use the arrow keys) and
// every value computed from it updates. `evaluate`, `formatNumber` and `chooseCase` come from
// lib/expr.js, which is prepended to this script at build time.
const sc = window.showcase
const DRAG_PX = 220 // dragging this far covers a number's whole range

sc.onPage("reactive", (article) => {
  const inputs = [...article.querySelectorAll(".sc-num")]
  if (inputs.length === 0) return
  const outputs = [...article.querySelectorAll(".sc-out, .sc-case")]

  const spec = (el) => ({
    min: Number(el.dataset.min),
    max: Number(el.dataset.max),
    step: Number(el.dataset.step),
    decimals: Number(el.dataset.decimals),
  })
  const vars = Object.fromEntries(
    inputs.map((el) => [el.dataset.var, Number(el.getAttribute("aria-valuenow"))]),
  )

  const flash = (el) => {
    el.classList.remove("sc-changed")
    void el.offsetWidth
    el.classList.add("sc-changed")
  }

  function recompute() {
    for (const out of outputs) {
      let text
      try {
        text = out.classList.contains("sc-case")
          ? chooseCase(JSON.parse(out.dataset.cases), vars)
          : formatNumber(evaluate(out.dataset.expr, vars), Number(out.dataset.decimals))
      } catch {
        text = "—"
      }
      if (out.textContent !== text) {
        out.textContent = text
        flash(out)
      }
    }
  }

  function set(el, raw) {
    const { min, max, step, decimals } = spec(el)
    const value = Number(
      Math.min(max, Math.max(min, Math.round((raw - min) / step) * step + min)).toFixed(decimals),
    )
    if (value === vars[el.dataset.var]) return
    vars[el.dataset.var] = value
    for (const twin of inputs.filter((other) => other.dataset.var === el.dataset.var)) {
      twin.textContent = formatNumber(value, Number.isInteger(value) ? 0 : decimals)
      twin.setAttribute("aria-valuenow", String(value))
      twin.style.setProperty("--fill", String((value - min) / (max - min)))
    }
    recompute()
  }

  let drag = null
  const onDown = (event) => {
    const el = event.target.closest(".sc-num")
    if (!el || event.button > 0) return
    event.preventDefault()
    el.setPointerCapture(event.pointerId)
    el.focus({ preventScroll: true })
    drag = { el, x: event.clientX, start: vars[el.dataset.var] }
    el.classList.add("dragging")
    document.documentElement.classList.add("sc-dragging")
  }
  const onMove = (event) => {
    if (!drag) return
    const { min, max } = spec(drag.el)
    set(drag.el, drag.start + ((event.clientX - drag.x) / DRAG_PX) * (max - min))
  }
  const onUp = () => {
    if (!drag) return
    drag.el.classList.remove("dragging")
    document.documentElement.classList.remove("sc-dragging")
    drag = null
  }
  const onKey = (event) => {
    const el = event.target.closest(".sc-num")
    if (!el) return
    const { min, max, step } = spec(el)
    const value = vars[el.dataset.var]
    const moves = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + step * 10,
      PageDown: value - step * 10,
      Home: min,
      End: max,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    set(el, moves[event.key])
  }

  for (const el of inputs) {
    const { min, max } = spec(el)
    el.style.setProperty("--fill", String((vars[el.dataset.var] - min) / (max - min)))
  }
  article.addEventListener("pointerdown", onDown)
  article.addEventListener("pointermove", onMove)
  article.addEventListener("pointerup", onUp)
  article.addEventListener("pointercancel", onUp)
  article.addEventListener("keydown", onKey)
  recompute()

  return () => {
    article.removeEventListener("pointerdown", onDown)
    article.removeEventListener("pointermove", onMove)
    article.removeEventListener("pointerup", onUp)
    article.removeEventListener("pointercancel", onUp)
    article.removeEventListener("keydown", onKey)
    document.documentElement.classList.remove("sc-dragging")
  }
})
