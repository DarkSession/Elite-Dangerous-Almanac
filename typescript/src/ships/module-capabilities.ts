/**
 * Data-free capability guards for sparse outfitting-module records.
 *
 * {@link OutfittingModule} represents every outfitting family, so its performance
 * fields are optional. These guards narrow only the stat group a calculation needs;
 * they do not infer identity from a symbol or require an unrelated family label.
 *
 * @example
 * ```ts
 * import { hasFrameShiftDriveJumpStats, hasWeaponDamageStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { weaponMetrics } from '@elite-dangerous-almanac/core/ships/weapons';
 *
 * declare const journalItem: string;
 *
 * const module = getModuleBySymbol(journalItem);
 * if (hasFrameShiftDriveJumpStats(module)) module.maxFuel; // required, in tonnes
 * if (hasWeaponDamageStats(module)) weaponMetrics(module);
 * ```
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';

/** Complete frame-shift-drive constants required by jump and fuel calculations. */
export interface FrameShiftDriveJumpStats extends OutfittingModule {
    /** Optimised mass, in tonnes. Positive for every catalogued drive. */
    readonly optMass: number;
    /** Maximum fuel consumed by one jump, in tonnes. Positive. */
    readonly maxFuel: number;
    /** Rating-dependent linear fuel constant. Positive. */
    readonly fuelMul: number;
    /** Size-dependent fuel exponent. Positive. */
    readonly fuelPower: number;
}

/** Complete power-plant output and heat-efficiency capability. */
export interface PowerGenerationStats extends OutfittingModule {
    /** Power generated, in megawatts. Non-negative. */
    readonly powerCapacity: number;
    /** Dimensionless heat-efficiency factor; positive, and lower runs cooler. */
    readonly heatEfficiency: number;
}

/** All three power-distributor capacitor capacities and recharge rates. */
export interface PowerDistributorStats extends OutfittingModule {
    /** WEP capacitor capacity, in megajoules. Non-negative. */
    readonly weaponsCapacity: number;
    /** WEP recharge rate, in megajoules per second. Non-negative. */
    readonly weaponsRecharge: number;
    /** ENG capacitor capacity, in megajoules. Non-negative. */
    readonly enginesCapacity: number;
    /** ENG recharge rate, in megajoules per second. Non-negative. */
    readonly enginesRecharge: number;
    /** SYS capacitor capacity, in megajoules. Non-negative. */
    readonly systemsCapacity: number;
    /** SYS recharge rate, in megajoules per second. Non-negative. */
    readonly systemsRecharge: number;
}

/** A complete three-point performance curve over hull mass. */
export interface MassCurveStats extends OutfittingModule {
    /** Optimised hull mass, in tonnes. Positive. */
    readonly optMass: number;
    /** Minimum curve mass, in tonnes. Positive. */
    readonly minMass: number;
    /** Maximum curve mass, in tonnes. Positive. */
    readonly maxMass: number;
    /** Dimensionless performance multiplier at `optMass`. Positive. */
    readonly optMultiplier: number;
    /** Dimensionless minimum performance multiplier, reached at `maxMass`. Positive. */
    readonly minMultiplier: number;
    /** Dimensionless maximum performance multiplier, reached at `minMass`. Positive. */
    readonly maxMultiplier: number;
}

/** Both shield regeneration rates exposed by a generator. */
export interface ShieldRegenerationStats extends OutfittingModule {
    /** Normal regeneration rate, in megajoules per second. Non-negative. */
    readonly shieldRegenRate: number;
    /** Broken-shield regeneration rate, in megajoules per second. Non-negative. */
    readonly shieldBrokenRegenRate: number;
}

/** The concrete damage capability shared by hardpoint weapons and tools. */
export interface WeaponDamageStats extends OutfittingModule {
    /** Damage per round, or per second for continuous-fire weapons. Non-negative. */
    readonly damage: number;
}

function hasNumberStats<K extends keyof OutfittingModule>(
    module: OutfittingModule,
    fields: readonly K[],
): boolean {
    return fields.every((field) => typeof module[field] === 'number');
}

/**
 * Test for complete frame-shift-drive jump constants.
 *
 * @param module - A catalogue result or custom sparse record, including `null`.
 * @returns Whether all fields in {@link FrameShiftDriveJumpStats} are numeric.
 * @example
 * ```ts
 * import type { OutfittingModule } from '@elite-dangerous-almanac/core/ships/modules';
 * import { singleJumpRange } from '@elite-dangerous-almanac/core/ships/jump-range';
 * import { hasFrameShiftDriveJumpStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
 *
 * declare const record: OutfittingModule | null;
 *
 * if (hasFrameShiftDriveJumpStats(record)) singleJumpRange(500, record.maxFuel, record);
 * ```
 */
