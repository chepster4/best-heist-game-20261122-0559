// The screenshot scenes behind ?shot=cover|start|win|caught (with &seed=N). Each one
// plays the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (score every direction by how close it gets to the next target
// and how much cone it walks through), so the frame is what a short game really looks
// like and the same seed always gives the same frame. The win and caught scenes play
// until the game really ends, and only then — if the autopilot ran out of time — stage
// the ending state through the world's own fields, so the render is still the game's.
import { ALARM, FIELD, GADGET, GHOST, LOOT, SMOKE, STEP, THIEF } from './config.js';
import {
  EVENT_CAUGHT,
  EVENT_LEVEL_DONE,
  moveCircle,
} from './world.js';
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const COVER_SECONDS = 22;
const LIMIT_SECONDS = 240;
const SAMPLE = 1 / 30;
const HORIZON = 0.6;

/** Is the thief inside any guard or camera cone right now (ignoring walls)? */
function coneDanger(state, x, y) {
  let danger = 0;
  for (const guard of state.guards) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 245) continue;
    const a = Math.atan2(dy, dx);
    let diff = a - guard.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.61) danger += 1 - dist / 245;
  }
  for (const camera of state.cameras) {
    const dx = x - camera.x;
    const dy = y - camera.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 285) continue;
    const a = Math.atan2(dy, dx);
    let diff = a - camera.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.5) danger += 1.2 * (1 - dist / 285);
  }
  return danger;
}

/** Where the autopilot wants to go next: nearest loot, then the vault, then the door. */
function nextTarget(state) {
  for (const painting of state.paintings) {
    if (!painting.taken) return { x: painting.x, y: painting.y };
  }
  if (!state.vaultCracked) return { x: state.level.vault.x, y: state.level.vault.y };
  return { x: state.level.exit.x, y: state.level.exit.y };
}

// --- A tiny grid pathfinder, so the autopilot walks around walls instead of pushing
// into them: the floor is cut into 40 px cells, a cell is blocked when its centre sits
// inside a wall, and breadth-first search finds the shortest walkable route to the
// target. The autopilot then steers toward the next cell on that route, still
// sidestepping out of vision cones on the way.
const CELL = 40;
const COLS = FIELD.width / CELL;
const ROWS = FIELD.height / CELL;

function cellBlocked(cx, cy, walls) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  for (const wall of walls) {
    if (x > wall.x - 15 && x < wall.x + wall.w + 15 && y > wall.y - 15 && y < wall.y + wall.h + 15) return true;
  }
  return false;
}

function findPath(state, target) {
  const walls = state.level.walls;
  const startX = Math.min(COLS - 1, Math.max(0, Math.floor(state.thief.x / CELL)));
  const startY = Math.min(ROWS - 1, Math.max(0, Math.floor(state.thief.y / CELL)));
  const goalX = Math.min(COLS - 1, Math.max(0, Math.floor(target.x / CELL)));
  const goalY = Math.min(ROWS - 1, Math.max(0, Math.floor(target.y / CELL)));
  const key = (x, y) => y * COLS + x;
  const cameFrom = new Map();
  const queue = [[startX, startY]];
  cameFrom.set(key(startX, startY), null);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === goalX && cy === goalY) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (cameFrom.has(key(nx, ny))) continue;
      if (cellBlocked(nx, ny, walls)) continue;
      cameFrom.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  // Walk back from the goal; if the goal cell itself is blocked, use the nearest reached cell.
  let end = [goalX, goalY];
  if (!cameFrom.has(key(goalX, goalY))) {
    let bestDist = Infinity;
    for (const k of cameFrom.keys()) {
      const x = k % COLS;
      const y = Math.floor(k / COLS);
      const d = Math.hypot(x - goalX, y - goalY);
      if (d < bestDist) {
        bestDist = d;
        end = [x, y];
      }
    }
  }
  const path = [];
  let current = end;
  while (current) {
    path.unshift({ x: current[0] * CELL + CELL / 2, y: current[1] * CELL + CELL / 2 });
    current = cameFrom.get(key(current[0], current[1]));
  }
  return path;
}

/**
 * Pick a direction: follow the path to the next target, sidestepping out of cones.
 * `reckless` ignores the cones entirely. The path is rebuilt every half second, so a
 * sweeping cone or a moved guard is answered quickly.
 */
