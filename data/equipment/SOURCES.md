# Data sources — `data/equipment/`

## Upstream snapshots this domain is pinned to

Referred to throughout by source name; the pin is here, once.

| Source                                            | Pin                                                                                                                                                            | Acquired       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Odyssey Materials Helper                          | commit `2e6d4c3e767d2b714ffddc5c9386831d66812916` (2026-08-09), the last revision before the project extracted its core data into a separately distributed dependency | 2026-08-13 UTC |
| Frontier Elite Dangerous Gamestore                | no immutable revision; the displayed weapon names were read on the acquisition date                                                                            | 2026-08-13 UTC |
| Elite Dangerous in-game observation               | no game version recorded; direct reading of the suit and weapon stats panels, the sight magnification they show, and the on-foot engineering options            | 2026-08-31 UTC |

**Where a source and the game disagree, the in-game reading governs.** Odyssey Materials Helper
supplies the identities, the slot and grade structure, the engineer availability and
every material shopping list; the stat values are the ones the game itself shows.

## Personal suits, handheld weapons and engineering

- **Files:** `suits.jsonc`, `weapons.jsonc`, `upgrade-costs.jsonc`,
  `modifications.jsonc`, `modification-costs.jsonc`,
  `modification-journal-names.jsonc`.
- **Derivation:**
  - `Suit.java` supplies the four suit families, journal symbols, weapon-slot counts and
    the grade-dependent modification slots, shield strength and shield regeneration.
    English suit display names come from
    `application/src/main/resources/locale/loadout/equipment.csv`. `family` removes
    `_class{grade}` from the grade-specific Frontier `symbol`; the exact symbol remains
    on every grade. Shield strength is in shield points, shield regeneration in shield
    points per second.
  - `Weapon.java` supplies the eleven handheld weapons, their exact journal symbols,
    class, slot, damage type, fire mode, magazine size, headshot multiplier and effective
    range. English weapon display names come from
    `application/src/main/resources/locale/loadout/equipment.csv`. Damage is per
    projectile or pellet, rate of fire is shots per second, effective range is metres,
    and the source's headshot percentages are divided by 100 into multipliers.
  - `OdysseyBlueprintConstants.java` supplies each one-step suit and manufacturer-family
    weapon upgrade recipe, all engineer-applied modification recipes, and the engineers
    who offer them. Enum names are joined to the lower-case Frontier micro-resource
    symbols in `data/materials/`. Upgrade keys are changed from `1_2` / `2_3` / `3_4` /
    `4_5` to their target grades `2` / `3` / `4` / `5`. Weapon upgrade families retain
    the source's `karma`, `takada` and `manticore` identities; `engineeringType` separately
    records the `kinetic`, `laser` or `plasma` suffix used by modification recipes.
  - `SuitModification.java` and `WeaponModification.java` supply the journal symbols.
    English engineer names come from
    `application/src/main/resources/locale/engineer/names.csv`. A recipe is keyed by its
    symbol rather than by a derived library id. Greater Range, Headshot Damage and
    Improved Hip Fire Accuracy retain their nine distinct Kinetic, Laser and Plasma
    recipe symbols. The journal writes only three unsuffixed symbols, so
    `modification-journal-names.jsonc` records that collision once for resolution against
    the weapon. `modification-costs.jsonc` is split from recipe metadata so an identity
    lookup does not bundle every shopping list, matching the ships engineering boundary.
  - **In-game observation supplies every stat value** described in the three sections
    below: the suit-wide component stats and the four resistances, the weapon combat
    stats and damage, and the multipliers each modification applies.

- **Manual corrections:**
  - Odyssey Materials Helper's English locale calls the four Karma weapons “Kinematic”
    and expands the three TK weapon names to “Takada”. The Frontier Elite Dangerous
    Gamestore confirms the in-game prefixes are `Karma` and `TK`, which are stored here.
  - Frontier's misspelled `surveilleancelogs` symbol is kept verbatim so it joins to
    journal inventory data and the micro-resource catalogue.
  - Three modification display names are the in-game text rather than the source's:
    `Faster Shield Regeneration`→`Faster Shield Regen`,
    `Higher Accuracy`→`Improved Hip Fire Accuracy`, and `Stowed Reloading`→
    `Stowed reloading`. The last keeps Frontier's own lower-case second word; it reads
    like a typo and is not one, so do not "fix" it back.

