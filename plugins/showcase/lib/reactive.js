import { visit } from "unist-util-visit"
import { chooseCase, evaluate, formatNumber } from "./expr.js"
import { demoFlags, escapeHtml } from "./util.js"

/**
 * Reactive documents (flag: reactive), written as inline code so the source stays readable:
 *
 *   `dose: 18 [12..22, 0.5]`        a number readers can drag (min..max, optional step)
 *   `= dose * 16 | 1`               a computed value (optional decimals after |)
 *   `? dose > 20: strong | mild`    the text of the first case that holds (last may be a default)
 *
 * Values are computed at build time too, so the page reads correctly without JavaScript.
 */
const numberRegex =
  /^([A-Za-z_]\w*)\s*:\s*(-?\d+(?:\.\d+)?)\s*\[\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\]$/
const outputRegex = /^=\s*(.+?)(?:\s*\|\s*(\d+))?$/
const caseRegex = /^\?\s*(.+)$/

const decimalsOf = (value) => (String(value).split(".")[1] ?? "").length

export function parseCases(source) {
  return source.split("|").map((part) => {
    const colon = part.indexOf(":")
    return colon === -1
      ? { when: "", text: part.trim() }
      : { when: part.slice(0, colon).trim(), text: part.slice(colon + 1).trim() }
  })
}

export function remarkReactive() {
  return (tree, file) => {
    if (!demoFlags(file).has("reactive")) return

    const vars = {}
    visit(tree, "inlineCode", (node) => {
      const match = node.value.match(numberRegex)
      if (match) vars[match[1]] = Number(match[2])
    })

    visit(tree, "inlineCode", (node, index, parent) => {
      if (!parent || index === undefined) return
      const html = render(node.value, vars, file)
      if (html) parent.children[index] = { type: "html", value: html }
    })
  }
}

function render(source, vars, file) {
  const number = source.match(numberRegex)
  if (number) {
    const [, name, value, min, max, step = "1"] = number
    const decimals = Math.max(decimalsOf(step), decimalsOf(value))
    return (
      `<span class="sc-num" data-var="${name}" data-min="${min}" data-max="${max}" ` +
      `data-step="${step}" data-decimals="${decimals}" tabindex="0" role="slider" ` +
      `aria-label="${name}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}">` +
      `${formatNumber(Number(value), Number.isInteger(Number(value)) ? 0 : decimals)}</span>`
    )
  }

  try {
    const output = source.match(outputRegex)
    if (output) {
      const [, expression, decimals = "0"] = output
      const value = formatNumber(evaluate(expression, vars), Number(decimals))
      return (
        `<span class="sc-out" data-expr="${escapeHtml(expression)}" data-decimals="${decimals}" ` +
        `aria-live="polite">${value}</span>`
      )
    }

    const cases = source.match(caseRegex)
    if (cases) {
      const parsed = parseCases(cases[1])
      return (
        `<span class="sc-case" data-cases="${escapeHtml(JSON.stringify(parsed))}" aria-live="polite">` +
        `${escapeHtml(chooseCase(parsed, vars))}</span>`
      )
    }
  } catch (error) {
    console.warn(`[showcase] ${file.data.slug}: ${error.message}`)
  }
  return null
}
