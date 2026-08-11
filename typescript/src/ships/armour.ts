/**
 * **Armour** — the hull's hit points and the resistances that decide how far they go.
 *
 * A hull starts from its `baseArmour`, which the fitted bulkhead multiplies, and each
 * hull reinforcement package adds a flat number of hit points on top:
 *
 * ```text
 * hitPoints = baseArmour × (1 + hullBoost) + Σ hull reinforcement
 * ```
 *
 * The bulkhead also sets the hull's four resistances, which the reinforcement packages
 * stack onto with diminishing returns — see `./resistances`. Module reinforcement
 * packages protect the *modules* rather than the hull, and are reported separately.
 *
 * This module is data-free. {@link ShipLoadout.armourMetrics} (in `./ship-loadout`)
 * gathers a build's bulkhead and reinforcement packages, post-engineering, and calls
 * {@link armourMetrics} for you.
 *
 * @remarks
 * Reference implementation: EDCD/Coriolis, `src/app/shipyard/Calculations.js`
 * (`armourMetrics`), commit `68c042ca6e3db62372cbbb2077cf972345511712`. The algorithm
 * is ported as fact, not code; credit and licence terms are in [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { armourMetrics } from '@elite-dangerous-almanac/core/ships/armour';
 *
 * armourMetrics({
 *   baseArmour: 525,                                    // Anaconda
 *   bulkhead: { hullBoost: 2.5, kineticResistance: 0.25 }, // reactive composite
 *   reinforcements: [{ hullReinforcement: 390, kineticResistance: 0.025 }],
 * }).hitPoints; // -> 2227.5
 * ```
 *
 * @packageDocumentation
 */

import {
    effectiveHitPoints,
    mapDamageTypes,
    stackArmourResistance,
    type DamageResistances,
    type DamageResistanceParams,
    type DamageType,
    type DamageTypeValues,
} from './resistances.js';

/** The fitted bulkhead's contribution — read straight off its armour module record. */
export interface BulkheadParams extends DamageResistanceParams {
    /**
     * Armour bonus as a fraction of the hull's base armour added on top of it: `0.8`
     * (lightweight alloy) means `baseArmour × 1.8`. Defaults to `0`.
     */
    readonly hullBoost?: number;
}

/** One fitted hull reinforcement package (including the Guardian and meta-alloy ones). */
export interface HullReinforcementParams extends DamageResistanceParams {
    /** Hull hit points added. Defaults to `0`. */
    readonly hullReinforcement?: number;
    /**
     * Extra armour as a fraction of the hull's base armour, when the package has been
     * engineered for it. Defaults to `0`.
     *
     * @remarks
     * A stock reinforcement package has no hull boost — in game the engineering
     * modifier *is* the bonus — so this is only non-zero on a build whose journal
     * carries a `DefenceModifierHealthMultiplier` modifier for the package.
     */
    readonly hullBoost?: number;
}

/** One fitted module reinforcement package. */
export interface ModuleReinforcementParams {
    /** The fraction of module damage the package absorbs (`0.3` = 30%). Defaults to `0`. */
    readonly moduleProtection?: number;
    /** The package's own integrity, which soaks module damage. Defaults to `0`. */
    readonly integrity?: number;
}

/** Everything {@link armourMetrics} needs about a build. */
export interface ArmourInput {
    /** The hull's base armour (`Ship.baseArmour`), in hull points. */
    readonly baseArmour: number;
    /**
     * The fitted bulkhead — an armour module's catalogue record works as-is.
     *
     * @remarks
     * Absent means **no** bulkhead: no armour bonus and no resistances, so the hull
     * reports its bare `baseArmour`. No ship in the game flies like that;
     * `ShipLoadout.armourMetrics()` substitutes the hull's stock lightweight alloy
     * instead, and you should pass the hull's own armour record here to do the same.
     */
    readonly bulkhead?: BulkheadParams | null;
    /** Each fitted, powered hull reinforcement package. Defaults to none. */
    readonly reinforcements?: readonly HullReinforcementParams[];
    /** Each fitted, powered module reinforcement package. Defaults to none. */
    readonly moduleReinforcements?: readonly ModuleReinforcementParams[];
}

/** A build's armour: hit points, where they come from, and what the hull resists. */
export interface ArmourMetrics {
    /** Total hull hit points. */
    readonly hitPoints: number;
    /** What the bulkhead alone gives — `baseArmour × (1 + hullBoost)`. */
    readonly bulkheads: number;
    /** What the hull reinforcement packages add. */
    readonly reinforcement: number;
    /** Effective resistances, bulkhead and reinforcement stacked with diminishing returns. */
    readonly resistances: DamageResistances;
    /**
     * Effective hit points against each damage type — `hitPoints / (1 − resistance)`,
     * the raw damage of that type the hull can soak. `Infinity` where a resistance
     * reaches 100%.
     */
    readonly effectiveHitPoints: DamageTypeValues;
    /** Hit points the module reinforcement packages add to the modules themselves. */
    readonly moduleArmour: number;
    /**
     * The fraction of module damage the module reinforcement packages absorb, stacked
     * multiplicatively (`0.3` = 30%). `0` with none fitted.
     */
    readonly moduleProtection: number;
}

/** Each package's resistance to one damage type, reading an absent field as `0`. */
const reinforcementResistances = (
    sources: readonly HullReinforcementParams[],
    type: DamageType,
): number[] => sources.map((source) => source[`${type}Resistance`] ?? 0);

/**
 * Everything an outfitting screen shows about a build's armour.
 *
 * @param input - The hull's base armour, the fitted bulkhead, and any hull and module
 * reinforcement packages.
 * @returns The {@link ArmourMetrics}.
 * @example
 * ```ts
 * import { armourMetrics } from '@elite-dangerous-almanac/core/ships/armour';
 *
 * const hull = armourMetrics({
 *   baseArmour: 525,
 *   bulkhead: { hullBoost: 0.8, kineticResistance: -0.2, explosiveResistance: -0.4 },
 * });
 * hull.hitPoints;                   // -> 945
 * hull.resistances.kinetic;         // -> -0.2 (lightweight alloy is kinetically weak)
 * hull.effectiveHitPoints.kinetic;  // -> 787.5
 * ```
 */
export function armourMetrics(input: ArmourInput): ArmourMetrics {
    const bulkhead: BulkheadParams = input.bulkhead ?? {};
    const reinforcements = input.reinforcements ?? [];
    const moduleReinforcements = input.moduleReinforcements ?? [];

    const bulkheads = input.baseArmour * (1 + (bulkhead.hullBoost ?? 0));
    const reinforcement = reinforcements.reduce(
        (sum, pack) =>
            sum + (pack.hullReinforcement ?? 0) + input.baseArmour * (pack.hullBoost ?? 0),
        0,
    );
    const hitPoints = bulkheads + reinforcement;

    const resistances: DamageResistances = mapDamageTypes((type) =>
        stackArmourResistance(
            bulkhead[`${type}Resistance`] ?? 0,
            reinforcementResistances(reinforcements, type),
        ),
    );

    return {
        hitPoints,
        bulkheads,
        reinforcement,
        resistances,
        effectiveHitPoints: effectiveHitPoints(hitPoints, resistances),
        moduleArmour: moduleReinforcements.reduce((sum, pack) => sum + (pack.integrity ?? 0), 0),
        moduleProtection:
            1 -
            moduleReinforcements.reduce(
                (product, pack) => product * (1 - (pack.moduleProtection ?? 0)),
                1,
            ),
    };
}