### Suit stats read in-game

The suit stats panel is read per suit family and per grade.

- **Suit-wide, identical at all five grades**, so they are stored once per family rather
  than per grade: `health` (30 on every suit), `mass` (100 kg on every suit),
  `batteryCapacity` in energy units, `oxygenTime` in seconds of emergency air,
  `boostAcceleration` for the jump assist, the three backpack capacities
  (`goodsCapacity`, `assetsCapacity`, `dataCapacity`), `footstepAudibleRange` as a
  multiplier of the base audible range (1 on every suit), `losAnalysisRange` in metres
  (50 on every suit) and `losAnalysisTime` in seconds (1 on every suit). The constant
  ones are stored anyway: a suit-stats view reads them like any other field, and a value
  that is the same everywhere is still the value.
- **Resistances are stored as fractions** (`0.5` means half the damage taken),
  matching the ships domain. The panel's own figure is the same fraction as a
  percentage, so a negative resistance is a weakness. Every resistance is now the
  panel's, which corrects nine grade rows against Odyssey Materials Helper:

  | Suit and grade      | Field → stored value                                                    |
  | ------------------- | ------------------------------------------------------------------------- |
  | Artemis 1           | `thermalResistance` 0.39→0.4                                            |
  | Artemis 2           | `kineticResistance` -0.42→-0.43; `plasmaResistance` 0→-0.01             |
  | Artemis 3           | `plasmaResistance` 0.14→0.15                                            |
  | Artemis 5           | `kineticResistance` 0.14→0.15; `plasmaResistance` 0.39→0.4              |
  | Flight Suit         | `thermalResistance` 0.39→0.4                                            |
  | Dominator 4         | `kineticResistance` 0.19→0.11; `thermalResistance` 0.78→0.76; `plasmaResistance` 0.46→0.41; `explosiveResistance` 0.46→0.41 |
  | Maverick 2          | `plasmaResistance` 0.07→0.08                                            |
  | Maverick 3          | `kineticResistance` -0.13→-0.14                                         |
  | Maverick 5          | `kineticResistance` 0.19→0.2                                            |

- **Shield strength and shield regeneration are unchanged.** Every stored value already
  matches the panel, which is also why the resistance disagreements are read as source
  rounding rather than as a different snapshot of the game.
- **A grade changes the armour, the shield generator, the modification slots and the
  item symbol.** Nothing else on a suit moves with the grade, which is what makes the
  suit-wide fields safe to store once per family.

### Weapon stats read in-game

- **Rate of fire** is the panel's, correcting `Karma AR-50` 9.5→9.52,
  `TK Aphelion` 5.7→5.71, `Manticore Oppressor` 6.7→6.67, `Manticore Intimidator`
  1.3→1.25, `Manticore Tormentor` 1.7→1.67, `Manticore Executioner` 0.8→0.833 and
  `TK Zenith` 5.7→2.78. The Zenith is the one large disagreement and it is not a
  rounding difference: it fires bursts, and 2.78 is the rate the panel shows.
- **Reserve ammunition** is the panel's, correcting `Karma P-15` 120→240,
  `Karma AR-50` 200→250, `TK Eclipse` 280→315 and `TK Zenith` 90→180. It is the reserve
  a stock suit carries, before the Extra Ammo Capacity modification.
- **Magazine size, effective range, class, slot, damage type and headshot multiplier**
  are unchanged: every one already matches the panel.
