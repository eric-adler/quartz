import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { remarkShowcaseCallouts } from "./lib/callouts.js"
import { remarkTelescope } from "./lib/telescope.js"
import { remarkWidgets } from "./lib/widgets.js"
import { remarkReactive } from "./lib/reactive.js"
import { rehypeDemoFlags, rehypeSidenotes } from "./lib/rehype.js"
import { lazyFiles } from "./lib/lazy.js"

const here = path.dirname(fileURLToPath(import.meta.url))

// Each feature may have a client script (client/<name>.js) and a stylesheet (styles/<name>.css).
// Order matters: core defines `window.showcase` (flags, reader memory, lazy loading) and drawer the
// shared drawer that later features use.
const features = [
  "core",
  "drawer",
  "concepts",
  "branching",
  "sidenotes",
  "telescope",
  "garden",
  "tprofile",
  "cards",
  "puzzle",
  "video",
  "scrolly",
  "reactive",
  "casestudy",
  "readaloud",
  "morph",
  "lazy-pages",
  // styles only: their scripts are lazy modules (lazy/), loaded by lazy-pages
  "hoverlab",
  "shaders",
  "semantic-map",
]

// Build-time modules a client script also needs, prepended to it. They must have no imports, and
// lose their `export` keywords because Quartz wraps every inline script in a function.
const preludes = { reactive: ["lib/expr.js"] }

const read = (dir, name, ext) => {
  const file = path.join(here, dir, `${name}.${ext}`)
  return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : null
}
const clientScript = (name) =>
  [
    ...(preludes[name] ?? []).map((file) =>
      fs.readFileSync(path.join(here, file), "utf-8").replace(/^export /gm, ""),
    ),
    read("client", name, "js"),
  ]
    .filter(Boolean)
    .join("\n")

/**
 * Showcase transformer: build-time syntax for the demo pages plus the client code that brings them
 * to life. Everything is gated by the page's `demo:` frontmatter flags, see SHOWCASE_PLAN.md.
 */
export default function Showcase() {
  return {
    name: "Showcase",
    markdownPlugins() {
      return [remarkShowcaseCallouts, remarkTelescope, remarkWidgets, remarkReactive]
    },
    htmlPlugins() {
      return [rehypeDemoFlags, rehypeSidenotes]
    },
    externalResources() {
      // where the lazily loaded modules live, for sc.load()
      const lazyScript = `(window.showcase ??= {}).lazyFiles = ${JSON.stringify(lazyFiles())}`
      return {
        css: features
          .map((name) => read("styles", name, "css"))
          .filter(Boolean)
          .map((content) => ({ content, inline: true })),
        js: features
          .map((name) =>
            name === "core" ? `${lazyScript}\n${clientScript(name)}` : clientScript(name),
          )
          .filter(Boolean)
          .map((script) => ({
            script,
            loadTime: "afterDOMReady",
            moduleType: "module",
            contentType: "inline",
          })),
      }
    },
  }
}
