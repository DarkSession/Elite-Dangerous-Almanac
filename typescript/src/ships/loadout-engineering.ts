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
import { baseStats, fieldForLabel } from './module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import type { OutfittingModule } from './modules.js';
import type { AvailableBlueprint } from './ship-loadout.js';

export { baseStats };

/** The complete catalogue is already part of the loadout facade; index it once. */
const MODULE_BY_SYMBOL: ReadonlyMap<string, OutfittingModule> = new Map(
    ALL_MODULES.map((module) => [module.symbol.toLowerCase(), module]),
);

/** Resolve a module's complete catalogue record across every category. @internal */
export function statFor(item: string): OutfittingModule | null {
    return MODULE_BY_SYMBOL.get(item.trim().toLowerCase()) ?? null;
}

/**
 * Modifier labels a recipe changes that the module carries no base value for — the
 * ones {@link computeModifiers} would have to skip.
 *
 * `overwrite` and `additive` contributions are exempt: the first replaces the stat
 * outright and the second starts from zero, so neither needs a base to scale (Double
 * Shot gives a burst size to a weapon that has none; Rapid Fire adds jitter to a weapon
 * that had none).
 *
 * @internal
 */
export function missingBaseLabels(
    base: Readonly<Record<string, number>>,
    features: readonly { readonly label: string; readonly method?: string }[],
    experimental?: readonly { readonly label: string; readonly method?: string }[],
): string[] {
    const contributions = [...features, ...(experimental ?? [])];
    // An overwrite replaces the stat outright and an addition starts from zero, so
    // neither needs a base value to apply to — as long as the catalogue has somewhere to
    // put the result. A label it models no field for stays uncomputable.
    const baseless = new Set(
        contributions
            .filter(
                (c) =>
                    (c.method === 'overwrite' || c.method === 'additive') &&
                    fieldForLabel(c.label) !== null,
            )
            .map((c) => c.label),
    );
    return [
        ...new Set(
            contributions
                .map((feature) => feature.label)
                .filter((label) => base[label] === undefined && !baseless.has(label)),
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