- **Damage** is the grade-1 figure read in-game, times the grade multiplier the game
  applies to it — `1`, `1.31`, `1.73`, `2.27`, `2.98` for grades 1 to 5. Each product is
  taken in double-precision floating point and rounded to three decimals, as
  `Number(x.toFixed(3))` does it; that reproduces every stored figure exactly. The
  rounding rule has to be stated rather than assumed, because some products land on a
  half and are therefore broken in both directions, and because scaling before rounding
  (`Math.round(x * 1000) / 1000`) re-introduces error and misses some of the stored
  figures.
- **The multipliers are what Odyssey Materials Helper's own figures follow.** On the four
  weapons whose grade-1 damage needed no correction — `Karma L-6`,
  `Manticore Executioner`, `Manticore Tormentor` and `Manticore Oppressor` — its grades 2
  to 5 sit within 0.05 of the same progression on 15 of those 16 rows, which is half of
  one decimal — the most a figure rounded to one decimal can move. The exception is `Karma L-6` grade 4: 90.8 here, and
  90 in that source alone.
- **Every weapon's damage therefore changes**, and by more than rounding wherever the
  grade-1 figure itself had been rounded: `Karma C-44` 0.6→0.65, `Karma AR-50` 1→0.95,
  `TK Eclipse` 0.9→0.85, `Karma P-15` 1.4→1.38, `TK Aphelion` 1.6→1.572, `TK Zenith`
  1.7→1.668 and `Manticore Intimidator` 1.8→1.75. Damage is stored at the precision the
  game reports it, which is why two of those grade-1 figures carry three decimals where
  the panel shows one.
- **`scopeMagnification` is new**: the aim-down-sights magnification the panel shows with
  the sight the weapon ships with, and with the sight the Scope modification fits, both
  to two decimals. Scope stores no modifier of its own because its magnitude is this
  pair, and it differs per weapon — `Manticore Executioner` gains 1.61x→3.75x where
  `Manticore Intimidator` gains 1.08x→1.25x.

### Modification magnitudes

Each recipe carries `modifiers`, the stat multipliers it applies. A modification is
applied in one step and has no grade or quality roll, so a modifier is a single factor
rather than the `[min, max]` band a ship blueprint feature carries, and `1` — a factor
that changes nothing — is never stored.

- **Enhanced Tracking effectively removes the analysis delay** rather than shortening
  it proportionally: its factor on `losAnalysisTime` is `0.001`, which takes the 1 second
  every suit needs down to a thousandth of one. It is recorded as the factor it applies,
  like every other modifier.
- **A resistance factor multiplies the damage taken**, not the stored resistance
  fraction. Damage Resistance is `×0.9` on damage taken, so a `0.5` resistance becomes
  `0.55`. This is the same convention the ships domain uses for resistances.
- **`roundUp` marks the one result the game rounds up**: Magazine Size multiplies by 1.5
  and rounds the magazine up to a whole number, so 45 rounds become 68 rather than 67.5.
- **Six recipes name a stat no catalogue field carries**, because the panel shows no
  base for it: the melee damage, sprint duration and tool energy drain multipliers, the
  reload speed, and the pressurised and unpressurised firing audible ranges. The factor
  is recorded against the stat it moves; the base has to come from the panel.
- **Ten recipes carry an empty modifier list**, for two different reasons, and both are
  a statement rather than a gap:
  - Night Vision, Scope, Stowed reloading and Combat Movement Speed apply no factor to
    any stat. Night Vision and Stowed reloading switch a capability on, Scope's whole
    numeric effect is the weapon's own `scopeMagnification`, and Combat Movement Speed
    changes how a suit moves while aiming without moving a displayed stat.
  - Faster Handling, Improved Hip Fire Accuracy, Stability and Improved Jump Assist do
    change stats, but ones the panel puts no number on — weapon handling, hip-fire
    jitter and recoil, and the jump assist's boost drain and recharge. Improved Jump
    Assist notably leaves the panel's Jump Assist Boost Acceleration exactly where it
    was, so recording it against that field would be wrong.
- **Extra Ammo Capacity multiplies a weapon's `reserveAmmo`**, which is why the reserve
  stored on a weapon is the stock figure and not an engineered one.
