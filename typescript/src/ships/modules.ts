/**
 * Outfitting-module types and lookups.
 *
 * Elite Dangerous has ~1200 fittable modules. This module holds the
 * {@link OutfittingModule} record shape — a module's **identity and its stats**
 * together — and the functions that find one ({@link getModuleBySymbol},
 * {@link getModulesByName}, {@link getBulkheadsForShip}).
 *
 * **Every lookup searches all 1199 modules by default.** A journal `Item` string does
 * not identify its outfitting category, so callers need no category for lookup:
 *
 * ```ts
 * getModuleBySymbol('Hpt_PulseLaser_Fixed_Small')?.name; // -> 'Pulse Laser'
 * ```
 *
 * Each lookup takes an optional second argument to **narrow** the search to a
 * subset — any array you have filtered yourself. The catalogue is also exported split
 * by Frontier's four outfitting categories:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./modules-core` | `CORE_MODULES` | 521 |
 * | `./modules-internal` | `INTERNAL_MODULES` | 484 |
 * | `./modules-hardpoint` | `HARDPOINT_MODULES` | 159 |
 * | `./modules-utility` | `UTILITY_MODULES` | 35 |
 * | `./modules-all` | `ALL_MODULES` | 1199 (the default) |
 *
 * Those four are for **listing** a category — an outfitting screen's hardpoint tab.
 * They make poor narrowing arguments: no module symbol or display name is shared
 * across categories, so passing one to a lookup can only make it miss.
 *
 * The record shape is intentionally sparse. Use the data-free guards in
 * `./module-capabilities` to narrow a lookup result before reading a complete stat group:
 *
 * ```ts
 * const module = getModuleBySymbol(journalItem);
 * if (hasFrameShiftDriveJumpStats(module)) module.maxFuel; // required here, in tonnes
 * if (hasWeaponDamageStats(module)) weaponMetrics(module);
 * ```
 *
 * @remarks
 * **This is the one default that costs real bundle weight.** A lookup imported from
 * here pulls all four catalogues — 311.9 KiB minified (30.5 KiB gzipped) — since
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
import { filterByKey, findByKey } from '../internal/registry-index.js';
import { builtInModuleBySymbol } from './internal/module-symbol-index.js';
import type { EngineeringGroupId } from './engineering-options.js';
import type { ModuleSlot, SlotRestriction } from './slots.js';

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
 * A game-enforced one-per-ship family. Two modules with the same value cannot be
 * fitted to one hull at the same time, even when they occupy different slots.
 */
export type ModuleExclusionGroup =
    | 'cargoScanner'
    | 'detailedSurfaceScanner'
    | 'discoveryScanner'
    | 'dockingComputer'
    | 'experimentalModuleStabiliser'
    | 'experimentalUtility'
    | 'fighterHangar'
    | 'frameShiftDriveInterdictor'
    | 'frameShiftWakeScanner'
    | 'fuelScoop'
    | 'guardianFsdBooster'
    | 'killWarrantScanner'
    | 'multiLimpetController'
    | 'pulseWaveAnalyser'
    | 'refinery'
    | 'shieldGenerator'
    | 'supercruiseAssist';

/**
 * A game-enforced per-ship module-count family.
 *
 * @remarks
 * Unlike {@link ModuleExclusionGroup}, a limit group may allow more than one fitted
 * module and another module may raise its allowance. The only current family is the
 * experimental-weapon limit shared by AX and Guardian weapons.
 */
export type ModuleLimitGroup = 'experimentalWeapon';

/** A fitted module's increase to one {@link ModuleLimitGroup} allowance. */
export interface ModuleLimitIncrease {
    /** Limit family whose allowance is increased. */
    readonly group: ModuleLimitGroup;
    /** Additional modules allowed, as a positive whole-module count (`1` or greater). */
    readonly amount: number;
}

