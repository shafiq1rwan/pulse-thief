/* Pulse Thief — page-level UI outside the canvas: the help dialog. */
(function () {
  'use strict';

  const dialog = document.getElementById('help');
  const openBtn = document.getElementById('help-btn');
  const closeBtn = document.getElementById('help-close');
  const controls = document.getElementById('help-controls');
  if (!dialog || !openBtn || !closeBtn) return;

  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (coarse && controls) controls.textContent = 'TAP a node to preview its reach, TAP it again to fire.';

  const supportsDialog = typeof dialog.showModal === 'function';
  const open = () => { if (supportsDialog) dialog.showModal(); else dialog.setAttribute('open', ''); };
  const close = () => { if (supportsDialog && dialog.open) dialog.close(); else dialog.removeAttribute('open'); };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) { if (dialog.open) close(); else open(); }
  });
})();
