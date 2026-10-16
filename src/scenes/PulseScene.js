/* Pulse Thief — the one and only gameplay scene.
   Lifecycle: create() -> layout() -> startSector() -> [player clicks] inject()
   -> receive() -> fire() -> receive() ... -> checkResult() -> endSector()
   -> celebrateWin() | showLoss() -> startSector().
   Responsive: layout(W, H) is called on create and on every canvas resize. It
   positions the HUD per orientation, computes the playfield, and scales radii
   and node density (this.unit) so the game plays the same on a phone and a
   desktop. Nodes keep normalised (nx, ny) positions inside the field.
   Input: mouse hovers to preview and clicks to fire. Touch taps to preview
   (select) and taps the same node again to fire. */
(function (PT) {
  'use strict';

  const { CONFIG, COLORS, TYPES, COLOR_BY_TYPE, ICON_BY_TYPE, TYPE_LABELS, JUICE, dist, hex } = PT;
  const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';

  class PulseScene extends Phaser.Scene {
    constructor() { super({ key: 'Pulse' }); }

    // ---------------------------------------------------------------- setup
    create() {
      this.sector = 1;
      this.score = 0;
      this.best = 0;
      this.all = [];
      this.effects = [];
      this.firstChainDone = false;
      this.hint = null;
      this.hovered = null;
      this.selected = null;
      this.isTouch = false;
      this.ended = false;
      this.busy = false;
      this.audio = new PT.AudioSystem();
      try { this.best = Number(localStorage.getItem(PT.STORAGE_KEY) || 0); } catch (e) { /* no storage */ }

      this.bg = this.add.graphics().setDepth(0);
      this.stars = [];
      for (let i = 0; i < 38; i++) {
        const star = this.add.circle(0, 0, Phaser.Math.FloatBetween(0.4, 1.6), 0x4aa9cb, 0.12).setDepth(0);
        star.nx = Math.random(); star.ny = Math.random();
        this.tweens.add({ targets: star, alpha: 0.42, duration: Phaser.Math.Between(1100, 2500), yoyo: true, repeat: -1 });
        this.stars.push(star);
      }
      this.previewRing = this.add.graphics().setDepth(5);
      this.hudG = this.add.graphics().setDepth(3);
      this.makeUI();
      this.layout(this.scale.width, this.scale.height);
      this.scale.on('resize', (gameSize) => this.layout(gameSize.width, gameSize.height));

      this.input.keyboard.on('keydown-R', () => this.restartRun());
      this.input.keyboard.on('keydown-M', () => this.toggleMute());
      this.input.keyboard.on('keydown-SPACE', () => this.pressOverlayButton());
      this.input.keyboard.on('keydown-ENTER', () => this.pressOverlayButton());
      // Tap on empty space clears a touch selection.
      this.input.on('pointerdown', (pointer, over) => {
        if (pointer.wasTouch && !this.isTouch) { this.isTouch = true; this.setIdleStatus(); }
        if (over.length === 0) this.deselect();
      });
      this.startSector();
    }

    text(x, y, str, size = 16, color = '#d8f6ff') {
      return this.add.text(x, y, str, { fontFamily: FONT, fontSize: Math.round(size) + 'px', fontStyle: 'bold', color });
    }

    makeUI() {
      const t = (x, y, s, size, color) => this.text(x, y, s, size, color);
      // HUD text; positions and sizes are assigned in layout().
      this.title = t(0, 0, 'SECTOR 01', 22, '#e2faff');
      this.subtitle = t(0, 0, 'CLEAR THE GRID', 10, '#749fb5').setLetterSpacing(2);
      this.scoreLabel = t(0, 0, '000000', 20, '#ffffff');
      this.scoreCaption = t(0, 0, 'SCORE', 9, '#7299ad').setLetterSpacing(2);
      this.bestLabel = t(0, 0, 'BEST 000000', 10, '#7299ad');
      this.chargeCaption = t(0, 0, 'CHARGES', 9, '#c9a34f').setLetterSpacing(2);
      this.chargeLabel = t(0, 0, '', 12, '#ffcf70');
      this.targetCaption = t(0, 0, 'TARGET', 9, '#7299ad').setLetterSpacing(2);
      this.targetLabel = t(0, 0, '0 / 0', 12, '#cfe9f2');
      this.statusLabel = t(0, 0, '', 11, '#8ec9df');
      this.helpLabel = t(0, 0, 'R RESTART   M SOUND', 9, '#5c8199').setLetterSpacing(1);
      this.previewLabel = t(0, 0, '', 10, '#ffffff').setOrigin(0.5, 1).setDepth(6).setVisible(false).setLetterSpacing(1);
      this.previewLabel.setStroke('#06111e', 4);
      this.chainLabel = t(0, 0, '', 22, '#ffffff').setOrigin(0.5).setDepth(40).setAlpha(0);

      // End-of-sector overlay (slides in from endSector)
      this.overlay = this.add.container(0, 0).setDepth(70).setVisible(false);
      this.overlayBg = this.add.rectangle(0, 0, 10, 10, 0x06111e, 0.92).setStrokeStyle(2, 0x32bfd8, 0.75);
      this.overlayKicker = t(0, 0, 'SECTOR 01', 11, '#7299ad').setOrigin(0.5).setLetterSpacing(3);
      this.overlayTitle = t(0, 0, 'SECTOR CLEARED', 34, '#7ef4ff').setOrigin(0.5);
      this.overlayStats = t(0, 0, '', 13, '#b6dce8').setOrigin(0.5).setAlign('center').setLineSpacing(6);
      this.overlayScoreLabel = t(0, 0, 'SCORE', 10, '#7299ad').setOrigin(0.5).setLetterSpacing(3);
      this.overlayScore = t(0, 0, '000000', 40, '#ffffff').setOrigin(0.5);
      this.rankLabel = t(0, 0, '', 64, '#ffd36c').setOrigin(0.5);
      this.rankLabel.setStroke('#06111e', 8);
      this.rankCaption = t(0, 0, 'RANK', 9, '#7299ad').setOrigin(0.5).setLetterSpacing(3);
      this.newBest = t(0, 0, 'NEW BEST', 16, '#06111e').setOrigin(0.5).setAngle(-12).setPadding(10, 5, 10, 5);
      this.newBest.setBackgroundColor('#ffd36c');
      this.btnBg = this.add.rectangle(0, 0, 240, 50, 0x154356).setStrokeStyle(2, 0x52dff0).setInteractive({ useHandCursor: true });
      this.btnLabel = t(0, 0, 'NEXT SECTOR  →', 16, '#e5fcff').setOrigin(0.5);
      this.btnHint = t(0, 0, 'SPACE / ENTER', 9, '#5c8199').setOrigin(0.5).setLetterSpacing(2);
      this.overlay.add([this.overlayBg, this.overlayKicker, this.overlayTitle, this.overlayStats, this.overlayScoreLabel,
        this.overlayScore, this.rankLabel, this.rankCaption, this.newBest, this.btnBg, this.btnLabel, this.btnHint]);
      this.btnBg.on('pointerover', () => this.btnBg.setFillStyle(0x206b7b));
      this.btnBg.on('pointerout', () => this.btnBg.setFillStyle(0x154356));
      this.btnBg.on('pointerdown', () => this.pressOverlayButton());
    }

    // --------------------------------------------------------------- layout
    /** Position everything for a W x H canvas. Safe to call at any time. */
    layout(W, H) {
      this.W = W; this.H = H;
      const portrait = H > W * 0.95;
      this.portrait = portrait;
      const f = Phaser.Math.Clamp(Math.min(W / 960, H / 560), 0.68, 1); // UI scale
      this.f = f;
      const pad = Math.round(12 * f);
      const topH = Math.round((portrait ? 98 : 72) * f);
      const bottomH = Math.round(30 * f);
      const field = { x: pad, y: topH, w: W - pad * 2, h: Math.max(120, H - topH - bottomH - pad) };
      this.field = field;
      this.unit = Phaser.Math.Clamp(Math.sqrt((field.w * field.h) / (PT.REF_FIELD.w * PT.REF_FIELD.h)), PT.UNIT_MIN, PT.UNIT_MAX);
      this.nodeScale = Phaser.Math.Clamp(this.unit, 0.78, 1.15);
      this.relayRadius = PT.relayRadiusFor(this.sector) * this.unit;
      this.ampRadius = this.relayRadius + CONFIG.amplifierBonus * this.unit;
      this.boltRadius = CONFIG.boltRadius * this.unit;

      // Background, grid, border
      const g = this.bg;
      g.clear();
      g.fillStyle(0x07101e, 1); g.fillRect(0, 0, W, H);
      g.lineStyle(1, 0x29425d, 0.22);
      const step = Math.round(30 * this.unit);
      for (let x = field.x + step; x < field.x + field.w; x += step) g.lineBetween(x, field.y, x, field.y + field.h);
      for (let y = field.y + step; y < field.y + field.h; y += step) g.lineBetween(field.x, y, field.x + field.w, y);
      g.lineStyle(2, 0x22718b, 0.65); g.strokeRoundedRect(field.x, field.y, field.w, field.h, 14);
      g.lineStyle(12, 0x12bfe8, 0.035); g.strokeRoundedRect(field.x, field.y, field.w, field.h, 14);
      for (const s of this.stars) s.setPosition(field.x + s.nx * field.w, field.y + s.ny * field.h);

      // HUD
      const fs = (obj, size) => obj.setFontSize(Math.round(size * f) + 'px');
      const hideSub = W < 640;
      if (portrait) {
        // Row 1: sector (left) / score (right). Row 2: charges (left) / target (right).
        this.title.setOrigin(0, 0).setPosition(pad + 4, 8 * f); fs(this.title, 20);
        this.subtitle.setVisible(false);
        this.scoreCaption.setOrigin(1, 0).setPosition(W - pad - 4, 8 * f); fs(this.scoreCaption, 9);
        this.scoreLabel.setOrigin(1, 0).setPosition(W - pad - 4, 20 * f); fs(this.scoreLabel, 20);
        this.bestLabel.setOrigin(0, 0).setPosition(pad + 4, 34 * f); fs(this.bestLabel, 10);
        this.chargeCaption.setOrigin(0, 0).setPosition(pad + 4, 56 * f); fs(this.chargeCaption, 9);
        this.L = { cellsX: pad + 4, cellsY: 78 * f, cellsAlign: 0, barX: W - pad - 4, barY: 78 * f, barW: Math.min(150 * f, W * 0.4), barAlign: 1 };
        this.targetCaption.setVisible(true).setOrigin(1, 0).setPosition(W - pad - 4, 56 * f); fs(this.targetCaption, 9);
        this.chargeLabel.setOrigin(0, 0.5).setPosition(pad + 4, 78 * f); fs(this.chargeLabel, 12);
        this.targetLabel.setOrigin(1, 0.5).setPosition(W - pad - 4 - this.L.barW - 8, 78 * f); fs(this.targetLabel, 11);
      } else {
        this.title.setOrigin(0, 0).setPosition(pad + 6, 12 * f); fs(this.title, 22);
        this.subtitle.setVisible(!hideSub).setOrigin(0, 0).setPosition(pad + 7, 42 * f); fs(this.subtitle, 10);
        this.scoreCaption.setOrigin(0.5, 0).setPosition(W / 2, 10 * f); fs(this.scoreCaption, 9);
        this.scoreLabel.setOrigin(0.5, 0).setPosition(W / 2, 22 * f); fs(this.scoreLabel, 22);
        this.bestLabel.setOrigin(0.5, 0).setPosition(W / 2, 50 * f); fs(this.bestLabel, 10);
        this.chargeCaption.setOrigin(1, 0).setPosition(W - pad - 6, 10 * f); fs(this.chargeCaption, 9);
        this.L = { cellsX: W - pad - 6, cellsY: 30 * f, cellsAlign: 1, barX: W - pad - 6, barY: 54 * f, barW: 150 * f, barAlign: 1 };
        this.targetCaption.setVisible(false);
        this.chargeLabel.setOrigin(1, 0.5).setPosition(W - pad - 6, 30 * f); fs(this.chargeLabel, 12);
        this.targetLabel.setOrigin(1, 0.5).setPosition(W - pad - 6 - this.L.barW - 8, 54 * f); fs(this.targetLabel, 11);
      }
      this.statusLabel.setOrigin(portrait ? 0.5 : 0, 0.5).setPosition(portrait ? W / 2 : pad + 6, H - bottomH / 2 - pad / 2); fs(this.statusLabel, 11);
      this.statusLabel.setWordWrapWidth(W - pad * 2 - 8);
      this.helpLabel.setVisible(!this.isTouch && W >= 640).setOrigin(1, 0.5).setPosition(W - pad - 6, H - bottomH / 2 - pad / 2); fs(this.helpLabel, 9);
      this.chainLabel.setPosition(field.x + field.w / 2, field.y + 26 * f); fs(this.chainLabel, 22);

      // Overlay, centred on the field
      const ow = Math.min(field.w - 16, 760);
      const oh = Math.min(field.h - 12, 400);
      const cx = field.x + field.w / 2, cy = field.y + field.h / 2;
      const narrow = ow < 540;
      const o = oh / 400; // vertical scale of the overlay
      this.overlayBg.setPosition(cx, cy).setSize(ow, oh);
      this.overlayKicker.setPosition(cx, cy - oh * 0.42); fs(this.overlayKicker, 11);
      this.overlayTitle.setPosition(cx, cy - oh * 0.32); fs(this.overlayTitle, narrow ? 26 : 34);
      this.overlayStats.setPosition(cx, cy - oh * 0.19).setWordWrapWidth(ow - 40); fs(this.overlayStats, narrow ? 11 : 13);
      this.overlayScoreLabel.setPosition(cx, cy - oh * 0.04); fs(this.overlayScoreLabel, 10);
      this.overlayScore.setPosition(cx, cy + oh * 0.06); fs(this.overlayScore, narrow ? 32 : 40);
      const side = narrow ? ow * 0.34 : Math.min(ow * 0.33, 280);
      this.rankLabel.setPosition(cx + side, cy + oh * 0.03); fs(this.rankLabel, narrow ? 44 : 64);
      this.rankCaption.setPosition(cx + side, cy + oh * 0.03 + (narrow ? 30 : 44) * o); fs(this.rankCaption, 9);
      this.newBest.setPosition(cx - side, cy + oh * 0.03); fs(this.newBest, narrow ? 12 : 16);
      this.btnBg.setPosition(cx, cy + oh * 0.30).setSize(Math.min(240, ow - 40), 50 * o);
      this.btnLabel.setPosition(cx, cy + oh * 0.30); fs(this.btnLabel, 16);
      this.btnHint.setPosition(cx, cy + oh * 0.30 + 36 * o).setVisible(!this.isTouch); fs(this.btnHint, 9);

      // Nodes follow the field
      for (const node of this.all) {
        node.x = field.x + node.nx * field.w;
        node.y = field.y + node.ny * field.h;
        node.base = this.nodeScale;
        this.tweens.killTweensOf(node.container);
        node.container.setPosition(node.x, node.y).setScale(this.nodeScale);
      }
      this.clearPreview();
      this.selected = null;
      this.hovered = null;
      if (this.hint) { this.clearHint(); this.showHint(); }
      if (this.L) this.updateHud();
    }

    setIdleStatus() {
      if (this.ended || this.busy) return;
      this.statusLabel.setText(this.isTouch ? 'TAP A NODE TO PREVIEW  •  TAP AGAIN TO FIRE' : 'HOVER A NODE TO PREVIEW ITS REACH  •  CLICK TO FIRE');
    }

    // --------------------------------------------------------------- sector
    startSector() {
      this.time.removeAllEvents();
      for (const node of this.all) node.container.destroy();
      for (const fx of this.effects) fx.destroy();
      this.all = [];
      this.effects = [];
      this.hint = null;
      this.hovered = null;
      this.selected = null;
      this.clearPreview();
      this.chainLabel.setAlpha(0);
      this.overlay.setVisible(false);
      this.ended = false;
      this.busy = false;
      this.won = false;
      this.lastReaction = 0;
      this.activated = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.charges = CONFIG.initialCharges + (this.sector >= CONFIG.bonusChargeSector ? 1 : 0);
      this.bestAtSectorStart = this.best;
      this.tallyDone = true;
      this.relayRadius = PT.relayRadiusFor(this.sector) * this.unit;
      this.ampRadius = this.relayRadius + CONFIG.amplifierBonus * this.unit;

      const count = Math.min(CONFIG.maxNodes, CONFIG.baseNodes + (this.sector - 1) * CONFIG.nodesPerSector);
      this.target = Math.ceil(count * PT.targetFractionFor(this.sector));

      const F = this.field;
      const inset = 42 * this.unit;
      const spacing = CONFIG.minNodeSpacing * this.unit;
      const positions = [];
      for (let i = 0; i < count; i++) {
        let x, y, tries = 0;
        do {
          x = Phaser.Math.Between(F.x + inset, F.x + F.w - inset);
          y = Phaser.Math.Between(F.y + inset, F.y + F.h - inset);
          tries++;
        } while (positions.some((p) => Math.hypot(x - p.x, y - p.y) < spacing) && tries < 300);
        positions.push({ x, y });
      }
      positions.forEach((p, i) => this.createNode(p.x, p.y, i));

      // Nodes pop in one by one so the board reads as "arriving", not "there".
      this.all.forEach((node, i) => {
        node.container.setScale(0);
        this.tweens.add({ targets: node.container, scale: node.base, duration: 420, delay: 18 * i, ease: 'Back.easeOut' });
      });

      this.updateHud();
      this.setIdleStatus();
      if (this.sector === 1 && this.score === 0) this.time.delayedCall(18 * count + 450, () => this.showHint());
    }

    createNode(x, y, index) {
      let type = TYPES[Phaser.Math.Between(0, TYPES.length - 1)];
      // Guarantee one battery, one amplifier and one splitter per sector.
      if (index === 0) type = 'battery';
      if (index === 1) type = 'amp';
      if (index === 2) type = 'split';
      const color = COLOR_BY_TYPE[type];
      const F = this.field;

      const container = this.add.container(x, y).setDepth(10);
      const aura = this.add.circle(0, 0, 24, color, 0.07).setStrokeStyle(2, color, 0.15);
      const halo = this.add.circle(0, 0, 18, color, 0.075);
      const rim = this.add.circle(0, 0, 15, 0x09192a).setStrokeStyle(2, color, 0.95);
      const core = this.add.circle(0, 0, 6, color, 0.97);
      const icon = this.add.text(0, 0, ICON_BY_TYPE[type], {
        fontFamily: 'Arial', fontSize: type === 'relay' ? '9px' : '16px', color: '#07111f', fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add([aura, halo, rim, core, icon]);

      const node = {
        x, y, nx: (x - F.x) / F.w, ny: (y - F.y) / F.h, base: this.nodeScale,
        type, color, container, aura, halo, rim, core, icon, hits: 0, activated: false,
      };
      this.all.push(node);

      // Phaser hit-tests a Container in top-left local space (it adds the
      // display origin), so the hit circle must be centred at (size/2, size/2).
      // 56 local px * nodeScale >= 44 CSS px, the usual minimum touch target.
      const HIT = 56;
      container.setSize(HIT, HIT)
        .setInteractive({
          hitArea: new Phaser.Geom.Circle(HIT / 2, HIT / 2, HIT / 2),
          hitAreaCallback: Phaser.Geom.Circle.Contains,
          useHandCursor: true,
        })
        .on('pointerover', (pointer) => this.hoverNode(node, true, pointer))
        .on('pointerout', (pointer) => this.hoverNode(node, false, pointer))
        .on('pointerdown', (pointer) => this.onNodeDown(node, pointer));
      node.auraTween = this.tweens.add({
        targets: aura, scale: Phaser.Math.FloatBetween(1.13, 1.37), alpha: 0.15,
        duration: Phaser.Math.Between(850, 1500), yoyo: true, repeat: -1,
      });
    }

    radiusOf(node) { return node.type === 'amp' ? this.ampRadius : this.relayRadius; }

    // ------------------------------------------------- hover, select, hint
    onNodeDown(node, pointer) {
      if (pointer && pointer.wasTouch) {
        this.isTouch = true;
        // Touch: first tap previews, second tap on the same node fires.
        if (this.selected !== node) { this.select(node); return; }
      }
      this.inject(node);
    }

    select(node) {
      if (node.activated || this.busy || this.ended) return;
      this.deselect();
      this.selected = node;
      this.tweens.add({ targets: node.container, scale: node.base * JUICE.hoverScale, duration: 160, ease: 'Back.easeOut' });
      this.audio.unlock();
      this.audio.tone(520, 0.04, 'sine');
      this.drawPreview(node);
      this.statusLabel.setText('TAP AGAIN TO FIRE  •  ' + TYPE_LABELS[node.type]);
    }

    deselect() {
      const node = this.selected;
      if (!node) return;
      this.selected = null;
      if (!node.activated) this.tweens.add({ targets: node.container, scale: node.base, duration: 180, ease: 'Back.easeOut' });
      this.clearPreview();
      this.setIdleStatus();
    }

    hoverNode(node, on, pointer) {
      if (pointer && pointer.wasTouch) return; // touch is handled by select()
      if (!on) {
        if (this.hovered === node) { this.hovered = null; this.clearPreview(); }
        if (!node.activated) this.tweens.add({ targets: node.container, scale: node.base, duration: 180, ease: 'Back.easeOut' });
        return;
      }
      if (node.activated || this.busy || this.ended) return;
      this.hovered = node;
      this.tweens.add({ targets: node.container, scale: node.base * JUICE.hoverScale, duration: 160, ease: 'Back.easeOut' });
      this.audio.tone(520, 0.04, 'sine');
      this.drawPreview(node);
    }

    /** Faint ring showing where a click on `node` will reach, a tick on each node inside it, and its type label. */
    drawPreview(node) {
      const g = this.previewRing;
      g.clear();
      const r = this.radiusOf(node);
      g.fillStyle(node.color, 0.05);
      g.fillCircle(node.x, node.y, r);
      g.lineStyle(1.5, node.color, 0.45);
      g.strokeCircle(node.x, node.y, r);
      if (node.type === 'split') {
        g.lineStyle(1, COLORS.yellow, 0.25);
        g.strokeCircle(node.x, node.y, this.boltRadius);
      }
      for (const n of this.all) {
        if (n === node || n.activated || dist(n, node) > r) continue;
        g.lineStyle(1.5, node.color, 0.6);
        g.strokeCircle(n.x, n.y, 21 * n.base);
      }
      const above = node.y - 34 * node.base;
      const flip = above < this.field.y + 14;
      this.previewLabel.setText(TYPE_LABELS[node.type]).setColor(hex(node.color))
        .setOrigin(0.5, flip ? 0 : 1).setPosition(node.x, flip ? node.y + 30 * node.base : above)
        .setFontSize(Math.round(10 * this.f) + 'px').setVisible(true);
    }

    clearPreview() {
      this.previewRing.clear();
      this.previewLabel.setVisible(false);
    }

    /** Pure simulation of the chain a click on `start` would cause. Used to pick the hint target. */
    simulateReach(start) {
      const on = new Set();
      const hits = new Map();
      const queue = [start];
      let n = 0;
      while (queue.length) {
        const a = queue.shift();
        if (on.has(a) || a.activated) continue;
        hits.set(a, (hits.get(a) || 0) + 1);
        if (a.type === 'cap' && hits.get(a) < 2) continue;
        on.add(a);
        n++;
        const r = this.radiusOf(a);
        for (const b of this.all) if (!on.has(b) && !b.activated && b !== a && dist(a, b) <= r) queue.push(b);
        if (a.type === 'split') for (const b of this.splitTargets(a, on)) queue.push(b);
      }
      return n;
    }

    showHint() {
      if (this.ended || this.busy || this.all.length === 0) return;
      let best = this.all[0];
      let bestReach = -1;
      for (const node of this.all) {
        const reach = this.simulateReach(node);
        if (reach > bestReach) { bestReach = reach; best = node; }
      }
      const s = best.base;
      const below = best.y < this.field.y + 70 * s; // flip the hint under the node near the top edge
      const c = this.add.container(best.x, best.y + (below ? 46 : -46) * s).setDepth(45);
      const label = this.text(0, below ? 14 * s : -14 * s, this.isTouch ? 'TAP HERE' : 'CLICK HERE', 13 * this.f, '#ffffff').setOrigin(0.5);
      const arrow = this.text(0, below ? -6 * s : 6 * s, below ? '▲' : '▼', 14 * this.f, '#ffffff').setOrigin(0.5);
      c.add([label, arrow]);
      const ring = this.add.circle(best.x, best.y, 30 * s).setStrokeStyle(2, 0xffffff, 0.9).setDepth(9);
      this.tweens.add({ targets: c, y: c.y + (below ? 8 : -8), duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 1100, repeat: -1, ease: 'Cubic.easeOut' });
      this.hint = [c, ring];
      this.effects.push(c, ring);
    }

    clearHint() {
      if (!this.hint) return;
      for (const obj of this.hint) { obj.destroy(); this.effects = this.effects.filter((e) => e !== obj); }
      this.hint = null;
    }

    // ------------------------------------------------------------- reaction
    /** Player spends a charge on a node. */
    inject(node) {
      if (this.ended || this.busy || node.activated || this.charges <= 0) return;
      this.audio.unlock();
      this.clearHint();
      this.clearPreview();
      this.hovered = null;
      this.selected = null;
      this.charges--;
      this.busy = true;
      this.combo = 0;
      this.statusLabel.setText('CHAIN IN PROGRESS');
      this.receive(node);
      this.updateHud();
      this.lastReaction = this.time.now;

      // Poll until the chain has been quiet long enough, then settle.
      const watch = this.time.addEvent({
        delay: 220, loop: true, callback: () => {
          if (this.ended) { watch.remove(); return; }
          if (this.time.now - this.lastReaction > CONFIG.chainQuietMs) {
            this.busy = false;
            watch.remove();
            this.checkResult();
          }
        },
      });
    }

    /** A node is hit by energy (from the player or from a neighbour). */
    receive(node) {
      if (this.ended || node.activated) return;
      node.hits++;
      this.lastReaction = this.time.now;

      if (node.type === 'cap' && node.hits < 2) {
        this.spark(node.x, node.y, node.color, 9);
        this.audio.tone(280, 0.07, 'triangle');
        this.wobble(node, 0.55);
        this.flashNumber(node.x, node.y, 'CHARGING', node.color);
        return;
      }

      node.activated = true;
      this.activated++;
      this.combo++;
      this.maxCombo = Math.max(this.combo, this.maxCombo);
      const points = CONFIG.pointsPerStep * Math.min(this.combo, CONFIG.comboCap);
      this.score += points;
      if (this.score > this.best) {
        this.best = this.score;
        try { localStorage.setItem(PT.STORAGE_KEY, String(this.best)); } catch (e) { /* no storage */ }
      }

      // Visual state: bright flash, then "spent".
      node.container.disableInteractive();
      node.auraTween.stop();
      node.aura.setScale(1).setFillStyle(node.color, 0.0).setStrokeStyle(2, node.color, 0.0);
      node.halo.setAlpha(0);
      node.core.setFillStyle(0xffffff, 1);
      this.tweens.add({ targets: node.core, scale: 2.2, duration: 110, yoyo: true, onComplete: () => {
        node.core.setFillStyle(node.color, 0.3);
        node.rim.setStrokeStyle(2, node.color, 0.28);
        node.icon.setAlpha(0.3);
      } });
      this.wobble(node, 1);

      this.flashNumber(node.x, node.y, '+' + points, node.color);
      this.spark(node.x, node.y, node.color, node.type === 'amp' ? 18 : 10);
      this.audio.tone(Math.min(1000, 230 + this.combo * 46), 0.095, 'sine');
      this.cameras.main.shake(110, Math.min(JUICE.shakeMax, JUICE.shakeBase + this.combo * JUICE.shakePerCombo), true);
      this.bumpChainLabel();
      if (JUICE.stings[this.combo]) this.sting(node, JUICE.stings[this.combo]);

      if (node.type === 'battery') {
        this.charges = Math.min(CONFIG.maxCharges, this.charges + 1);
        this.flashNumber(node.x, node.y - 24, '+1 CHARGE', COLORS.green);
        this.punch(this.chargeCaption, 1.3);
      }
      this.updateHud();
      this.time.delayedCall(125, () => this.fire(node));
    }

    /** Dormant nodes a splitter would bolt: up to 3, in distinct directions. */
    splitTargets(node, extraOn = null) {
      const others = this.all
        .filter((n) => !n.activated && !(extraOn && extraOn.has(n)) && n !== node && dist(n, node) < this.boltRadius)
        .sort((a, b) => dist(b, node) - dist(a, node));
      const chosen = [];
      for (const n of others) {
        const angle = Math.atan2(n.y - node.y, n.x - node.x);
        const distinct = chosen.every((c) => Math.abs(Math.atan2(Math.sin(angle - c.angle), Math.cos(angle - c.angle))) > 0.75);
        if (distinct) {
          chosen.push({ node: n, angle });
          if (chosen.length >= 3) break;
        }
      }
      return chosen.map((c) => c.node);
    }

    /** An activated node pushes energy to its neighbours. */
    fire(node) {
      if (this.ended) return;
      this.lastReaction = this.time.now;
      const radius = this.radiusOf(node);
      this.drawShockwave(node.x, node.y, radius, node.color);

      const neighbors = this.all
        .filter((n) => !n.activated && n !== node && dist(n, node) <= radius)
        .sort((a, b) => dist(a, node) - dist(b, node));
      neighbors.forEach((n) => {
        this.arc(node, n, node.color);
        this.shove(n, node);
        this.time.delayedCall(75 + dist(node, n) * 1.5 / this.unit, () => this.receive(n));
      });

      if (node.type === 'split') {
        this.splitTargets(node).forEach((n) => {
          this.arc(node, n, COLORS.yellow);
          this.time.delayedCall(160 + dist(node, n) * 1.6 / this.unit, () => this.receive(n));
        });
      }
    }

    // ------------------------------------------------------- juice helpers
    /** Squash, then rebound elastically. `power` scales the squash. */
    wobble(node, power) {
      const c = node.container;
      this.tweens.killTweensOf(c);
      const sx = 1 + (JUICE.squashX - 1) * power;
      const sy = 1 - (1 - JUICE.squashY) * power;
      c.setScale(node.base * sx, node.base * sy);
      this.tweens.add({ targets: c, scaleX: node.base, scaleY: node.base, duration: 520, ease: 'Elastic.easeOut', easeParams: [1.1, 0.35] });
    }

    /** Push a neighbour away from the pulse source and let it spring back. */
    shove(node, from) {
      const d = Math.max(1, dist(node, from));
      const ux = (node.x - from.x) / d;
      const uy = (node.y - from.y) / d;
      const c = node.container;
      const push = JUICE.shoveDistance * this.unit;
      this.tweens.add({
        targets: c, x: node.x + ux * push, y: node.y + uy * push,
        duration: 90, ease: 'Quad.easeOut',
        onComplete: () => this.tweens.add({ targets: c, x: node.x, y: node.y, duration: 480, ease: 'Elastic.easeOut' }),
      });
    }

    /** Scale-punch any display object (base scale 1). */
    punch(obj, amount = 1.25) {
      this.tweens.killTweensOf(obj);
      obj.setScale(amount);
      this.tweens.add({ targets: obj, scale: 1, duration: 320, ease: 'Back.easeOut' });
    }

    bumpChainLabel() {
      const lbl = this.chainLabel;
      lbl.setText('CHAIN  x' + this.combo).setAlpha(1).setColor(this.combo >= 8 ? '#ffd36c' : '#ffffff');
      this.punch(lbl, 1 + Math.min(0.6, this.combo * 0.06));
    }

    /** Big word at a node: "NICE", "SURGE", "OVERLOAD". */
    sting(node, word) {
      const t = this.text(node.x, node.y - 40 * node.base, word + '!', 26 * this.f, '#ffffff').setOrigin(0.5).setDepth(50).setScale(0);
      t.setStroke(hex(node.color), 5);
      this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, y: node.y - 80 * node.base, alpha: 0, duration: 900, delay: 350, onComplete: () => t.destroy() });
      this.audio.tone(900 + this.combo * 30, 0.18, 'square');
      this.cameras.main.flash(90, 255, 255, 255, false);
    }

    /** Centre-field message that fades after a beat. */
    callout(msg, color = '#9ff4ff') {
      const cx = this.field.x + this.field.w / 2, cy = this.field.y + this.field.h / 2;
      const t = this.text(cx, cy + 8, msg, 14 * this.f, color).setOrigin(0.5).setDepth(60).setAlpha(0).setAlign('center')
        .setWordWrapWidth(this.field.w - 40);
      t.setStroke('#06111e', 6);
      this.tweens.add({ targets: t, alpha: 1, y: cy, duration: 260, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 1900, onComplete: () => t.destroy() });
      this.effects.push(t);
    }

    // --------------------------------------------------------------- effects
    drawShockwave(x, y, radius, color) {
      const ring = this.add.circle(x, y, 2).setStrokeStyle(3, color, 0.95).setFillStyle(color, 0.06).setDepth(8);
      this.tweens.add({ targets: ring, scale: radius / 2, alpha: 0, duration: 440, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
      const ghost = this.add.circle(x, y, 2).setStrokeStyle(1, 0xffffff, 0.6).setDepth(8);
      this.tweens.add({ targets: ghost, scale: radius / 2 * 0.8, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => ghost.destroy() });
    }

    arc(a, b, color) {
      const g = this.add.graphics().setDepth(13);
      const len = Math.max(1, dist(a, b));
      const pts = [{ x: a.x, y: a.y }];
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        const offset = Phaser.Math.Between(-9, 9) * this.unit;
        pts.push({ x: px + (b.y - a.y) / len * offset, y: py - (b.x - a.x) / len * offset });
      }
      pts.push({ x: b.x, y: b.y });
      for (const [width, alpha] of [[7, 0.18], [2, 1]]) {
        g.lineStyle(width, color, alpha);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.strokePath();
      }
      this.tweens.add({ targets: g, alpha: 0, duration: 220, delay: 95, onComplete: () => g.destroy() });
    }

    spark(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Phaser.Math.Between(24, 55) * this.unit;
        const dot = this.add.circle(x, y, Phaser.Math.Between(1, 3), color, 1).setDepth(20);
        this.tweens.add({
          targets: dot, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, scale: 0,
          duration: Phaser.Math.Between(240, 510), ease: 'Cubic.easeOut', onComplete: () => dot.destroy(),
        });
      }
    }

    flashNumber(x, y, s, color) {
      const small = s.startsWith('+1') || s === 'CHARGING';
      const txt = this.text(x, y - 23, s, (small ? 12 : 13) * this.f, hex(color)).setOrigin(0.5).setDepth(30);
      this.tweens.add({ targets: txt, y: y - 57, alpha: 0, duration: 650, onComplete: () => txt.destroy() });
    }

    // ------------------------------------------------------------------ hud
    updateHud() {
      const L = this.L, f = this.f;
      this.title.setText('SECTOR ' + String(this.sector).padStart(2, '0'));
      this.scoreLabel.setText(String(this.score).padStart(6, '0'));
      this.bestLabel.setText('BEST ' + String(this.best).padStart(6, '0'));
      const banked = this.ended && this.won;
      this.chargeLabel.setText(banked ? 'BANKED' : (this.charges <= 0 ? 'EMPTY' : ''));
      this.targetLabel.setText(this.activated + ' / ' + this.target);

      const g = this.hudG;
      g.clear();
      // Charge cells: one glowing cell per charge, dim slots up to the starting count.
      if (!banked && this.charges > 0) {
        const size = Math.round(12 * f), gap = Math.round(6 * f);
        const slots = Math.max(this.charges, CONFIG.initialCharges);
        const total = slots * size + (slots - 1) * gap;
        const x0 = L.cellsAlign === 1 ? L.cellsX - total : L.cellsX;
        for (let i = 0; i < slots; i++) {
          const x = x0 + i * (size + gap), y = L.cellsY - size / 2;
          if (i < this.charges) {
            g.fillStyle(COLORS.yellow, 0.18); g.fillRoundedRect(x - 2, y - 2, size + 4, size + 4, 4);
            g.fillStyle(COLORS.yellow, 1); g.fillRoundedRect(x, y, size, size, 3);
          } else {
            g.lineStyle(1, COLORS.yellow, 0.35); g.strokeRoundedRect(x, y, size, size, 3);
          }
        }
      }
      // Target bar
      const bw = L.barW, bh = Math.round(8 * f);
      const bx = L.barAlign === 1 ? L.barX - bw : L.barX, by = L.barY - bh / 2;
      const done = this.target > 0 ? Math.min(1, this.activated / this.target) : 0;
      g.fillStyle(0x0d2233, 1); g.fillRoundedRect(bx, by, bw, bh, bh / 2);
      if (done > 0) {
        const col = done >= 1 ? COLORS.green : COLORS.cyan;
        g.fillStyle(col, 0.25); g.fillRoundedRect(bx - 1, by - 1, Math.max(bh, bw * done) + 2, bh + 2, bh / 2 + 1);
        g.fillStyle(col, 1); g.fillRoundedRect(bx, by, Math.max(bh, bw * done), bh, bh / 2);
      }
      g.lineStyle(1, 0x2b5a72, 0.8); g.strokeRoundedRect(bx, by, bw, bh, bh / 2);
    }

    // ------------------------------------------------------------ win / lose
    checkResult() {
      if (this.ended) return;
      this.tweens.add({ targets: this.chainLabel, alpha: 0, duration: 400, delay: 300 });
      if (this.activated >= this.target) { this.endSector(true); return; }
      if (this.charges <= 0) { this.endSector(false); return; }
      if (this.all.every((n) => n.activated)) { this.endSector(this.activated >= this.target); return; }

      if (!this.firstChainDone) {
        this.firstChainDone = true;
        this.callout('LONGER CHAINS SCORE MORE\n' + (this.isTouch ? 'TAP A NODE TO PREVIEW ITS REACH' : 'HOVER A NODE TO PREVIEW ITS REACH'));
      } else if (this.charges === 1) {
        this.callout('LAST CHARGE  •  MAKE IT COUNT', '#ffcf70');
        this.punch(this.chargeCaption, 1.4);
      }
      this.statusLabel.setText('CHAIN x' + this.maxCombo + '  •  ' + this.charges + ' CHARGE' + (this.charges > 1 ? 'S' : '') + ' LEFT');
    }

    endSector(won) {
      this.ended = true;
      this.won = won;
      this.clearPreview();
      this.hovered = null;
      this.selected = null;
      const go = this.isTouch ? 'TAP THE BUTTON' : 'SPACE / ENTER';
      this.statusLabel.setText(won ? 'SECTOR CLEARED  •  ' + go + ' FOR NEXT SECTOR' : 'OUT OF CHARGES  •  ' + go + ' TO RETRY');
      if (won) this.celebrateWin(); else this.showLoss();
    }

    /** Rank from how cleanly the sector was cleared. */
    rankFor() {
      const c = this.charges, k = this.maxCombo;
      if (c >= 2 && k >= 8) return ['S', '#ffd36c'];
      if (c >= 1 || k >= 8) return ['A', '#7ef4ff'];
      if (k >= 5) return ['B', '#b6dce8'];
      return ['C', '#8eb3c3'];
    }

    celebrateWin() {
      const lit = this.all.filter((n) => n.activated);
      this.cameras.main.flash(160, 255, 255, 255, false);
      this.cameras.main.shake(260, 0.008, true);
      [0, 90, 180, 300].forEach((d, i) => this.time.delayedCall(d, () => this.audio.tone([523, 659, 784, 1047][i], 0.22, 'triangle')));
      lit.forEach((n, i) => this.time.delayedCall(i * 22, () => this.confetti(n.x, n.y, n.color)));

      const [rank, rankColor] = this.rankFor();
      const preBonus = this.score;
      const bonusCharges = this.charges;
      this.score += bonusCharges * CONFIG.clearBonusPerCharge;
      if (this.score > this.best) {
        this.best = this.score;
        try { localStorage.setItem(PT.STORAGE_KEY, String(this.best)); } catch (e) { /* no storage */ }
      }
      const isNewBest = this.score > this.bestAtSectorStart && this.bestAtSectorStart > 0;

      this.overlayKicker.setText('SECTOR ' + String(this.sector).padStart(2, '0'));
      this.overlayTitle.setText('SECTOR CLEARED').setColor('#7ef4ff');
      this.overlayStats.setText(this.activated + ' / ' + this.all.length + ' NODES LIT   •   BEST CHAIN x' + this.maxCombo
        + (bonusCharges ? '\n' + bonusCharges + ' CHARGE' + (bonusCharges > 1 ? 'S' : '') + ' SAVED' : ''));
      this.overlayScore.setText(String(preBonus).padStart(6, '0')).setColor('#ffffff');
      this.rankLabel.setText('').setColor(rankColor);
      this.rankCaption.setAlpha(0);
      this.newBest.setVisible(false).setScale(0);
      this.btnLabel.setText('NEXT SECTOR  →');
      this.btnBg.setVisible(false); this.btnLabel.setVisible(false); this.btnHint.setVisible(false);
      this.tallyDone = false;

      this.time.delayedCall(650, () => {
        this.slideInOverlay();
        this.punch(this.overlayTitle, 1.3);
        const step = bonusCharges > 3 ? 160 : 280;
        for (let i = 0; i < bonusCharges; i++) {
          this.time.delayedCall(500 + i * step, () => this.flyCharge(i, preBonus + (i + 1) * CONFIG.clearBonusPerCharge));
        }
        const tallyEnd = 500 + bonusCharges * step + 200;
        this.time.delayedCall(tallyEnd, () => {
          this.overlayScore.setText(String(this.score).padStart(6, '0'));
          this.updateHud();
          this.punch(this.scoreLabel, 1.2);
          this.rankLabel.setText(rank).setScale(2.4).setAlpha(0);
          this.tweens.add({ targets: this.rankLabel, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeIn' });
          this.tweens.add({ targets: this.rankCaption, alpha: 1, duration: 200, delay: 300 });
          this.time.delayedCall(330, () => { this.cameras.main.shake(120, 0.006, true); this.audio.tone(rank === 'S' ? 1320 : 990, 0.25, 'square'); });
          if (isNewBest) {
            this.time.delayedCall(520, () => {
              this.newBest.setVisible(true);
              this.tweens.add({ targets: this.newBest, scale: 1, duration: 260, ease: 'Back.easeOut' });
              this.audio.tone(1568, 0.3, 'triangle');
            });
          }
          this.time.delayedCall(700, () => this.showOverlayButton());
        });
      });
    }

    showLoss() {
      const short = this.target - this.activated;
      this.audio.tone(220, 0.3, 'sawtooth');
      this.time.delayedCall(120, () => this.audio.tone(165, 0.4, 'sawtooth'));
      this.overlayKicker.setText('SECTOR ' + String(this.sector).padStart(2, '0'));
      this.overlayTitle.setText('ENERGY DEPLETED').setColor('#ff7ea8');
      this.overlayStats.setText(this.activated + ' / ' + this.target + ' NEEDED   •   ' + short + ' SHORT   •   BEST CHAIN x' + this.maxCombo
        + '\n\nTIP: ' + (this.isTouch ? 'TAP' : 'HOVER') + ' A NODE TO PREVIEW ITS REACH FIRST');
      this.overlayScore.setText(String(this.score).padStart(6, '0')).setColor('#b6dce8');
      this.rankLabel.setText('');
      this.rankCaption.setAlpha(0);
      this.newBest.setVisible(false);
      this.btnLabel.setText('RETRY SECTOR  ↻');
      this.btnBg.setVisible(false); this.btnLabel.setVisible(false); this.btnHint.setVisible(false);
      this.tallyDone = false;
      this.time.delayedCall(450, () => { this.slideInOverlay(); this.time.delayedCall(350, () => this.showOverlayButton()); });
    }

    slideInOverlay() {
      this.overlay.setVisible(true).setAlpha(0).setY(-36);
      this.tweens.add({ targets: this.overlay, alpha: 1, y: 0, duration: 340, ease: 'Cubic.easeOut' });
    }

    showOverlayButton() {
      this.tallyDone = true;
      this.btnBg.setVisible(true).setScale(0.8); this.btnLabel.setVisible(true).setScale(0.8);
      this.btnHint.setVisible(!this.isTouch).setAlpha(0);
      this.tweens.add({ targets: [this.btnBg, this.btnLabel], scale: 1, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.btnHint, alpha: 1, duration: 300, delay: 200 });
    }

    pressOverlayButton() {
      if (!this.ended || !this.tallyDone) return;
      this.audio.tone(660, 0.075, 'sine');
      if (this.won) this.sector++;
      this.startSector();
    }

    /** A charge token flies from the HUD into the overlay score and bumps it. */
    flyCharge(i, newValue) {
      const L = this.L;
      const token = this.text(L.cellsX + (L.cellsAlign === 1 ? -i * 18 - 8 : i * 18 + 8), L.cellsY, '●', 16 * this.f, '#ffcf70').setOrigin(0.5).setDepth(80);
      this.tweens.add({
        targets: token, x: this.overlayScore.x, y: this.overlayScore.y, scale: 0.4, duration: 420, ease: 'Cubic.easeIn',
        onComplete: () => {
          token.destroy();
          this.overlayScore.setText(String(newValue).padStart(6, '0')).setColor('#ffd36c');
          this.punch(this.overlayScore, 1.25);
          this.spark(this.overlayScore.x, this.overlayScore.y, COLORS.yellow, 8);
          this.audio.tone(700 + i * 80, 0.1, 'triangle');
        },
      });
    }

    confetti(x, y, color) {
      const palette = [color, 0xffffff, COLORS.yellow];
      const u = this.unit;
      for (let i = 0; i < 9; i++) {
        const piece = this.add.rectangle(x, y, Phaser.Math.Between(3, 6), Phaser.Math.Between(6, 10),
          palette[i % palette.length], 1).setDepth(65).setAngle(Phaser.Math.Between(0, 180));
        const dx = Phaser.Math.Between(-90, 90) * u;
        const up = Phaser.Math.Between(50, 130) * u;
        this.tweens.add({ targets: piece, y: y - up, duration: 260, ease: 'Quad.easeOut', onComplete: () => {
          this.tweens.add({ targets: piece, y: y + Phaser.Math.Between(80, 200) * u, alpha: 0, duration: Phaser.Math.Between(600, 1000), ease: 'Quad.easeIn', onComplete: () => piece.destroy() });
        } });
        this.tweens.add({ targets: piece, x: x + dx, angle: piece.angle + Phaser.Math.Between(-540, 540), duration: 1100, ease: 'Sine.easeOut' });
      }
    }

    restartRun() {
      this.sector = 1;
      this.score = 0;
      this.firstChainDone = false;
      this.startSector();
    }

    toggleMute() {
      const muted = this.audio.toggleMute();
      this.statusLabel.setText(muted ? 'SOUND MUTED' : 'SOUND ENABLED');
    }
  }

  PT.PulseScene = PulseScene;
})(window.PulseThief);
