import { visit } from "unist-util-visit"
import { demoFlags } from "./util.js"

/**
 * Custom callout types, handled on the Markdown tree *before* ObsidianFlavoredMarkdown sees them
 * (the plugin runs at a lower `order`), so we own the markup:
 *
 *   > [!checkpoint] Question            (flag: branching)
 *   > - Choice that just continues
 *   > - Choice that reveals a branch → branch-id
 *
 *   > [!branch|branch-id] Optional title (flag: branching)
 *   > Content revealed by a choice.
 *
 *   > [!margin] Optional title          (flag: sidenotes)
 *   > Content placed in the right margin.
 */
const directiveRegex = /^\[!(\w+)(?:\|([^\]]*))?\]([+-]?)[ \t]*/
const arrowRegex = /\s*(?:→|->)\s*([\w-]+)\s*$/

const handlers = {
  checkpoint: { flag: "branching", build: buildCheckpoint },
  branch: { flag: "branching", build: buildBranch },
  margin: { flag: "sidenotes", build: buildMargin },
}

export function remarkShowcaseCallouts() {
  return (tree, file) => {
    const flags = demoFlags(file)
    if (flags.size === 0) return

    let checkpointCount = 0
    visit(tree, "blockquote", (node) => {
      const directive = readDirective(node)
      if (!directive) return
      const handler = handlers[directive.type]
      if (!handler || !flags.has(handler.flag)) return

      if (directive.type === "checkpoint") directive.index = ++checkpointCount
      handler.build(node, directive)
      // children were rebuilt; still descend so nested checkpoints inside branches are handled
    })
  }
}

/** Parses `[!type|meta] title` off the first paragraph and returns the title's inline nodes. */
function readDirective(blockquote) {
  const first = blockquote.children[0]
  if (first?.type !== "paragraph") return null
  const head = first.children[0]
  if (head?.type !== "text") return null

  const match = head.value.match(directiveRegex)
  if (!match) return null

  const [directive, type, meta, fold] = match
  const rest = head.value.slice(directive.length)
  const [firstLine, ...moreLines] = rest.split("\n")

  // OFM's text transform puts the title on its own paragraph, but be defensive about
  // content that shares the paragraph on following lines.
  const title = [...(firstLine ? [{ type: "text", value: firstLine }] : [])]
  let body = blockquote.children.slice(1)
  if (moreLines.length > 0) {
    const remainder = [{ type: "text", value: moreLines.join("\n") }, ...first.children.slice(1)]
    body = [{ type: "paragraph", children: remainder }, ...body]
  } else {
    title.push(...first.children.slice(1))
  }

  return { type: type.toLowerCase(), meta: meta?.trim(), fold, title: trimInline(title), body }
}

function trimInline(nodes) {
  const isBlank = (n) => n?.type === "text" && n.value.trim() === ""
  while (isBlank(nodes[0])) nodes.shift()
  while (isBlank(nodes.at(-1))) nodes.pop()
  return nodes
}

function buildCheckpoint(node, { index, title, body }) {
  const list = body.find((child) => child.type === "list")
  const choices = (list?.children ?? []).map((item, i) => {
    const paragraph = item.children.find((child) => child.type === "paragraph")
    const inline = paragraph ? [...paragraph.children] : []
    let target = ""
    const last = inline.at(-1)
    if (last?.type === "text") {
      const arrow = last.value.match(arrowRegex)
      if (arrow) {
        target = arrow[1]
        inline[inline.length - 1] = { ...last, value: last.value.slice(0, arrow.index) }
      }
    }
    return {
      type: "paragraph",
      data: {
        hName: "button",
        hProperties: {
          type: "button",
          className: ["sc-choice"],
          dataChoice: String(i),
          dataTarget: target,
        },
      },
      children: trimInline(inline),
    }
  })

  node.data = {
    hName: "div",
    hProperties: { className: ["sc-checkpoint"], dataCheckpoint: `cp-${index}`, role: "group" },
  }
  node.children = [
    {
      type: "paragraph",
      data: { hProperties: { className: ["sc-checkpoint-q"] } },
      children: title,
    },
    {
      type: "blockquote",
      data: { hName: "div", hProperties: { className: ["sc-choices"] } },
      children: choices,
    },
  ]
}

function buildBranch(node, { meta, title, body }) {
  node.data = {
    hName: "div",
    hProperties: { className: ["sc-branch"], dataBranch: meta ?? "" },
  }
  node.children = [
    ...(title.length > 0
      ? [
          {
            type: "paragraph",
            data: { hProperties: { className: ["sc-branch-title"] } },
            children: title,
          },
        ]
      : []),
    ...body,
  ]
}

function buildMargin(node, { title, body }) {
  node.data = {
    hName: "aside",
    hProperties: { className: ["sc-margin"], role: "note" },
  }
  node.children = [
    ...(title.length > 0
      ? [
          {
            type: "paragraph",
            data: { hProperties: { className: ["sc-margin-title"] } },
            children: title,
          },
        ]
      : []),
    ...body,
  ]
}
