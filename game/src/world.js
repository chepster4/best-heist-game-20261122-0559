// The heist rules and state, with no drawing and no browser in it: the thief, the
// patrolling guards and their vision cones, the sweeping cameras, the loot, the vault
// crack and the getaway, the alarm meter and the win/lose conditions. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates after
// createWorld returns.
import {
  ALARM,
  CAMERA,
  FIELD,
  GADGET,
  GUARD,
  LEVELS,
  LOOT,
  THIEF,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_VAULT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_DONE = 8;
export const EVENT_DECOY = 16;
export const EVENT_SPOTTED = 32;

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Does the segment (x1,y1)-(x2,y2) cross the rectangle? Walls block sight. */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function hasLineOfSight(x1, y1, x2, y2, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, walls[i])) return false;
  }
  return true;
}

/** Push a circle out of every wall it overlaps; move x then y so it slides along walls. */
export function moveCircle(body, dx, dy, walls) {
  const r = body.radius;
  let nx = body.x + dx;
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    if (nx + r > w.x && nx - r < w.x + w.w && body.y + r > w.y && body.y - r < w.y + w.h) {
      nx = dx > 0 ? w.x - r : w.x + w.w + r;
    }
  }
  body.x = nx;
  let ny = body.y + dy;
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    if (body.x + r > w.x && body.x - r < w.x + w.w && ny + r > w.y && ny - r < w.y + w.h) {
      ny = dy > 0 ? w.y - r : w.y + w.h + r;
    }
  }
  body.y = ny;
  body.x = Math.min(FIELD.width - r, Math.max(r, body.x));
  body.y = Math.min(FIELD.height - r, Math.max(r, body.y));
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    thief: { x: 0, y: 0, radius: THIEF.radius, angle: -Math.PI / 2, sneaking: false, moving: false },
    guards: [],
    cameras: [],
    paintings: [],
    decoys: [],
    vaultCracked: false,
    crackProgress: 0,
    alarm: 0,
    maxAlarm: 0,
    score: 0,
    gadgets: GADGET.count,
    elapsed: 0,
    levelElapsed: 0,
    lootTaken: 0,
    timesSpotted: 0,
    wasSeen: false,
    caughtReason: '',
    levelDone: false,
    gameWon: false,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.thief.x = level.thiefStart.x;
    state.thief.y = level.thiefStart.y;
    state.thief.angle = -Math.PI / 2;
    state.guards = level.guards.map((g) => ({
      waypoints: g.waypoints,
      waypointIndex: 0,
      x: g.waypoints[0].x,
      y: g.waypoints[0].y,
      radius: GUARD.radius,
      angle: 0,
      pause: 0,
      suspicion: 0,
      investigating: false,
      investigateX: 0,
      investigateY: 0,
      distractUntil: 0,
      seen: false,
    }));
    state.cameras = level.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      angle: c.baseAngle,
      phase: random() * Math.PI * 2,
      seen: false,
    }));
    state.paintings = level.paintings.map((p) => ({ x: p.x, y: p.y, hue: p.hue, taken: false }));
    state.decoys = [];
    state.vaultCracked = false;
    state.crackProgress = 0;
    state.alarm = 0;
    state.levelElapsed = 0;
    state.levelDone = false;
    state.wasSeen = false;
  }

  function reset() {
    state.score = 0;
    state.gadgets = GADGET.count;
    state.elapsed = 0;
    state.maxAlarm = 0;
    state.lootTaken = 0;
    state.timesSpotted = 0;
    state.caughtReason = '';
    state.gameWon = false;
    loadLevel(0);
  }

  /** Can the watcher at (x, y) facing `angle` see the thief right now? */
  function canSee(x, y, angle, halfAngle, range, walls) {
    const thief = state.thief;
    const dist = distance(x, y, thief.x, thief.y);
    if (dist > range) return false;
    if (dist > 1 && Math.abs(angleDiff(angleTo(x, y, thief.x, thief.y), angle)) > halfAngle) return false;
    return hasLineOfSight(x, y, thief.x, thief.y, walls);
  }

  function stepGuard(guard, dt) {
    const thief = state.thief;
    if (state.elapsed < guard.distractUntil) {
      // Walk to the decoy that rang, then stand there, puzzled, until it wears off.
      const dx = guard.investigateX - guard.x;
      const dy = guard.investigateY - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const speed = GUARD.investigateSpeed * dt;
        moveCircle(guard, (dx / dist) * Math.min(speed, dist), (dy / dist) * Math.min(speed, dist), state.level.walls);
        guard.angle = Math.atan2(dy, dx);
      }
      return;
    }
    if (guard.investigating) {
      const dx = guard.investigateX - guard.x;
      const dy = guard.investigateY - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const speed = GUARD.investigateSpeed * dt;
        moveCircle(guard, (dx / dist) * Math.min(speed, dist), (dy / dist) * Math.min(speed, dist), state.level.walls);
        guard.angle = Math.atan2(dy, dx);
        return;
      }
      guard.investigating = false;
      guard.suspicion = 0;
      guard.pause = GUARD.patrolPause;
      return;
    }
    if (guard.pause > 0) {
      guard.pause -= dt;
      return;
    }
    const target = guard.waypoints[guard.waypointIndex];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    const step = GUARD.speed * dt;
    if (dist <= step) {
      guard.x = target.x;
      guard.y = target.y;
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.pause = GUARD.patrolPause;
      return;
    }
    moveCircle(guard, (dx / dist) * step, (dy / dist) * step, state.level.walls);
    guard.angle = Math.atan2(dy, dx);
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1, `sneak` halves speed and detection,
   * `throwDecoy` drops a noise coin ahead of the thief. With `harmless` set (the title
   * screen's backdrop) the world moves but nobody is ever caught and nothing scores.
   */
  function step(dt, move, sneak, throwDecoy, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.levelElapsed += dt;
    const thief = state.thief;
    const walls = state.level.walls;

    // Thief movement.
    const len = Math.hypot(move.x, move.y);
    thief.moving = len > 0.01;
    if (thief.moving) {
      const speed = (sneak ? THIEF.sneakSpeed : THIEF.speed) * dt;
      const nx = (move.x / len) * speed;
      const ny = (move.y / len) * speed;
      moveCircle(thief, nx, ny, walls);
      thief.angle = Math.atan2(move.y, move.x);
    }
    thief.sneaking = sneak;

    // Decoy: costs score, rings out, pulls the nearest guard that can hear it.
    if (throwDecoy && state.gadgets > 0 && !harmless) {
      state.gadgets -= 1;
      state.score = Math.max(0, state.score - GADGET.cost);
      const dx = Math.cos(thief.angle);
      const dy = Math.sin(thief.angle);
      const decoy = { x: thief.x + dx * GADGET.throwDistance, y: thief.y + dy * GADGET.throwDistance, until: state.elapsed + GADGET.distractSeconds };
      state.decoys.push(decoy);
      let nearest = null;
      let nearestDist = Infinity;
      for (const guard of state.guards) {
        const d = distance(guard.x, guard.y, decoy.x, decoy.y);
        if (d < GADGET.hearRange && d < nearestDist) {
          nearest = guard;
          nearestDist = d;
        }
      }
      if (nearest) {
        nearest.investigateX = decoy.x;
        nearest.investigateY = decoy.y;
        nearest.distractUntil = decoy.until;
        nearest.investigating = false;
        nearest.suspicion = 0;
      }
      events |= EVENT_DECOY;
    }
    state.decoys = state.decoys.filter((d) => state.elapsed < d.until);

    // Cameras sweep.
    for (const camera of state.cameras) {
      const t = (state.levelElapsed / CAMERA.sweepSeconds) * Math.PI * 2 + camera.phase;
      camera.angle = camera.baseAngle + Math.sin(t) * CAMERA.sweep;
    }

    // Who sees the thief?
    let seen = false;
    let alarmGain = 0;
    for (const guard of state.guards) {
      const visible = canSee(guard.x, guard.y, guard.angle, GUARD.halfAngle, GUARD.sightRange, walls);
      guard.seen = visible;
      if (visible) {
        seen = true;
        guard.suspicion = Math.min(100, guard.suspicion + GUARD.suspicionRate * dt);
        alarmGain += sneak ? GUARD.sneakAlarmRate : GUARD.alarmRate;
        if (guard.suspicion >= 60 && !guard.investigating && state.elapsed >= guard.distractUntil) {
          guard.investigating = true;
          guard.investigateX = thief.x;
          guard.investigateY = thief.y;
        }
      } else {
        guard.suspicion = Math.max(0, guard.suspicion - 25 * dt);
      }
    }
    for (const camera of state.cameras) {
      const visible = canSee(camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.sightRange, walls);
      camera.seen = visible;
      if (visible) {
        seen = true;
        alarmGain += sneak ? CAMERA.sneakAlarmRate : CAMERA.alarmRate;
      }
    }

    if (seen) {
      if (!state.wasSeen) {
        state.timesSpotted += 1;
        events |= EVENT_SPOTTED;
      }
      state.wasSeen = true;
      state.alarm = Math.min(ALARM.max, state.alarm + alarmGain * dt);
    } else {
      state.wasSeen = false;
      state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    }
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

    // A guard that reaches the thief ends the run.
    if (!harmless) {
      for (const guard of state.guards) {
        if (distance(guard.x, guard.y, thief.x, thief.y) < guard.radius + thief.radius - 2) {
          state.caughtReason = 'A guard grabbed you in the gallery.';
          return events | EVENT_CAUGHT;
        }
      }
      if (state.alarm >= ALARM.max) {
        state.caughtReason = 'The alarm hit 100% — the vault sealed shut.';
        return events | EVENT_CAUGHT;
      }
    }

    // Paintings: walk over one to pocket it.
    if (!harmless) {
      for (const painting of state.paintings) {
        if (!painting.taken && distance(thief.x, thief.y, painting.x, painting.y) < LOOT.grabRadius) {
          painting.taken = true;
          state.score += LOOT.paintingValue;
          state.lootTaken += 1;
          events |= EVENT_PICKUP;
        }
      }
    }

    // The vault: stand close and it cracks open after a few seconds of work.
    if (!state.vaultCracked) {
      const vault = state.level.vault;
      if (distance(thief.x, thief.y, vault.x, vault.y) < THIEF.crackReach) {
        state.crackProgress += dt / THIEF.crackSeconds;
        if (state.crackProgress >= 1 && !harmless) {
          state.vaultCracked = true;
          state.score += LOOT.vaultValue;
          state.lootTaken += 1;
          events |= EVENT_VAULT;
        }
      }
    }

    // The getaway: the green door only opens once the vault is cracked.
    if (!harmless && state.vaultCracked) {
      const exit = state.level.exit;
      if (distance(thief.x, thief.y, exit.x, exit.y) < 42) {
        if (state.levelIndex + 1 >= LEVELS.length) {
          state.gameWon = true;
        } else {
          state.levelDone = true;
        }
        return events | EVENT_LEVEL_DONE;
      }
    }

    // Guards patrol (after the catch checks, so a caught frame freezes them).
    for (const guard of state.guards) stepGuard(guard, dt);

    return events;
  }

  function nextLevel() {
    loadLevel(state.levelIndex + 1);
  }

  reset();
  return { state, reset, step, nextLevel, loadLevel };
}
