// Flashcards (flag: cards). Every ==highlight== becomes a cloze card: its sentence with the highlight
// blanked out. "Quiz me" reviews the deck (Leitner boxes: Good moves a card up, Again back to 0,
// and any card above box 0 counts as learned); "Hide highlights" tests you while reading.
// Progress is kept in reader memory, so the personal graph can tell "seen" from "learned".
const sc = window.showcase
const LEARNED_BOX = 1
const MAX_BOX = 4
const GRADES = ["Again", "Hard", "Good"]

const cardId = (value) => {
  let h = 5381
  for (const char of value) h = (Math.imul(h, 33) ^ char.codePointAt(0)) >>> 0
  return h.toString(36)
}

const shuffle = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

sc.onPage("cards", (article) => {
  const marks = [...article.querySelectorAll(".text-highlight")].filter(
    (mark) => !mark.closest(".callout"),
  )
  if (marks.length === 0) return

  const slug = sc.slug()
  const cards = marks.map((mark) => {
    const block = mark.closest("p, li, td, dd") ?? mark.parentElement
    const answer = mark.textContent.trim()
    return {
      id: cardId(`${answer}|${block.textContent.trim()}`),
      mark,
      block,
      answer,
      markIndex: [...block.querySelectorAll(".text-highlight")].indexOf(mark),
    }
  })

  let progress = { ...(sc.memory.get(slug, "cards") ?? {}) }
  const boxOf = (card) => progress[card.id]?.box ?? 0
  const save = () => sc.memory.set(slug, "cards", progress)

  // ——— deck bar ———
  const content = marks[0].closest(".markdown-preview-view") ?? article
  const deck = document.createElement("div")
  deck.className = "sc-deck"
  deck.innerHTML = `
    <div class="sc-deck-info">
      <strong>${cards.length} cards</strong>
      <span class="sc-deck-meter" aria-hidden="true"><span></span></span>
      <span class="sc-deck-learned" aria-live="polite"></span>
    </div>
    <label class="sc-switch"><input type="checkbox"><span>Hide highlights</span></label>
    <button type="button" class="sc-deck-start">Quiz me</button>`
  content.prepend(deck)
  const refreshDeck = () => {
    const learned = cards.filter((card) => boxOf(card) >= LEARNED_BOX).length
    deck.querySelector(".sc-deck-learned").textContent = `${learned} learned`
    deck.querySelector(".sc-deck-meter > span").style.width = `${(learned / cards.length) * 100}%`
  }
  refreshDeck()

  // ——— reading mode: highlights become blanks you can peek at ———
  const toggle = deck.querySelector("input")
  const onToggle = () => {
    content.classList.toggle("sc-cloze", toggle.checked)
    for (const card of cards) {
      card.mark.classList.remove("revealed")
      if (toggle.checked) {
        card.mark.setAttribute("tabindex", "0")
        card.mark.setAttribute("role", "button")
        card.mark.setAttribute("aria-label", "Hidden answer, press to reveal")
      } else {
        for (const attr of ["tabindex", "role", "aria-label"]) card.mark.removeAttribute(attr)
      }
    }
  }
  const reveal = (event) => {
    if (!toggle.checked) return
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return
    const mark = event.target.closest(".text-highlight")
    if (!mark || !content.contains(mark)) return
    event.preventDefault()
    mark.classList.add("revealed")
    mark.removeAttribute("aria-label")
  }
  toggle.addEventListener("change", onToggle)
  content.addEventListener("click", reveal)
  content.addEventListener("keydown", reveal)

  // ——— quiz ———
  let quiz = null

  function face(card, revealed) {
    const clone = card.block.cloneNode(true)
    const target = clone.querySelectorAll(".text-highlight")[card.markIndex]
    if (revealed) {
      target.className = "sc-answer"
    } else {
      const blank = document.createElement("span")
      blank.className = "sc-blank"
      blank.style.setProperty("--len", `${Math.max(4, card.answer.length)}ch`)
      blank.setAttribute("aria-label", "blank")
      target.replaceWith(blank)
    }
    const wrapper = document.createElement("div")
    wrapper.className = "sc-card-text"
    wrapper.append(...(clone.tagName === "LI" ? clone.childNodes : [clone]))
    return wrapper
  }

  function openQuiz() {
    const overlay = document.createElement("div")
    overlay.className = "sc-quiz"
    overlay.innerHTML = `
      <div class="sc-quiz-panel" role="dialog" aria-modal="true" aria-label="Flashcard quiz" tabindex="-1">
        <div class="sc-quiz-head">
          <span class="sc-quiz-count"></span>
          <span class="sc-quiz-progress" aria-hidden="true"><span></span></span>
          <button type="button" class="sc-quiz-close" aria-label="Close quiz">×</button>
        </div>
        <div class="sc-card"><div class="sc-card-inner">
          <div class="sc-card-face front"></div>
          <div class="sc-card-face back"></div>
        </div></div>
        <div class="sc-quiz-foot">
          <button type="button" class="sc-reveal">Show answer <kbd>Space</kbd></button>
          <div class="sc-grades" hidden>
            ${GRADES.map((g, i) => `<button type="button" data-grade="${i}">${g} <kbd>${i + 1}</kbd></button>`).join("")}
          </div>
        </div>
      </div>`
    document.body.append(overlay)
    document.documentElement.classList.add("sc-quiz-open")

    const panel = overlay.querySelector(".sc-quiz-panel")
    const sorted = shuffle(cards).sort((a, b) => boxOf(a) - boxOf(b))
    quiz = {
      overlay,
      panel,
      queue: sorted,
      total: sorted.length,
      done: 0,
      flipped: false,
      tally: [0, 0, 0],
      requeued: new Set(),
    }
    overlay.addEventListener("click", onQuizClick)
    requestAnimationFrame(() => overlay.classList.add("open"))
    showCard()
    panel.focus()
  }

  function showCard() {
    const { panel, queue } = quiz
    if (queue.length === 0) return summary()
    const card = queue[0]
    quiz.flipped = false
    const cardEl = panel.querySelector(".sc-card")
    cardEl.classList.remove("flipped")
    cardEl.classList.remove("enter")
    void cardEl.offsetWidth
    cardEl.classList.add("enter")
    panel.querySelector(".front").replaceChildren(face(card, false))
    panel.querySelector(".back").replaceChildren(face(card, true))
    panel.querySelector(".sc-reveal").hidden = false
    panel.querySelector(".sc-grades").hidden = true
    panel.querySelector(".sc-quiz-count").textContent = `${quiz.done + 1} / ${quiz.total}`
    panel.querySelector(".sc-quiz-progress > span").style.width =
      `${(quiz.done / quiz.total) * 100}%`
  }

  function flip() {
    if (!quiz || quiz.flipped || quiz.queue.length === 0) return
    quiz.flipped = true
    quiz.panel.querySelector(".sc-card").classList.add("flipped")
    quiz.panel.querySelector(".sc-reveal").hidden = true
    quiz.panel.querySelector(".sc-grades").hidden = false
  }

  function grade(value) {
    if (!quiz?.flipped) return
    const card = quiz.queue.shift()
    const box = boxOf(card)
    const next = value === 0 ? 0 : value === 1 ? box : Math.min(MAX_BOX, box + 1)
    progress[card.id] = { box: next, seen: (progress[card.id]?.seen ?? 0) + 1, last: Date.now() }
    save()
    quiz.tally[value]++
    // "Again" comes back once at the end of this session
    if (value === 0 && !quiz.requeued.has(card.id)) {
      quiz.requeued.add(card.id)
      quiz.queue.push(card)
      quiz.total++
    }
    quiz.done++
    refreshDeck()
    showCard()
  }

  function summary() {
    const learned = cards.filter((card) => boxOf(card) >= LEARNED_BOX).length
    const { panel } = quiz
    panel.querySelector(".sc-quiz-progress > span").style.width = "100%"
    panel.querySelector(".sc-quiz-count").textContent = "Done"
    panel.querySelector(".sc-card").outerHTML = `
      <div class="sc-quiz-summary">
        <p class="big">${learned} of ${cards.length} learned</p>
        <p>${GRADES.map((g, i) => `${quiz.tally[i]} ${g.toLowerCase()}`).join(" · ")}</p>
      </div>`
    panel.querySelector(".sc-quiz-foot").innerHTML = `
      <button type="button" class="sc-again-all">Review again</button>
      <button type="button" class="sc-quiz-close primary">Close</button>`
  }

  function closeQuiz() {
    if (!quiz) return
    const { overlay } = quiz
    quiz = null
    overlay.classList.remove("open")
    document.documentElement.classList.remove("sc-quiz-open")
    setTimeout(() => overlay.remove(), sc.reducedMotion() ? 0 : 250)
    deck.querySelector(".sc-deck-start").focus()
  }

  function onQuizClick(event) {
    if (event.target === quiz?.overlay || event.target.closest(".sc-quiz-close")) return closeQuiz()
    if (event.target.closest(".sc-reveal") || event.target.closest(".sc-card")) return flip()
    const gradeButton = event.target.closest("[data-grade]")
    if (gradeButton) return grade(Number(gradeButton.dataset.grade))
    if (event.target.closest(".sc-again-all")) {
      closeQuiz()
      openQuiz()
    }
  }

  const onKey = (event) => {
    if (!quiz) return
    if (event.key === "Escape") closeQuiz()
    else if (event.key === " " || event.key === "Enter") {
      if (event.target.closest?.("button")) return
      event.preventDefault()
      flip()
    } else if (["1", "2", "3"].includes(event.key)) grade(Number(event.key) - 1)
  }

  deck.querySelector(".sc-deck-start").addEventListener("click", openQuiz)
  document.addEventListener("keydown", onKey)

  return () => {
    document.removeEventListener("keydown", onKey)
    content.removeEventListener("click", reveal)
    content.removeEventListener("keydown", reveal)
    quiz?.overlay.remove()
    document.documentElement.classList.remove("sc-quiz-open")
    quiz = null
  }
})
