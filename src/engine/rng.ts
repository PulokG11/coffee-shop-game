/** Small, fast seeded PRNG (mulberry32). Returns uniforms in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of the parts, used to derive independent stream seeds. */
export function hashSeed(...parts: (number | string)[]): number {
  let h = 0x811c9dc5
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

/** Unit-rate exponential from a uniform in [0, 1). */
export const expo = (u: number) => -Math.log(1 - u)

/**
 * One independent stream per source of randomness. Every customer consumes exactly one
 * draw from each stream, so two runs with the same seed see the same customers whatever
 * the decisions are (common random numbers).
 */
export class Streams {
  readonly arrival: () => number
  readonly drink: () => number
  readonly order: () => number
  readonly service: () => number
  readonly balk: () => number

  constructor(seed: number) {
    this.arrival = mulberry32(hashSeed(seed, 'arrival'))
    this.drink = mulberry32(hashSeed(seed, 'drink'))
    this.order = mulberry32(hashSeed(seed, 'order'))
    this.service = mulberry32(hashSeed(seed, 'service'))
    this.balk = mulberry32(hashSeed(seed, 'balk'))
  }
}
