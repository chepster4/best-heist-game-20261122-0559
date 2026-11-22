// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Canvas shapes and text only — every pixel is the game's own art: marble floor,
// carpets, framed paintings, the gold vault, the green getaway door, guards with their
// sweeping vision cones, cameras with theirs, and the thief in the middle of it all.
import { ALARM, CAMERA, FIELD, FONT, GADGET, GUARD, LOOT, PALETTE, THIEF } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEVEL = 'level';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 140, line: 34, bottom: 76 };
const TILE = 80;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const lootLabel = cachedLabel('LOOT $');
  const timeLabel = cachedLabel('');
  const levelLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a client (mouse) point to playfield coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    return {
      x: ((clientX - rect.left) * ratio - view.x) / view.scale,
      y: ((clientY - rect.top) * ratio - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawCone(x, y, angle, halfAngle, range, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
    // Bright edges so the cone reads as a shape, not a faint blob.
    context.strokeStyle = fill.replace(/[\d.]+\)$/, '0.55)');
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    context.stroke();
  }

  function drawFloor(state) {
    for (let ty = 0; ty < FIELD.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    // Carpet runners down the middle of each hall, so the thief's route reads at a glance.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(600, 24, 80, 672);
    context.fillRect(24, 330, 1232, 56);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 3;
    context.strokeRect(600, 24, 80, 672);
    context.strokeRect(24, 330, 1232, 56);
  }

  function drawWalls(state) {
    for (const wall of state.level.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 4);
    }
  }

  function drawPaintings(state) {
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 3);
    for (const painting of state.paintings) {
      if (painting.taken) continue;
      // Big frame + glowing value tag, so loot is obvious from across the room.
      context.fillStyle = `rgba(242, 201, 76, ${0.25 + 0.35 * pulse})`;
      context.fillRect(painting.x - 32, painting.y - 26, 64, 52);
      context.fillStyle = PALETTE.paintingFrame;
      context.fillRect(painting.x - 28, painting.y - 20, 56, 40);
      context.fillStyle = painting.hue;
      context.fillRect(painting.x - 22, painting.y - 14, 44, 28);
      // A gold glint so loot is obvious from across the room.
      context.fillStyle = 'rgba(255, 255, 255, 0.5)';
      context.fillRect(painting.x - 22, painting.y - 14, 44, 5);
      text(`$${painting.value ?? LOOT.paintingValue}`, painting.x, painting.y + 38, 15, PALETTE.vaultGlow, 'center');
    }
  }

  function drawVault(state) {
    const vault = state.level.vault;
    const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 3);
    context.fillStyle = state.vaultCracked ? PALETTE.vaultGlow : PALETTE.vaultDoor;
    context.beginPath();
    context.arc(vault.x, vault.y, 30, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = state.vaultCracked ? '#fff7cc' : '#7a5f0e';
    context.lineWidth = 4;
    context.stroke();
    // Dial spokes.
    context.strokeStyle = '#3a2f05';
    context.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2 + state.elapsed * (state.vaultCracked ? 0 : 0.4);
      context.beginPath();
      context.moveTo(vault.x, vault.y);
      context.lineTo(vault.x + Math.cos(a) * 22, vault.y + Math.sin(a) * 22);
      context.stroke();
    }
    if (!state.vaultCracked) {
      text('VAULT', vault.x, vault.y - 40, 15, `rgba(242, 201, 76, ${0.55 + 0.45 * pulse})`, 'center');
    }
    // Crack progress ring while the thief works on it.
    if (state.crackProgress > 0 && !state.vaultCracked) {
      context.strokeStyle = PALETTE.vaultGlow;
      context.lineWidth = 6;
      context.beginPath();
      context.arc(vault.x, vault.y, 40, -Math.PI / 2, -Math.PI / 2 + state.crackProgress * Math.PI * 2);
      context.stroke();
    }
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.vaultCracked;
    const pulse = open ? 0.6 + 0.4 * Math.sin(state.elapsed * 4) : 0.35;
    context.fillStyle = open ? PALETTE.exitDoor : '#234d2c';
    context.fillRect(exit.x - 46, exit.y - 12, 92, 24);
    context.fillStyle = `rgba(81, 207, 102, ${pulse})`;
    context.fillRect(exit.x - 46, exit.y - 12, 92, 24);
    text(open ? 'GETAWAY ▼' : 'GETAWAY (LOCKED)', exit.x, exit.y - 22, 15, open ? PALETTE.exitGlow : PALETTE.muted, 'center');
  }

  function drawDecoys(state) {
    for (const decoy of state.decoys) {
      context.fillStyle = PALETTE.vaultGlow;
      context.beginPath();
      context.arc(decoy.x, decoy.y, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#7a5f0e';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(decoy.x, decoy.y, 12 + 4 * Math.sin(state.elapsed * 8), 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.sightRange, camera.seen ? 'rgba(229, 83, 75, 0.30)' : 'rgba(79, 195, 247, 0.24)');
      // Wall mount bracket, then a bigger body with a blinking red eye, so the
      // camera reads as a camera instead of a dot on the wall.
      context.fillStyle = '#5a6474';
      context.fillRect(camera.x - 4, camera.y - 16, 8, 8);
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(camera.x, camera.y, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#eef1f5';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(camera.x, camera.y, 13, 0, Math.PI * 2);
      context.stroke();
      const blink = camera.seen || Math.sin(state.elapsed * 4) > 0;
      context.fillStyle = blink ? '#ff3b30' : '#7a2020';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 8, camera.y + Math.sin(camera.angle) * 8, 4.5, 0, Math.PI * 2);
      context.fill();
      text('CAM', camera.x, camera.y + 28, 11, camera.seen ? '#e5534b' : PALETTE.muted, camera.x > 1100 ? 'right' : camera.x < 180 ? 'left' : 'center');
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const alerted = guard.suspicion >= 60 || guard.investigating || state.elapsed < guard.distractUntil;
      drawCone(guard.x, guard.y, guard.angle, GUARD.halfAngle, GUARD.sightRange, guard.seen ? PALETTE.coneAlert : 'rgba(242, 201, 76, 0.28)');
      // Suspicion arc above the guard's head.
      if (guard.suspicion > 0) {
        context.strokeStyle = guard.suspicion >= 60 ? '#e5534b' : '#f2c94c';
        context.lineWidth = 5;
        context.beginPath();
        context.arc(guard.x, guard.y, 26, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
        context.stroke();
      }
      // Bigger body with a cap brim and a bright ring, so the guard reads at a glance.
      const bodyR = GUARD.radius + 5;
      context.fillStyle = alerted ? PALETTE.guardAlert : '#3f6db3';
      context.beginPath();
      context.arc(guard.x, guard.y, bodyR, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#dfe6f2';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(guard.x, guard.y, bodyR, 0, Math.PI * 2);
      context.stroke();
      // Cap brim facing where the guard looks.
      context.strokeStyle = '#dfe6f2';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (bodyR + 8), guard.y + Math.sin(guard.angle) * (bodyR + 8));
      context.stroke();
      // "?" while suspicious, "!" while chasing — the guard's state at a glance.
      if (guard.investigating || guard.suspicion >= 60) {
        text('!', guard.x, guard.y - bodyR - 12, 22, '#e5534b', 'center');
      } else if (guard.suspicion > 0) {
        text('?', guard.x, guard.y - bodyR - 12, 20, '#f2c94c', 'center');
      }
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    // Soft shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.ellipse(thief.x, thief.y + 10, 15, 6, 0, 0, Math.PI * 2);
    context.fill();
    // Gold halo so the thief pops out of the dark floor.
    context.strokeStyle = 'rgba(242, 201, 76, 0.85)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius + 5, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thiefMask;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.stroke();
    // The mask: a pale band with two eye slits, facing the way the thief moves.
    context.save();
    context.translate(thief.x, thief.y);
    context.rotate(thief.angle);
    context.fillStyle = PALETTE.thiefMask;
    context.fillRect(2, -8, 9, 16);
    context.fillStyle = PALETTE.thief;
    context.fillRect(6, -5, 4, 3);
    context.fillRect(6, 2, 4, 3);
    context.restore();
    if (thief.sneaking) {
      text('sneaking', thief.x, thief.y - 22, 12, PALETTE.muted, 'center');
    }
  }

  function alarmColor(alarm) {
    if (alarm >= ALARM.tenseAt) return PALETTE.alarmHigh;
    if (alarm >= 40) return PALETTE.alarmMid;
    return PALETTE.alarmLow;
  }

  function drawHud(state, muted) {
    // Top bar.
    context.fillStyle = 'rgba(11, 13, 18, 0.82)';
    context.fillRect(0, 0, FIELD.width, 52);
    context.textBaseline = 'top';
    text(lootLabel(state.score), 24, 14, 26, PALETTE.hud, 'left');
    text(levelLabel(state.level.name), FIELD.width / 2, 16, 20, PALETTE.muted, 'center');
    const seconds = Math.floor(state.elapsed);
    text(timeLabel(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`), FIELD.width - 24, 14, 26, PALETTE.hud, 'right');

    // The alarm meter: a wide bar across the top centre, impossible to miss.
    const barW = 420;
    const barX = (FIELD.width - barW) / 2;
    const barY = 56;
    text('ALARM', barX - 10, barY + 1, 18, alarmColor(state.alarm), 'right');
    context.fillStyle = '#10131a';
    context.fillRect(barX, barY, barW, 20);
    context.fillStyle = alarmColor(state.alarm);
    context.fillRect(barX, barY, (barW * state.alarm) / ALARM.max, 20);
    context.strokeStyle = '#3a4152';
    context.lineWidth = 2;
    context.strokeRect(barX, barY, barW, 20);
    text(`${Math.round(state.alarm)}%`, barX + barW + 10, barY + 1, 18, alarmColor(state.alarm), 'left');
    // Objective tracker under the alarm bar: what is left to steal, at a glance.
    const lootTotal = state.paintings.length + 1;
    const lootGot = state.lootTaken;
    const vaultText = state.vaultCracked ? 'VAULT CRACKED' : 'VAULT LOCKED';
    const tierText = state.alarm >= ALARM.tenseAt ? ' · Alarm critical — break line of sight!' : state.alarm >= 50 ? ' · Alarm rising — break line of sight' : '';
    text(`LOOT ${lootGot}/${lootTotal} · ${vaultText}${tierText}`, FIELD.width / 2, barY + 30, 16, state.vaultCracked ? PALETTE.exitGlow : PALETTE.hud, 'center');
    if (state.alarm >= ALARM.tenseAt) {
      const pulse = 0.25 + 0.2 * Math.sin(state.elapsed * 10);
      context.fillStyle = `rgba(229, 83, 75, ${pulse})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    // Gadgets, bottom left.
    text('DECOYS', 24, FIELD.height - 34, 16, PALETTE.muted, 'left');
    for (let i = 0; i < GADGET.count; i += 1) {
      context.fillStyle = i < state.gadgets ? PALETTE.vaultGlow : '#2a3040';
      context.beginPath();
      context.arc(104 + i * 28, FIELD.height - 26, 9, 0, Math.PI * 2);
      context.fill();
    }
    text('WASD / arrows move · Shift sneak · E decoy (-$50) · P pause · M mute', FIELD.width / 2, FIELD.height - 32, 15, PALETTE.muted, 'center');
    if (muted) text('MUTED', FIELD.width - 24, FIELD.height - 34, 16, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 13, 18, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent ?? PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.hud, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.vaultGlow, 'center');
  }

  function drawField(state) {
    drawFloor(state);
    drawExit(state);
    drawPaintings(state);
    drawVault(state);
    drawDecoys(state);
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    drawWalls(state);
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'MIDNIGHT VAULT',
        [
          'Three heists. One thief. No alarms, if you are good.',
          'Cross the gallery, dodge the guards and their cones,',
          'beat the cameras, crack the vault and get out.',
          '',
          `Best loot yet: $${best}`,
        ],
        'Press Space or click to start the heist',
        PALETTE.vaultGlow,
      );
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to keep sneaking');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'BUSTED',
        [
          state.caughtReason,
          '',
          `Loot banked: $${state.score}   ·   Best: $${best}`,
          `Spotted ${state.timesSpotted} time${state.timesSpotted === 1 ? '' : 's'} · Peak alarm ${Math.round(state.maxAlarm)}%`,
        ],
        'Press Space or click to try again',
        PALETTE.alarmHigh,
      );
    } else if (screen === SCREEN_LEVEL) {
      drawPanel(
        'HEIST COMPLETE',
        [
          `${state.level.name} — cleared.`,
          `Loot so far: $${state.score}   ·   Peak alarm ${Math.round(state.maxAlarm)}%`,
          state.maxAlarm < 30 ? 'Ghost rating: nobody ever saw you.' : 'Loud rating: they knew someone was here.',
        ],
        'Press Space or click for the next heist',
        PALETTE.exitGlow,
      );
    } else if (screen === SCREEN_WIN) {
      const ghost = state.maxAlarm < 30;
      drawPanel(
        'THE CLEAN GETAWAY',
        [
          'All three vaults cracked. The crew is gone before dawn.',
          '',
          `Total loot: $${state.score}   ·   Time ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`,
          ghost ? 'GHOST — never once spotted. A legend.' : `Spotted ${state.timesSpotted} times — still got away with it.`,
          `Best: $${best}`,
        ],
        'Press Space or click to run it again',
        PALETTE.vaultGlow,
      );
    }
    if (extra && extra.message) {
      context.textBaseline = 'alphabetic';
      text(extra.message, FIELD.width / 2, 110, 22, extra.color ?? PALETTE.vaultGlow, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