/**
 * How a weapon's damage splits across the damage types, as fractions of one shot.
 *
 * @remarks
 * The conventional shares — {@link DamageDistribution.kinetic | kinetic},
 * {@link DamageDistribution.thermal | thermal},
 * {@link DamageDistribution.explosive | explosive},
 * {@link DamageDistribution.absolute | absolute}, and any
 * {@link DamageDistribution.unclassified | unclassified} share — partition the damage and sum to
 * `1`; a type a weapon does not deal is absent rather than `0`. Kinetic, thermal and
 * explosive damage meet the defender's resistance of the same name. No shield or hull
 * resistance reduces absolute damage; the type and mitigation of unclassified damage
 * are not established by in-game verification.
 *
 * {@link DamageDistribution.antiXeno | antiXeno} is different: it **overlays** the
 * conventional split instead of partitioning it, flagging the portion that is effective
 * against Thargoid targets. It is expressed relative to conventional damage and can
 * exceed `1`, so a distribution's values can sum past `1`.
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
    /** Share unclassified by in-game verification, `0`–`1`. */
    readonly unclassified?: number;
    /**
     * Anti-xeno ratio: the amount effective against Thargoids divided by conventional
     * damage. Non-negative and potentially greater than `1`; see the type's remarks.
     */
    readonly antiXeno?: number;
}

/**
 * Exact damage amounts carried by one round, or one second of continuous fire.
 *
 * @remarks
 * Every amount is non-negative. Kinetic, thermal, explosive, absolute and all
 * `unclassified` entries sum to the module's conventional {@link OutfittingModule.damage}.
 * `antiXeno` overlays that conventional amount and is not added to it. The exact amounts
 * are authoritative when present; {@link DamageDistribution} remains the compatible
 * fractional projection.
 *
 * @example
 * ```ts
 * import type { DamageComponents } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * const components: DamageComponents = { explosive: 27, antiXeno: 43 };
 * ```
 */
export interface DamageComponents {
    /** Non-negative kinetic damage. */
    readonly kinetic?: number;
    /** Non-negative thermal damage. */
    readonly thermal?: number;
    /** Non-negative explosive damage. */
    readonly explosive?: number;
    /** Non-negative absolute damage, which no resistance reduces. */
    readonly absolute?: number;
    /** Non-negative damage effective against Thargoid targets, overlaid on conventional damage. */
    readonly antiXeno?: number;
    /** Non-negative damage amounts unclassified by in-game verification. */
    readonly unclassified?: readonly number[];
}

/**
 * In-game projectile boundary parameters that are not effective weapon ranges.
 *
 * @remarks
 * Values are non-negative boundary parameters. They are deliberately not stated in
 * metres and must not be passed to a range attenuation calculation: projectile reach
 * depends on projectile behavior not represented by these two numbers.
 *
 * @example
 * ```ts
 * import type { ProjectileRangeBoundaries } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * const boundaries: ProjectileRangeBoundaries = {
 *   maximumBoundary: 0,
 *   falloffBoundary: 100000,
 * };
 * ```
 */
export interface ProjectileRangeBoundaries {
    /** Non-negative maximum boundary parameter observed in-game, when present. */
    readonly maximumBoundary?: number;
    /** Non-negative falloff boundary parameter observed in-game. */
    readonly falloffBoundary: number;
}

/**
 * Identity, classification, fit constraints, and price for one outfitting module.
 *
 * @remarks
 * The core identity fields (`symbol`, `name`, `category`, `class`, and `rating`) are
 * always present. Optional fields describe fit restrictions, purchase entitlement, and
 * price. Performance data belongs to {@link OutfittingModuleStats}; the complete flat
 * catalogue record is {@link OutfittingModule}.
 *
 * @example
 * ```ts
 * import type { OutfittingModuleIdentity } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * const identity: OutfittingModuleIdentity = {
 *   symbol: 'CustomCargoRack',
 *   category: 'internal',
 *   engineeringGroup: 'cargoRacks',
 *   name: 'Custom Cargo Rack',
 *   class: 2,
 *   rating: 'E',
 * };
 * ```
 */
