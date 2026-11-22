# best-heist-game-20261122-0559

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/chepster4/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/chepster4/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**Midnight Vault** is an original top-down stealth heist game that runs offline in a
desktop browser from its own static files. Three heists, one thief, no alarms — if
you are good.

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

## How to play

You are the thief. Cross the gallery, dodge the guards and their vision cones, beat
the sweeping security cameras, crack the gold vault, then reach the green getaway
door before the alarm hits 100%.

- **WASD / arrow keys** — move (or hold the mouse button and the thief walks to it)
- **Shift** — sneak: slower, but guards and cameras spot you half as fast
- **E** — throw a decoy coin (-$50): the nearest guard walks off to investigate it
- **Q** — drop a smoke puff (-$75): guards and cameras cannot see you inside the cloud
- **F** — slip into a floor vent: crawl unseen to the paired grate on the other side
- **P** — pause · **M** — mute · **Space / click** — start, continue, retry

## The heists

1. **The Gilded Gallery** — 2 guards, 2 cameras, 3 paintings, 1 vault.
2. **The Jade Vault** — 3 guards, 3 cameras, 4 paintings, the vault behind the east wing.
3. **The Crown Suite** — 4 guards, 4 cameras, 4 paintings, the crown vault.

Each heist has several routes through its rooms: a loud thief can grab every
painting, a ghost can slip straight to the vault — or crawl through the floor
vents from one side of the gallery to the other. Paintings are worth $100, a vault
$500. Standing by the vault cracks it open after a few seconds of work. The alarm
rises while any guard or camera has eyes on you and falls while you stay hidden —
at 100% the vault seals and security swarms in. Once the vault is cracked the alarm
stays hot while you run for the green door. Finish a heist with the alarm never
past 50% and the crew pays a $150 ghost bonus. A guard that reaches you ends the
run on the spot.

No build step, no network requests, no libraries — plain canvas and WebAudio bleeps
synthesized in code. Screenshots in `screenshots/` are real renders of the game,
staged by `game/src/shots.js` (`?shot=cover|tools|win|caught&seed=7`).

## Entry

Built for the make.fun competition
[best-heist-game-20261122-0559](https://make.fun/bounty/best-heist-game-20261122-0559).
`main.ts` (Node 22) copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=b5gt2sm0&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
