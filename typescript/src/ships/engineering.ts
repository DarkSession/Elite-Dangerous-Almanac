/**
 * The **engineering calculator** — data-free maths that turns a blueprint (grade +
 * quality) and an optional experimental effect into journal-style stat modifiers.
 *
 * A blueprint feature bounds a modifier by the engineering **quality** roll
 * (`v = min + (max − min) · quality`); an experimental effect adds a fixed
 * contribution. Each contribution names a journal Modifier **Label** and an apply
 * **method**, and {@link computeModifiers} folds every contribution to a Label onto a
 * base value:
 *
 * - `multiplicative` — `final = base · Π(1 + v)` (percentage modifiers compound)
 * - `additive` — `final = base + Σ v` (resistances, flat reinforcement)
 * - `overwrite` — `final = v` (the value replaces the base)
 *
 * The catalogues live in `./blueprints` and `./experimental-effects`; this module
 * holds no data. It is what {@link ShipLoadout.applyBlueprint} uses under the hood.
 *
 * @example
 * ```ts
 * import { computeModifiers } from '@elite-dangerous-almanac/core/ships/engineering';
 * import { getBlueprintGrade } from '@elite-dangerous-almanac/core/ships/blueprints';
 * import { getExperimentalEffect } from '@elite-dangerous-almanac/core/ships/experimental-effects';
 *
 * const mods = computeModifiers(
 *   { FSDOptimalMass: 4670 },
 *   getBlueprintGrade('FSD_LongRange', 5)!,
 *   1,
 *   getExperimentalEffect('special_fsd_heavy')!,
 * );
 * // -> [{ Label: 'FSDOptimalMass', Value: 7528.04, OriginalValue: 4670 }]
 * ```
 *
 * @packageDocumentation
 */

import type { EngineeringModifier } from './slef.js';

/** How a modifier value is applied to a base stat. */
export type ModifierMethod = 'multiplicative' | 'additive' | 'overwrite';

/** One stat a blueprint grade modifies, bounded by the quality roll. */
export interface BlueprintFeature {
    /** The journal Modifier Label, e.g. `"FSDOptimalMass"`, `"Mass"`. */
    readonly label: string;
    /** How the value applies. */
    readonly method: ModifierMethod;
    /** Modifier value at quality `0` (the worst roll). */
    readonly min: number;
    /** Modifier value at quality `1` (the best roll). */
    readonly max: number;
}

/** One stat an experimental effect modifies (a fixed contribution). */
export interface ExperimentalContribution {
    /** The journal Modifier Label. */
    readonly label: string;
    /** How the value applies. */
    readonly method: ModifierMethod;
    /** The contribution value (a fraction for percentage modifiers). */
    readonly value: number;
}

/**
 * One material an engineering step consumes — a blueprint grade's per-roll cost, an
 * experimental effect's per-application cost, or a summed total from {@link sumMaterials}.
 */
export interface EngineeringMaterial {
    /**
     * The material's Frontier symbol, e.g. `"ChemicalManipulators"` — the key into the
     * `materials` domain (`getMaterialBySymbol`) for its own grade and category.
     */
    readonly symbol: string;
    /** Display name, e.g. `"Chemical Manipulators"`. */
    readonly name: string;
    /** How many of this material the step consumes. */
    readonly count: number;
}

/**
 * One material a blueprint grade consumes per roll.
 *
 * @deprecated Use {@link EngineeringMaterial} — the same shape, shared by blueprints and
 * experimental effects. Kept as an alias so existing imports keep working.
 */
export type BlueprintMaterial = EngineeringMaterial;

/** One grade of a blueprint — the modifiers it applies and the materials it costs. */
export interface BlueprintGrade {
    /** The stat modifiers this grade applies (feed to {@link computeModifiers}). */
    readonly features: readonly BlueprintFeature[];
    /**
     * The materials one roll at this grade consumes — possibly empty (a known recipe
     * that costs nothing). Join each `symbol` to the `materials` domain for its grade
     * and category.
     */
    readonly materials: readonly EngineeringMaterial[];
}

/**
 * One experimental (special) effect — the stat modifiers it applies and the materials a
 * single application costs. An experimental effect is applied in one step (one roll),
 * unlike a blueprint whose grades are rolled up to.
 */
export interface ExperimentalEffect {
    /** The stat contributions this effect applies (feed to {@link computeModifiers}). */
    readonly modifiers: readonly ExperimentalContribution[];
    /** The materials one application of this effect consumes. */
    readonly materials: readonly EngineeringMaterial[];
}