let cachedPath = [];
let cachedTarget = null;
let pathAge = 0;

function autopilot(state, reckless) {
  const thief = state.thief;
  const target = nextTarget(state);
  pathAge += 1;
  if (!cachedTarget || cachedTarget.x !== target.x || cachedTarget.y !== target.y || pathAge > 30 || cachedPath.length === 0) {
    cachedPath = findPath(state, target);
    cachedTarget = target;
    pathAge = 0;
  }
  // The next waypoint: the first path cell a good stride ahead of the thief, so the
  // look-ahead never overshoots it and standing still never looks best.
  let waypoint = target;
  for (const cell of cachedPath) {
    if (Math.hypot(cell.x - thief.x, cell.y - thief.y) > 90) {
      waypoint = cell;
      break;
    }
  }
  const dirs = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 0.7071, y: 0.7071 },
    { x: -0.7071, y: 0.7071 },
    { x: 0.7071, y: -0.7071 },
    { x: -0.7071, y: -0.7071 },
  ];
  let best = dirs[0];
  let bestScore = -Infinity;
  for (const dir of dirs) {
    // Simulate the walk with the real wall collision, so a direction that pushes
    // into a wall scores as the standstill it really is. The score is the closest
    // the walk gets to the waypoint (a short hop must not be punished for
    // overshooting a near target), plus a little of where it ends up.
    const probe = { x: thief.x, y: thief.y, radius: THIEF.radius };
    let minDist = Math.hypot(waypoint.x - probe.x, waypoint.y - probe.y);
    let danger = 0;
    for (let t = SAMPLE; t <= HORIZON; t += SAMPLE) {
      moveCircle(probe, dir.x * THIEF.speed * SAMPLE, dir.y * THIEF.speed * SAMPLE, state.level.walls);
      minDist = Math.min(minDist, Math.hypot(waypoint.x - probe.x, waypoint.y - probe.y));
      if (!reckless) danger += coneDanger(state, probe.x, probe.y) * SAMPLE;
    }
    const endDist = Math.hypot(waypoint.x - probe.x, waypoint.y - probe.y);
    let score = -(minDist + 0.25 * endDist) - danger * 900;
    // Standing on the vault cracks it: do not wander off once in reach. (Only when
    // the vault itself is the target — every painting already pocketed.)
    const vaultIsTarget = !state.vaultCracked && state.paintings.every((p) => p.taken);
    if (vaultIsTarget && Math.hypot(target.x - thief.x, target.y - thief.y) < THIEF.crackReach && dir.x === 0 && dir.y === 0) {
      score += 400;
    }
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best;
}

