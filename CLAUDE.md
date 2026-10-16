# CLAUDE.md

Guidance for AI assistants and new contributors working in this repo.

## What this is

Pulse Thief: a single-scene Phaser 3.90.0 arcade game. Zero build step, zero assets, zero network. It must keep working when `index.html` is double-clicked from disk while offline.

## Hard constraints

- **No ES modules.** Browsers block `import` on `file://`. Use classic `<script>` tags and the `window.PulseThief` namespace. See `docs/ARCHITECTURE.md`.
- **No CDN or remote URLs** in `index.html`. Phaser lives in `vendor/`.
- **No bundler, no npm install required to run.** `package.json` only holds convenience scripts.
- **No image or audio files.** Graphics are Phaser shapes, audio is Web Audio.
- **Responsive by construction.** Never hard-code a canvas coordinate outside `layout()`. Positions come from `this.field`, `this.L`, `this.f` and `this.unit`; nodes use `nx, ny`. Test at desktop, phone portrait and phone landscape before calling a layout change done.
- **Touch has no hover.** Any new affordance that relies on hover needs a tap equivalent (see `select()`).
- **Phaser 3 API only.** Verify a method exists before calling it. The original bug in this project was a call to a non-existent `setCharacterSpacing`; the Text method is `setLetterSpacing`.
- **Container hit areas are in top-left local space.** Phaser adds the display origin before calling the hit-area callback, so a Container with `setSize(w, h)` needs its hit shape centred at `(w/2, h/2)`, not `(0, 0)`. Getting this wrong made every node unclickable once.
- **Headless Edge throttles requestAnimationFrame**, so Phaser input never processes there. For an input test, construct the game with `fps: { forceSetTimeOut: true }` and dispatch `MouseEvent('mousedown')` on the canvas (Phaser listens for mouse/touch events, not `pointerdown`).

## Layout

- `src/config.js`: all tunables and palette. Change balance here, not in the scene.
- `src/audio.js`: `AudioSystem`.
- `src/scenes/PulseScene.js`: all gameplay. Sections are marked with `// ---- name` banners; keep new methods in the right section.
- `src/main.js`: Phaser boot (RESIZE mode) plus the `ResizeObserver`. Rarely changes.
- `src/ui.js`: page-level DOM only (help dialog). No game logic.
- `assets/css/style.css`: page chrome only, never game visuals.
- `docs/`: architecture and game design. Update them when behaviour changes.
- `.archive/`: the original single-file `game.js` kept for reference. Do not edit or load it.

## Script load order

`vendor/phaser.min.js` → `src/config.js` → `src/audio.js` → `src/scenes/*.js` → `src/main.js`. A new file goes after its dependencies and before `main.js`, in both `index.html` and this list.

## Verifying a change

1. `node --check src/**/*.js` for syntax.
2. Open `index.html` directly in a browser and watch the devtools console. A blank game box means `create()` threw; the console will say where.
3. Headless check from this folder (Edge on Windows):

   ```sh
   "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu \
     --enable-logging=stderr --virtual-time-budget=8000 --host-resolver-rules="MAP * ~NOTFOUND" \
     --screenshot=out.png "file:///$(pwd)/index.html" 2>&1 | grep -iE "uncaught|net::ERR"
   ```

   `--host-resolver-rules` kills all DNS so the run proves offline operation. No output from grep means no errors.

4. Headless screenshots: Edge enforces a minimum window width (~500 px), so to test a phone size pin the `.shell` element to exact pixel dimensions instead of relying on `--window-size`. The screenshot step also resizes the viewport at capture time, which triggers the `ResizeObserver` and can capture a cleared canvas; pinning the shell avoids that too.
5. Synthetic touch in a test needs `pageX` / `pageY` on the `Touch` (Phaser reads those), not just `clientX` / `clientY`, and the `--touch-events=enabled` flag.

## Style

- 2-space indent, single quotes, semicolons, trailing commas in multiline literals.
- Keep `PulseScene.js` method order as documented. Effects destroy themselves in `onComplete`.
- Comments explain why, not what. Keep the lifecycle comment at the top of `PulseScene.js` accurate.

## When adding features

- Balance numbers go in `CONFIG`, never inline.
- New node types: update `TYPES`, `COLOR_BY_TYPE`, `ICON_BY_TYPE`, the legend in `makeUI`, and `docs/GAME_DESIGN.md`.
- Record user-visible changes in `CHANGELOG.md`.
