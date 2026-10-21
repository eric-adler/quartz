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
 *
 *   > [!video] https://youtu.be/ID       (flag: video-notes)
 *   > - 00:42 Note shown from 42 s
 *   > - 01:30–01:55 Note with an end time
 *
 *   > [!step|state] Optional title       (flag: scrolly)
 *   > One step of a scrollytelling sequence; `state` is passed to the figure.
 *
 *   > [!pins] ![alt](image.svg)          (flag: case-study)
 *   > - 20, 35: Note pinned at 20% from the left, 35% from the top
 *
 *   > [!compare] Before | After          (flag: case-study)
 *   > ![before](before.svg) ![after](after.svg)
 */
const directiveRegex = /^\[!(\w+)(?:\|([^\]]*))?\]([+-]?)[ \t]*/
const arrowRegex = /\s*(?:→|->)\s*([\w-]+)\s*$/
const timeRegex = /^\s*((?:\d+:)?\d{1,2}:\d{2})(?:\s*[–-]\s*((?:\d+:)?\d{1,2}:\d{2}))?\s+/
const pinRegex = /^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*:\s*/
const youtubeRegex = /(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/

const handlers = {
  checkpoint: { flag: "branching", build: buildCheckpoint },
  branch: { flag: "branching", build: buildBranch },
  margin: { flag: "sidenotes", build: buildMargin },
  video: { flag: "video-notes", build: buildVideo },
  step: { flag: "scrolly", build: buildStep },
  pins: { flag: "case-study", build: buildPins },
  compare: { flag: "case-study", build: buildCompare },
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

const seconds = (stamp) => stamp.split(":").reduce((total, part) => total * 60 + Number(part), 0)

/** Text content of inline nodes, including link targets (a bare URL may arrive as a link). */
const inlineText = (nodes) =>
  nodes.map((n) => (n.type === "link" ? n.url : (n.value ?? inlineText(n.children ?? [])))).join("")

/** Strips a leading pattern from a list item's first text node; returns the match or null. */
function takePrefix(item, regex) {
  const paragraph = item.children.find((child) => child.type === "paragraph")
  const head = paragraph?.children[0]
  if (head?.type !== "text") return null
  const match = head.value.match(regex)
  if (!match) return null
  paragraph.children[0] = { ...head, value: head.value.slice(match[0].length) }
  return { match, paragraph }
}

function buildVideo(node, { title, body }) {
  const id = inlineText(title).match(youtubeRegex)?.[1] ?? ""
  const list = body.find((child) => child.type === "list")
  const notes = (list?.children ?? []).flatMap((item) => {
    const taken = takePrefix(item, timeRegex)
    if (!taken) return []
    const [, start, end] = taken.match
    return [
      {
        type: "listItem",
        data: {
          hProperties: {
            className: ["sc-vnote"],
            dataStart: String(seconds(start)),
            ...(end ? { dataEnd: String(seconds(end)) } : {}),
          },
        },
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "strong",
                data: {
                  hName: "button",
                  hProperties: { type: "button", className: ["sc-vnote-time"] },
                },
                children: [{ type: "text", value: start }],
              },
              {
                type: "emphasis",
                data: { hName: "span", hProperties: { className: ["sc-vnote-text"] } },
                children: taken.paragraph.children,
              },
            ],
          },
        ],
      },
    ]
  })

  node.data = { hName: "div", hProperties: { className: ["sc-video"], dataVideo: id } }
  node.children = [
    {
      type: "paragraph",
      data: { hName: "div", hProperties: { className: ["sc-video-stage"] } },
      children: [
        {
          type: "link",
          url: `https://www.youtube.com/watch?v=${id}`,
          data: { hProperties: { className: ["sc-video-fallback"] } },
          children: [{ type: "text", value: "Watch on YouTube" }],
        },
      ],
    },
    {
      type: "list",
      ordered: false,
      spread: false,
      data: { hName: "ol", hProperties: { className: ["sc-vnotes"] } },
      children: notes,
    },
  ]
}

function buildStep(node, { meta, title, body }) {
  node.data = { hName: "div", hProperties: { className: ["sc-step"], dataState: meta ?? "" } }
  node.children = [
    ...(title.length > 0
      ? [
          {
            type: "paragraph",
            data: { hProperties: { className: ["sc-step-title"] } },
            children: title,
          },
        ]
      : []),
    ...body,
  ]
}

function buildPins(node, { title, body }) {
  const list = body.find((child) => child.type === "list")
  for (const item of list?.children ?? []) {
    const taken = takePrefix(item, pinRegex)
    if (!taken) continue
    item.data = {
      hProperties: { className: ["sc-pin-note"], dataX: taken.match[1], dataY: taken.match[2] },
    }
  }
  if (list) list.data = { hName: "ol", hProperties: { className: ["sc-pin-notes"] } }

  node.data = { hName: "figure", hProperties: { className: ["sc-pins"] } }
  node.children = [
    {
      type: "paragraph",
      data: { hName: "div", hProperties: { className: ["sc-pins-media"] } },
      children: title,
    },
    ...body,
  ]
}

function buildCompare(node, { title, body }) {
  const labels = inlineText(title)
    .split("|")
    .map((label) => label.trim())
  node.data = {
    hName: "figure",
    hProperties: {
      className: ["sc-compare"],
      dataBefore: labels[0] || "Before",
      dataAfter: labels[1] || "After",
    },
  }
  node.children = body
}
