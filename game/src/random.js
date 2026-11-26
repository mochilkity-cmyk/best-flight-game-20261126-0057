// Skycourier — Island Run: deterministic randomness.
// One job: a seeded PRNG and value noise, so the islands, clouds and gusts are
// identical on every run and every machine. No Math.random, no clock here.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise from integer lattice hashing. Deterministic for any seed.
export function makeNoise2D(seed) {
  function hash(ix, iz) {
    let h = (ix * 374761393 + iz * 668265263 + seed * 974634239) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const u = smooth(fx);
    const v = smooth(fz);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // Fractal sum: 4 octaves, each half the strength of the last.
  return function fbm(x, z) {
    let total = 0;
    let amp = 1;
    let freq = 1;
    for (let octave = 0; octave < 4; octave++) {
      total += noise(x * freq, z * freq) * amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return total / 1.875;
  };
}

// Deterministic pick from a list by index, for mission text variety.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
