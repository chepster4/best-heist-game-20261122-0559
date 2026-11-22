// Keyboard and pointer input. Held keys give a steering vector; one-shot presses
// (start, pause, throw a decoy) are queued as bit flags and taken once by the loop, so
// a press between two frames is never lost and never counted twice. The mouse steers
// too: hold the left button and the thief walks toward the pointer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DECOY = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DECOY = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let sneak = false;
  let actions = 0;
  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (SNEAK.has(event.code)) sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DECOY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DECOY;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (SNEAK.has(event.code)) sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything.
  window.addEventListener('blur', () => {
    left = right = up = down = sneak = false;
    pointerDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  return {
    /** The steering vector this frame, from keys or from the held pointer. */
    move(thiefX, thiefY, toField) {
      let x = (right ? 1 : 0) - (left ? 1 : 0);
      let y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0 && pointerDown) {
        const target = toField(pointerX, pointerY);
        const dx = target.x - thiefX;
        const dy = target.y - thiefY;
        const dist = Math.hypot(dx, dy);
        if (dist > 14) {
          x = dx / dist;
          y = dy / dist;
        }
      }
      return { x, y };
    },
    sneaking() {
      return sneak;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
