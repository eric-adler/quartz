import { visit } from "unist-util-visit"
import { demoFlags, el, hasClass, text } from "./util.js"

/**
 * Stamps the page's demo flags onto the article so client scripts and CSS can scope themselves:
 * `<span class="demo-flags" data-demo="concepts sidenotes" hidden>`.
 */
export function rehypeDemoFlags() {
  return (tree, file) => {
    const flags = demoFlags(file)
    if (flags.size === 0) return
    tree.children.unshift(
      el("span", { className: ["demo-flags"], dataDemo: [...flags].join(" "), hidden: true }),
    )
  }
}

/**
 * Footnotes → sidenotes (flag: sidenotes). Each GFM footnote's content is copied next to its
 * reference as an inline `span.sidenote`. The original footnote list stays for small screens and
 * no-JS readers.
 */
export function rehypeSidenotes() {
  return (tree, file) => {
    if (!demoFlags(file).has("sidenotes")) return

    const definitions = new Map()
    visit(tree, "element", (node) => {
      if (node.tagName === "li" && String(node.properties?.id ?? "").includes("fn-")) {
        definitions.set(String(node.properties.id), node)
      }
    })
    if (definitions.size === 0) return

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "sup" || !parent || index === undefined) return
      const ref = node.children.find(
        (child) =>
          child.type === "element" &&
          child.tagName === "a" &&
          "dataFootnoteRef" in child.properties,
      )
      if (!ref) return

      const id = String(ref.properties.href ?? "").replace(/^#/, "")
      const definition = definitions.get(id)
      if (!definition) return

      const number = ref.children.map((child) => child.value ?? "").join("")
      ref.properties.dataRouterIgnore = true
      ref.properties.dataSidenote = `sn-${id}`

      const sidenote = el("span", { className: ["sidenote"], id: `sn-${id}`, role: "note" }, [
        el("span", { className: ["sidenote-num"], ariaHidden: "true" }, [text(number)]),
        ...inlineCopy(definition.children),
      ])
      parent.children.splice(index + 1, 0, sidenote)
      return index + 2
    })
  }
}

/** Copies footnote content as inline-safe nodes: paragraphs become block-styled spans, backrefs drop. */
function inlineCopy(nodes) {
  const out = []
  for (const node of nodes) {
    if (node.type === "text") {
      out.push({ ...node })
      continue
    }
    if (node.type !== "element") continue
    if (node.tagName === "a" && "dataFootnoteBackref" in node.properties) continue
    if (node.tagName === "p") {
      out.push(el("span", { className: ["sidenote-p"] }, inlineCopy(node.children)))
      continue
    }
    if (hasClass(node, "sidenote")) continue
    out.push({ ...node, properties: { ...node.properties }, children: inlineCopy(node.children) })
  }
  return out
}