/** A blueprint's grades, keyed by grade number as a string (`"1"`–`"5"`). */
export type BlueprintGrades = Readonly<Record<string, BlueprintGrade>>;

/** Round to 6 decimals to shed floating-point noise, matching in-game modifier values. */
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * Compute the journal-style modifiers a blueprint (and optional experimental effect)
 * produce on a module's base stats.
 *
 * @param base - The module's base stat values, keyed by journal Modifier Label (only
 * the labels present here can be modified — a contribution to an absent stat is
 * skipped).
 * @param features - The blueprint grade's features (from {@link getBlueprintGrade}).
 * @param quality - The engineering quality roll, `0`–`1`. Defaults to `1` (best roll).
 * @param experimental - The experimental effect's contributions (from
 * {@link getExperimentalEffect}), if any.
 * @returns One {@link EngineeringModifier} per modified label, each carrying the
 * computed `Value` and the `OriginalValue`.
 * @throws {RangeError} If `quality` is not a finite number in `[0, 1]`.
 */
export function computeModifiers(
    base: Readonly<Record<string, number>>,
    features: readonly BlueprintFeature[],
    quality = 1,
    experimental?: readonly ExperimentalContribution[],
): EngineeringModifier[] {
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new RangeError(`computeModifiers: quality must be a finite number in [0, 1]`);
    }
    const roll = quality;
    // Gather every contribution per label, keeping each one's own method so a
    // blueprint and an experimental targeting the same label can apply differently.
    const byLabel = new Map<string, { method: ModifierMethod; value: number }[]>();
    const add = (label: string, method: ModifierMethod, value: number) => {
        const list = byLabel.get(label) ?? [];
        list.push({ method, value });
        byLabel.set(label, list);
    };
    for (const f of features) add(f.label, f.method, f.min + (f.max - f.min) * roll);
    for (const e of experimental ?? []) add(e.label, e.method, e.value);

    const modifiers: EngineeringModifier[] = [];
    for (const [label, contributions] of byLabel) {
        const original = base[label];
        if (original === undefined) continue; // cannot modify a stat we do not carry
        // Fold in a stable order — compound the multiplicative factors, then add the
        // additive terms, then let an overwrite (if any) win last.
        let value = original;
        for (const c of contributions) if (c.method === 'multiplicative') value *= 1 + c.value;
        for (const c of contributions) if (c.method === 'additive') value += c.value;
        for (const c of contributions) if (c.method === 'overwrite') value = c.value;
        modifiers.push({ Label: label, Value: round6(value), OriginalValue: original });
    }
    return modifiers;
}

/**
 * The number of engineering rolls to complete a single blueprint grade: grade `N` takes
 * `N` rolls (grade 1 → 1 roll, grade 2 → 2 rolls, … grade 5 → 5 rolls). Each roll at a
 * grade consumes that grade's materials, so the total to engineer a module *up to* a
 * grade is the running sum of `rollsForGrade(g) ·` (grade `g`'s materials) for every
 * grade `g` up to the target — what {@link getBlueprintCost} computes.
 *
 * @param grade - The blueprint grade, `1`–`5`.
 * @returns The rolls to complete that grade (equal to the grade number).
 * @throws {RangeError} If `grade` is not an integer from 1 through 5.
 */
export function rollsForGrade(grade: number): number {
    if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
        throw new RangeError(`rollsForGrade: grade must be an integer in [1, 5]`);
    }
    return grade;
}

/**
 * Combine several material lists into one, summing the counts of any material that
 * appears in more than one list (matched by `symbol`, case-insensitively). Use it to
 * fold a blueprint's cost together with an experimental effect's — the two data modules
 * stay decoupled, so pass in whichever lists you have:
 *
 * @example
 * ```ts
 * sumMaterials(
 *   getBlueprintCost('FSD_LongRange', 5)!,
 *   getExperimentalEffectMaterials('special_fsd_heavy')!,
 * );
 * ```
 *
 * @param lists - The material lists to merge; each may be empty.
 * @returns One entry per distinct material, in first-seen order, with summed counts.
 */
export function sumMaterials(
    ...lists: readonly (readonly EngineeringMaterial[])[]
): EngineeringMaterial[] {
    const totals = new Map<string, EngineeringMaterial>();
    for (const list of lists) {
        for (const material of list) {
            const key = material.symbol.toLowerCase();
            const previous = totals.get(key);
            // Keep the first-seen symbol/name; only the counts accumulate.
            totals.set(key, {
                symbol: previous?.symbol ?? material.symbol,
                name: previous?.name ?? material.name,
                count: (previous?.count ?? 0) + material.count,
            });
        }
    }
    return [...totals.values()];
}
