/**
 * The bridge between journal Modifier Labels and the catalogue fields that hold their
 * base values.
 *
 * Its own module so that code needing only the mapping — resolving a pre-engineered
 * variant's stats, say — does not pull in the blueprint and experimental-effect
 * catalogues alongside it.
 *
 * @internal
 */

import type { OutfittingModule } from './modules.js';

/**
 * Journal modifier label → catalogue field holding its base value.
 *
 * Not injective in either direction by design: a module carries one optimal mass, and
 * which label names it depends on the module's kind, so three labels share `optMass`.
 *
 * @internal
 */
export const STAT_LABELS: readonly (readonly [string, keyof OutfittingModule])[] = [
    ['Mass', 'mass'],
    ['Integrity', 'integrity'],
    ['PowerDraw', 'powerDraw'],
    ['BootTime', 'bootTime'],
    ['FSDOptimalMass', 'optMass'],
    ['EngineOptimalMass', 'optMass'],
    ['ShieldGenOptimalMass', 'optMass'],
    ['EngineOptPerformance', 'optMultiplier'],
    ['ShieldGenStrength', 'optMultiplier'],
    ['MaxFuelPerJump', 'maxFuel'],
    ['PowerCapacity', 'powerCapacity'],
    ['HeatEfficiency', 'heatEfficiency'],
    ['EnginesCapacity', 'enginesCapacity'],
    ['EnginesRecharge', 'enginesRecharge'],
    ['SystemsCapacity', 'systemsCapacity'],
    ['SystemsRecharge', 'systemsRecharge'],
    ['WeaponsCapacity', 'weaponsCapacity'],
    ['WeaponsRecharge', 'weaponsRecharge'],
    ['FuelCapacity', 'fuelCapacity'],
    ['CargoCapacity', 'cargoCapacity'],
    ['RegenRate', 'shieldRegenRate'],
    ['BrokenRegenRate', 'shieldBrokenRegenRate'],
    ['DefenceModifierShieldMultiplier', 'shieldBoost'],
];

/** Convert catalogue stats to journal modifier labels. @internal */
export function baseStats(stats: OutfittingModule): Record<string, number> {
    const base: Record<string, number> = {};
    for (const [label, field] of STAT_LABELS) {
        const value = stats[field];
        if (typeof value === 'number') base[label] = value;
    }
    return base;
}

/**
 * The catalogue field a journal modifier label writes back to, or `null` when the
 * catalogue carries no base value for that label (every weapon stat, for instance).
 *
 * @internal
 */
export function fieldForLabel(label: string): keyof OutfittingModule | null {
    return STAT_LABELS.find(([name]) => name === label)?.[1] ?? null;
}
