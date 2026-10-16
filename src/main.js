/* Pulse Thief — entry point. Boots Phaser with the single gameplay scene. */
(function (PT) {
  'use strict';

  PT.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#07101e',
    render: { antialias: true },
    input: { activePointers: 2 },
    // RESIZE: the canvas always matches the #game element, 1 game px = 1 CSS px.
    // The scene re-lays itself out on every resize (PulseScene.layout).
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%', autoRound: true },
    scene: [PT.PulseScene],
  });

  // Phaser's RESIZE mode only re-measures its parent on window resize events.
  // Flex layout settling after boot, the mobile address bar collapsing, or a
  // dvh change do not fire one, so watch the container directly.
  const parent = document.getElementById('game');
  if (parent && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      const w = Math.round(box.width), h = Math.round(box.height);
      if (w > 0 && h > 0 && (w !== PT.game.scale.width || h !== PT.game.scale.height)) PT.game.scale.resize(w, h);
    });
    // Observe only once Phaser has booted; the observer fires immediately on observe().
    PT.game.events.once(Phaser.Core.Events.READY, () => ro.observe(parent));
  }
})(window.PulseThief);
