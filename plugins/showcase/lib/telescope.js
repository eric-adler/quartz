import { visit } from "unist-util-visit"
import { demoFlags, escapeHtml } from "./util.js"

/**
 * ```telescope fences (flag: telescope) become text that expands in place.
 *
 *   - I made {coffee}.
 *     - coffee: a {pour-over} with beans from Ethiopia
 *       - pour-over: slow pour-over through a paper filter
 *
 * Every `{phrase}` with a matching child line `phrase: replacement` becomes expandable.
 */
const itemRegex = /^(\s*)[-*+]\s+(.*)$/
const phraseRegex = /(\{[^{}]+\})/

export function remarkTelescope() {
  return (tree, file) => {
    if (!demoFlags(file).has("telescope")) return

    visit(tree, "code", (node, index, parent) => {
      if (node.lang !== "telescope" || !parent || index === undefined) return
      parent.children[index] = { type: "html", value: renderTelescope(parseOutline(node.value)) }
    })
  }
}

function parseOutline(source) {
  const root = { children: [], indent: -1 }
  const stack = [root]
  for (const line of source.split("\n")) {
    const match = line.replace(/\t/g, "  ").match(itemRegex)
    if (!match) continue
    const indent = match[1].length
    const item = { raw: match[2].trim(), children: [], indent }
    while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop()
    stack.at(-1).children.push(item)
    stack.push(item)
  }
  return root.children
}

function renderTelescope(lines) {
  let maxDepth = 0

  const renderText = (value, expansions, depth) => {
    const byPhrase = new Map()
    for (const expansion of expansions) {
      const colon = expansion.raw.indexOf(":")
      if (colon === -1) continue
      byPhrase.set(expansion.raw.slice(0, colon).trim(), {
        text: expansion.raw.slice(colon + 1).trim(),
        children: expansion.children,
      })
    }

    return value
      .split(phraseRegex)
      .map((part) => {
        if (!phraseRegex.test(part)) return escapeHtml(part)
        const phrase = part.slice(1, -1)
        const expansion = byPhrase.get(phrase.trim())
        if (!expansion) return escapeHtml(phrase)

        const level = depth + 1
        maxDepth = Math.max(maxDepth, level)
        return (
          `<span class="sc-tele" data-depth="${level}">` +
          `<button type="button" class="sc-tele-phrase" aria-expanded="false">${escapeHtml(phrase)}</button>` +
          `<span class="sc-tele-more" hidden>${renderText(expansion.text, expansion.children, level)}</span>` +
          `</span>`
        )
      })
      .join("")
  }

  const body = lines
    .map((line) => `<p class="sc-tele-line">${renderText(line.raw, line.children, 0)}</p>`)
    .join("")
  return `<div class="sc-telescope" data-max-depth="${maxDepth}">${body}</div>`
}