export interface OutfittingModuleIdentity {
    /** Internal identifier, e.g. `"Hpt_PulseLaser_Fixed_Small"`. Unique — the module's key. */
    readonly symbol: string;
    /**
     * Which kind of slot the module fits.
     *
     * @remarks
     * Derived from the catalogue the record was read from rather than stored on it —
     * `CORE_MODULES` is what makes a record `'core'` — so it is always present and
     * always agrees with the catalogue you found the module in — it is written after
     * the record's own fields, so the file wins outright. That also makes it the last
     * key on the record, which is worth knowing only if you serialize one and compare
     * the resulting string.
     */
    readonly category: ModuleCategory;
    /**
     * Stable engineering-menu family, or `null` when no source classifies this module.
     * See {@link EngineeringGroupId}.
     */
    readonly engineeringGroup: EngineeringGroupId | null;
    /**
     * The one fixed mount this module fills, when it fills one: `'armour'` or one of
     * the seven {@link CoreSlotType} core functions.
     *
     * @remarks
     * Present on every `core` module, and on the fifteen Guardian Hybrid power plants
     * and power distributors — which Frontier files under `internal`, but which go in
     * a core mount. Absent on everything else, because there is no one mount to name:
     * a weapon, a utility fitting or an ordinary optional internal fits any mount of
     * its kind that is large enough.
     *
     * This is the module's half of the fit rule and `BuildSlot.core` is the mount's
     * half; `ShipLoadout.setModule` matches the two. Read it rather than inferring a
     * mount from the symbol — `Int_Engine_*` being thrusters is a naming habit, not a
     * guarantee, and the Python Mk II's `Int_MkIIAgileBoost_*` thrusters already break
     * it.
     *
     * A `fuelTank` is the one module that fits somewhere else as well: its own core
     * mount *and* any optional slot large enough.
     *
     * **The rule is read off the record, not off the symbol** — the same way
     * {@link OutfittingModule.restrictedToShips} behaves, and with the same
     * consequence: a record you assemble yourself from a journal `Item` string, with
     * no `slot` on it, will not go into a core mount. Resolve records from a catalogue
     * ({@link getModuleBySymbol}) and the question does not arise.
     *
     * @example
     * ```ts
     * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
     *
     * getModuleBySymbol('Int_Hyperdrive_Size5_Class5')?.slot; // -> 'frameShiftDrive'
     * getModuleBySymbol('Anaconda_Armour_Grade1')?.slot;      // -> 'armour'
     * getModuleBySymbol('Int_CargoRack_Size4_Class1')?.slot;  // -> undefined
     * ```
     */
    readonly slot?: ModuleSlot;
    /**
     * Stable, descriptive English name, e.g. `"Pulse Laser"`.
     *
     * @remarks
     * This is a canonical library label, not a byte-exact copy of the game's
     * localized UI text: abbreviations such as FSD and AFM are expanded for readability.
     * It is not localized and is not suitable as a localization key.
     *
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

    /**
     * The hull symbol(s) a module is restricted to, when it is ship-specific — e.g.
     * `["Explorer_NX"]` for the Python Mk II's MkII Gravity Optimised thrusters.
     *
     * @remarks
     * Present only on the handful of non-armour modules limited to particular hulls.
     * Armour is ship-specific too, but that restriction lives in
     * {@link OutfittingModule.ship} / {@link getBulkheadsForShip}, not here. Symbols
     * match {@link Ship.symbol}.
     */
    readonly restrictedToShips?: readonly string[];
    /**
     * The slot restriction a module **requires** — it fits only mounts carrying this
     * {@link SlotRestriction}, and no unrestricted mount at all.
     *
     * @remarks
     * Not to be confused with {@link OutfittingModule.slot}, which names *one* mount
     * the module fills; this narrows a whole family of them, and the two never appear
     * on the same record.
     *
     * The mirror image of `BuildSlot.restriction`, and the other half of the same
     * rule: a mount's restriction says which modules it takes, this says which mounts
     * a module goes in. Most restricted families bind one way only — a cargo rack fits
     * a `cargo` mount *and* any unrestricted optional — so this is present on just the
     * five records the game sells for one kind of mount and nowhere else:
     *
     * | Module | Requires |
     * | --- | --- |
     * | `Int_PlanetApproachSuite`, `Int_PlanetApproachSuite_Advanced` | `planetaryApproachSuite` |
     * | `Int_LargeCargoRack_Size7_Class1`, `Int_LargeCargoRack_Size8_class1` (Mk II Cargo Rack) | `cargo` |
     * | `Int_MultiDroneControl_MiningV2_Size5_Class5` (Mk II Mining Multi-Limpet Controller) | `limpetController` |
     *
     * It composes with {@link OutfittingModule.restrictedToShips} rather than
     * replacing it: the Mk II racks name both the hull that can buy them and the kind
     * of mount they go in, and a build must satisfy both. Where a module names a hull
     * and nothing else — the Mk II Vessel Hangars, say — it fits that hull's ordinary
     * optionals like anything else.
     *
     * **The rule is read off the record, not off the symbol.** A module you assemble
     * yourself — from a journal `Item` string, say — is refused only if you give it
     * this field, exactly as `restrictedToShips` behaves. Resolve records from a
     * catalogue and the question does not arise.
     * @example
     * ```ts
     * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
     * import { INTERNAL_MODULES } from '@elite-dangerous-almanac/core/ships/modules-internal';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const rack = getModuleBySymbol('Int_LargeCargoRack_Size8_class1', INTERNAL_MODULES)!;
     * rack.restrictedToSlot; // -> 'cargo'
     * ShipLoadout.empty('PantherMkII').setModule('Cargo01', rack); // fits
     * try {
     *     ShipLoadout.empty('PantherMkII').setModule('Slot01_Size8', rack);
     * } catch (error) {
     *     if (error instanceof TypeError) error.message;
     *     // -> 'ShipLoadout.setModule: Int_LargeCargoRack_Size8_class1 → Slot01_Size8: module only fits a mount that takes cargo racks and fuel tanks'
     * }
     * ```
     */
    readonly restrictedToSlot?: SlotRestriction;
    /**
     * One-per-ship family, absent when the module has no exclusive fitting rule.
     * Two fitted modules sharing this id are structurally invalid.
     */
    readonly exclusionGroup?: ModuleExclusionGroup;
    /**
     * Per-ship count limit this fitted module consumes, absent when it consumes none.
     * Read the base allowance and current usage with `calculateModuleLimits` from
     * `ships/module-limits` rather than inferring the family from a symbol or name.
     */
    readonly limitGroup?: ModuleLimitGroup;
    /**
     * Increase this fitted module grants to a per-ship count allowance.
     *
     * @remarks
     * The Experimental Weapon Stabiliser grants one additional experimental weapon at
     * class 3 and two at class 5. The grant comes from the fitted article; module power
     * state does not change structural fitting validity.
     */
    readonly limitIncrease?: ModuleLimitIncrease;
    /**
     * Standard purchase price, in credits — the base list price before any station
     * discount or markup, which is what an outfitting screen quotes at 0% discount.
     *
     * @remarks
     * Absent on the handful of records no registry prices: the starter `*_free`
     * variants, the size-8 frame shift drives, and a few internals no outfitting
     * registry carries a figure for — among them the two Corrosion Resistant Cargo
     * Racks no station sells, which are not free. Treat `undefined` as "unknown", never
     * as free — see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
     */
    readonly cost?: number;
}

