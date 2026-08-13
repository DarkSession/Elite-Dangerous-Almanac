# Data sources — `data/equipment/`

## Personal suits, handheld weapons and engineering

- **Files:** `suits.jsonc`, `weapons.jsonc`, `upgrade-costs.jsonc`,
  `modifications.jsonc`, `modification-costs.jsonc`,
  `modification-journal-names.jsonc`.
- **Acquired:** 2026-08-13.
- **Source:** Odyssey Materials Helper.
- **Upstream revisions:**
  - Odyssey Materials Helper commit `2e6d4c3e767d2b714ffddc5c9386831d66812916`
    (2026-08-09), the last revision before the project extracted its core data into a
    separately distributed dependency.
  - Frontier Elite Dangerous Gamestore product pages have no immutable revision; their
    displayed weapon names were read on the acquisition date above.
- **Derivation:**
  - `Suit.java` supplies the four suit families, journal symbols, weapon-slot counts and
    grade-dependent shield strength, shield regeneration, resistances and modification
    slots. English suit display names come from
    `application/src/main/resources/locale/loadout/equipment.csv`. `family` removes
    `_class{grade}` from the grade-specific Frontier `symbol`; the exact symbol remains
    on every grade. Shield strength is in shield points, shield regeneration in shield
    points per second. The source's resistance percentage points are divided by 100 into
    fractions, matching the resistance convention used by the ships domain (`0.5` means
    50% resisted).
  - `Weapon.java` supplies the eleven handheld weapons, their exact journal symbols,
    class, slot, damage type, fire mode and combat stats. English weapon display names
    come from `application/src/main/resources/locale/loadout/equipment.csv`. Damage is
    per projectile or pellet, rate of fire is shots per second, effective range is
    metres, and the source's headshot percentages are divided by 100 into multipliers.
  - `OdysseyBlueprintConstants.java` supplies each one-step suit and manufacturer-family
    weapon upgrade recipe, all engineer-applied modification recipes, and the engineers
    who offer them. Enum names are joined to the lower-case Frontier micro-resource
    symbols in `data/materials/`. Upgrade keys are changed from `1_2` / `2_3` / `3_4` /
    `4_5` to their target grades `2` / `3` / `4` / `5`. Weapon upgrade families retain
    the source's `karma`, `takada` and `manticore` identities; `engineeringType` separately
    records the `kinetic`, `laser` or `plasma` suffix used by modification recipes.
  - `SuitModification.java` and `WeaponModification.java` supply the journal symbols.
    English modification display names come from
    `application/src/main/resources/locale/loadout/modification.csv`; English engineer
    names come from `application/src/main/resources/locale/engineer/names.csv`. A recipe
    is keyed by its symbol rather than by a derived library id. Greater Range, Headshot
    Damage and Higher Accuracy retain their nine distinct Kinetic, Laser and Plasma
    recipe symbols. The journal writes only three unsuffixed symbols, so
    `modification-journal-names.jsonc` records that collision once for resolution against
    the weapon. `modification-costs.jsonc` is split from recipe metadata so an identity
    lookup does not bundle every shopping list, matching the ships engineering boundary.
- **Manual corrections:** Odyssey Materials Helper's English locale calls the four Karma
  weapons “Kinematic” and expands the three TK weapon names to “Takada”. The Frontier
  Elite Dangerous Gamestore confirms the in-game prefixes are `Karma` and `TK`, which are
  stored here. Frontier's misspelled `surveilleancelogs` symbol is kept verbatim so it
  joins to journal inventory data and the micro-resource catalogue.
