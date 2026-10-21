// Tiny expression evaluator for reactive documents, shared by the build and the browser (the client
// script is prefixed with this file). Numbers, variables, + - * / ^ ( ), comparisons and a few
// functions. No eval.
const FUNCTIONS = {
  min: Math.min,
  max: Math.max,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
}
const COMPARE = {
  "<": (a, b) => a < b,
  ">": (a, b) => a > b,
  "<=": (a, b) => a <= b,
  ">=": (a, b) => a >= b,
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
}

export function evaluate(source, vars) {
  const tokens = source.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|<=|>=|==|!=|[-+*/^()<>,]/g) ?? []
  let i = 0
  const peek = () => tokens[i]
  const next = () => tokens[i++]
  const expect = (token) => {
    if (next() !== token) throw new Error(`Expected "${token}" in "${source}"`)
  }

  const comparison = () => {
    let left = additive()
    while (peek() in COMPARE) {
      const op = next()
      left = COMPARE[op](left, additive()) ? 1 : 0
    }
    return left
  }
  const additive = () => {
    let value = term()
    while (peek() === "+" || peek() === "-")
      value = next() === "+" ? value + term() : value - term()
    return value
  }
  const term = () => {
    let value = power()
    while (peek() === "*" || peek() === "/")
      value = next() === "*" ? value * power() : value / power()
    return value
  }
  const power = () => {
    const base = unary()
    if (peek() !== "^") return base
    next()
    return base ** power()
  }
  const unary = () => {
    if (peek() !== "-") return primary()
    next()
    return -unary()
  }
  const primary = () => {
    const token = next()
    if (token === "(") {
      const value = comparison()
      expect(")")
      return value
    }
    if (/^\d/.test(token ?? "")) return Number(token)
    if (token in FUNCTIONS && peek() === "(") {
      next()
      const args = [comparison()]
      while (peek() === ",") {
        next()
        args.push(comparison())
      }
      expect(")")
      return FUNCTIONS[token](...args)
    }
    if (token in vars) return vars[token]
    throw new Error(`Unknown name "${token}" in "${source}"`)
  }

  const value = comparison()
  if (i < tokens.length) throw new Error(`Unexpected "${peek()}" in "${source}"`)
  return value
}

export const formatNumber = (value, decimals = 0) =>
  Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : "—"

/** Picks the text of the first case whose condition holds; the last case may be a bare default. */
export function chooseCase(cases, vars) {
  for (const { when, text } of cases) {
    if (!when || evaluate(when, vars)) return text
  }
  return ""
}