/**
 * Sparse performance and capability fields carried by an outfitting module.
 *
 * @remarks
 * Every field is optional because no module family uses every stat. Use the guards in
 * `./module-capabilities` when a calculation needs a complete group. The interface is
 * also useful for functions that accept or return engineered stat snapshots without
 * requiring a module's identity fields. Masses are tonnes, power is megawatts, jump
 * ranges are light-years, and weapon ranges are metres.
 *
 * @example
 * ```ts
 * import type { OutfittingModuleStats } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * const engineered: OutfittingModuleStats = { mass: 18.4, powerDraw: 0.69 };
 * ```
 */
export interface OutfittingModuleStats {
    // The three `*Multiplier` fields are group-dependent: a thruster's speed
    // multiplier or a shield generator's strength multiplier.

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
    /** Minimum performance multiplier, reached at `maxMass`. */
    readonly minMultiplier?: number;
    /** Maximum performance multiplier, reached at `minMass`. */
    readonly maxMultiplier?: number;
    /** Thruster top-speed multiplier at `optMass`, when distinct from acceleration. */
    readonly optSpeedMultiplier?: number;
    /** Thruster minimum top-speed multiplier, reached at `maxMass`. */
    readonly minSpeedMultiplier?: number;
    /** Thruster maximum top-speed multiplier, reached at `minMass`. */
    readonly maxSpeedMultiplier?: number;
    /** Thruster rotation multiplier at `optMass`, when distinct from acceleration. */
    readonly optRotationMultiplier?: number;
    /** Thruster minimum rotation multiplier, reached at `maxMass`. */
    readonly minRotationMultiplier?: number;
    /** Thruster maximum rotation multiplier, reached at `minMass`. */
    readonly maxRotationMultiplier?: number;

