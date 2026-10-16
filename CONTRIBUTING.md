# Contributing

Thanks for helping with Pulse Thief. This is a small prototype, so the process is light.

## Ground rules

- The game must open from `index.html` with a double-click, offline, with no install step. Any change that breaks this will be reverted.
- No ES modules, no CDN links, no image or audio assets. See `CLAUDE.md` for why.
- Balance values belong in `src/config.js`.

## Workflow

1. Make your change.
2. Syntax-check: `node --check src/config.js src/audio.js src/scenes/PulseScene.js src/main.js`
3. Open `index.html` in a browser with devtools open. Play a sector. Confirm no console errors.
4. If you changed behaviour, update `docs/GAME_DESIGN.md` or `docs/ARCHITECTURE.md` and add a line to `CHANGELOG.md`.
5. Commit with a short imperative subject line, e.g. `Add dead node type`.

## Reporting bugs

Open an issue with:

- Browser and version
- Whether you opened `index.html` directly or via a local server
- Console output (F12 → Console)
- Steps to reproduce

## Ideas welcome

See the "open questions" list in `docs/GAME_DESIGN.md`. Balance feedback is especially useful; nothing has been playtested.
