/**
 * Outfitting-module **stats** — the numbers behind the module registry: mass,
 * power, and the per-group performance figures that drive calculations.
 *
 * This module is **data-free**: it holds the {@link ModuleStats} record shape and
 * {@link getModuleStats}. The numbers live in sibling catalogues, one per Frontier
 * outfitting category, keyed by the **same `symbol`** as the matching registry in
 * `./modules-*` — join the two on `symbol` to pair a module's identity with its
 * stats:
 *
 * | Module | Export |
 * | --- | --- |
 * | `./module-stats-standard` | `STANDARD_MODULE_STATS` |
 * | `./module-stats-internal` | `INTERNAL_MODULE_STATS` |
 * | `./module-stats-hardpoint` | `HARDPOINT_MODULE_STATS` |
 * | `./module-stats-utility` | `UTILITY_MODULE_STATS` |
 * | `./module-stats-all` | `ALL_MODULE_STATS` |
 *
 * Every record carries `symbol` and a display `name`; the performance fields are
 * optional — a module carries only the stats that apply to it. `restrictedToShips`
 * appears on the few non-armour modules limited to particular hulls. Masses are
 * tonnes, power is megawatts, ranges are light-years. Weapon combat stats (damage,
 * falloff, breach, …) are intentionally not carried.
 *
 * Data from EDCD/coriolis-data; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

/**
 * The stats of one outfitting module, keyed by its Frontier `symbol`.
 *
 * @remarks
 * A sparse record: only the fields relevant to the module's group are present. The
 * three `*Multiplier` fields are **group-dependent** — a thruster's speed multiplier
 * or a shield generator's strength multiplier at the corresponding hull mass.
 */
export interface ModuleStats {
    /** Internal identifier, matching the registry's {@link OutfittingModule.symbol}. */
    readonly symbol: string;
    /**
     * Display name, e.g. `"Frame Shift Drive"` — the registry's
     * {@link OutfittingModule.name}, repeated here so a stats record reads on its own.
     * Not unique (a name is shared across sizes and ratings).
     */
    readonly name: string;
    /**
     * The hull symbol(s) a module is restricted to, when it is ship-specific — e.g.
     * `["Explorer_NX"]` for the Python Mk II's MkII Gravity Optimised thrusters.
     *
     * @remarks
     * Present only on the handful of non-armour modules limited to particular hulls.
     * Armour is ship-specific too, but that restriction lives in the registry
     * ({@link OutfittingModule.ship} / {@link getModulesForShip}) and is not repeated
     * here. Symbols match {@link Ship.symbol}.
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
 * Look up a module's stats by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Int_Hyperdrive_Size5_Class5"`.
 * Leading/trailing whitespace and case are ignored, so the journal's lower-cased
 * form (`"int_hyperdrive_size5_class5"`) resolves too.
 * @param catalogue - The stats catalogue to search — `STANDARD_MODULE_STATS`,
 * `INTERNAL_MODULE_STATS`, `HARDPOINT_MODULE_STATS`, `UTILITY_MODULE_STATS`,
 * `ALL_MODULE_STATS`, or any subset.
 * @returns The matching {@link ModuleStats}, or `null` if the catalogue holds no
 * stats for that symbol (e.g. ship-specific armour, which is not carried here).
 * @example
 * ```ts
 * getModuleStats('int_hyperdrive_size5_class5', STANDARD_MODULE_STATS)?.optMass; // -> 1050
 * ```
 */
export function getModuleStats(
    symbol: string,
    catalogue: readonly ModuleStats[],
): ModuleStats | null {
    const wanted = symbol.trim().toLowerCase();
    return catalogue.find((m) => m.symbol.toLowerCase() === wanted) ?? null;
}
