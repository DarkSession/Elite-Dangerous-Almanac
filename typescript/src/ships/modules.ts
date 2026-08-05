/**
 * Outfitting-module types and lookups.
 *
 * Elite Dangerous has ~1200 fittable modules. This module holds the
 * {@link OutfittingModule} record shape — a module's **identity and its stats**
 * together — and the functions that find one ({@link getModuleBySymbol},
 * {@link getModulesByName}, {@link getModulesForShip}).
 *
 * **Every lookup searches all 1198 modules by default.** A journal `Item` string
 * does not tell you which outfitting category it belongs to, so needing to know that
 * before you could look it up was backwards:
 *
 * ```ts
 * getModuleBySymbol('Hpt_PulseLaser_Fixed_Small')?.name; // -> 'Pulse Laser'
 * ```
 *
 * Each lookup still takes an optional second argument to **narrow** the search to a
 * subset — any array you have filtered yourself. The catalogue is also exported split
 * by Frontier's four outfitting categories:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./modules-core` | `CORE_MODULES` | 521 |
 * | `./modules-internal` | `INTERNAL_MODULES` | 483 |
 * | `./modules-hardpoint` | `HARDPOINT_MODULES` | 159 |
 * | `./modules-utility` | `UTILITY_MODULES` | 35 |
 * | `./modules-all` | `ALL_MODULES` | 1198 (the default) |
 *
 * Those four are for **listing** a category — an outfitting screen's hardpoint tab.
 * They make poor narrowing arguments: no module symbol or display name is shared
 * across categories, so passing one to a lookup can only make it miss.
 *
 * @remarks
 * **This is the one default that costs real bundle weight.** A lookup imported from
 * here pulls all four catalogues — about 290 KB minified (~30 KB gzipped) — since
 * that is what it falls back to, and passing an explicit catalogue does not undo it.
 * A build that must carry only one category should import that catalogue and search
 * it directly:
 *
 * ```ts
 * // Catalogue symbols are mixed-case; a journal's are not.
 * UTILITY_MODULES.find((m) => m.symbol.toLowerCase() === wanted);
 * ```
 *
 * @example
 * ```ts
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * getModuleBySymbol('hpt_pulselaser_fixed_small')?.name; // -> 'Pulse Laser'
 * ```
 *
 * @packageDocumentation
 */

import { ALL_MODULES } from './modules-all.js';

/**
 * Frontier's outfitting category — which kind of slot a module fits.
 *
 * - `core` — the core internals every hull must fit (armour, power plant, thrusters,
 *   frame shift drive, life support, power distributor, sensors, fuel tank). Frontier's
 *   own registry calls this category "standard"; it is named for the slots it fills,
 *   which are the same seven {@link CoreSlotType}s plus armour. A fuel tank is a `core`
 *   module that also fits an optional slot.
 * - `internal` — optional internals (cargo racks, shield generators, fuel scoops,
 *   passenger cabins, limpet and planetary controllers, …).
 * - `hardpoint` — the weapons and tools mounted on a hardpoint.
 * - `utility` — the small utility-mount fittings (chaff, heat sinks, point defence,
 *   shield boosters, scanners).
 */
export type ModuleCategory = 'core' | 'internal' | 'hardpoint' | 'utility';

/** How a hardpoint weapon is aimed. Only hardpoint modules carry a mount. */
export type ModuleMount = 'Fixed' | 'Gimballed' | 'Turreted';

/** A missile/torpedo hardpoint's guidance. Only some hardpoints carry one. */
export type ModuleGuidance = 'Dumbfire' | 'Seeker' | 'Swarm';

/** A module's grade letter, best (`A`) to worst; `I` is the armour placeholder. */
export type ModuleRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

/**
 * How a weapon's damage splits across the damage types, as fractions of one shot.
 *
 * @remarks
 * The four **physical** shares — {@link DamageDistribution.kinetic | kinetic},
 * {@link DamageDistribution.thermal | thermal},
 * {@link DamageDistribution.explosive | explosive} and
 * {@link DamageDistribution.absolute | absolute} — partition the damage and sum to
 * `1`; a type a weapon does not deal is absent rather than `0`. Each is met by the
 * defender's resistance of the same name, except `absolute`, which no shield or hull
 * resistance reduces.
 *
 * {@link DamageDistribution.antiXeno | antiXeno} is different: it **overlays** the
 * physical split instead of partitioning it, flagging the portion that is effective
 * against Thargoid targets. An AX multi-cannon is `{ kinetic: 1, antiXeno: 1 }` — all
 * of its damage is kinetic *and* all of it is anti-xeno, so a distribution's values
 * can sum past `1`.
 */
