import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import esbuild from "esbuild"

/**
 * Heavy client code (WebGL effects, data views) lives in `lazy/` and is bundled into separate files
 * that pages load only when they need them. The transformer tells the browser where they are
 * (`sc.lazyFiles`); the companion emitter plugin (plugins/showcase-assets) writes them.
 */
const lazyDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lazy")

export const lazyEntries = ["hoverlab", "shaders", "semantic-map"]

export const lazyOutput = (name) => `static/showcase/${name}.js`

/** One version for all lazy files, so browsers refetch them whenever any source changes. */
export function lazyVersion() {
  const hash = createHash("sha256")
  for (const file of fs.readdirSync(lazyDir).sort()) {
    hash.update(file).update(fs.readFileSync(path.join(lazyDir, file)))
  }
  return hash.digest("hex").slice(0, 10)
}

export function lazyFiles() {
  const version = lazyVersion()
  return Object.fromEntries(lazyEntries.map((name) => [name, `${lazyOutput(name)}?v=${version}`]))
}

export async function bundleLazy(name) {
  const result = await esbuild.build({
    entryPoints: [path.join(lazyDir, `${name}.js`)],
    bundle: true,
    format: "esm",
    minify: true,
    write: false,
    target: "es2022",
    logLevel: "silent",
  })
  return result.outputFiles[0].text
}
