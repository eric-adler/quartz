import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { remarkShowcaseCallouts } from "./lib/callouts.js"
import { remarkTelescope } from "./lib/telescope.js"
import { remarkWidgets } from "./lib/widgets.js"
import { remarkReactive } from "./lib/reactive.js"
import { rehypeDemoFlags, rehypeSidenotes } from "./lib/rehype.js"

const here = path.dirname(fileURLToPath(import.meta.url))

// One client script and one stylesheet per feature. Order matters: core defines `window.showcase`
// (flags, reader memory) and drawer the shared drawer that later features use.
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
]

// Build-time modules a client script also needs, prepended to it. They must have no imports, and
// lose their `export` keywords because Quartz wraps every inline script in a function.
const preludes = { reactive: ["lib/expr.js"] }

const read = (dir, name, ext) => fs.readFileSync(path.join(here, dir, `${name}.${ext}`), "utf-8")
const clientScript = (name) =>
  [
    ...(preludes[name] ?? []).map((file) =>
      fs.readFileSync(path.join(here, file), "utf-8").replace(/^export /gm, ""),
    ),
    read("client", name, "js"),
  ].join("\n")

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
      return {
        css: features.map((name) => ({ content: read("styles", name, "css"), inline: true })),
        js: features.map((name) => ({
          script: clientScript(name),
          loadTime: "afterDOMReady",
          moduleType: "module",
          contentType: "inline",
        })),
      }
    },
  }
}
