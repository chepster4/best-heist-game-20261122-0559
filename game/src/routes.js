// Alternate routes: floor vents the thief slips through to cross a room unseen.
// Each level hides two grates, paired with each other: slip into one (F) and, after
// a short crawl no guard or camera can watch, pop out of the other. A vent is a
// second way through a room — the loud route is never the only route, and a thief
// who reads the patrols can skip a whole wing of trouble for free.

import { VENT } from './config.js';

/** The vent nearest (x, y), or null when none is close enough to slip into. */
export function nearestVent(vents, x, y) {
  let best = null;
  let bestDist = VENT.radius;
  for (const vent of vents) {
    const d = Math.hypot(vent.x - x, vent.y - y);
    if (d < bestDist) {
      best = vent;
      bestDist = d;
    }
  }
  return best;
}

/** The grate paired with `vent`: vents come in twos, each one's exit is the other. */
export function pairedVent(vents, vent) {
  for (const other of vents) {
    if (other !== vent) return other;
  }
  return vent;
}

/**
 * Slip into the nearest vent. Returns true when the thief starts crawling; the
 * world keeps the crawl in state.vent and moves him to the paired grate when the
 * crawl time is up. While he crawls he cannot steer and nobody can see him.
 */
export function enterVent(state) {
  if (state.vent) return false;
  const vent = nearestVent(state.vents, state.thief.x, state.thief.y);
  if (!vent) return false;
  state.vent = {
    from: vent,
    exit: pairedVent(state.vents, vent),
    until: state.elapsed + VENT.crawlSeconds,
  };
  return true;
}

/** True while the thief is crawling between grates — unseen, and unable to steer. */
export function thiefInVent(state) {
  return state.vent !== null;
}
