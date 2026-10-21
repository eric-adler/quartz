/**
 * Semantic map data, computed at build time from the notes' own words — no model, no API:
 *
 *   1. TF-IDF vectors over lightly stemmed words (title counted three times)
 *   2. Latent semantic analysis: the top singular vectors of the TF-IDF matrix, so notes that use
 *      related vocabulary end up close even when they share few exact words
 *   3. t-SNE to lay the notes out in 2D, k-means for clusters, labelled by their strongest terms
 *
 * Deterministic: the same notes always produce the same map.
 */
const STOPWORDS = new Set(
  `the and for that with this from your you are was were but not have has had its it's into than then them they their there
  these those what when where which while who whom why how all any both each few more most other some such only own same
  too very can will just don should now about above after again against below between during before under over out off
  once here also our ours ourselves his her hers him she he its itself we us one two three four five six seven eight nine ten
  get got make makes made like much many every per via does did doing done being been less more most usually often still even
  way ways thing things see use used using uses page pages note notes demo click read reading`
    .split(/\s+/)
    .filter(Boolean),
)

function stem(word) {
  for (const [suffix, min] of [
    ["ations", 4],
    ["ation", 4],
    ["ings", 4],
    ["ing", 4],
    ["edly", 4],
    ["ies", 3],
    ["ness", 4],
    ["ment", 4],
    ["ers", 4],
    ["er", 4],
    ["ed", 4],
    ["ly", 4],
    ["es", 4],
    ["s", 4],
  ]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= min) {
      return suffix === "ies" ? `${word.slice(0, -3)}y` : word.slice(0, -suffix.length)
    }
  }
  return word
}

/** Lowercased, stop-word-free stems. `seen` records which surface words produced each stem. */
const tokenize = (text, seen) =>
  (text.toLowerCase().match(/[a-z][a-z'-]+/g) ?? [])
    .map((w) => w.replace(/'s$|'/g, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((word) => {
      const s = stem(word)
      if (seen) {
        const words = seen.get(s) ?? new Map()
        words.set(word, (words.get(word) ?? 0) + 1)
        seen.set(s, words)
      }
      return s
    })

/** Seeded PRNG so layouts are reproducible. */
function random(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Eigen-decomposition of a symmetric matrix (cyclic Jacobi). Returns values and column vectors. */
function jacobi(matrix) {
  const n = matrix.length
  const a = matrix.map((row) => [...row])
  const v = a.map((_, i) => a.map((_, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2
    if (off < 1e-12) break
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p]
          const vkq = v[k][q]
          v[k][p] = c * vkp - s * vkq
          v[k][q] = s * vkp + c * vkq
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]), vectors: v }
}

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0)
const normalise = (a) => {
  const length = Math.hypot(...a) || 1
  return a.map((x) => x / length)
}

/** Exact t-SNE — fine for the few dozen notes in the showcase. */
function tsne(distances, { perplexity = 8, iterations = 900, seed = 7 } = {}) {
  const n = distances.length
  const rand = random(seed)
  const P = distances.map(() => new Float64Array(n))
  const target = Math.log(perplexity)
  for (let i = 0; i < n; i++) {
    let lo = 1e-6
    let hi = 1e6
    let beta = 1
    for (let tries = 0; tries < 60; tries++) {
      let sum = 0
      let entropy = 0
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const p = Math.exp(-distances[i][j] * beta)
        P[i][j] = p
        sum += p
      }
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        P[i][j] /= sum || 1
        if (P[i][j] > 1e-12) entropy -= P[i][j] * Math.log(P[i][j])
      }
      if (Math.abs(entropy - target) < 1e-4) break
      if (entropy > target) lo = beta
      else hi = beta
      beta = hi >= 1e6 ? beta * 2 : (lo + hi) / 2
    }
  }
  const Psym = P.map((row, i) => Array.from(row, (p, j) => (p + P[j][i]) / (2 * n)))

  const Y = Array.from({ length: n }, () => [(rand() - 0.5) * 1e-2, (rand() - 0.5) * 1e-2])
  const gains = Y.map(() => [1, 1])
  const velocity = Y.map(() => [0, 0])
  for (let it = 0; it < iterations; it++) {
    const exaggeration = it < 120 ? 6 : 1
    const momentum = it < 250 ? 0.5 : 0.8
    const num = Y.map(() => new Float64Array(n))
    let sumQ = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const q = 1 / (1 + (Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2)
        num[i][j] = num[j][i] = q
        sumQ += 2 * q
      }
    }
    for (let i = 0; i < n; i++) {
      const grad = [0, 0]
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const mult = 4 * (exaggeration * Psym[i][j] - num[i][j] / sumQ) * num[i][j]
        grad[0] += mult * (Y[i][0] - Y[j][0])
        grad[1] += mult * (Y[i][1] - Y[j][1])
      }
      for (let d = 0; d < 2; d++) {
        gains[i][d] =
          Math.sign(grad[d]) === Math.sign(velocity[i][d]) ? gains[i][d] * 0.8 : gains[i][d] + 0.2
        gains[i][d] = Math.max(gains[i][d], 0.01)
        velocity[i][d] = momentum * velocity[i][d] - 100 * gains[i][d] * grad[d]
      }
    }
    for (let i = 0; i < n; i++) {
      Y[i][0] += velocity[i][0]
      Y[i][1] += velocity[i][1]
    }
  }
  return Y
}

