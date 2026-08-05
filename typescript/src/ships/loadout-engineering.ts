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
import { baseStats, fieldForLabel, isUnknown } from './module-stat-labels.js';
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
 * Modifier labels a recipe changes that **cannot be answered** for a module — the ones
 * that make {@link ShipLoadout.applyBlueprint} refuse the recipe rather than store it
 * half-applied.
 *
 * A label with no base value is not automatically one of them. The catalogue's rule is
 * that an absent stat means *the module has no such stat* unless the record names it in
 * {@link OutfittingModule.unknownStats}, and a recipe leg on a stat that is not there is
 * simply inert: Long Range scales the shot speed of a weapon that fires a projectile and
 * leaves a beam laser's alone, exactly as the game does. So a label is missing only when
 *
 * - the catalogue models **no field at all** for it, so there would be nowhere to put
 *   the result — an engineered stat this record shape cannot express; or
 * - the record declares that field **unknown**, so a value exists and nobody publishes
 *   it. Nothing can be scaled from an unknown, and guessing would be worse than
 *   refusing.
 *
 * @internal
 */
export function missingBaseLabels(
    stats: OutfittingModule,
    base: Readonly<Record<string, number>>,
    features: readonly { readonly label: string; readonly method?: string }[],
    experimental?: readonly { readonly label: string; readonly method?: string }[],
): string[] {
    const contributions = [...features, ...(experimental ?? [])];
    return [
        ...new Set(
            contributions
                .map((contribution) => contribution.label)
                .filter((label) => {
                    if (base[label] !== undefined) return false;
                    const field = fieldForLabel(label, stats);
                    return field === null || isUnknown(stats, field);
                }),
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
            .filter(([, grade]) => missingBaseLabels(stats, base, grade.features).length === 0)
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
            missingBaseLabels(stats, base, effect.modifiers).length === 0
        );
    });
}
