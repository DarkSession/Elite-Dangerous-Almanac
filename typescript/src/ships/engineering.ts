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
 * - `additive` — `final = base + Σ v` (flat reinforcement)
 * - `overwrite` — `final = v` (the value replaces the base)
 *
 * A handful of stats are **percentages of a multiplier** and compound on that
 * multiplier instead, whichever method the recipe names: hull boost and shield boost on
 * `1 + v`, and the four resistances on their damage multiplier `1 − v`. That is why a
 * `+80%` bulkhead engineered by a `+32%` blueprint reads `137.6%` and not `105.6%`, and
 * why a `−20%` kinetic resistance with `+5%` becomes `−14%`.
 *
 * @remarks
 * Every feature names the stat it actually changes. Frontier's own Rapid Fire and High
 * Capacity recipes shorten the **fire interval** (`BurstInterval`) rather than raising
 * the rate of fire, so that is the label they carry; a weapon's combined `rateOfFire`
 * follows from the interval and the burst pattern via `combinedRateOfFire` in
 * `./weapons`. `ShipLoadout` and `getPreEngineeredStats` recompute it for you.
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
import { multiplierBaseForLabel } from './module-stat-labels.js';

/** How a modifier value is applied to a base stat. */
export type ModifierMethod = 'multiplicative' | 'additive' | 'overwrite';

/** One stat a blueprint grade modifies, bounded by the quality roll. */
export interface BlueprintFeature {
    /**
     * The Modifier Label the stat is known by, e.g. `"FSDOptimalMass"`, `"Mass"`.
     *
     * @remarks
     * These are the journal's own labels, with one deliberate exception: the recipes
     * that shorten a weapon's fire interval carry `"BurstInterval"`, the stat they
     * change, where a journal reports the resulting `"RateOfFire"` instead. See
     * [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
     */
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
    /** The in-game display name, e.g. `"Mass Manager"`, `"Auto Loader"`. */
    readonly name: string;
    /**
     * The stat contributions this effect applies (feed to {@link computeModifiers}).
     *
     * @remarks
     * May be **empty** for a purely qualitative effect — one whose game behaviour is a
     * gameplay flag with no numeric magnitude the data exposes (e.g. Auto Loader
     * reloading while firing, Smart Rounds sparing untargeted ships). Such an effect
     * still carries a human-readable {@link ExperimentalEffect.description}.
     */
    readonly modifiers: readonly ExperimentalContribution[];
    /** The materials one application of this effect consumes. */
    readonly materials: readonly EngineeringMaterial[];
    /**
     * A short human-readable note on what the effect does in game — present on effects
     * whose behaviour is not fully captured by {@link ExperimentalEffect.modifiers}
     * (chiefly the qualitative weapon-combat effects with no numeric magnitude).
     */
    readonly description?: string;
}

/** A blueprint's grades, keyed by grade number as a string (`"1"`–`"5"`). */
export type BlueprintGrades = Readonly<Record<string, BlueprintGrade>>;

/**
 * One engineering blueprint — its in-game display name and its per-grade data.
 *
 * @remarks
 * A blueprint is keyed in {@link BLUEPRINTS} by its Frontier `fdname`; this is the record
 * that key maps to. `grades` carries the modifier `features` and material cost of each
 * grade the blueprint defines (a blueprint need not define every grade `1`–`5`).
 */