export interface DamageDistribution {
    /** Kinetic share of one shot's damage, `0`–`1`. */
    readonly kinetic?: number;
    /** Thermal share of one shot's damage, `0`–`1`. */
    readonly thermal?: number;
    /** Explosive share of one shot's damage, `0`–`1`. */
    readonly explosive?: number;
    /** Absolute share — damage no resistance reduces — of one shot's damage, `0`–`1`. */
    readonly absolute?: number;
    /**
     * Anti-xeno share: the portion effective against Thargoids. Overlays the physical
     * shares rather than partitioning them (see the type's remarks).
     */
    readonly antiXeno?: number;
}

/**
 * One fittable outfitting module — its **identity and its stats** in one record.
 *
 * @remarks
 * The identity fields (`symbol`, `name`, `category`, `class`, `rating`, …) come from
 * Frontier's outfitting registry and are always present. The stats fields (`mass`,
 * `powerDraw`, the FSD constants, per-group performance, the defence and weapon
 * stats, …) come from coriolis-data and are **sparse** — a module carries only the
 * stats that apply to it. Masses are tonnes, power is megawatts, jump ranges are
 * light-years and weapon ranges are metres.
 */
export interface OutfittingModule {
    /** Internal identifier, e.g. `"Hpt_PulseLaser_Fixed_Small"`. Unique — the module's key. */
    readonly symbol: string;
    /** Which kind of slot the module fits. */
    readonly category: ModuleCategory;
    /**
     * Display name, e.g. `"Pulse Laser"`.
     *
     * @remarks
     * **Not unique** — the game shows most modules at several sizes and ratings, and
     * every hull's armour shares the same five names. Use {@link OutfittingModule.symbol}
     * as the key; {@link getModulesByName} returns every match.
     */
    readonly name: string;
    /**
     * The module size, `0`–`8` — the number in the "5A" the outfitting screen shows.
     *
     * @remarks
     * Frontier calls this the module *class*; it is the slot-size number, not the
     * grade letter (that is {@link OutfittingModule.rating}). Named `class` to match
     * the source registry.
     */
    readonly class: number;
    /** The grade letter, `A`–`I` — the letter in the "5A" the screen shows. */
    readonly rating: ModuleRating;
    /**
     * How the weapon is aimed. Present only on hardpoint weapons that have a mount
     * variant; absent on every other module.
     */
    readonly mount?: ModuleMount;
    /**
     * A missile/torpedo hardpoint's guidance. Present only on the launchers that
     * have one; absent on everything else.
     */
    readonly guidance?: ModuleGuidance;
    /**
     * The hull an armour variant belongs to, e.g. `"Anaconda"`. Present only on the
     * `core`-category armour modules, which are the one ship-specific module;
     * absent on every generic module.
     */
    readonly ship?: string;
    /**
     * Frontier's DLC / purchase-grant entitlement token, e.g.
     * `"ELITE_HORIZONS_V_PLANETARY_LANDINGS"`. Present only on gated modules.
     */
    readonly entitlement?: string;

    // ── Stats (from coriolis-data) — sparse: only the fields the module's group
    //    uses are present. The three `*Multiplier` fields are group-dependent (a
    //    thruster's speed multiplier, a shield generator's strength multiplier). ──

