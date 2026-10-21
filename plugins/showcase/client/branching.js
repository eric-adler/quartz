// Choose-your-own-depth (flag: branching). Checkpoints hold back the rest of the article until the
// reader answers; an answer can reveal a branch of extra support right where it was asked for.
// Answers are remembered per page, and "show everything" turns the page back into a plain article.
const sc = window.showcase

sc.onPage("branching", (article) => {
  const checkpoints = [...article.querySelectorAll(".sc-checkpoint")]
  if (checkpoints.length === 0) return

  const slug = sc.slug()
  let choices = { ...(sc.memory.get(slug, "choices") ?? {}) }
  let showAll = Boolean(sc.memory.get(slug, "showAll"))

  // Every branch remembers where the author put it, so "show everything" can restore that order.
  const branches = new Map()
  for (const branch of article.querySelectorAll(".sc-branch")) {
    const home = document.createComment(`branch ${branch.dataset.branch}`)
    branch.before(home)
    branches.set(branch.dataset.branch, { el: branch, home })
  }

  // A reveal slot right after each checkpoint receives the chosen branch.
  const slots = new Map()
  for (const checkpoint of checkpoints) {
    const slot = document.createElement("div")
    slot.className = "sc-reveal"
    checkpoint.after(slot)
    slots.set(checkpoint, slot)

    const skip = document.createElement("button")
    skip.type = "button"
    skip.className = "sc-skip"
    skip.textContent = "Skip this question"
    checkpoint.querySelector(".sc-choices").append(skip)
  }

  const bar = document.createElement("div")
  bar.className = "sc-cyoa-bar"
  bar.innerHTML = `
    <span class="sc-cyoa-progress" aria-live="polite"></span>
    <label class="sc-switch"><input type="checkbox"><span>Show everything</span></label>
    <button type="button" class="sc-cyoa-reset">Start over</button>`
  const toggle = bar.querySelector("input")
  toggle.checked = showAll
  // Themes may wrap the rendered markdown, so gate the element that actually holds the top-level blocks.
  const content = checkpoints.find((cp) => !cp.closest(".sc-branch")).parentElement
  content.prepend(bar)

  const chosenBranch = (checkpoint) => {
    const choice = choices[checkpoint.dataset.checkpoint]
    if (choice === undefined || choice === "skip") return null
    const button = checkpoint.querySelector(`.sc-choice[data-choice="${choice}"]`)
    const target = button?.dataset.target
    return target ? { branch: branches.get(target), label: button.textContent.trim() } : null
  }

  const isVisible = (el) => el.checkVisibility?.() ?? el.offsetParent !== null
  const branchEls = () => [...branches.values()].map((b) => b.el)
  // everything that can appear or disappear: top-level blocks, branches, and blocks inside branches
  const animatable = () => [
    ...branchEls(),
    ...[content, ...branchEls()].flatMap((c) => [...c.children]),
  ]

  function gate(container) {
    let held = false
    for (const child of container.children) {
      // branches are shown or hidden by choices, never held back by position
      const isBranch = child.classList.contains("sc-branch")
      child.classList.toggle("sc-held", held && !showAll && !isBranch)
      if (
        child.classList.contains("sc-checkpoint") &&
        choices[child.dataset.checkpoint] === undefined
      ) {
        held = true
      }
    }
  }

  function apply({ animate }) {
    const wasVisible = new Set(animatable().filter(isVisible))

    for (const checkpoint of checkpoints) {
      const choice = choices[checkpoint.dataset.checkpoint]
      checkpoint.classList.toggle("answered", choice !== undefined)
      for (const button of checkpoint.querySelectorAll(".sc-choice")) {
        button.setAttribute("aria-pressed", String(button.dataset.choice === String(choice)))
      }
    }

    for (const { el, home } of branches.values()) {
      if (showAll) {
        home.after(el)
        el.hidden = false
        delete el.dataset.because
      } else {
        el.hidden = true
      }
    }

    if (!showAll) {
      for (const checkpoint of checkpoints) {
        const chosen = chosenBranch(checkpoint)
        if (!chosen?.branch) continue
        slots.get(checkpoint).append(chosen.branch.el)
        chosen.branch.el.hidden = false
        chosen.branch.el.dataset.because = chosen.label
      }
    }

    gate(content)
    for (const el of branchEls()) gate(el)

    if (animate && !sc.reducedMotion()) {
      const entering = animatable().filter(
        (el) => isVisible(el) && !wasVisible.has(el) && !el.classList.contains("sc-reveal"),
      )
      entering.forEach((el, i) => {
        el.style.setProperty("--enter-delay", `${Math.min(i, 6) * 60}ms`)
        el.classList.add("sc-enter")
        el.addEventListener("animationend", () => el.classList.remove("sc-enter"), { once: true })
      })
    }

    const reachable = checkpoints.filter(isVisible)
    const answered = reachable.filter((cp) => choices[cp.dataset.checkpoint] !== undefined)
    const detours = checkpoints.filter((cp) => chosenBranch(cp)?.branch).length
    const route =
      detours === 0 ? "the direct route" : `${detours} detour${detours === 1 ? "" : "s"}`
    bar.querySelector(".sc-cyoa-progress").textContent = showAll
      ? "Full article, every branch shown"
      : answered.length === reachable.length
        ? `Your version: ${route}`
        : answered.length === 0
          ? "Answer a checkpoint to read on"
          : `${answered.length} answered so far, ${route}`
  }

  function choose(checkpoint, choice) {
    choices[checkpoint.dataset.checkpoint] = choice
    sc.memory.set(slug, "choices", choices)
    apply({ animate: true })
    const revealed =
      slots.get(checkpoint).firstElementChild ?? slots.get(checkpoint).nextElementSibling
    if (revealed && revealed.getBoundingClientRect().top > window.innerHeight * 0.75) {
      revealed.scrollIntoView({ behavior: sc.reducedMotion() ? "auto" : "smooth", block: "center" })
    }
  }

  const onClick = (event) => {
    const checkpoint = event.target.closest(".sc-checkpoint")
    if (!checkpoint || !article.contains(checkpoint)) return
    const button = event.target.closest(".sc-choice")
    if (button) choose(checkpoint, button.dataset.choice)
    else if (event.target.closest(".sc-skip")) choose(checkpoint, "skip")
  }

  const onToggle = () => {
    showAll = toggle.checked
    sc.memory.set(slug, "showAll", showAll)
    apply({ animate: true })
  }

  const onReset = () => {
    choices = {}
    sc.memory.set(slug, "choices", choices)
    apply({ animate: false })
    checkpoints[0].scrollIntoView({
      behavior: sc.reducedMotion() ? "auto" : "smooth",
      block: "center",
    })
  }

  article.classList.add("sc-cyoa")
  article.addEventListener("click", onClick)
  toggle.addEventListener("change", onToggle)
  bar.querySelector(".sc-cyoa-reset").addEventListener("click", onReset)
  apply({ animate: false })

  return () => article.removeEventListener("click", onClick)
})
