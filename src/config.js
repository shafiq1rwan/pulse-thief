/* Pulse Thief — shared constants and tunables.
   Loaded first; everything hangs off the global PulseThief namespace so the
   game keeps working when index.html is opened directly from disk (file://),
   where ES modules are blocked by browsers. */
window.PulseThief = window.PulseThief || {};

(function (PT) {
  'use strict';

  /** Design-reference canvas size. The game now resizes to its container;
      these only seed the UI scale factor (see PulseScene.layout). */
  PT.W = 960;
  PT.H = 600;

  /** Gameplay tunables. Edit these to rebalance the game. */
  PT.CONFIG = {
    initialCharges: 3,     // energy charges at the start of every sector
    bonusChargeSector: 4,  // from this sector on, +1 starting charge
    maxCharges: 8,         // batteries cannot push charges above this
    baseNodes: 16,         // nodes in sector 1
    nodesPerSector: 2,     // extra nodes per sector
    maxNodes: 29,          // hard cap on nodes per sector
    // Early sectors are generous so the first click feels powerful; values
    // ramp linearly from *Start (sector 1) to *End (sector rampSectors).
    rampSectors: 4,
    relayRadiusStart: 128, // sector-1 pulse radius
    relayRadiusEnd: 105,   // pulse radius from sector 4 on
    amplifierBonus: 53,    // amplifier radius = relay radius + this
    boltRadius: 180,       // splitter bolt range
    targetFractionStart: 0.62, // fraction of nodes to clear, sector 1
    targetFractionEnd: 0.74,   // fraction of nodes to clear, sector 4+
    minNodeSpacing: 65,    // minimum distance between node centres
    comboCap: 12,          // combo multiplier stops growing here
    pointsPerStep: 100,    // score = pointsPerStep * min(combo, comboCap)
    clearBonusPerCharge: 500,
    chainQuietMs: 750,     // chain is "over" after this much silence
  };

  /** Palette (Phaser wants hex numbers, text styles want CSS strings). */
  PT.COLORS = {
    cyan: 0x49ecff, pink: 0xff5ccf, yellow: 0xffd36c, purple: 0xb797ff,
    green: 0x62ffad, white: 0xe4f8ff, dim: 0x537b95, navy: 0x081527,
  };

  /** Spawn table: duplicates raise the odds of that type. */
  PT.TYPES = ['relay', 'relay', 'relay', 'relay', 'amp', 'split', 'cap', 'battery'];

  PT.COLOR_BY_TYPE = {
    relay: PT.COLORS.cyan,
    amp: PT.COLORS.pink,
    split: PT.COLORS.yellow,
    cap: PT.COLORS.purple,
    battery: PT.COLORS.green,
  };

  PT.ICON_BY_TYPE = { relay: '●', amp: '✦', split: '◆', cap: 'Ⅱ', battery: '+' };

  /** Shown above a node while it is hovered / selected, replacing a static legend. */
  PT.TYPE_LABELS = {
    relay: 'RELAY',
    amp: 'AMPLIFIER  ·  WIDE PULSE',
    split: 'SPLITTER  ·  3 LONG BOLTS',
    cap: 'CAPACITOR  ·  NEEDS 2 HITS',
    battery: 'BATTERY  ·  +1 CHARGE',
  };

  /** Reference field size (px) that all radii / spacing were tuned on.
      On other screens they scale by sqrt(fieldArea / refArea), clamped. */
  PT.REF_FIELD = { w: 876, h: 406 };
  PT.UNIT_MIN = 0.55;
  PT.UNIT_MAX = 1.25;

  PT.STORAGE_KEY = 'pulse_thief_best';

  /** Linear ramp of a CONFIG value across the first rampSectors sectors. */
  PT.ramp = (sector, start, end) => {
    const t = Math.min(1, Math.max(0, (sector - 1) / (PT.CONFIG.rampSectors - 1)));
    return start + (end - start) * t;
  };
  PT.relayRadiusFor = (sector) => PT.ramp(sector, PT.CONFIG.relayRadiusStart, PT.CONFIG.relayRadiusEnd);
  PT.targetFractionFor = (sector) => PT.ramp(sector, PT.CONFIG.targetFractionStart, PT.CONFIG.targetFractionEnd);

  /** Feel / juice tunables. */
  PT.JUICE = {
    hoverScale: 1.18,        // node swell on hover
    squashX: 1.4, squashY: 0.6, // hit squash before the elastic rebound
    shoveDistance: 14,       // px a neighbour is pushed by a nearby pulse
    shakeBase: 0.0015,       // camera shake intensity at combo 1
    shakePerCombo: 0.0006,   // added per chain step
    shakeMax: 0.012,
    stings: { 5: 'NICE', 8: 'SURGE', 12: 'OVERLOAD' },
  };

  PT.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  PT.hex = (n) => '#' + n.toString(16).padStart(6, '0');
})(window.PulseThief);
