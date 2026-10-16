# Architecture

Pulse Thief is a single-scene Phaser 3 game with no build tooling. This document explains how the pieces fit so you can change one without breaking the others.

## Load order

`index.html` loads five classic scripts, in this order:

1. `vendor/phaser.min.js` creates the global `Phaser`.
2. `src/config.js` creates the global `PulseThief` namespace (`PT`) and fills it with constants.
3. `src/audio.js` adds `PT.AudioSystem`.
4. `src/scenes/PulseScene.js` adds `PT.PulseScene`.
5. `src/main.js` instantiates `Phaser.Game` with that scene and attaches a `ResizeObserver` to `#game`.
6. `src/ui.js` wires the help dialog. It does not touch `PT`.

Each file is wrapped in an IIFE that receives `window.PulseThief`. Nothing else leaks into the global scope. If you add a file, it must go after whatever it reads from `PT` and before whatever reads from it.

### Why not ES modules?

Browsers refuse to `import` on `file://` URLs (CORS). The product requirement is "double-click index.html, it works, offline". Classic scripts plus one namespace object is the simplest thing that meets that requirement.

## Files

### `src/config.js`

Pure data. No Phaser calls. Holds:

- `W`, `H`: virtual canvas size (960 × 600). Phaser's `Scale.FIT` stretches this to the window.
- `FIELD`: the playfield rectangle.
- `CONFIG`: every balance number. See `GAME_DESIGN.md`.
- `COLORS`, `TYPES`, `COLOR_BY_TYPE`, `ICON_BY_TYPE`: palette and spawn tables.
- `dist(a, b)` and `hex(n)` helpers.

### `src/audio.js`

`AudioSystem` wraps Web Audio. It lazily creates an `AudioContext` on `unlock()` (browsers require a user gesture first), and `tone(freq, duration, waveType)` plays a short pitched blip with a downward frequency sweep. There are no audio files.

### `src/scenes/PulseScene.js`

Everything you see. Sections, top to bottom:

| Section   | Methods                                               | Responsibility                                  |
| --------- | ----------------------------------------------------- | ----------------------------------------------- |
| setup     | `create`, `text`, `makeUI`                            | One-time creation of HUD and overlay objects    |
| layout    | `layout`, `setIdleStatus`                             | Position and size everything for the current canvas size |
| sector    | `startSector`, `createNode`, `radiusOf`               | Wipe the board and spawn a new node field       |
| hover/select/hint | `onNodeDown`, `select`, `deselect`, `hoverNode`, `drawPreview`, `clearPreview`, `simulateReach`, `showHint`, `clearHint` | Mouse hover and touch select previews; sector-1 marker |
| reaction  | `inject`, `receive`, `fire`, `splitTargets`           | The chain-reaction state machine                |
| juice     | `wobble`, `shove`, `punch`, `bumpChainLabel`, `sting`, `callout` | Squash, spring-back, shake, counters, messages |
| effects   | `drawShockwave`, `arc`, `spark`, `flashNumber`        | Fire-and-forget visuals that destroy themselves |
| hud       | `updateHud`                                           | Rewrites the text labels from scene state       |
| win/lose  | `checkResult`, `endSector`, `rankFor`, `celebrateWin`, `showLoss`, `slideInOverlay`, `showOverlayButton`, `pressOverlayButton`, `flyCharge`, `confetti`, `restartRun`, `toggleMute` | End-of-sector flow and celebration |

### `src/main.js`

Phaser boot config. `parent: 'game'` targets the `<div id="game">` in `index.html`.

## Resolution

`main.js` sizes the canvas at `CSS px * PT.DPR` (`devicePixelRatio`, capped at 3) and uses `Phaser.Scale.NONE` with `zoom = 1 / PT.DPR`. Phaser then shrinks the hi-res canvas back to CSS size via its style and scales input coordinates accordingly. Inside the scene, **one game px is 1/DPR CSS px**. Anything that reasons about physical size (breakpoints, font floors, touch targets, fixed-pixel offsets) multiplies by `this.dpr`; anything proportional (`* f`, `* unit`, `* node.base`) already includes it because `f`, `unit` and `nodeScale` are computed in CSS px and multiplied by DPR.

Why not `Scale.RESIZE` with `zoom`? RESIZE derives the game size from the parent's CSS size, which fights a DPR multiplier. NONE plus our own `ResizeObserver` (which multiplies by DPR) is explicit.

## Responsive layout

`layout(W, H)` runs on create and on every `resize` event and is the only place that knows about screen size:

- `cw, ch = W / dpr, H / dpr` are the CSS-px dimensions used for breakpoints.
- `portrait = ch > cw * 0.95` picks one of two HUD arrangements.
- `f = dpr * clamp(min(cw/960, ch/560), 0.68, 1)` scales every font and HUD measurement; HUD fonts floor at 8 CSS px.
- `field` is what remains after the HUD rows and the status line.
- `unit = clamp(sqrt(fieldArea / refArea), 0.55, 1.25)` scales radii, node spacing, shove distance and particle travel so density matches the reference 876 x 406 field the numbers were tuned on. `nodeScale` (0.78 to 1.15) scales the node containers; `node.base` remembers it so hover / wobble tweens are relative.
- Nodes keep `nx, ny` in 0..1 and are re-placed from them, so a mid-sector rotation keeps the board.
- `layoutOverlay()` lays out the results card: a stacked arrangement by default and a two-column one when `ch < 430 && cw > ch`. Card width is `min(cw - 24, 600)` CSS px (820 in wide mode); `cf = dpr * clamp(width / 520, 0.72, 1.15)` scales every card measurement, with per-text CSS-px floors via `sz(base, min)`. If the stack is taller than the field, `cf` shrinks to fit. `drawOverlayCard()` paints the card, tiles and button from the computed geometry (`this.ovlGeom`) and the content state (`this.ovl`); `setOverlayContent()` is the only entry point for filling it.

