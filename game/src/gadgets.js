// The smoke puff: the thief's second tool, and like the decoy it is never free.
// Q drops a cloud at the thief's feet for a few seconds; any guard or camera whose
// eyes are on the thief while he stands inside it sees nothing at all. Step out of
// the cloud and the cover is gone — so a smoke puff buys a crossing, not a hiding
// place, and the thief who spends it on nothing has thrown $75 away.

import { SMOKE } from './config.js';

/**
 * Drop a smoke puff at the thief's feet. Costs score, like every tool in this
 * game. Returns true when a cloud went down.
 */
export function throwSmoke(state) {
  if (state.smokeLeft <= 0) return false;
  state.smokeLeft -= 1;
  state.score = Math.max(0, state.score - SMOKE.cost);
  state.smokes.push({ x: state.thief.x, y: state.thief.y, until: state.elapsed + SMOKE.seconds });
  return true;
}

/** True when the thief stands inside a live smoke cloud — and is invisible. */
export function thiefInSmoke(state) {
  for (const smoke of state.smokes) {
    if (Math.hypot(state.thief.x - smoke.x, state.thief.y - smoke.y) < SMOKE.radius) return true;
  }
  return false;
}
