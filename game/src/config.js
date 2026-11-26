// Skycourier — Island Run: shared tuning and mission definitions.
// One job: every number the rest of the game agrees on, in one place.

export const WORLD = {
  size: 4096, // world spans -2048..2048 m on x and z
  seaLevel: 0,
  grid: 512, // heightmap samples per side
  gridStep: 8, // metres between heightmap samples
  far: 1500, // voxel ray length in metres
};

export const PLANE = {
  minSpeed: 24, // m/s, below this the wing stalls
  cruiseSpeed: 62,
  maxSpeed: 95,
  maxThrottle: 1,
  climbRate: 9, // m/s at full power, level
  sinkRate: 6, // m/s gliding with power off
  turnRate: 0.55, // rad/s at full bank
  maxBank: 1.1, // rad
  maxPitch: 0.32, // rad
  fuelCapacity: 100,
  fuelBurn: 0.55, // units/s at full throttle
  fuelBurnIdle: 0.12,
  gearSpeedMax: 55, // m/s, fastest safe touchdown
  touchdownSinkMax: 4.5, // m/s descent at touchdown
};

export const RUNWAY = {
  x: 0,
  zStart: -320,
  zEnd: 320,
  halfWidth: 22,
  height: 6, // flat apron height in metres
};

// Ring course for the Ring Run mission: [x, altitude, z].
export const RING_COURSE = [
  [0, 130, 500],
  [-260, 110, 180],
  [-420, 150, -260],
  [-180, 90, -620],
  [240, 140, -780],
  [520, 110, -420],
  [620, 160, 60],
  [380, 120, 480],
];

// Delivery stops for the Storm Courier mission: [x, altitude, z].
export const COURIER_STOPS = [
  [-420, 150, -260],
  [620, 160, 60],
  [240, 140, -780],
  [-180, 90, -620],
  [0, 130, 500],
];

export const MISSIONS = [
  {
    id: 'ring-run',
    key: '1',
    name: 'RING RUN',
    tagline: 'Thread all 8 sky rings.',
    briefing:
      'Eight golden rings hang over the archipelago. Fly through each one in order. ' +
      'Smooth throttle and gentle banks win: hard turns bleed speed, and speed is lift.',
    goal: 'Fly through rings 1-8 in order.',
    rings: RING_COURSE,
    needsLanding: false,
    fuel: 100,
    timeLimit: 360,
  },
  {
    id: 'island-hop',
    key: '2',
    name: 'ISLAND HOP',
    tagline: 'Land on the strip at Coral Bay.',
    briefing:
      'Take off from the grass at Coral Bay, climb out over the lagoon, then come back ' +
      'and land on runway 09. Gear down, speed under 55 m/s, sink under 4.5 m/s — ' +
      'grease it for the bonus.',
    goal: 'Land on the runway, softly.',
    rings: [[0, 130, 500]],
    needsLanding: true,
    fuel: 100,
    timeLimit: 420,
  },
  {
    id: 'storm-courier',
    key: '3',
    name: 'STORM COURIER',
    tagline: 'Five drops, one storm, little fuel.',
    briefing:
      'The mail plane is late and the storm is coming in. Hit all five drop rings, ' +
      'then land on the strip before the tanks run dry. Gusts will shove you sideways — ' +
      'correct early, correct small.',
    goal: 'Hit 5 drop rings, then land on the runway.',
    rings: COURIER_STOPS,
    needsLanding: true,
    fuel: 70,
    timeLimit: 420,
    gusts: true,
  },
];

export const COLOURS = {
  skyTop: '#2f6fd0',
  skyMid: '#7fb2e8',
  skyHorizon: '#cfe8f7',
  seaDeep: '#0d4d7a',
  seaShallow: '#2e8fb8',
  sand: '#e3cd8f',
  grass: '#5d9b4a',
  grassDry: '#8aa84f',
  forest: '#2f6b34',
  rock: '#7a7268',
  snow: '#eef3f6',
  runway: '#3c3f45',
  runwayMark: '#f2f2e8',
  ringGold: '#ffc93c',
  ringGlow: 'rgba(255,201,60,0.35)',
  hudInk: '#eaf6ff',
  hudAmber: '#ffb347',
  hudRed: '#ff5d5d',
  hudGreen: '#7dff9b',
  panel: 'rgba(10,18,30,0.82)',
};