    /**
     * Thrusters: waste heat generated per second at top speed.
     *
     * @remarks
     * The stat the journal calls `EngineHeatRate` — every Dirty Drive Tuning roll
     * raises it and every Clean Drive roll lowers it. Frontier's own units: a bare
     * number the ship's heat model consumes, not a temperature or a percentage.
     */
    readonly engineHeatRate?: number;

    /** FSD: maximum fuel per jump, in tonnes. */
    readonly maxFuel?: number;
    /** FSD: rating (linear) fuel constant. */
    readonly fuelMul?: number;
    /** FSD: size (power) fuel constant. */
    readonly fuelPower?: number;
    /**
     * Frame shift drive: waste heat generated per second while charging a jump.
     *
     * @remarks
     * The journal's `FSDHeatRate`, in the same units as
     * {@link OutfittingModule.engineHeatRate}. It is what Faster Boot Sequence trades
     * away, what Shielded improves, and the whole of the Deep Charge / Thermal Spread
     * (`special_fsd_cooled`) experimental effect. A drive's size sets it — every rating
     * of a size shares one value, and a supercruise-assist (SCO) drive matches the plain
     * drive of the same size.
     */
    readonly fsdHeatRate?: number;
    /** Guardian FSD Booster: flat jump-range bonus, in light-years. */
    readonly jumpBoost?: number;

    /** Power plant: power generated, in megawatts. */
    readonly powerCapacity?: number;
    /** Power plant: heat efficiency (lower runs cooler). */
    readonly heatEfficiency?: number;

    /** Power distributor: WEP capacitor capacity. */
    readonly weaponsCapacity?: number;
    /** Power distributor: maximum WEP recharge at four pips, in megajoules per second. */
    readonly weaponsRecharge?: number;
    /** Power distributor: ENG capacitor capacity. */
    readonly enginesCapacity?: number;
    /** Power distributor: maximum ENG recharge at four pips, in megajoules per second. */
    readonly enginesRecharge?: number;
    /** Power distributor: SYS capacitor capacity. */
    readonly systemsCapacity?: number;
    /** Power distributor: maximum SYS recharge at four pips, in megajoules per second. */
    readonly systemsRecharge?: number;

