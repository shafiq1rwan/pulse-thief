# Changelog

All notable changes to this project are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Results card redesign: glowing bordered card with accent bar, big total score, rank badge, three stat tiles, full-width button; two-column variant on short landscape screens. Card scale derives from its width with CSS-px font floors, so it reads the same on every device.
- High-DPI rendering: the canvas is sized at `devicePixelRatio` (capped at 3) with Phaser `Scale.NONE` and `zoom = 1/DPR`. Fixes blurry text and lines on phones.
- Reach preview is clipped to the playfield.

### Changed
- Camera shake reduced to about a third and made sparse: only the player's click, sting thresholds and sector clear, no longer every node. `JUICE.shakeMax: 0` disables it.
- Target readout is now the primary HUD element: large lit / target number (turns green when reached, punches on every change), TARGET caption in both orientations, thicker glowing progress bar.
- Page chrome removed: the canvas fills the viewport inside the safe areas. The masthead and footer are gone; the `?` help button floats bottom-right.
- HUD captions lose their letter spacing (Phaser clipped right-aligned spaced text) and get an 8 CSS px floor.
- GitHub Pages deploy workflow (`.github/workflows/pages.yml`): syntax check, then publish the static site on every push to `main`.
- Responsive layout. Phaser now runs in RESIZE mode and the scene re-lays itself out on every resize: HUD per orientation, playfield from the remaining space, radii / spacing / node size scaled by a `unit` factor derived from field area. Nodes keep normalised positions so rotating a phone mid-sector keeps the board intact.
- Touch input model: tap to select and preview, tap again to fire, tap empty space to clear. Status lines, hint and tips switch wording on first touch.
- Node type label shown above a hovered / selected node (replaces the static legend).
- Charges drawn as glowing cells and the target as a progress bar.
- `?` help dialog in the page with node types and controls; wording adapts to touch devices.
- `src/ui.js` for page-level UI. `ResizeObserver` in `main.js` keeps the canvas matched to its container (flex settling, mobile address bar).
- Viewport meta for mobile: `viewport-fit=cover`, safe-area padding, `touch-action: none` on the canvas.
- Win celebration: camera flash and shake, four-note fanfare, confetti bursting from every lit node, overlay slides in, saved charges fly from the HUD into the score one by one, rolling score, rank letter (S / A / B / C) with a hit, NEW BEST stamp when the run's best is beaten.
- Loss screen: slides in gently, shows how many nodes short you were and a one-line tip. Retry is one key away.
- Space or Enter press the overlay button. Button appears only after the tally so the celebration cannot be skipped by accident.
- Hover preview: hovering a dormant node draws its pulse radius and marks every node it would reach. Splitters also show their bolt range.
- Sector-1 hint: a pulsing CLICK HERE marker on the node with the longest simulated chain, removed on first click.
- One-time callouts: "longer chains score more" after the first chain, and a "last charge" warning.
- Juice: nodes squash and rebound elastically when hit, neighbours get shoved and spring back, camera shake scales with chain length, chain counter punches on every step, stings at x5 / x8 / x12, arcs have a glow pass, nodes pop in at sector start.
- Spent look: activated nodes go dim and flat so remaining targets stand out.
- `PT.JUICE` tunables in `config.js`.

### Changed
- Early sectors are more generous: relay radius ramps 128 → 105 and target fraction 0.62 → 0.74 across sectors 1–4 (`rampSectors`, `relayRadiusStart/End`, `targetFractionStart/End`). Amplifier radius is now relay + `amplifierBonus`.
- `startSector` clears all pending timers so a restart mid-chain cannot act on destroyed nodes.

### Fixed
- Nodes were almost unclickable. The Container hit circle was centred at (0,0) but Phaser hit-tests Containers in top-left local space, so only a sliver at each node's top-left corner responded. Hit circle now centred at (size/2, size/2).
- `PulseThief.game` now exposes the Phaser instance for debugging and tests.

## [0.2.0] - 2026-10-16

### Changed
- Split the single `game.js` into `src/config.js`, `src/audio.js`, `src/scenes/PulseScene.js` and `src/main.js`.
- Moved all balance numbers into `CONFIG` (max charges, node cap, combo cap, points, bonuses, chain timeout).
- Moved `style.css` to `assets/css/` and Phaser to `vendor/`.
- Rewrote README; added `CLAUDE.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/GAME_DESIGN.md`.

### Fixed
- Game rendered a blank canvas because `create()` called `setCharacterSpacing`, which does not exist on Phaser 3 Text. Now uses `setLetterSpacing`.

### Removed
- CDN dependency. Phaser 3.90.0 is bundled in `vendor/`, so the game runs offline.

## [0.1.0] - 2026-10-16

### Added
- Initial prototype: single-file Phaser 3 chain-reaction game with five node types, sector progression, synthesized audio and a persistent best score.

[Unreleased]: ./
[0.2.0]: ./
[0.1.0]: ./
