import fs from "node:fs/promises"
import path from "node:path"
import { bundleLazy, lazyEntries, lazyOutput } from "../showcase/lib/lazy.js"
import { semanticMap } from "../showcase/lib/semantic.js"

async function write(ctx, file, content) {
  const target = path.join(ctx.argv.output, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
  return target
}

/**
 * Companion emitter for the showcase transformer: bundles the lazily loaded client modules and
 * writes the semantic map's data, computed from every note's text at build time.
 */
export default function ShowcaseAssets() {
  const emit = async (ctx, content) => {
    const written = []
    for (const name of lazyEntries)
      written.push(await write(ctx, lazyOutput(name), await bundleLazy(name)))
    const map = semanticMap(content, { prefix: "demo/" })
    written.push(await write(ctx, "static/showcase/semantic-map.json", JSON.stringify(map)))
    return written
  }
  return { name: "ShowcaseAssets", emit, partialEmit: emit }
}