    /** Fuel scoop: scoop rate, in tonnes per second. */
    readonly refuelRate?: number;
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

    // ── Shield cell banks ──────────────────────────────────────────────────────
    // What one cell does when it fires: how fast it pours shields back, how long it
    // keeps pouring, how long you wait first, and the heat it costs.

    /** Shield cell bank: shield megajoules restored per second while a cell runs. */
    readonly shieldBankReinforcement?: number;
    /** Shield cell bank: waste heat generated by firing one cell. */
    readonly shieldBankHeat?: number;
    /** Shield cell bank: seconds between firing a cell and the shields starting to rise. */
    readonly shieldBankSpinUp?: number;
    /** Shield cell bank: seconds one cell keeps reinforcing for. */
    readonly shieldBankDuration?: number;

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
     * Whether Anti-Guardian Zone Resistance protects this Guardian module from a
     * Thargoid anti-Guardian field.
     *
     * @remarks
     * A sparse capability flag rather than a percentage: `true` means the protection is
     * inherent or the grade-1 blueprint grants it, while absence means it is not granted.
     * The two Guardian Nanite Torpedo Pylons carry it inherently; read engineered
     * protection from a fitted module's {@link FittedModule.effectiveStats}.
     */
    readonly guardianZoneResistance?: boolean;
    /**
     * Whether this particular resolved article accepts no further engineering.
     *
     * @remarks
     * Stock module catalogues omit this field. `getPreEngineeredStats` sets it on final
     * pre-engineered Guardian weapons so a fitted article exposes an empty engineering
     * menu and rejects both blueprints and experimental effects.
     */
    readonly engineeringLocked?: boolean;
    /**
     * Armour: the hull hit points this bulkhead adds, as a fraction of the hull's
     * {@link Ship.baseArmour} on top of it — `0.8` (lightweight alloy) means
     * `baseArmour × 1.8`, `2.5` means `baseArmour × 3.5`.
     *
     * @remarks
     * Carried by the ship-specific armour modules, which are the `core`-category
     * records with a {@link OutfittingModule.ship}. List a hull's five (or, on the
     * Caspian Explorer, six) options with {@link getBulkheadsForShip}.
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

    // ── Scanning ───────────────────────────────────────────────────────────────
    // Carried by the core sensor suites and by the utility scanners (kill warrant,
    // manifest, frame shift wake, xeno, pulse wave analyser), which share the stats
    // even though the game shows them under different names.

    /**
     * Scan range, in **metres**.
     *
     * @remarks
     * On a **utility scanner** it is the distance the scan reaches. On a **core sensor
     * suite** it is the range at which a contact with typical emissions resolves — the
     * "typical sensor range" the outfitting panel shows in kilometres and the journal
     * reports in metres, not the suite's absolute detection ceiling.
     *
     * This is the sole distance field on utility scanners and sensor suites. A journal
     * may spell its modifier `ScannerRange` or `Range`; both labels resolve here. Weapon
     * distance is the separate {@link OutfittingModule.maximumRange} field.
     */
    readonly scannerRange?: number;
    /**
     * Scan cone half-angle, in degrees — how far off boresight a target can sit and
     * still be scanned. Wide Angle raises it; Long Range and Lightweight narrow it.
     */
    readonly scanAngle?: number;
    /** Seconds a scan takes to complete. Utility scanners only. */
    readonly scanTime?: number;
    /**
     * Detailed Surface Scanner: probe radius, as a **percentage** (`20` = the stock
     * 20%).
     *
     * @remarks
     * Frontier stores this one as a percentage rather than a fraction, and the journal
     * reports it that way too — a grade 4 Expanded Probe Scanning Radius roll takes the
     * stock `20` to `28`. The journal spells the label `DSS_PatchRadius`; the blueprint
     * recipe spells it `ProbeRadius`, and both resolve here.
     */
    readonly probeRadius?: number;

