// Puzzle lock (flag: puzzle). Each solved clue reveals one letter; together they spell the password of
// a page encrypted by the encrypted-pages plugin. Answers are checked against salted hashes, so the
// published page never contains them. Solving hands the password to encrypted-pages, which then
// unlocks the door page by itself.
const sc = window.showcase
const PASSWORD_CACHE = "encrypted-pages-passwords" // read by encrypted-pages on every page load

const normalise = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function rememberPassword(password) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(PASSWORD_CACHE) ?? "[]")
    if (!cached.includes(password)) cached.push(password)
    sessionStorage.setItem(PASSWORD_CACHE, JSON.stringify(cached))
  } catch {}
}

function setup(puzzle, slug) {
  const { salt, door } = puzzle.dataset
  const clues = [...puzzle.querySelectorAll(".sc-clue")]
  const solved = { ...(sc.memory.get(slug, "puzzle") ?? {}) }

  const lock = document.createElement("div")
  lock.className = "sc-lock"
  lock.innerHTML = `
    <div class="sc-lock-shackle" aria-hidden="true"></div>
    <div class="sc-lock-body">
      <div class="sc-lock-slots">${clues.map(() => `<span class="sc-slot"></span>`).join("")}</div>
      <p class="sc-lock-status" aria-live="polite">Locked</p>
      <a class="sc-door" hidden>Step through the door</a>
    </div>`
  puzzle.prepend(lock)
  const slots = [...lock.querySelectorAll(".sc-slot")]

  const fill = (i, answer, animate) => {
    const clue = clues[i]
    clue.classList.add("solved")
    const input = clue.querySelector("input")
    input.value = answer
    input.disabled = true
    clue.querySelector("button").disabled = true
    clue.querySelector(".sc-clue-feedback").textContent = "Solved"
    slots[i].textContent = normalise(answer)[0].toUpperCase()
    slots[i].classList.add("filled")
    if (animate) slots[i].classList.add("flip")
  }

  const checkOpen = (animate) => {
    const letters = slots.map((slot) => slot.textContent)
    lock.querySelector(".sc-lock-status").textContent = letters.every(Boolean)
      ? "Unlocked"
      : `${letters.filter(Boolean).length} of ${slots.length} letters found`
    if (!letters.every(Boolean)) return
    rememberPassword(letters.join("").toLowerCase())
    lock.classList.add("open")
    if (animate) lock.classList.add("opening")
    if (door) {
      const link = lock.querySelector(".sc-door")
      link.href = sc.href(door)
      link.hidden = false
    }
  }

  clues.forEach((clue, i) => {
    const form = document.createElement("form")
    form.className = "sc-clue-form"
    form.innerHTML = `
      <input type="text" autocomplete="off" spellcheck="false" aria-label="Answer to clue ${i + 1}">
      <button type="submit">Try</button>
      <span class="sc-clue-feedback" aria-live="polite"></span>`
    clue.append(form)
    form.addEventListener("submit", async (event) => {
      event.preventDefault()
      const input = form.querySelector("input")
      const answer = input.value.trim()
      if (!answer) return
      const hash = await sha256(`${salt}:${normalise(answer)}`)
      const feedback = form.querySelector(".sc-clue-feedback")
      if (clue.dataset.hashes.split(" ").includes(hash)) {
        solved[i] = answer
        sc.memory.set(slug, "puzzle", solved)
        fill(i, answer, true)
        checkOpen(true)
        clues
          .find((c) => !c.classList.contains("solved"))
          ?.querySelector("input")
          ?.focus()
      } else {
        feedback.textContent = "Not quite"
        clue.classList.remove("shake")
        void clue.offsetWidth
        clue.classList.add("shake")
      }
    })
  })

  for (const [i, answer] of Object.entries(solved)) fill(Number(i), answer, false)
  checkOpen(false)
}

sc.onPage("puzzle", (article) => {
  for (const puzzle of article.querySelectorAll(".sc-puzzle")) setup(puzzle, sc.slug())
})
