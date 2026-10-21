import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { remarkShowcaseCallouts } from "./lib/callouts.js"
import { remarkTelescope } from "./lib/telescope.js"
import { rehypeDemoFlags, rehypeSidenotes } from "./lib/rehype.js"

const here = path.dirname(fileURLToPath(import.meta.url))

// Order matters: core defines `window.showcase` (flags, reader memory, drawer) for the features.
const clientScripts = ["core", "drawer", "concepts", "branching", "sidenotes", "telescope"]
const stylesheets = ["core", "drawer", "concepts", "branching", "sidenotes", "telescope"]

const read = (dir, name, ext) => fs.readFileSync(path.join(here, dir, `${name}.${ext}`), "utf-8")

/**
 * Showcase transformer: build-time syntax for the demo pages plus the client code that brings them
 * to life. Everything is gated by the page's `demo:` frontmatter flags, see SHOWCASE_PLAN.md.
 */
export default function Showcase() {
  return {
    name: "Showcase",
    markdownPlugins() {
      return [remarkShowcaseCallouts, remarkTelescope]
    },
    htmlPlugins() {
      return [rehypeDemoFlags, rehypeSidenotes]
    },
    externalResources() {
      return {
        css: stylesheets.map((name) => ({ content: read("styles", name, "css"), inline: true })),
        js: clientScripts.map((name) => ({
          script: read("client", name, "js"),
          loadTime: "afterDOMReady",
          moduleType: "module",
          contentType: "inline",
        })),
      }
    },
  }
}