    // ── FSD interdictor ────────────────────────────────────────────────────────

    /** FSD interdictor: maximum target angle off boresight, in degrees. */
    readonly interdictorFacingLimit?: number;
    /**
     * FSD interdictor: maximum target range, in **seconds to intercept** — the units the
     * game measures a supercruise separation in, not a distance.
     */
    readonly interdictorRange?: number;

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
     * Exact damage amounts when in-game verification exposes distinct components.
     * On effective fitted stats these scale with engineered total damage, and are absent
     * when engineering converts the weapon to a new fractional damage distribution.
     */
    readonly damageComponents?: DamageComponents;
    /**
     * Rounds fired per shot, for the weapons that fire several at once (fragment
     * cannons, shard cannons). Absent means one round per shot.
     */
    readonly roundsPerShot?: number;
    /**
     * Shots per second with the burst pattern folded in — the journal's `RateOfFire`.
     *
     * @remarks
     * Absent on continuous-fire weapons (beam and mining lasers), whose `damage` is
     * already per second. Excludes charge and reload time; {@link OutfittingModule.chargeTime}
     * is the delay before a shot lands, while {@link OutfittingModule.clipSize} and
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
    /**
     * Rounds in a clip before reloading. Absent on weapons that never reload.
     *
     * @remarks
     * A capacity, and the largest `AmmoInClip` a journal can report for the module.
     * `ammunitionCapacity` in `./ammunition` reads it together with
     * {@link OutfittingModule.ammoMaximum}.
     */
    readonly clipSize?: number;
    /**
     * Reserve rounds to reload from — the magazine is *not* counted in it, exactly as the
     * journal's `AmmoInHopper` does not count it. Absent beside a {@link clipSize} means
     * nothing limits the refills (the mining Abrasion Blaster); absent beside no clip
     * either means the module takes no ammunition at all, as the lasers do.
     */
    readonly ammoMaximum?: number;
    /** Seconds to reload a clip. */
    readonly reloadTime?: number;
    /**
     * Weapons-capacitor draw, in megawatts — per shot, or per second on a
     * continuous-fire weapon. Shield generators carry it too, as the systems-capacitor
     * cost of one MJ per second of regeneration — the stat the journal calls
     * `EnergyPerRegen` rather than `DistributorDraw`, and the one Hi-Cap, Lo-draw and
     * Force Block move.
     */
    readonly distributorDraw?: number;
    /** Heat generated — per shot, or per second on a continuous-fire weapon. */
    readonly thermalLoad?: number;
    /**
     * Armour piercing rating. Damage to a hull is scaled by
     * `min(1, armourPiercing / hardness)` against a hull of that {@link Ship.hardness}.
     */
    readonly armourPiercing?: number;
    /**
     * Maximum effective range, in metres. A weapon does no damage beyond it; on a
     * non-scanner utility module, it is the effect's reach.
     */
    readonly maximumRange?: number;
    /** Range at which damage starts to drop off, in metres. */
    readonly falloffRange?: number;
    /** Projectile boundary parameters; these are not effective distances in metres. */
    readonly projectileRange?: ProjectileRangeBoundaries;
    /**
     * Projectile speed, in metres per second.
     *
     * @remarks
     * Absent on the weapons that have no projectile to speed up — the pulse, burst,
     * beam and mining lasers, rail guns, Gauss cannons and mine launchers all hit (or
     * drop) where they are aimed. No registry publishes a figure for them because there
     * is none, so Long Range and Focused simply leave their shot speed alone; see
     * {@link ShipLoadout.applyBlueprint}.
     */
    readonly shotSpeed?: number;
    /** Maximum aim deviation, in degrees. */
    readonly jitter?: number;
}

