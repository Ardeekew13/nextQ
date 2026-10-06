/**
 * Deterministic PRNG helpers shared by the server and the browser (offline match
 * generation), so both pick the same players for the same pool.
 */

/** Deterministic PRNG (mulberry32-style) seeded from a string — stable across repeated calls with the same input. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Stable seed for a given eligible pool — same pool always yields the same seed. */
export function poolSeed(ids: string[]): string {
  return [...ids].sort().join(",");
}