    /**
     * The hull symbol(s) a module is restricted to, when it is ship-specific — e.g.
     * `["Explorer_NX"]` for the Python Mk II's MkII Gravity Optimised thrusters.
     *
     * @remarks
     * Present only on the handful of non-armour modules limited to particular hulls.
     * Armour is ship-specific too, but that restriction lives in
     * {@link OutfittingModule.ship} / {@link getModulesForShip}, not here. Symbols
     * match {@link Ship.symbol}.
     */
    readonly restrictedToShips?: readonly string[];
    /**
     * The stat fields this record omits because the value is **unknown**, rather than
     * because the module has no such stat.
     *
     * @remarks
     * Every stat below is optional, and a missing one reads as `undefined` either way:
     * a cargo rack draws no power, while a withdrawn Discovery Scanner draws power
     * nobody publishes. Only the second kind is named here, so a calculation can tell
     * "nothing to add" from "cannot be answered" instead of adding up a zero it cannot
     * justify — {@link isStatUnknown} is the predicate.
     *
     * Present on five records today. A field named here is always absent from this
     * record, so sourcing a value means deleting its name here in the same change.
     * Read its absence as "not one of the known gaps", not as "the game has no such
     * value": the base stats blueprints modify that no record carries at all are a
     * separate gap, tracked in `TODO.md`.
     *
     * @example
     * ```ts
     * const scanner = getModuleBySymbol('Int_StellarBodyDiscoveryScanner_Advanced');
     * scanner?.powerDraw;    // -> undefined
     * scanner?.unknownStats; // -> ['powerDraw'] — don't budget it as 0 MW
     * ```
     */
    readonly unknownStats?: readonly ModuleStatField[];
    /** Mass, in tonnes. */
    readonly mass?: number;
    /** Integrity (hit points against module damage). */
    readonly integrity?: number;
    /** Power draw, in megawatts. */
    readonly powerDraw?: number;
    /** Boot time from power-on, in seconds. */
    readonly bootTime?: number;

    /** Optimised mass, in tonnes — thrusters, shield generators, and FSDs. */
    readonly optMass?: number;
    /** Minimum mass for the performance curve, in tonnes. */
    readonly minMass?: number;
    /** Maximum mass for the performance curve, in tonnes. */
    readonly maxMass?: number;
    /** Performance multiplier at `optMass` — thruster speed or shield strength. */
    readonly optMultiplier?: number;
    /** Performance multiplier at `minMass`. */
    readonly minMultiplier?: number;
    /** Performance multiplier at `maxMass`. */
    readonly maxMultiplier?: number;

    /** FSD: maximum fuel per jump, in tonnes. */
    readonly maxFuel?: number;
    /** FSD: rating (linear) fuel constant. */
    readonly fuelMul?: number;
    /** FSD: size (power) fuel constant. */
    readonly fuelPower?: number;
    /** Guardian FSD Booster: flat jump-range bonus, in light-years. */
    readonly jumpBoost?: number;

    /** Power plant: power generated, in megawatts. */
    readonly powerCapacity?: number;
    /** Power plant: heat efficiency (lower runs cooler). */
    readonly heatEfficiency?: number;

    /** Power distributor: WEP capacitor capacity. */
    readonly weaponsCapacity?: number;
    /** Power distributor: WEP recharge rate, per second. */
    readonly weaponsRecharge?: number;
    /** Power distributor: ENG capacitor capacity. */
    readonly enginesCapacity?: number;
    /** Power distributor: ENG recharge rate, per second. */
    readonly enginesRecharge?: number;
    /** Power distributor: SYS capacitor capacity. */
    readonly systemsCapacity?: number;
    /** Power distributor: SYS recharge rate, per second. */
    readonly systemsRecharge?: number;

    /** Fuel tank: capacity, in tonnes. */
    readonly fuelCapacity?: number;
    /** Cargo rack: capacity, in tonnes. */
    readonly cargoCapacity?: number;

    /** Shield generator: regeneration rate, MJ per second. */
    readonly shieldRegenRate?: number;
    /** Shield generator: broken (down) regeneration rate, MJ per second. */
    readonly shieldBrokenRegenRate?: number;
    /** Shield booster: shield strength bonus, as a fraction (`0.04` = +4%). */
    readonly shieldBoost?: number;

    // ── Defence: resistances and reinforcement ─────────────────────────────────
    // Carried by shield generators, shield boosters, hull and module reinforcement
    // packages. Resistances are the fraction of incoming damage removed, so `0.4` is
    // 40% resisted and a *negative* value is a weakness (every shield generator is
    // −0.2 to thermal). They stack with diminishing returns — see `./resistances`.