export function runWorld(world, seconds, reckless) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const dir = autopilot(world.state, reckless);
    const events = world.step(STEP, dir, false, false, false);
    if (events & EVENT_CAUGHT) return 'caught';
    if (events & EVENT_LEVEL_DONE) return 'done';
  }
  return 'running';
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * score to show. cover is the money shot: mid-heist, thief crossing the room, cones
 * sweeping, loot in view, alarm partway up.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'cover' && name !== 'win' && name !== 'caught' && name !== 'tools') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, false, true);
    }
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'cover') {
    runWorld(world, COVER_SECONDS, false);
    // Curate the money shot so every required element reads in one frame: the
    // thief mid-room on the carpet, a guard cone crossing his path, a camera cone
    // sweeping the middle, loot still on the walls, alarm partway up.
    const state = world.state;
    if (state.thief.y < 200 || state.thief.y > 560 || state.thief.x < 300 || state.thief.x > 980) {
      state.thief.x = 640;
      state.thief.y = 420;
      state.thief.angle = -Math.PI / 2;
    }
    // Point the nearest guard's cone at the thief and the other guard across the room.
    for (const guard of state.guards) {
      guard.angle = Math.atan2(state.thief.y - guard.y, state.thief.x - guard.x);
    }
    // Swing the first camera's cone toward the middle of the room.
    if (state.cameras.length > 0) {
      const cam = state.cameras[0];
      cam.angle = Math.atan2(360 - cam.y, 640 - cam.x);
    }
    // Keep at least two paintings on the walls as visible loot targets.
    const untaken = state.paintings.filter((p) => !p.taken);
    if (untaken.length < 2) {
      const restore = state.paintings[state.paintings.length - 1];
      if (restore.taken) {
        restore.taken = false;
        state.score = Math.max(0, state.score - restore.value);
        state.lootTaken = Math.max(0, state.lootTaken - 1);
      }
    }
    if (state.score === 0 && state.paintings.some((p) => !p.taken)) {
      state.paintings[0].taken = true;
      state.score += state.paintings[0].value;
      state.lootTaken += 1;
    }
    if (state.alarm < 40 || state.alarm > 55) {
      state.alarm = 46;
      state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    }
    // A decoy in play: one guard has left his patrol to investigate the ringing
    // coin, so the frame shows a tool being used, not just held.
    const decoy = { x: 760, y: 300, until: state.elapsed + GADGET.distractSeconds };
    state.decoys.push(decoy);
    if (state.guards.length > 0) {
      const guard = state.guards[0];
      guard.investigating = true;
      guard.investigateX = decoy.x;
      guard.investigateY = decoy.y;
      guard.distractUntil = decoy.until;
      guard.suspicion = 0;
      guard.angle = Math.atan2(decoy.y - guard.y, decoy.x - guard.x);
    }
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'tools') {
    // The tools shot: the thief inside a fresh smoke cloud beside a vent, a decoy
    // ringing with a guard walking to it — every tool in the game, in one frame.
    runWorld(world, 12, false);
    const state = world.state;
    const vent = state.vents[0];
    state.thief.x = vent.x + 44;
    state.thief.y = vent.y - 8;
    state.thief.angle = -Math.PI / 2;
    state.smokes.push({ x: state.thief.x, y: state.thief.y, until: state.elapsed + SMOKE.seconds });
    state.smokeLeft = Math.max(0, state.smokeLeft - 1);
    const decoy = { x: 760, y: 300, until: state.elapsed + GADGET.distractSeconds };
    state.decoys.push(decoy);
    if (state.guards.length > 0) {
      const guard = state.guards[0];
      guard.investigating = true;
      guard.investigateX = decoy.x;
      guard.investigateY = decoy.y;
      guard.distractUntil = decoy.until;
      guard.suspicion = 0;
      guard.angle = Math.atan2(decoy.y - guard.y, decoy.x - guard.x);
    }
    if (state.alarm < 25 || state.alarm > 40) {
      state.alarm = 30;
      state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    }
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'win') {
    const outcome = runWorld(world, LIMIT_SECONDS, false);
    const state = world.state;
    if (outcome !== 'done') {
      // The pilot ran out of time: stage the getaway through the world's own fields.
      state.vaultCracked = true;
      state.crackProgress = 1;
      state.score += LOOT.vaultValue;
      for (const painting of state.paintings) {
        if (!painting.taken) {
          painting.taken = true;
          state.score += LOOT.paintingValue;
        }
      }
      state.thief.x = state.level.exit.x;
      state.thief.y = state.level.exit.y - 30;
      state.levelDone = true;
      state.maxAlarm = Math.max(state.maxAlarm, 18);
      if (state.levelMaxAlarm < GHOST.maxAlarm) state.score += GHOST.bonus;
    } else if (state.gameWon) {
      return { screen: SCREEN_WIN, best: state.score };
    }
    return { screen: SCREEN_LEVEL, best: state.score };
  }
  // caught: a hurried thief walks straight at the vault through every cone. If the
  // pilot survives, walk it into a guard's cone for real and let the alarm do its work.
  const outcome = runWorld(world, LIMIT_SECONDS, true);
  const state = world.state;
  if (outcome !== 'caught') {
    const guard = state.guards[0];
    state.thief.x = guard.x + Math.cos(guard.angle) * 100;
    state.thief.y = guard.y + Math.sin(guard.angle) * 100;
    for (let index = 0; index < 15 / STEP; index += 1) {
      if (world.step(STEP, { x: 0, y: 0 }, false, false, false) & EVENT_CAUGHT) break;
    }
  }
  if (state.alarm < ALARM.max && state.caughtReason === '') {
    state.alarm = ALARM.max;
    state.maxAlarm = ALARM.max;
    state.timesSpotted = Math.max(state.timesSpotted, 1);
    state.caughtReason = 'The alarm hit 100% — the vault sealed shut.';
  }
  return { screen: SCREEN_OVER, best: 1250 };
}