export interface Blueprint {
    /** The in-game display name, e.g. `"Increased range"`, `"Fuel Scoop — Scoop rate enhanced"`. */
    readonly name: string;
    /**
     * The `BlueprintName` a journal `Loadout` event writes for this recipe, when that is
     * **not** the key it is stored under.
     *
     * Absent on 106 of the 109 blueprints, for two different reasons. It marks a
     * **collision** rather than a rename: a key carries one only when the id the game
     * writes for it is a key some *other* record already answers to. Where the game
     * publishes a spelling nothing else uses, that spelling is simply the key — and where
     * a key is an Operations id, no journal spelling has been observed for it,
     * so there is none to name.
     *
     * It is present on `Scanner_LongRange` and `Scanner_WideAngle`, which the game
     * writes as `Sensor_LongRange` and `Sensor_WideAngle` — the same ids it writes for the
     * sensor suites' own Long Range and Wide Angle, which are different recipes rolling
     * different stats. Two recipes need two records, so the scanner side keeps coriolis's
     * distinct keys and names its journal spelling here. `MC_Overcharged` is the third and
     * the same shape: a multi-cannon's Overcharged also cuts the clip by 3–15%, so coriolis
     * keys it apart from the `Weapon_Overcharged` every other weapon takes, and the game
     * writes `Weapon_Overcharged` for both.
     *
     * **This does not make the id unambiguous on its own** — that is the point of it being
     * shared. `resolveBlueprintForModule` in `ships/blueprint-journal` reads this against
     * a module's menu, which is the only thing that can say which of the two a journal
     * meant.
     */
    readonly journalName?: string;
    /** The blueprint's grades, keyed by grade number as a string (`"1"`–`"5"`). */
    readonly grades: BlueprintGrades;
}

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
        const overwrite = contributions.find((c) => c.method === 'overwrite');
        const multiplierBase = multiplierBaseForLabel(label);
        // A stat the module does not carry cannot be *scaled*, but it can still be set or
        // added to: an overwrite replaces it outright (Double Shot gives a burst size to
        // a weapon that fires one round at a time) and an addition starts from zero
        // (Rapid Fire adds jitter to a weapon that had none) — the same fallbacks
        // Coriolis uses. A purely multiplicative recipe has nothing to work on.
        //
        // A percentage-of-a-multiplier stat is the exception: it has no absent state. No
        // hull boost is a ×1 multiplier — 0% — which is a real base to compound on, and
        // is why a hull reinforcement package can be engineered to a hull boost it never
        // had: the recipe's +24% *is* the bonus.
        const baseless =
            original === undefined &&
            (multiplierBase !== null ||
                overwrite !== undefined ||
                contributions.some((c) => c.method === 'additive'));
        if (original === undefined && !baseless) continue;
        let value = original ?? 0;
        if (multiplierBase === null) {
            // Fold in a stable order — compound the multiplicative factors, then add
            // the additive terms, then let an overwrite (if any) win last.
            for (const c of contributions) if (c.method === 'multiplicative') value *= 1 + c.value;
            for (const c of contributions) if (c.method === 'additive') value += c.value;
        } else {
            // A percentage-of-a-multiplier stat compounds on its multiplier, whatever
            // method the recipe declares: hull boost and shield boost on `1 + v`,
            // a resistance on its damage multiplier `1 - v`.
            let factor = 1 + value / multiplierBase;
            for (const c of contributions) {
                if (c.method === 'overwrite') continue;
                factor *= 1 + (c.value * 100) / multiplierBase;
            }
            value = (factor - 1) * multiplierBase;
        }
        if (overwrite) value = overwrite.value;
        modifiers.push({
            Label: label,
            Value: round6(value),
            // A stat the module never carried has no original value to report — except a
            // percentage-of-a-multiplier stat, whose absence *is* a value: 0%, exactly as
            // a journal reports it.
            ...(original === undefined && multiplierBase === null
                ? {}
                : { OriginalValue: original ?? 0 }),
        });
    }
    return resolveFalloffFromRange(modifiers, base);
}

/**
 * Long Range's "damage falls off from maximum range" is stored upstream as an overwrite
 * in `[0, 1]` — a flag, not a distance — so a literal reading would put the falloff a
 * metre from the muzzle. Resolve it to the weapon's (modified) maximum range, and hold
 * every falloff to that ceiling.
 *
 * A weapon with **no maximum range at all** — a missile rack, a torpedo pylon, a mine
 * launcher, a flak mortar — has nothing for the flag to resolve against, so the leg is
 * dropped rather than shipped as the raw sentinel. Its own `Range` leg is already inert
 * on such a weapon for the same reason; this keeps the pair consistent. Most of those
 * weapons carry no `falloffRange` either, but the few that do keep the stock distance:
 * only the flag is dropped, never a real value, and a recipe that *scales* the falloff
 * (Focused) is untouched by this.
 *
 * @remarks
 * Reference: Coriolis `Module.getFalloff` — `if (mods['fallofffromrange']) return
 * getRange()`, and otherwise `falloff > range ? range : falloff`.
 */
function resolveFalloffFromRange(
    modifiers: EngineeringModifier[],
    base: Readonly<Record<string, number>>,
): EngineeringModifier[] {
    const falloff = modifiers.find((m) => m.Label === 'FalloffRange');
    if (!falloff || falloff.Value === undefined) return modifiers;
    const range =
        modifiers.find((m) => m.Label === 'Range' || m.Label === 'MaximumRange')?.Value ??
        base['Range'] ??
        base['MaximumRange'];
    if (range === undefined) {
        // Still a flag, and nothing to turn it into: drop it. A falloff the weapon really
        // carries has a distance of its own and survives.
        return falloff.Value <= 1 ? modifiers.filter((m) => m !== falloff) : modifiers;
    }
    if (falloff.Value <= 1 || falloff.Value > range) {
        return modifiers.map((m) => (m === falloff ? { ...m, Value: round6(range) } : m));
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
