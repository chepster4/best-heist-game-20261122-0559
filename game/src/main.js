// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, level complete, win
// and busted.
//
// ?seed=N fixes the level layouts' camera phases. ?shot=cover|start|win|caught (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_DECOY, EVENT_GHOST, EVENT_LEVEL_DONE, EVENT_PICKUP, EVENT_SMOKE, EVENT_SPOTTED, EVENT_VAULT, EVENT_VENT } from './world.js';
import { ACTION_CONFIRM, ACTION_DECOY, ACTION_MUTE, ACTION_PAUSE, ACTION_SMOKE, ACTION_VENT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();
  let flash = null;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    flash = null;
    announce('Playing. Crack the vault, then reach the green getaway door.');
  }

  function endGame(caught) {
    if (caught) {
      screen = SCREEN_OVER;
      audio.caught();
      announce(`Busted. ${world.state.caughtReason} Loot $${world.state.score}.`);
    } else if (world.state.gameWon) {
      screen = SCREEN_WIN;
      audio.win();
      announce(`Clean getaway! Total loot $${world.state.score}.`);
    } else {
      screen = SCREEN_LEVEL;
      audio.win();
      announce(`Heist complete. Loot $${world.state.score}. Next heist.`);
    }
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_LEVEL) {
        world.nextLevel();
        screen = SCREEN_PLAY;
        flash = null;
        announce(`Playing. ${world.state.level.name}.`);
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, false, true);
      return;
    }
    const move = input.move(world.state.thief.x, world.state.thief.y, renderer.toField);
    const prevScore = world.state.score;
    const events = world.step(STEP, move, input.sneaking(), Boolean(actions & ACTION_DECOY), false, Boolean(actions & ACTION_SMOKE), Boolean(actions & ACTION_VENT));
    if (events & EVENT_PICKUP) {
      audio.pickup();
      flash = { message: `Loot pocketed! +$${world.state.score - prevScore}`, color: '#f2c94c', until: world.state.elapsed + 2.5 };
    } else if (events & EVENT_VAULT) {
      audio.vault();
      flash = { message: 'VAULT CRACKED — get to the green door!', color: '#51cf66', until: world.state.elapsed + 3 };
    } else if (events & EVENT_DECOY) {
      audio.decoy();
      flash = { message: 'Decoy thrown — the guard goes to look (-$50)', color: '#8b93a3', until: world.state.elapsed + 2.5 };
    } else if (events & EVENT_SMOKE) {
      flash = { message: 'Smoke out — hidden inside the cloud (-$75)', color: '#8b93a3', until: world.state.elapsed + 2.5 };
    } else if (events & EVENT_VENT) {
      flash = { message: 'Through the vent — they lost you', color: '#51cf66', until: world.state.elapsed + 2.5 };
    } else if (events & EVENT_GHOST) {
      flash = { message: 'GHOST BONUS +$150 — the alarm never passed 50%', color: '#f2c94c', until: world.state.elapsed + 3 };
    } else if (events & EVENT_SPOTTED) {
      audio.spotted();
      flash = { message: 'SPOTTED — break line of sight!', color: '#e5534b', until: world.state.elapsed + 2 };
    }
    if (events & EVENT_CAUGHT) endGame(true);
    else if (events & EVENT_LEVEL_DONE) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot actions (decoy, confirm) belong to the first step only: the same
      // press must never fire again on the catch-up steps of the same frame.
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (flash && world.state.elapsed > flash.until) flash = null;
    renderer.draw(world.state, screen, best, muted, flash);
  }

  // Leaving the tab pauses a running game rather than letting the alarm rise unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
