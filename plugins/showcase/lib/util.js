/** Demo flags declared in a page's frontmatter: `demo: [concepts, sidenotes]` or `demo: concepts`. */
export function demoFlags(file) {
  const raw = file.data?.frontmatter?.demo
  if (!raw) return new Set()
  const list = Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/)
  return new Set(list.map((flag) => String(flag).trim()).filter(Boolean))
}

/** Minimal hast element builder (avoids depending on hastscript). */
export function el(tagName, properties = {}, children = []) {
  return { type: "element", tagName, properties, children }
}

export function text(value) {
  return { type: "text", value }
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function hasClass(node, className) {
  const classes = node.properties?.className
  return Array.isArray(classes) ? classes.includes(className) : classes === className
}
