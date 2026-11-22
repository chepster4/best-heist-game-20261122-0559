// Every tuning number, colour and level layout in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Levels are plain data: walls, guard patrols, cameras, loot, the
// vault, the getaway door and where the thief starts.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  speed: 215,
  sneakSpeed: 115,
  /** Seconds standing by the vault to crack it open. */
  crackSeconds: 2.5,
  /** How close the thief must be to the vault to work on it. */
  crackReach: 78,
};

export const GUARD = {
  radius: 14,
  speed: 72,
  patrolPause: 1.4,
  /** How far a guard can see, in pixels. */
  sightRange: 245,
  /** Half of the guard's vision cone, in radians. */
  halfAngle: 0.61,
  /** Alarm points per second while a guard has eyes on the thief. */
  alarmRate: 30,
  sneakAlarmRate: 15,
  /** Suspicion per second while the thief is in sight; at 60 the guard investigates. */
  suspicionRate: 70,
  investigateSpeed: 128,
};

export const CAMERA = {
  sightRange: 285,
  halfAngle: 0.5,
  /** Alarm points per second while a camera has the thief in frame. */
  alarmRate: 46,
  sneakAlarmRate: 24,
  /** How far, in radians, the camera sweeps either side of its base angle. */
  sweep: 0.7,
  /** Seconds for one full sweep out and back. */
  sweepSeconds: 5,
};

export const ALARM = {
  max: 100,
  /** Points per second the alarm falls while nobody sees the thief. */
  decay: 8,
  /** Alarm level where the screen starts pulsing red and the music turns tense. */
  tenseAt: 70,
};

export const GADGET = {
  /** Decoy coins the thief carries into a heist. */
  count: 3,
  /** Score it costs to throw one: tools are never free. */
  cost: 50,
  /** How far ahead of the thief a thrown decoy lands. */
  throwDistance: 150,
  /** Seconds a guard stays distracted by a decoy. */
  distractSeconds: 4.5,
  /** A guard only hears a decoy this close. */
  hearRange: 320,
};

export const LOOT = {
  paintingValue: 100,
  vaultValue: 500,
  /** Radius inside which a painting is pocketed. */
  grabRadius: 30,
};

