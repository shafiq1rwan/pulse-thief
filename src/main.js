/* Pulse Thief — entry point. Boots Phaser and keeps the canvas matched to its box. */
(function (PT) {
  'use strict';

  const parent = document.getElementById('game');

  // Render at device resolution so text and lines are crisp on phones.
  // Game px = CSS px * DPR; the scene's layout() divides by PT.DPR wherever it
  // reasons in CSS px (breakpoints, touch targets). Capped at 3 to bound fill cost.
  PT.DPR = Math.min(window.devicePixelRatio || 1, 3);

  const cssW = Math.max(1, parent ? parent.clientWidth : 960);
  const cssH = Math.max(1, parent ? parent.clientHeight : 600);

  PT.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#07101e',
    render: { antialias: true },
    input: { activePointers: 2 },
    // NONE: we own the size. zoom = 1/DPR shrinks the hi-res canvas back to CSS size
    // and makes Phaser's input scaling account for it.
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: 1 / PT.DPR,
      width: Math.round(cssW * PT.DPR),
      height: Math.round(cssH * PT.DPR),
    },
    scene: [PT.PulseScene],
  });

  // Resize the game whenever the container changes (orientation, address bar,
  // layout settling, dvh changes). Attached after READY because a ResizeObserver
  // fires synchronously on observe(), before the scale manager exists.
  if (parent && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      const w = Math.round(box.width * PT.DPR), h = Math.round(box.height * PT.DPR);
      if (w > 0 && h > 0 && (w !== PT.game.scale.width || h !== PT.game.scale.height)) PT.game.scale.resize(w, h);
    });
    PT.game.events.once(Phaser.Core.Events.READY, () => ro.observe(parent));
  }
})(window.PulseThief);
