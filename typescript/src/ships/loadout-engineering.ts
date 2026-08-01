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
import { baseStats } from './module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import type { AvailableBlueprint } from './ship-loadout.js';

export { baseStats };

/** Resolve a module's complete catalogue record across every category. @internal */
export function statFor(item: string): OutfittingModule | null {
    return getModuleBySymbol(item, ALL_MODULES);
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