export function hasFrameShiftDriveJumpStats(
    module: OutfittingModule | null | undefined,
): module is FrameShiftDriveJumpStats {
    return !!module && hasNumberStats(module, ['optMass', 'maxFuel', 'fuelMul', 'fuelPower']);
}

/**
 * Test for complete power-generation stats.
 *
 * @param module - A catalogue result or custom sparse record, including `null`.
 * @returns Whether both fields in {@link PowerGenerationStats} are numeric.
 * @example
 * ```ts
 * import type { OutfittingModule } from '@elite-dangerous-almanac/core/ships/modules';
 * declare const record: OutfittingModule | null;
 *
 * import { hasPowerGenerationStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
 *
 * if (hasPowerGenerationStats(record)) record.powerCapacity; // MW
 * ```
 */
export function hasPowerGenerationStats(
    module: OutfittingModule | null | undefined,
): module is PowerGenerationStats {
    return !!module && hasNumberStats(module, ['powerCapacity', 'heatEfficiency']);
}

/**
 * Test for all three power-distributor capacitor stat pairs.
 *
 * @param module - A catalogue result or custom sparse record, including `null`.
 * @returns Whether every field in {@link PowerDistributorStats} is numeric.
 * @example
 * ```ts
 * import type { OutfittingModule } from '@elite-dangerous-almanac/core/ships/modules';
 * declare const record: OutfittingModule | null;
 *
 * import { hasPowerDistributorStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
 *
 * if (hasPowerDistributorStats(record)) record.weaponsRecharge; // MJ/s
 * ```
 */
export function hasPowerDistributorStats(
    module: OutfittingModule | null | undefined,
): module is PowerDistributorStats {
    return (
        !!module &&
        hasNumberStats(module, [
            'weaponsCapacity',
            'weaponsRecharge',
            'enginesCapacity',
            'enginesRecharge',
            'systemsCapacity',
            'systemsRecharge',
        ])
    );
}

/**
 * Test for a complete three-point hull-mass performance curve.
 *
 * @param module - A catalogue result or custom sparse record, including `null`.
 * @returns Whether every field in {@link MassCurveStats} is numeric. Both thrusters
 * and shield generators satisfy this capability.
 * @example
 * ```ts
 * import type { OutfittingModule } from '@elite-dangerous-almanac/core/ships/modules';
 * declare const record: OutfittingModule | null;
 *
 * import { hasMassCurveStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
 *
 * if (hasMassCurveStats(record)) record.optMultiplier; // dimensionless
 * ```
 */
export function hasMassCurveStats(
    module: OutfittingModule | null | undefined,
): module is MassCurveStats {
    return (
        !!module &&
        hasNumberStats(module, [
            'optMass',
            'minMass',
            'maxMass',
            'optMultiplier',
            'minMultiplier',
            'maxMultiplier',
        ])
    );
}

/**
 * Test for both shield regeneration rates.
 *
 * @param module - A catalogue result or custom sparse record, including `null`.
 * @returns Whether both fields in {@link ShieldRegenerationStats} are numeric.
 * @example
 * ```ts
 * import type { OutfittingModule } from '@elite-dangerous-almanac/core/ships/modules';
 * declare const record: OutfittingModule | null;
 *
 * import { hasShieldRegenerationStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
 *
 * if (hasShieldRegenerationStats(record)) record.shieldRegenRate; // MJ/s
 * ```
 */
export function hasShieldRegenerationStats(
    module: OutfittingModule | null | undefined,
): module is ShieldRegenerationStats {
    return !!module && hasNumberStats(module, ['shieldRegenRate', 'shieldBrokenRegenRate']);
}

/**
 * Test for a concrete weapon/tool damage figure.
 *
 * @param module - A catalogue result or custom sparse record, including `null`.
 * @returns Whether `damage` is numeric, narrowing to {@link WeaponDamageStats}.
 * Other firing fields stay optional because continuous-fire and ammunition-free
 * weapons legitimately omit different stats.
 * @example
 * ```ts
 * import type { OutfittingModule } from '@elite-dangerous-almanac/core/ships/modules';
 * declare const record: OutfittingModule | null;
 *
 * import { hasWeaponDamageStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
 * import { weaponMetrics } from '@elite-dangerous-almanac/core/ships/weapons';
 *
 * if (hasWeaponDamageStats(record)) weaponMetrics(record);
 * ```
 */
export function hasWeaponDamageStats(
    module: OutfittingModule | null | undefined,
): module is WeaponDamageStats {
    return !!module && typeof module.damage === 'number';
}