function kmeans(points, k, seed = 3) {
  const rand = random(seed)
  // k-means++ seeding
  const centres = [points[Math.floor(rand() * points.length)]]
  while (centres.length < k) {
    const weights = points.map((p) => Math.min(...centres.map((c) => 1 - dot(p, c))))
    let pick = rand() * weights.reduce((a, b) => a + b, 0)
    let index = 0
    while (pick > weights[index] && index < points.length - 1) pick -= weights[index++]
    centres.push(points[index])
  }
  let assignment = []
  for (let it = 0; it < 50; it++) {
    assignment = points.map((p) =>
      centres.map((c) => dot(p, c)).reduce((best, s, i, all) => (s > all[best] ? i : best), 0),
    )
    const next = centres.map((c, i) => {
      const members = points.filter((_, j) => assignment[j] === i)
      if (members.length === 0) return c
      return normalise(c.map((_, d) => members.reduce((sum, m) => sum + m[d], 0)))
    })
    centres.splice(0, k, ...next)
  }
  return assignment
}

export function semanticMap(content, { prefix = "", dimensions = 12, clusters = 5 } = {}) {
  const docs = []
  const surface = new Map()
  for (const [, file] of content) {
    const data = file.data ?? {}
    const slug = String(data.slug ?? "")
    if (!slug.startsWith(prefix) || slug.endsWith("index")) continue
    if (data.unlisted === true || data.encrypted === true || data.frontmatter?.password) continue
    const title = String(data.frontmatter?.title ?? slug)
    docs.push({
      slug,
      title,
      tags: (data.frontmatter?.tags ?? []).filter((t) => t !== "coffee"),
      links: new Set((data.links ?? []).map((l) => (l.endsWith("/") ? `${l}index` : l))),
      tokens: [
        ...tokenize(`${title} ${title} ${title}`),
        ...tokenize(String(data.text ?? ""), surface),
      ],
    })
  }
  const n = docs.length
  if (n < 3) return { nodes: [], clusters: [], neighbours: {}, unlinked: [] }

  // TF-IDF
  const df = new Map()
  for (const doc of docs)
    for (const term of new Set(doc.tokens)) df.set(term, (df.get(term) ?? 0) + 1)
  const vocab = [...df.keys()].filter((t) => df.get(t) >= 2 && df.get(t) <= n * 0.6).sort()
  const index = new Map(vocab.map((t, i) => [t, i]))
  const X = docs.map((doc) => {
    const row = new Float64Array(vocab.length)
    const counts = new Map()
    for (const t of doc.tokens) if (index.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1)
    for (const [t, c] of counts) row[index.get(t)] = (1 + Math.log(c)) * Math.log(n / df.get(t))
    const length = Math.hypot(...row) || 1
    return row.map((x) => x / length)
  })

  // LSA via the Gram matrix: X Xᵀ = U S² Uᵀ, document coordinates are U S
  const gram = X.map((a) => X.map((b) => dot(a, b)))
  const { values, vectors } = jacobi(gram)
  const order = values
    .map((v, i) => [v, i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, Math.min(dimensions, n - 1))
  const lsa = docs.map((_, d) =>
    normalise(order.map(([value, i]) => vectors[d][i] * Math.sqrt(Math.max(value, 0)))),
  )

  const similarity = lsa.map((a) => lsa.map((b) => dot(a, b)))
  const layout = tsne(similarity.map((row) => row.map((s) => Math.max(0, 1 - s) ** 2 * 10)))

  // fit the layout into 0..1 by the 5th–95th percentiles, so a few outliers can't squash the rest
  const quantile = (values, q) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]
  }
  const xs = layout.map((p) => p[0])
  const ys = layout.map((p) => p[1])
  const [x0, x1, y0, y1] = [
    quantile(xs, 0.05),
    quantile(xs, 0.95),
    quantile(ys, 0.05),
    quantile(ys, 0.95),
  ]
  // each axis fills the frame on its own: it's a map of neighbourhoods, not of exact distances
  const place = (v, lo, hi) =>
    Math.min(0.97, Math.max(0.03, ((v - (lo + hi) / 2) / (hi - lo || 1)) * 0.86 + 0.5))

  const assignment = kmeans(lsa, Math.min(clusters, n))
  const clusterInfo = [...new Set(assignment)].map((id) => {
    const members = docs.map((_, i) => i).filter((i) => assignment[i] === id)
    const weight = new Float64Array(vocab.length)
    for (const i of members) X[i].forEach((x, t) => (weight[t] += x))
    // label with the most common real word behind each stem ("dissolv" → "dissolves")
    const word = (s) => [...(surface.get(s) ?? new Map([[s, 1]]))].sort((a, b) => b[1] - a[1])[0][0]
    const terms = [...weight.keys()]
      .sort((a, b) => weight[b] - weight[a])
      .slice(0, 3)
      .map((t) => word(vocab[t]))
    return { id, terms, size: members.length }
  })

  const neighbours = {}
  const unlinked = []
  const seen = new Set()
  docs.forEach((doc, i) => {
    const ranked = docs
      .map((_, j) => [j, similarity[i][j]])
      .filter(([j]) => j !== i)
      .sort((a, b) => b[1] - a[1])
    neighbours[doc.slug] = ranked.slice(0, 5).map(([j, s]) => [docs[j].slug, Number(s.toFixed(3))])
    // close in meaning, but neither note links to the other
    for (const [j, s] of ranked.slice(0, 4)) {
      const other = docs[j]
      const key = [doc.slug, other.slug].sort().join("|")
      if (seen.has(key) || doc.links.has(other.slug) || other.links.has(doc.slug)) continue
      seen.add(key)
      unlinked.push([doc.slug, other.slug, Number(s.toFixed(3))])
    }
  })
  unlinked.sort((a, b) => b[2] - a[2])

  return {
    method: "tf-idf → latent semantic analysis → t-SNE",
    nodes: docs.map((doc, i) => ({
      slug: doc.slug,
      title: doc.title,
      tags: doc.tags,
      cluster: assignment[i],
      x: Number(place(layout[i][0], x0, x1).toFixed(4)),
      y: Number(place(layout[i][1], y0, y1).toFixed(4)),
    })),
    clusters: clusterInfo,
    neighbours,
    unlinked: unlinked.slice(0, 12),
  }
}
