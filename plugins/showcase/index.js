import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { remarkShowcaseCallouts } from "./lib/callouts.js"
import { remarkTelescope } from "./lib/telescope.js"
import { remarkWidgets } from "./lib/widgets.js"
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
]

const read = (dir, name, ext) => fs.readFileSync(path.join(here, dir, `${name}.${ext}`), "utf-8")

/**
 * Showcase transformer: build-time syntax for the demo pages plus the client code that brings them
 * to life. Everything is gated by the page's `demo:` frontmatter flags, see SHOWCASE_PLAN.md.
 */
export default function Showcase() {
  return {
    name: "Showcase",
    markdownPlugins() {
      return [remarkShowcaseCallouts, remarkTelescope, remarkWidgets]
    },
    htmlPlugins() {
      return [rehypeDemoFlags, rehypeSidenotes]
    },
    externalResources() {
      return {
        css: features.map((name) => ({ content: read("styles", name, "css"), inline: true })),
        js: features.map((name) => ({
          script: read("client", name, "js"),
          loadTime: "afterDOMReady",
          moduleType: "module",
          contentType: "inline",
        })),
      }
    },
  }
}
