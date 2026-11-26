// Skycourier — Island Run: the archipelago.
// One job: build the heightmap once (deterministic, seeded), answer heightAt(x, z),
// and say what colour a patch of ground is — sand, grass, forest, rock, snow,
// sea, or the runway strip at Coral Bay.

import { WORLD, RUNWAY } from './config.js';
import { makeNoise2D, mulberry32 } from './random.js';

const SEED = 20261126;

// Island bumps: [centre x, centre z, radius m, peak height m].
const ISLANDS = [
  [0, 0, 950, 68], // Coral Bay, the big island with the runway
  [-1250, -700, 620, 120], // North Peak
  [1150, -950, 540, 85], // Gull Rock
  [-1450, 900, 480, 60], // Turtle Cay
  [1300, 800, 700, 70], // Palm Shoal
  [250, -1450, 420, 140], // The Spire
  [-650, 1450, 380, 45], // Driftwood Isle
];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Raw island height before the runway is carved flat.
function islandHeight(x, z, fbm) {
  let h = -6; // seabed
  for (const [cx, cz, r, peak] of ISLANDS) {
    const dx = (x - cx) / r;
    const dz = (z - cz) / r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= 1) continue;
    const dome = Math.cos(d2 * Math.PI * 0.5); // 1 at centre, 0 at the rim
    const rough = 1 + fbm(x * 0.0016 + 7.3, z * 0.0016 - 2.1) * 0.35;
    h = Math.max(h, dome * peak * rough);
  }
  // Rolling hills on top of the big island, gentler elsewhere.
  h += fbm(x * 0.004, z * 0.004) * 4;
  return h;
}

function runwayMask(x, z) {
  // 1 inside the strip, feathering to 0 over a 60 m apron around it.
  const along = z > RUNWAY.zStart - 60 && z < RUNWAY.zEnd + 60;
  const across = Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth + 60;
  let m = 0;
  if (along && across) {
    const az = smoothstep(0, 60, Math.min(z - (RUNWAY.zStart - 60), RUNWAY.zEnd + 60 - z));
    const ax = smoothstep(0, 60, RUNWAY.halfWidth + 60 - Math.abs(x - RUNWAY.x));
    m = Math.min(az, ax);
  }
  // A flat valley along the runway's axis, so the final approach flies over
  // level ground instead of a hillside: the island-hop landing stays fair.
  if (z > -900 && z < 900) {
    const corridor = smoothstep(90, 30, Math.abs(x - RUNWAY.x));
    m = Math.max(m, corridor);
  }
  return m;
}

export function buildTerrain() {
  const fbm = makeNoise2D(SEED);
  const n = WORLD.grid;
  const half = WORLD.size / 2;
  const grid = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++) {
    const z = -half + iz * WORLD.gridStep;
    for (let ix = 0; ix < n; ix++) {
      const x = -half + ix * WORLD.gridStep;
      let h = islandHeight(x, z, fbm);
      const m = runwayMask(x, z);
      if (m > 0) h = h * (1 - m) + RUNWAY.height * m;
      grid[iz * n + ix] = h;
    }
  }

  function heightAt(x, z) {
    const gx = (x + half) / WORLD.gridStep;
    const gz = (z + half) / WORLD.gridStep;
    const ix = Math.max(0, Math.min(n - 2, Math.floor(gx)));
    const iz = Math.max(0, Math.min(n - 2, Math.floor(gz)));
    const fx = gx - ix;
    const fz = gz - iz;
    const a = grid[iz * n + ix];
    const b = grid[iz * n + ix + 1];
    const c = grid[(iz + 1) * n + ix];
    const d = grid[(iz + 1) * n + ix + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  function onRunway(x, z) {
    return (
      Math.abs(x - RUNWAY.x) <= RUNWAY.halfWidth &&
      z >= RUNWAY.zStart &&
      z <= RUNWAY.zEnd
    );
  }

  return { heightAt, onRunway, grid };
}

// Ground colour for a sampled point, before distance fog is applied.
// Returns [r, g, b] so the renderer can shade it cheaply.
export function groundColour(h, x, z, fbm) {
  if (h <= 0.4) {
    // Sea: shallow turquoise near shore, deep blue further out.
    const depth = Math.min(1, -h / 14);
    return [
      46 + (13 - 46) * depth,
      143 + (77 - 143) * depth,
      184 + (122 - 184) * depth,
    ];
  }
  if (h <= 2.5) return [227, 205, 143]; // sand
  // Patchy grass: two greens mixed by noise so fields read as fields.
  const patch = fbm(x * 0.01, z * 0.01) * 0.5 + 0.5;
  if (h <= 55) {
    return [
      74 + (122 - 74) * patch,
      138 + (158 - 138) * patch,
      58 + (66 - 58) * patch,
    ];
  }
  if (h <= 68) return [38, 94, 44]; // forest
  if (h <= 85) return [139, 122, 102]; // warm rock
  return [238, 243, 246]; // snow
}

// Fixed cloud puffs, placed once from the seeded RNG.
export function buildClouds() {
  const rng = mulberry32(SEED + 77);
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    clouds.push({
      x: (rng() * 2 - 1) * 1900,
      y: 300 + rng() * 160,
      z: (rng() * 2 - 1) * 1900,
      r: 60 + rng() * 90,
      a: 0.35 + rng() * 0.2,
    });
  }
  return clouds;
}