export const PALETTE = {
  backdrop: '#0b0d12',
  floorA: '#232833',
  floorB: '#1e232e',
  carpet: '#5d1f26',
  carpetEdge: '#8a6d3b',
  wall: '#3a4152',
  wallTop: '#565f73',
  vaultDoor: '#c9a227',
  vaultGlow: '#f2c94c',
  paintingFrame: '#8a6d3b',
  exitDoor: '#2f9e44',
  exitGlow: '#51cf66',
  thief: '#15161c',
  thiefMask: '#e8e8e8',
  guard: '#2f4a7a',
  guardAlert: '#a83232',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneAlert: 'rgba(229, 83, 75, 0.28)',
  cameraCone: 'rgba(79, 195, 247, 0.16)',
  camera: '#9aa5b1',
  hud: '#eef1f5',
  muted: '#8b93a3',
  alarmLow: '#51cf66',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  panel: '#1b1f2a',
  panelEdge: '#3a4152',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';

/**
 * A wall is {x, y, w, h}. A guard patrols its waypoints and pauses at each. A camera sits
 * on a wall at (x, y), looks along baseAngle and sweeps either side of it. Loot paintings
 * sit at (x, y). The vault and the exit are single points; the exit only opens once the
 * vault is cracked.
 */
export const LEVELS = [
  {
    name: 'Heist 1 — The Gilded Gallery',
    hint: 'Grab the paintings, crack the vault, reach the green door.',
    thiefStart: { x: 640, y: 630 },
    vault: { x: 640, y: 118 },
    exit: { x: 640, y: 684 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 0, w: 24, h: 720 },
      { x: 1256, y: 0, w: 24, h: 720 },
      { x: 400, y: 24, w: 24, h: 336 },
      { x: 856, y: 360, w: 24, h: 336 },
      { x: 424, y: 340, w: 180, h: 24 },
      { x: 664, y: 340, w: 192, h: 24 },
      { x: 520, y: 24, w: 24, h: 140 },
      { x: 736, y: 24, w: 24, h: 140 },
      { x: 520, y: 196, w: 80, h: 24 },
      { x: 660, y: 196, w: 100, h: 24 },
    ],
    guards: [
      { waypoints: [{ x: 200, y: 180 }, { x: 200, y: 520 }] },
      { waypoints: [{ x: 720, y: 280 }, { x: 1080, y: 280 }] },
    ],
    cameras: [
      { x: 520, y: 30, baseAngle: Math.PI / 2 },
      { x: 1250, y: 420, baseAngle: Math.PI },
    ],
    paintings: [
      { x: 300, y: 120, hue: '#c96a4a' },
      { x: 1000, y: 580, hue: '#4a7ac9' },
      { x: 700, y: 600, hue: '#7ac94a' },
    ],
  },
  {
    name: 'Heist 2 — The Jade Vault',
    hint: 'Three guards, three cameras. The vault sits behind the east wing.',
    thiefStart: { x: 120, y: 630 },
    vault: { x: 1120, y: 118 },
    exit: { x: 120, y: 684 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 0, w: 24, h: 720 },
      { x: 1256, y: 0, w: 24, h: 720 },
      { x: 420, y: 24, w: 24, h: 420 },
      { x: 840, y: 276, w: 24, h: 420 },
      { x: 444, y: 440, w: 200, h: 24 },
      { x: 704, y: 440, w: 136, h: 24 },
      { x: 960, y: 24, w: 24, h: 140 },
      { x: 960, y: 196, w: 296, h: 24 },
      { x: 640, y: 120, w: 24, h: 200 },
    ],
    guards: [
      { waypoints: [{ x: 200, y: 200 }, { x: 200, y: 560 }] },
      { waypoints: [{ x: 640, y: 560 }, { x: 640, y: 120 }] },
      { waypoints: [{ x: 1040, y: 300 }, { x: 1040, y: 600 }] },
    ],
    cameras: [
      { x: 640, y: 30, baseAngle: Math.PI / 2 },
      { x: 30, y: 360, baseAngle: 0 },
      { x: 1250, y: 240, baseAngle: Math.PI },
    ],
    paintings: [
      { x: 300, y: 120, hue: '#c94a7a' },
      { x: 640, y: 620, hue: '#4ac9b8' },
      { x: 1120, y: 420, hue: '#c9a24a' },
      { x: 980, y: 120, hue: '#8a4ac9' },
    ],
  },
  {
    name: 'Heist 3 — The Crown Suite',
    hint: 'The crown vault. Four guards, four cameras, no easy way in.',
    thiefStart: { x: 640, y: 630 },
    vault: { x: 640, y: 118 },
    exit: { x: 640, y: 684 },
    walls: [
      { x: 0, y: 0, w: 1280, h: 24 },
      { x: 0, y: 696, w: 1280, h: 24 },
      { x: 0, y: 0, w: 24, h: 720 },
      { x: 1256, y: 0, w: 24, h: 720 },
      { x: 300, y: 24, w: 24, h: 300 },
      { x: 956, y: 396, w: 24, h: 300 },
      { x: 324, y: 300, w: 300, h: 24 },
      { x: 684, y: 300, w: 272, h: 24 },
      { x: 520, y: 24, w: 24, h: 140 },
      { x: 736, y: 24, w: 24, h: 140 },
      { x: 520, y: 196, w: 80, h: 24 },
      { x: 660, y: 196, w: 100, h: 24 },
      { x: 640, y: 420, w: 24, h: 180 },
    ],
    guards: [
      { waypoints: [{ x: 160, y: 160 }, { x: 160, y: 540 }] },
      { waypoints: [{ x: 1120, y: 160 }, { x: 1120, y: 540 }] },
      { waypoints: [{ x: 480, y: 560 }, { x: 800, y: 560 }] },
      { waypoints: [{ x: 480, y: 380 }, { x: 800, y: 380 }] },
    ],
    cameras: [
      { x: 500, y: 30, baseAngle: Math.PI / 2 },
      { x: 30, y: 200, baseAngle: 0 },
      { x: 1250, y: 200, baseAngle: Math.PI },
      { x: 640, y: 690, baseAngle: -Math.PI / 2 },
    ],
    paintings: [
      { x: 160, y: 640, hue: '#c96a4a' },
      { x: 1120, y: 640, hue: '#4a7ac9' },
      { x: 480, y: 480, hue: '#7ac94a' },
      { x: 800, y: 480, hue: '#c94a7a' },
    ],
  },
];
