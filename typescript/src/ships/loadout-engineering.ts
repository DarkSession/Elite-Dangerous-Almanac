/**
 * Internal catalogue adapters used by the loadout facade and fitted-module handle.
 *
 * @internal
 */

import { BLUEPRINTS } from './blueprints.js';
import {
    blueprintTargets,
    experimentalTarget,
    moduleEngineeringTarget,
} from './engineering-compatibility.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import type { AvailableBlueprint } from './ship-loadout.js';

/** Journal modifier label → catalogue field holding its base value. */
const STAT_LABELS: readonly (readonly [string, keyof OutfittingModule])[] = [
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

/** Resolve a module's complete catalogue record across every category. @internal */
export function statFor(item: string): OutfittingModule | null {
    return getModuleBySymbol(item, ALL_MODULES);
}

/** Convert catalogue stats to journal modifier labels. @internal */
export function baseStats(stats: OutfittingModule): Record<string, number> {
    const base: Record<string, number> = {};
    for (const [label, field] of STAT_LABELS) {
        const value = stats[field];
        if (typeof value === 'number') base[label] = value;
    }
    return base;
}

/** Modifier labels absent from the base stats carried by a module. @internal */
export function missingBaseLabels(
    base: Readonly<Record<string, number>>,
    features: readonly { readonly label: string }[],
    experimental?: readonly { readonly label: string }[],
): string[] {
    return [
        ...new Set(
            [...features, ...(experimental ?? [])]
                .map((feature) => feature.label)
                .filter((label) => base[label] === undefined),
        ),
    ];
}

/** Blueprints whose complete modifiers can be computed for a module. @internal */
export function availableBlueprintsFor(item: string): AvailableBlueprint[] {
    const target = moduleEngineeringTarget(item);
    const stats = statFor(item);
    if (!stats) return [];
    const base = baseStats(stats);
    const available: AvailableBlueprint[] = [];
    for (const fdname of Object.keys(BLUEPRINTS)) {
        if (!blueprintTargets(fdname)?.includes(target)) continue;
        const grades = Object.entries(BLUEPRINTS[fdname]!.grades)
            .filter(([, grade]) => missingBaseLabels(base, grade.features).length === 0)
            .map(([grade]) => Number(grade))
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
        if (grades.length > 0) available.push({ fdname, grades });
    }
    return available;
}

/** Experimental effects whose complete modifiers can be computed for a module. @internal */
export function availableExperimentalsFor(item: string): string[] {
    const target = moduleEngineeringTarget(item);
    const stats = statFor(item);
    if (!stats) return [];
    const base = baseStats(stats);
    return Object.keys(EXPERIMENTAL_EFFECTS).filter((fdname) => {
        const effect = EXPERIMENTAL_EFFECTS[fdname];
        return (
            experimentalTarget(fdname) === target &&
            effect !== undefined &&
            missingBaseLabels(base, effect.modifiers).length === 0
        );
    });
}