/**
 * One fittable outfitting module: its identity and sparse stats in one flat record.
 *
 * @remarks
 * Keeping the runtime record flat lets engineering modifiers address stat keys directly.
 * Consumers that need a smaller contract can accept {@link OutfittingModuleIdentity},
 * {@link OutfittingModuleStats}, or one of the required groups in
 * `./module-capabilities`.
 *
 * @example
 * ```ts
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * getModuleBySymbol('Int_Hyperdrive_Size5_Class5')?.engineeringGroup;
 * // -> 'frameShiftDrives'
 * ```
 */
export interface OutfittingModule extends OutfittingModuleIdentity, OutfittingModuleStats {}

/**
 * Look up a module by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Hpt_PulseLaser_Fixed_Small"`.
 * Leading/trailing whitespace and case are ignored, so the journal's lower-cased
 * form resolves too.
 * @param modules - Optional subset to search instead of all 1199 modules —
 * `CORE_MODULES`, `INTERNAL_MODULES`, `HARDPOINT_MODULES`, `UTILITY_MODULES`, or any
 * array you have filtered yourself. Omit it unless you specifically want to exclude
 * the other categories; a symbol is unique across all four.
 * @returns The matching {@link OutfittingModule}, or `null` if no module has that
 * symbol.
 * @throws {TypeError} If `symbol` is present and not a string. A nullish
 * `symbol` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * getModuleBySymbol('hpt_pulselaser_fixed_small')?.class; // -> 1
 * ```
 */
export function getModuleBySymbol(
    symbol: string,
    modules: readonly OutfittingModule[] = ALL_MODULES,
): OutfittingModule | null {
    return modules === ALL_MODULES
        ? builtInModuleBySymbol(symbol, 'getModuleBySymbol: symbol')
        : findByKey(modules, 'symbol', symbol, 'getModuleBySymbol: symbol');
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
 * @throws {TypeError} If `name` is present and not a string. A nullish
 * `name` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getModulesByName } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * getModulesByName('pulse laser').length; // -> every size/mount variant
 * ```
 */
export function getModulesByName(
    name: string,
    modules: readonly OutfittingModule[] = ALL_MODULES,
): OutfittingModule[] {
    return filterByKey(modules, 'name', name, 'getModulesByName: name');
}

/**
 * Every bulkhead (armour) variant a given hull can be fitted with, in catalogue order.
 *
 * @param ship - The hull's display name as the registry spells it, e.g.
 * `"Anaconda"`. Leading/trailing whitespace and case are ignored, but matching is
 * otherwise exact.
 * @param modules - Optional subset to search (see {@link getModuleBySymbol}). Bulkheads
 * live in `CORE_MODULES`; narrowing to any other category returns an empty array.
 * @returns The hull's bulkhead modules — five variants, or six on the Caspian Explorer —
 * or an empty array if none are carried for that hull. The input array is not modified.
 * @remarks
 * Bulkheads are the only hull-specific module; everything else fits by slot size, so
 * this does *not* answer "what else can this hull carry" — that is slot layout, which the
 * hull's own record carries. Reach it with {@link getShipByName}, which takes the same
 * display name as this function; {@link getShipSlots} is the same layout keyed by
 * {@link Ship.symbol} instead, and the two differ for most hulls (`"Viper Mk III"` is the
 * record `"Viper"`).
 * @throws {TypeError} If `ship` is present and not a string. A nullish
 * `ship` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getBulkheadsForShip } from '@elite-dangerous-almanac/core/ships/modules';
 *
 * getBulkheadsForShip('Anaconda').map((m) => m.name);
 * // -> [ 'Lightweight Alloy', 'Reinforced Alloy', 'Military Grade Composite',
 * //      'Mirrored Surface Composite', 'Reactive Surface Composite' ]
 * ```
 */
export function getBulkheadsForShip(
    ship: string,
    modules: readonly OutfittingModule[] = ALL_MODULES,
): OutfittingModule[] {
    return filterByKey(modules, 'ship', ship, 'getBulkheadsForShip: ship');
}
