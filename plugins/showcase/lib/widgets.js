import { createHash } from "node:crypto"
import { visit } from "unist-util-visit"
import { demoFlags, escapeHtml } from "./util.js"
import { effectMeta } from "./fx-meta.js"

/**
 * Fenced blocks that mount client widgets:
 *
 *   ```garden-graph```   (flag: memory-graph)  your visits drawn on the garden's graph
 *   ```garden-trail```   (flag: trail)         your route through the garden
 *   ```puzzle```         (flag: puzzle)        clues whose answers spell a password
 *   ```scrolly```        (flag: scrolly)       sticky figure for the `[!step]` callouts that follow;
 *                                              the block's content names the figure
 *   ```hoverlab```       (flag: hover-lab)     effect cards, one per line: `effect-id | word | slug`
 *   ```semantic-map```   (flag: semantic-map)  the garden laid out by meaning
 *   ```shader-stage```   (flag: shaders)       controls for the page's background shaders
 *   ```morph-gallery```  (flag: morph)         cards (one slug per line) that morph into their page
 *
 * Puzzle syntax: an optional `door: <slug>` line, then one clue per item, `clue | answer, alias`.
 * Only salted hashes of the answers are published.
 */
const widgets = {
  "garden-graph": { flag: "memory-graph", render: () => mount("graph") },
  "garden-trail": { flag: "trail", render: () => mount("trail") },
  puzzle: { flag: "puzzle", render: renderPuzzle },
  hoverlab: { flag: "hover-lab", render: renderHoverLab },
  "semantic-map": { flag: "semantic-map", render: () => mount("semantic-map") },
  "shader-stage": { flag: "shaders", render: () => mount("shader-stage") },
  "morph-gallery": { flag: "morph", render: renderMorphGallery },
  scrolly: {
    flag: "scrolly",
    render: (source) => `<div class="sc-scrolly" data-figure="${escapeHtml(source.trim())}"></div>`,
  },
}

export function remarkWidgets() {
  return (tree, file) => {
    const flags = demoFlags(file)
    if (flags.size === 0) return

    visit(tree, "code", (node, index, parent) => {
      const widget = widgets[node.lang]
      if (!widget || !flags.has(widget.flag) || !parent || index === undefined) return
      parent.children[index] = { type: "html", value: widget.render(node.value, file) }
    })
  }
}

function mount(kind) {
  return (
    `<div class="sc-mount" data-widget="${kind}">` +
    `<p class="sc-mount-fallback">This part of the page needs JavaScript.</p></div>`
  )
}

/** Normalises answers so "Roast level", "roast-level" and "ROAST LEVEL" all match. */
export const normaliseAnswer = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")

export const hashAnswer = (salt, answer) =>
  createHash("sha256")
    .update(`${salt}:${normaliseAnswer(answer)}`)
    .digest("hex")

function renderPuzzle(source, file) {
  const salt = String(file.data.slug ?? "")
  let door = ""
  const clues = []
  for (const line of source.split("\n")) {
    const doorMatch = line.match(/^\s*door:\s*(\S+)\s*$/)
    if (doorMatch) {
      door = doorMatch[1]
      continue
    }
    const item = line.match(/^\s*[-*]\s+(.+?)\s*\|\s*(.+)$/)
    if (!item) continue
    const answers = item[2]
      .split(",")
      .map((answer) => answer.trim())
      .filter(Boolean)
    clues.push({ text: item[1], hashes: answers.map((answer) => hashAnswer(salt, answer)) })
  }

  const items = clues
    .map(
      (clue, i) =>
        `<li class="sc-clue" data-hashes="${clue.hashes.join(" ")}">` +
        `<span class="sc-clue-n">${i + 1}</span><p class="sc-clue-text">${escapeHtml(clue.text)}</p></li>`,
    )
    .join("")
  return (
    `<div class="sc-puzzle" data-salt="${escapeHtml(salt)}" data-door="${escapeHtml(door)}">` +
    `<ol class="sc-clues">${items}</ol></div>`
  )
}

/** Relative URL from the current page to another slug, as Quartz writes its own links. */
function relativeHref(from, to) {
  const depth = from.split("/").length - 1
  return `${"../".repeat(depth) || "./"}${to.replace(/(^|\/)index$/, "$1")}`
}

function renderHoverLab(source, file) {
  const meta = new Map(effectMeta.map((fx) => [fx.id, fx]))
  const cards = source
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([id, word]) => meta.has(id) && word)
    .map(([id, word, slug], i) => {
      const fx = meta.get(id)
      const href = slug ? relativeHref(String(file.data.slug ?? ""), slug) : "#"
      return (
        `<li class="sc-fx-card" data-fx="${id}">` +
        `<span class="sc-fx-n">${String(i + 1).padStart(2, "0")}</span>` +
        `<a class="sc-fx-link" href="${escapeHtml(href)}" data-no-popover="true">${escapeHtml(word)}</a>` +
        `<span class="sc-fx-name">${escapeHtml(fx.name)}</span>` +
        `<span class="sc-fx-technique">${escapeHtml(fx.technique)}</span></li>`
      )
    })
  return `<ol class="sc-hoverlab">${cards.join("")}</ol>`
}

function renderMorphGallery(source, file) {
  const items = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((slug) => {
      const label = slug.split("/").pop().replace(/-/g, " ")
      const href = relativeHref(String(file.data.slug ?? ""), slug)
      return `<li><a class="sc-morph-link" href="${escapeHtml(href)}" data-slug="${escapeHtml(slug)}">${escapeHtml(label)}</a></li>`
    })
  return `<ul class="sc-morph-gallery">${items.join("")}</ul>`
}
