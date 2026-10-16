# Game design

## Core loop

1. A sector spawns a random field of dormant nodes.
2. The player spends a charge to activate one node.
3. Energy cascades to nearby nodes. Bigger chains score more.
4. Repeat until the target is reached (win) or charges hit zero (lose).
5. Win: next sector, slightly more nodes. Lose: reroll the same sector.

The tension is spatial: find the click that reaches the most nodes, and save a charge for the stragglers.

## Rules

| Rule                    | Value                                   | Config key            |
| ----------------------- | --------------------------------------- | --------------------- |
| Starting charges        | 3 (4 from sector 4 onward)              | `initialCharges`, `bonusChargeSector` |
| Max charges             | 8                                       | `maxCharges`          |
| Nodes in sector *n*     | 16 + 2(n−1), capped at 29               | `baseNodes`, `nodesPerSector`, `maxNodes` |
| Target to clear         | ceil(62% of nodes) in sector 1, ramping to 74% by sector 4 | `targetFractionStart`, `targetFractionEnd`, `rampSectors` |
| Min spacing             | 65 px between node centres              | `minNodeSpacing`      |
| Relay radius            | 128 px in sector 1, ramping to 105 by sector 4 | `relayRadiusStart`, `relayRadiusEnd` |
| Amplifier radius        | relay + 53 px                           | `amplifierBonus`      |
| Splitter bolt range     | 180 px, up to 3 bolts ≥ 0.75 rad apart  | `boltRadius`          |
| Chain considered over   | 750 ms with no new activations          | `chainQuietMs`        |

## Scoring

- Each activation is worth `pointsPerStep × min(combo, comboCap)`, i.e. 100, 200, … up to 1200 per node.
- `combo` resets to 0 on every player click, so one click that reaches 12 nodes earns 100+200+…+1200 = 7800.
- Clearing a sector adds `clearBonusPerCharge` (500) per unspent charge.
- Best score persists in the browser.

## Node types

| Type      | Spawn weight | Radius    | Special                                            |
| --------- | ------------ | --------- | -------------------------------------------------- |
| Relay     | 4 / 8        | relay     | None                                               |
| Amplifier | 1 / 8        | relay + 53 | Bigger spark burst                                |
| Splitter  | 1 / 8        | relay + bolts | Also fires 3 bolts to far nodes in distinct directions |
| Capacitor | 1 / 8        | relay     | Ignores the first hit; fires on the second         |
| Battery   | 1 / 8        | relay     | +1 charge on activation                            |

Spawn weight comes from how many times the type appears in `TYPES`. The first three nodes of every sector are forced to battery, amplifier, splitter so each sector has at least one of each.

## Screens and input

All distances in this document are for the reference 876 x 406 playfield. On other screens they are multiplied by `unit` (see ARCHITECTURE.md), so a phone board is a scaled copy with the same density and the same chain behaviour.

Mouse: hover previews, click fires. Touch: tap previews (selects), tap again fires, tap empty space cancels. The two-tap model exists because touch has no hover, and the preview is the core decision aid.

## Onboarding and feel

There is no tutorial screen. The game teaches by showing:

- Hovering a dormant node draws its reach and rings every node inside it, so the player sees the outcome before committing.
- Sector 1 marks the best starting node with a CLICK HERE pulse (best = longest chain by `simulateReach`).
- After the first chain a single callout explains that longer chains score more.
- Spent nodes go dim, live nodes keep glowing, so "what can I still click" is always visible.

Feel tunables live in `JUICE` (`config.js`): hover swell, squash amounts, shove distance, shake amounts, sting thresholds. Shake is sparse by design: the player's click, the x5 / x8 / x12 stings and the sector clear, never per node. Per-node shake was tested and caused motion discomfort. `shakeMax: 0` disables it.

### Simulated balance (400 boards per row)

| Sector | Relay | Target | Avg chain, random click | Clicks hitting only 1 node | Best possible first click |
| ------ | ----- | ------ | ----------------------- | -------------------------- | ------------------------- |
| 1      | 128   | 10/16  | 8.0                     | 8%                         | 12.1                      |
| 2      | 120   | 12/18  | 9.4                     | 8%                         | 13.9                      |
| 3      | 112   | 14/20  | 9.6                     | 9%                         | 15.4                      |
| 4      | 105   | 17/22  | 10.9                    | 9%                         | 17.4                      |

A perfect first click can clear sector 1 in one go. That is intentional: the first impression should be "I am powerful".

## Sector clear and rank

Clearing a sector pays `clearBonusPerCharge` (500) per unspent charge, shown as charges flying into the score. A rank letter is then stamped:

| Rank | Condition                                      |
| ---- | ---------------------------------------------- |
| S    | 2+ charges saved **and** best chain >= 8       |
| A    | 1+ charge saved **or** best chain >= 8         |
| B    | best chain >= 5                                |
| C    | otherwise                                      |

NEW BEST appears when the final score beats the best recorded before this sector started (and that best was non-zero, so a first-ever run does not get stamped on every sector).

## Design notes and open questions

- **Capacitors are the only "bad" node.** A capacitor at a chokepoint can kill a chain. They are also the only thing that rewards overlapping pulses. Consider whether that is enough counterplay.
- **No fail state past sector 1 is harsh.** Losing rerolls the sector but keeps score and sector number. There is currently no run-over condition, so the game is effectively endless.
- **Scaling plateaus at sector 7** (29 nodes). Beyond that only the bonus charge changes. Ideas: shrink radii per sector, add a "dead" node type, raise `targetFraction`.
- **Simulated, not playtested.** The table above comes from a headless simulation of spawn and propagation, not from humans.

## Tuning checklist

When changing `CONFIG`, check:

- Sector 1 is clearable with 3 charges most of the time (relay radius vs. node spacing).
- From sector 2 on, a single click should rarely clear a sector outright, or there is no decision to make. Sector 1 is allowed to be a one-click win.
- `chainQuietMs` is longer than the longest scheduled delay (`160 + boltRadius × 1.6` ≈ 450 ms), otherwise results are checked mid-chain.
