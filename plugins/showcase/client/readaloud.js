// Read aloud (flag: read-aloud). The browser's own speech engine reads the page block by block. The
// current word is highlighted with the CSS Custom Highlight API (no DOM changes); voices that don't
// report word positions fall back to highlighting the whole paragraph.
const sc = window.showcase
const WORDS_PER_MINUTE = 170
const SPEEDS = [0.8, 1, 1.25, 1.5, 1.75]
const BLOCKS = "h2, h3, h4, p, li"
const SKIP = "pre, code, .katex, sup, .sidenote, .callout, .sc-reader, .demo-flags, figure"

/** A block's speakable text plus a map from character offsets back to its text nodes. */
function readable(block) {
  const parts = []
  let text = ""
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement.closest(SKIP) || node.parentElement.closest(BLOCKS) !== block
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    parts.push({ node, start: text.length })
    text += node.data
  }
  return { block, text: text.replace(/\s+/g, " "), raw: text, parts }
}

function rangeFor(item, from, to) {
  const locate = (offset) => {
    let part = item.parts[0]
    for (const p of item.parts) if (p.start <= offset) part = p
    return [part.node, Math.min(offset - part.start, part.node.data.length)]
  }
  const range = new Range()
  range.setStart(...locate(from))
  range.setEnd(...locate(to))
  return range
}

sc.onPage("read-aloud", (article) => {
  const content = article.querySelector(".markdown-preview-view") ?? article
  const items = [...content.querySelectorAll(BLOCKS)]
    .filter((block) => !block.closest(SKIP) && !block.querySelector(":scope > p"))
    .map(readable)
    .filter((item) => item.text.trim().length > 0)
  if (items.length === 0) return

  const reader = document.createElement("div")
  reader.className = "sc-reader"
  content.prepend(reader)

  const synth = window.speechSynthesis
  if (!synth) {
    reader.innerHTML = `<p class="sc-reader-note">This browser can't read pages aloud.</p>`
    return
  }

  const words = items.reduce((sum, item) => sum + (item.text.match(/\S+/g)?.length ?? 0), 0)
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  reader.innerHTML = `
    <button type="button" class="sc-reader-play" aria-label="Play">
      <span class="sc-reader-icon" aria-hidden="true"></span><span class="sc-reader-label">Listen · ${minutes} min</span>
    </button>
    <button type="button" class="sc-reader-speed" aria-label="Speed">1×</button>
    <select class="sc-reader-voice" aria-label="Voice"></select>
    <span class="sc-reader-pos" aria-live="polite"></span>
    <button type="button" class="sc-reader-stop" aria-label="Stop" hidden>Stop</button>
    <p class="sc-reader-note" hidden></p>`
  const playButton = reader.querySelector(".sc-reader-play")
  const speedButton = reader.querySelector(".sc-reader-speed")
  const voiceSelect = reader.querySelector(".sc-reader-voice")
  const position = reader.querySelector(".sc-reader-pos")
  const note = reader.querySelector(".sc-reader-note")
  const highlights = "highlights" in CSS ? CSS.highlights : null

  let voices = []
  const loadVoices = () => {
    const lang = (document.documentElement.lang || "en").slice(0, 2)
    voices = synth.getVoices().filter((voice) => voice.lang.startsWith(lang))
    // local voices are the ones that report word positions most reliably
    voices.sort((a, b) => Number(b.localService) - Number(a.localService))
    voiceSelect.replaceChildren(
      ...voices.map(
        (voice, i) =>
          new Option(`${voice.name}${voice.localService ? "" : " (online)"}`, String(i)),
      ),
    )
    voiceSelect.hidden = voices.length < 2
  }
  loadVoices()
  synth.addEventListener?.("voiceschanged", loadVoices)

  let state = "idle" // idle | playing | paused
  let index = 0
  let speed = 1
  let token = 0
  let sawBoundary = false

  const clearMarks = () => {
    highlights?.delete("sc-word")
    content.querySelectorAll(".sc-reading").forEach((el) => el.classList.remove("sc-reading"))
  }

  const render = () => {
    reader.dataset.state = state
    playButton.setAttribute("aria-label", state === "playing" ? "Pause" : "Play")
    reader.querySelector(".sc-reader-label").textContent =
      state === "playing" ? "Pause" : state === "paused" ? "Resume" : `Listen · ${minutes} min`
    reader.querySelector(".sc-reader-stop").hidden = state === "idle"
    position.textContent = state === "idle" ? "" : `${index + 1} / ${items.length}`
    content.classList.toggle("sc-reader-active", state !== "idle")
  }

  function speak(i) {
    const run = ++token
    synth.cancel()
    clearMarks()
    if (i >= items.length) {
      state = "idle"
      index = 0
      return render()
    }
    index = i
    state = "playing"
    render()

    const item = items[i]
    item.block.classList.add("sc-reading")
    const rect = item.block.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.15 || rect.bottom > window.innerHeight * 0.85) {
      item.block.scrollIntoView({
        block: "center",
        behavior: sc.reducedMotion() ? "auto" : "smooth",
      })
    }

    // speak the raw text so boundary offsets line up with the text nodes
    const utterance = new SpeechSynthesisUtterance(item.raw)
    utterance.rate = speed
    utterance.voice = voices[Number(voiceSelect.value)] ?? null
    sawBoundary = false
    utterance.onboundary = (event) => {
      if (run !== token || event.name !== "word" || !highlights) return
      sawBoundary = true
      const length =
        event.charLength || (item.raw.slice(event.charIndex).match(/^\S+/)?.[0].length ?? 0)
      highlights.set(
        "sc-word",
        new Highlight(rangeFor(item, event.charIndex, event.charIndex + length)),
      )
    }
    utterance.onend = () => {
      if (run !== token) return
      if (!sawBoundary && highlights) {
        note.hidden = false
        note.textContent =
          "This voice doesn't report word positions, so whole paragraphs are highlighted."
      }
      speak(i + 1)
    }
    utterance.onerror = (event) => {
      if (run === token && event.error !== "interrupted" && event.error !== "canceled") speak(i + 1)
    }
    synth.speak(utterance)
  }

  const stop = () => {
    token++
    synth.cancel()
    clearMarks()
    state = "idle"
    index = 0
    render()
  }

  playButton.addEventListener("click", () => {
    if (state === "playing") {
      synth.pause()
      state = "paused"
    } else if (state === "paused") {
      synth.resume()
      state = "playing"
    } else {
      speak(index)
    }
    render()
  })
  speedButton.addEventListener("click", () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    speedButton.textContent = `${speed}×`
    if (state === "playing") speak(index)
  })
  voiceSelect.addEventListener("change", () => state === "playing" && speak(index))
  reader.querySelector(".sc-reader-stop").addEventListener("click", stop)

  // while listening, clicking a paragraph jumps there
  const onClick = (event) => {
    if (state === "idle" || event.target.closest("a, button, select, input, .sc-reader")) return
    const i = items.findIndex((item) => item.block.contains(event.target))
    if (i !== -1) speak(i)
  }
  content.addEventListener("click", onClick)
  render()

  return () => {
    token++
    synth.cancel()
    clearMarks()
    synth.removeEventListener?.("voiceschanged", loadVoices)
    content.removeEventListener("click", onClick)
  }
})