    /** Kinetic resistance, as a fraction (`0.4` = 40% resisted, `-0.2` = 20% weaker). */
    readonly kineticResistance?: number;
    /** Thermal resistance, as a fraction (negative is a weakness). */
    readonly thermalResistance?: number;
    /** Explosive resistance, as a fraction (negative is a weakness). */
    readonly explosiveResistance?: number;
    /** Caustic resistance, as a fraction (negative is a weakness). */
    readonly causticResistance?: number;
    /**
     * Armour: the hull hit points this bulkhead adds, as a fraction of the hull's
     * {@link Ship.baseArmour} on top of it — `0.8` (lightweight alloy) means
     * `baseArmour × 1.8`, `2.5` means `baseArmour × 3.5`.
     *
     * @remarks
     * Carried by the ship-specific armour modules, which are the `core`-category
     * records with a {@link OutfittingModule.ship}. List a hull's five (or, on the
     * Caspian Explorer, six) options with {@link getModulesForShip}.
     */
    readonly hullBoost?: number;
    /** Hull reinforcement package: hull hit points added. */
    readonly hullReinforcement?: number;
    /** Guardian shield reinforcement package: shield megajoules added. */
    readonly shieldAddition?: number;
    /**
     * Module reinforcement package: the fraction of module damage it absorbs
     * (`0.3` = 30%). Protects the *modules*, not the hull.
     */
    readonly moduleProtection?: number;

    /**
     * `true` when a hardpoint-mounted module draws its power continuously.
     *
     * @remarks
     * Weapons and most utility fittings only draw power while the hardpoints are
     * deployed; shield boosters, chaff, heat sinks, point defence, caustic sinks and
     * shutdown field neutralisers draw theirs all the time, and carry this flag.
     * Absent on every `core`/`internal` module, which are always powered anyway.
     * See {@link powerDraw} and `./power`.
     */
    readonly alwaysPowered?: boolean;

    // ── Weapons ────────────────────────────────────────────────────────────────
    // A weapon's raw combat stats. `damage` is per **round**, while `distributorDraw`
    // and `thermalLoad` are per **shot** — the two differ on a weapon that fires several
    // rounds at once, like a fragment cannon. On the continuous-fire beam and mining
    // lasers, which carry no `rateOfFire`, all three are already per second. `./weapons`
    // turns them into DPS, capacitor draw per second and heat per second.

    /** Damage per round — or per second on a continuous-fire (beam) weapon. */
    readonly damage?: number;
    /** How `damage` splits across the damage types. */
    readonly damageDistribution?: DamageDistribution;
    /**
     * Rounds fired per shot, for the weapons that fire several at once (fragment
     * cannons, shard cannons). Absent means one round per shot.
     */
    readonly roundsPerShot?: number;
    /**
     * Shots per second, with the burst pattern and any charge time folded in — the
     * journal's `RateOfFire`.
     *
     * @remarks
     * Absent on continuous-fire weapons (beam and mining lasers), whose `damage` is
     * already per second. Excludes reload time; {@link OutfittingModule.clipSize} and
     * {@link OutfittingModule.reloadTime} give the sustained rate.
     */
    readonly rateOfFire?: number;
    /** Seconds between shots — between *bursts* on a burst-fire weapon. */
    readonly burstInterval?: number;
    /** Shots in one burst. Absent (or `1`) on a weapon that does not fire in bursts. */
    readonly burstRounds?: number;
    /** Shots per second *within* a burst. */
    readonly burstRateOfFire?: number;
    /** Seconds spent charging before a shot (rail guns), if any. */
    readonly chargeTime?: number;
    /** Rounds in a clip before reloading. Absent on weapons that never reload. */
    readonly clipSize?: number;
    /** Reserve rounds to reload from. */
    readonly ammoMaximum?: number;
    /** Seconds to reload a clip. */
    readonly reloadTime?: number;
    /**
     * Weapons-capacitor draw, in megawatts — per shot, or per second on a
     * continuous-fire weapon. Shield generators carry it too, as the capacitor cost of
     * one MJ per second of regeneration.
     */
    readonly distributorDraw?: number;
    /** Heat generated — per shot, or per second on a continuous-fire weapon. */
    readonly thermalLoad?: number;
    /**
     * Armour piercing rating. Damage to a hull is scaled by
     * `min(1, armourPiercing / hardness)` against a hull of that {@link Ship.hardness}.
     */
    readonly armourPiercing?: number;
    /** Maximum range, in metres — beyond it the weapon does nothing. */
    readonly maximumRange?: number;
    /** Range at which damage starts to drop off, in metres. */
    readonly falloffRange?: number;
    /** Projectile speed, in metres per second. Absent on hitscan (laser) weapons. */
    readonly shotSpeed?: number;
    /** Maximum aim deviation, in degrees. */
    readonly jitter?: number;

