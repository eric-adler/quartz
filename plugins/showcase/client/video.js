// Video annotations (flag: video-notes). A YouTube video with notes that appear while it plays.
// The player loads only when the reader asks for it (YouTube sets cookies), using the privacy-
// enhanced youtube-nocookie.com host. Readers can also add their own notes at the current time.
const sc = window.showcase
const DEFAULT_NOTE_SECONDS = 12
const POLL_MS = 250

let apiPromise = null
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.onerror = () => {
      apiPromise = null
      reject(new Error("YouTube could not be loaded"))
    }
    document.head.append(script)
  })
  return apiPromise
}

const stamp = (seconds) => {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${String(m).padStart(2, "0")}:${rest}`
}

function setup(root, slug) {
  const id = root.dataset.video
  if (!id) return () => {}
  const memoryKey = `videoNotes:${id}`
  const list = root.querySelector(".sc-vnotes")
  const stage = root.querySelector(".sc-video-stage")

  stage.innerHTML = `
    <button type="button" class="sc-video-load" aria-label="Play video (loads YouTube)">
      <span class="sc-video-play" aria-hidden="true"></span>
      <span class="sc-video-consent">Plays from YouTube, which may set cookies</span>
    </button>
    <div class="sc-video-overlay" aria-live="polite"></div>`
  const overlay = stage.querySelector(".sc-video-overlay")

  const track = document.createElement("div")
  track.className = "sc-video-track"
  track.innerHTML = `<div class="sc-video-progress"></div><div class="sc-video-markers"></div>`
  stage.after(track)

  const form = document.createElement("form")
  form.className = "sc-vnote-form"
  form.innerHTML = `
    <label><span>Add a note at <b class="sc-vnote-at">00:00</b></span>
      <input type="text" placeholder="What's happening here?" maxlength="200"></label>
    <button type="submit">Add</button>`
  list.after(form)

  let player = null
  let duration = 0
  let poll = 0
  let lastActive = null

  // ——— notes: authored ones from the page, plus the reader's own ———
  const authored = [...list.querySelectorAll(".sc-vnote")]
  const readerNotes = () => sc.memory.get(slug, memoryKey) ?? []

  function renderReaderNotes() {
    list.querySelectorAll(".sc-vnote.mine").forEach((el) => el.remove())
    for (const [i, note] of readerNotes().entries()) {
      const li = document.createElement("li")
      li.className = "sc-vnote mine"
      li.dataset.start = String(note.t)
      li.innerHTML = `<p><button type="button" class="sc-vnote-time"></button><span class="sc-vnote-text"></span>
        <button type="button" class="sc-vnote-delete" aria-label="Delete your note" data-index="${i}">×</button></p>`
      li.querySelector(".sc-vnote-time").textContent = stamp(note.t)
      li.querySelector(".sc-vnote-text").textContent = note.text
      const after = [...list.children].find((el) => Number(el.dataset.start) > note.t)
      list.insertBefore(li, after ?? null)
    }
    layoutNotes()
  }

  function layoutNotes() {
    const items = [...list.querySelectorAll(".sc-vnote")]
    items.forEach((li, i) => {
      const start = Number(li.dataset.start)
      const nextStart = Number(items[i + 1]?.dataset.start ?? Infinity)
      li.dataset.until = li.dataset.end ?? String(Math.min(start + DEFAULT_NOTE_SECONDS, nextStart))
    })
    const markers = track.querySelector(".sc-video-markers")
    markers.replaceChildren()
    if (!duration) return
    for (const li of items) {
      const marker = document.createElement("button")
      marker.type = "button"
      marker.className = `sc-video-marker${li.classList.contains("mine") ? " mine" : ""}`
      marker.style.left = `${(Number(li.dataset.start) / duration) * 100}%`
      marker.dataset.start = li.dataset.start
      marker.setAttribute("aria-label", `Jump to ${stamp(Number(li.dataset.start))}`)
      markers.append(marker)
    }
  }

  // ——— player ———
  async function load(startAt = 0) {
    if (player) return player
    stage.classList.add("loading")
    const YT = await loadYouTubeApi()
    const host = document.createElement("div")
    stage.querySelector(".sc-video-load").replaceWith(host)
    await new Promise((resolve) => {
      player = new YT.Player(host, {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        playerVars: { rel: 0, playsinline: 1, start: Math.floor(startAt), autoplay: 1 },
        events: {
          onReady: () => {
            duration = player.getDuration()
            layoutNotes()
            resolve()
          },
        },
      })
    })
    stage.classList.remove("loading")
    stage.classList.add("ready")
    poll = window.setInterval(tick, POLL_MS)
    return player
  }

  function tick() {
    if (!player?.getCurrentTime) return
    const t = player.getCurrentTime()
    form.querySelector(".sc-vnote-at").textContent = stamp(t)
    if (duration) track.querySelector(".sc-video-progress").style.width = `${(t / duration) * 100}%`

    let active = null
    for (const li of list.querySelectorAll(".sc-vnote")) {
      const start = Number(li.dataset.start)
      const until = Number(li.dataset.until)
      const on = t >= start && t < until
      li.classList.toggle("active", on)
      li.classList.toggle("past", t >= until)
      li.style.setProperty(
        "--p",
        on ? String((t - start) / (until - start)) : t >= until ? "1" : "0",
      )
      if (on) active = li
    }
    if (active !== lastActive) {
      lastActive = active
      overlay.classList.remove("show")
      if (active) {
        overlay.textContent = active.querySelector(".sc-vnote-text").textContent
        overlay.classList.toggle("mine", active.classList.contains("mine"))
        void overlay.offsetWidth
        overlay.classList.add("show")
      }
    }
  }

  async function seek(seconds) {
    if (!player) return load(seconds)
    player.seekTo(seconds, true)
    player.playVideo()
    tick()
  }

  const onClick = (event) => {
    if (event.target.closest(".sc-video-load")) return load()
    const del = event.target.closest(".sc-vnote-delete")
    if (del) {
      const notes = readerNotes()
      notes.splice(Number(del.dataset.index), 1)
      sc.memory.set(slug, memoryKey, notes)
      return renderReaderNotes()
    }
    const jump = event.target.closest(".sc-vnote-time, .sc-video-marker")
    if (jump) seek(Number((jump.closest(".sc-vnote") ?? jump).dataset.start))
  }

  const onSubmit = (event) => {
    event.preventDefault()
    const input = form.querySelector("input")
    const text = input.value.trim()
    if (!text) return
    const t = Math.floor(player?.getCurrentTime?.() ?? 0)
    sc.memory.set(
      slug,
      memoryKey,
      [...readerNotes(), { t, text }].sort((a, b) => a.t - b.t),
    )
    input.value = ""
    renderReaderNotes()
  }

  root.addEventListener("click", onClick)
  form.addEventListener("submit", onSubmit)
  renderReaderNotes()
  authored.forEach((li) => li.classList.add("authored"))

  return () => {
    window.clearInterval(poll)
    player?.destroy?.()
  }
}

sc.onPage("video-notes", (article) => {
  const disposers = [...article.querySelectorAll(".sc-video")].map((root) => setup(root, sc.slug()))
  return () => disposers.forEach((dispose) => dispose())
})
