/**
 * Outfitting-module types and lookups — the **data-free** core of the ship-modules
 * feature.
 *
 * Elite Dangerous has ~1200 fittable modules. This module holds the
 * {@link OutfittingModule} record shape — a module's **identity and its stats**
 * together — and the pure functions that search a catalogue
 * ({@link getModuleBySymbol}, {@link getModulesByName}, {@link getModulesForShip});
 * the catalogues themselves live in sibling modules, one per Frontier outfitting
 * category, so you only bundle the ones you ask for:
 *
 * | Module | Export | Entries |
 * | --- | --- | --- |
 * | `./modules-standard` | `STANDARD_MODULES` | 521 |
 * | `./modules-internal` | `INTERNAL_MODULES` | 475 |
 * | `./modules-hardpoint` | `HARDPOINT_MODULES` | 159 |
 * | `./modules-utility` | `UTILITY_MODULES` | 35 |
 * | `./modules-all` | `ALL_MODULES` | 1190 |
 *
 * Importing a query function from here costs nothing but the function: pass in
 * whichever catalogue you imported.
 *
 * @example
 * ```ts
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
 *
 * getModuleBySymbol('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES)?.name;
 * // -> 'Pulse Laser'
 * ```
 *
 * @packageDocumentation
 */

/**
 * Frontier's outfitting category — which kind of slot a module fits.
 *
 * - `standard` — core internals every hull must fit (armour, power plant,
 *   thrusters, frame shift drive, life support, power distributor, sensors, fuel
 *   tank).
 * - `internal` — optional internals (cargo racks, shield generators, fuel scoops,
 *   passenger cabins, limpet and planetary controllers, …).
 * - `hardpoint` — the weapons and tools mounted on a hardpoint.
 * - `utility` — the small utility-mount fittings (chaff, heat sinks, point defence,
 *   shield boosters, scanners).
 */
export type ModuleCategory = 'standard' | 'internal' | 'hardpoint' | 'utility';

/** How a hardpoint weapon is aimed. Only hardpoint modules carry a mount. */
export type ModuleMount = 'Fixed' | 'Gimballed' | 'Turreted';

/** A missile/torpedo hardpoint's guidance. Only some hardpoints carry one. */
export type ModuleGuidance = 'Dumbfire' | 'Seeker' | 'Swarm';

/** A module's grade letter, best (`A`) to worst; `I` is the armour placeholder. */
export type ModuleRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

/**
 * One fittable outfitting module — its **identity and its stats** in one record.
 *
 * @remarks
 * The identity fields (`symbol`, `name`, `category`, `class`, `rating`, …) come from
 * Frontier's outfitting registry and are always present. The stats fields (`mass`,
 * `powerDraw`, the FSD constants, per-group performance, …) come from coriolis-data
 * and are **sparse** — a module carries only the stats that apply to it, and a few
 * modules (ship-specific armour) carry no stats at all. Masses are tonnes, power is
 * megawatts, ranges are light-years. Weapon combat stats (damage, falloff, breach)
 * are intentionally not carried.
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
     * `standard`-category armour modules, which are the one ship-specific module;
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
}

/**
 * Look up a module by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Hpt_PulseLaser_Fixed_Small"`.
 * Leading/trailing whitespace and case are ignored, so the journal's lower-cased
 * form resolves too.
 * @param modules - The catalogue to search — `STANDARD_MODULES`, `INTERNAL_MODULES`,
 * `HARDPOINT_MODULES`, `UTILITY_MODULES`, `ALL_MODULES`, or any subset you have
 * filtered yourself.
 * @returns The matching {@link OutfittingModule}, or `null` if the catalogue holds
 * no module with that symbol.
 * @example
 * ```ts
 * getModuleBySymbol('hpt_pulselaser_fixed_small', HARDPOINT_MODULES)?.class; // -> 1
 * ```
 */
export function getModuleBySymbol(
    symbol: string,
    modules: readonly OutfittingModule[],
): OutfittingModule | null {
    const wanted = symbol.trim().toLowerCase();
    return modules.find((module) => module.symbol.toLowerCase() === wanted) ?? null;
}

/**
 * Every module with a given display name, in catalogue order.
 *
 * @param name - The display name as the registry spells it, e.g. `"Pulse Laser"`.
 * Leading/trailing whitespace and case are ignored, but matching is otherwise exact.
 * @param modules - The catalogue to search (see {@link getModuleBySymbol}).
 * @returns All matching modules — the name is shared across sizes, ratings and (for
 * armour) hulls, so this returns an array. Empty if none match. The input array is
 * not modified.
 * @example
 * ```ts
 * getModulesByName('pulse laser', HARDPOINT_MODULES).length; // -> every size/mount variant
 * ```
 */
export function getModulesByName(
    name: string,
    modules: readonly OutfittingModule[],
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
 * @param modules - The catalogue to search (see {@link getModuleBySymbol}). Armour lives
 * in `STANDARD_MODULES` (and therefore `ALL_MODULES`); other catalogues hold no
 * ship-specific modules and return an empty array.
 * @returns The ship's armour modules — the five bulkhead variants — or an empty
 * array if the catalogue holds none for that hull. The input array is not modified.
 * @remarks
 * Armour is the only module tied to a specific hull; every other module fits by slot
 * size, so "modules for a ship" beyond armour is a question of slot layout, which
 * this registry does not carry.
 * @example
 * ```ts
 * getModulesForShip('Anaconda', STANDARD_MODULES).map((m) => m.name);
 * // -> [ 'Lightweight Alloy', 'Reinforced Alloy', 'Military Grade Composite',
 * //      'Mirrored Surface Composite', 'Reactive Surface Composite' ]
 * ```
 */
export function getModulesForShip(
    ship: string,
    modules: readonly OutfittingModule[],
): OutfittingModule[] {
    const wanted = ship.trim().toLowerCase();
    return modules.filter((module) => module.ship?.toLowerCase() === wanted);
}