    /**
     * Standard purchase price, in credits — the base list price before any station
     * discount or markup, which is what an outfitting screen quotes at 0% discount.
     *
     * Absent on the handful of records no registry prices: the starter `*_free`
     * variants, the size-8 frame shift drives, and a few reward-only internals. Treat
     * `undefined` as "unknown", never as free — see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
     */
    readonly cost?: number;
}

/**
 * A field of an {@link OutfittingModule} record — what
 * {@link OutfittingModule.unknownStats} names and {@link isStatUnknown} takes.
 *
 * The whole record shape, not a stats-only subset: identity fields (`symbol`, `name`,
 * `category`) are never unknown, so asking about one simply answers `false`.
 */
export type ModuleStatField = keyof OutfittingModule;

/**
 * Look up a module by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Hpt_PulseLaser_Fixed_Small"`.
 * Leading/trailing whitespace and case are ignored, so the journal's lower-cased
 * form resolves too.
 * @param modules - Optional subset to search instead of all 1198 modules —
 * `CORE_MODULES`, `INTERNAL_MODULES`, `HARDPOINT_MODULES`, `UTILITY_MODULES`, or any
 * array you have filtered yourself. Omit it unless you specifically want to exclude
 * the other categories; a symbol is unique across all four.
 * @returns The matching {@link OutfittingModule}, or `null` if no module has that
 * symbol.
 * @example
 * ```ts
 * getModuleBySymbol('hpt_pulselaser_fixed_small')?.class; // -> 1
 * ```
 */
export function getModuleBySymbol(
    symbol: string,
    modules: readonly OutfittingModule[] = ALL_MODULES,
): OutfittingModule | null {
    const wanted = symbol.trim().toLowerCase();
    return modules.find((module) => module.symbol.toLowerCase() === wanted) ?? null;
}

/**
 * Every module with a given display name, in catalogue order.
 *
 * @param name - The display name as the registry spells it, e.g. `"Pulse Laser"`.
 * Leading/trailing whitespace and case are ignored, but matching is otherwise exact.
 * @param modules - Optional subset to search (see {@link getModuleBySymbol}).
 * @returns All matching modules — the name is shared across sizes, ratings and (for
 * armour) hulls, so this returns an array. Empty if none match. The input array is
 * not modified.
 * @example
 * ```ts
 * getModulesByName('pulse laser').length; // -> every size/mount variant
 * ```
 */
export function getModulesByName(
    name: string,
    modules: readonly OutfittingModule[] = ALL_MODULES,
): OutfittingModule[] {
    const wanted = name.trim().toLowerCase();
    return modules.filter((module) => module.name.toLowerCase() === wanted);
}

/**
 * Every armour variant fitted to a given ship, in catalogue order.
 *
 * @param ship - The hull's display name as the registry spells it, e.g.
 * `"Anaconda"`. Leading/trailing whitespace and case are ignored, but matching is
 * otherwise exact.
 * @param modules - Optional subset to search (see {@link getModuleBySymbol}). Armour
 * lives in `CORE_MODULES`; narrowing to any other category returns an empty array.
 * @returns The ship's armour modules — the five bulkhead variants — or an empty
 * array if none are carried for that hull. The input array is not modified.
 * @remarks
 * Armour is the only module tied to a specific hull; every other module fits by slot
 * size, so "modules for a ship" beyond armour is a question of slot layout, which
 * this registry does not carry.
 * @example
 * ```ts
 * getModulesForShip('Anaconda').map((m) => m.name);
 * // -> [ 'Lightweight Alloy', 'Reinforced Alloy', 'Military Grade Composite',
 * //      'Mirrored Surface Composite', 'Reactive Surface Composite' ]
 * ```
 */
export function getModulesForShip(
    ship: string,
    modules: readonly OutfittingModule[] = ALL_MODULES,
): OutfittingModule[] {
    const wanted = ship.trim().toLowerCase();
    return modules.filter((module) => module.ship?.toLowerCase() === wanted);
}