The `ResizeObserver` in `main.js` matters because Phaser only re-measures on window `resize`. Flex layout settling after boot, a phone's address bar collapsing, or a `dvh` change do not fire one. It is attached after `Phaser.Core.Events.READY` because the observer fires synchronously on `observe()`, before the scale manager exists.

## Input model

| Device | Preview                         | Fire                    | Cancel                 |
| ------ | ------------------------------- | ----------------------- | ---------------------- |
| Mouse  | hover (`hoverNode`)             | click (`onNodeDown`)    | move away              |
| Touch  | tap = `select()`                | tap same node again     | tap empty space (`deselect`) |

`pointer.wasTouch` decides per event. `hoverNode` ignores touch pointers entirely because Phaser emits `pointerover` / `pointerout` around every tap. `isTouch` flips on the first touch and only changes wording (status, hint, tips, hidden keyboard hints).

## The chain reaction

This is the only non-trivial logic in the project.

```
player click
   │
   ▼
inject(node)          spend a charge, set busy, start a "quiet" watcher
   │
   ▼
receive(node)         mark activated, score it, +charge if battery
   │  (125 ms)        capacitors return early on their first hit
   ▼
fire(node)            shockwave; for each dormant neighbour in radius:
   │                    schedule receive(neighbour) after 75 ms + 1.5 ms/px
   │                  splitters also pick up to 3 far nodes in distinct
   │                    directions and schedule those too
   ▼
receive(...) → fire(...) → receive(...) ...   until nothing is in range
   │
   ▼
watcher sees lastReaction is > chainQuietMs old
   │
   ▼
checkResult()         won? lost? otherwise unlock input for the next click
   │
   ▼
endSector(won)        overlay; button calls startSector()
```

`simulateReach(start)` is a pure, synchronous copy of this walk (no timers, no visuals). It drives the hint and is safe to call any time because it never mutates node state.

Key invariants:

- `node.activated` is the only guard against double-activation. `receive` checks it first, so overlapping pulses are harmless.
- `lastReaction` is bumped in both `receive` and `fire`. The watcher in `inject` polls every 220 ms and declares the chain over once `chainQuietMs` (750 ms) has passed without a bump. All scheduled `delayedCall`s fire well inside that window, so there is no race in practice.
- `busy` blocks new clicks while a chain is running. `ended` blocks everything once the overlay is up.
- `node.x / node.y` are the logical position and never change. `node.container` may be tweened away from it (shove, wobble) and always springs back; all distance maths uses `node.x / node.y`.
- `startSector` calls `time.removeAllEvents()` first, so no delayed `receive` from a previous board can fire on destroyed nodes.
- Chain delays divide by `unit` so propagation speed in px/ms is the same on every screen.

## End-of-sector sequence

`endSector(won)` sets `ended`, then hands off to `celebrateWin()` or `showLoss()`. Both hide the button and set `tallyDone = false`; `pressOverlayButton()` ignores clicks and keys until `showOverlayButton()` flips it back. Everything in the sequence is a chain of `time.delayedCall`s, so `startSector()`'s `removeAllEvents()` also cancels a celebration in progress if the player restarts with R.

Win timeline (ms after the chain settles): 0 flash, shake, fanfare, confetti from each lit node staggered 22 ms; 650 overlay slides in; 1150+ one charge flies into the score every 280 ms; then rank drops in with a hit, NEW BEST stamp if earned, button appears 700 ms later.

## State

All mutable state lives on the scene instance. There is no separate model. The only persistence is the best score in `localStorage` under `pulse_thief_best`, guarded by try/catch for private-mode browsers.

## Rendering

No textures. Nodes are five stacked Phaser shapes inside a `Container` so they move and hit-test as a unit. Effects (rings, arcs, sparks, score popups) are created, tweened, and destroyed in their `onComplete`. The `effects` array is kept for symmetry but effects clean themselves up, so it is usually empty.

Depth layering, low to high: background 0, legend 2, reach preview 5, shockwaves 8, hint ring 9, nodes 10, arcs 13, sparks 20, score popups 30, chain counter 40, hint label 45, stings 50, callouts 60, overlay 70.

## Adding things

- **New node type**: add it to `TYPES`, `COLOR_BY_TYPE`, `ICON_BY_TYPE` in `config.js`; add a legend entry in `makeUI`; branch on `node.type` in `receive` or `fire`.
- **New sound**: call `this.audio.tone(...)`. Keep durations under 0.25 s; tones stack.
- **New scene** (menu, pause): create `src/scenes/YourScene.js` that sets `PT.YourScene`, add it to `index.html` before `main.js`, and push it into the `scene` array in `main.js`.
