/**
 * The **engineering calculator** — data-free maths that turns a blueprint (grade +
 * quality) and an optional experimental effect into stat modifiers.
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
 * A capability-granting label is the non-numeric exception: Anti-Guardian Zone
 * Resistance produces `{ Label: 'GuardianModuleResistance', ValueStr: 'Active' }` and
 * effective module stats expose the granted boolean. Its source's displayed `+100%` is
 * not folded as a number.
 *
 * A handful of stats are **percentages of a multiplier** and compound on that
 * multiplier instead, whichever method the recipe names: hull boost and shield boost on
 * `1 + v`, and the four resistances on their damage multiplier `1 − v`. That is why a
 * `+80%` bulkhead engineered by a `+32%` blueprint reads `137.6%` and not `105.6%`, and
 * why a `−20%` kinetic resistance with `+5%` becomes `−14%`.
 *
 * @remarks
 * {@link computeModifiers} preserves the primitive labels a recipe actually changes.
 * Frontier's own Rapid Fire and High Capacity recipes shorten `BurstInterval`, for
 * example, rather than directly raising `RateOfFire`. Values use Frontier's float32
 * arithmetic. A journal writer then maps those primitive results to the derived labels
 * Frontier exposes; {@link ShipLoadout.applyBlueprint} performs that presentation step.
 *
 * The catalogues live in `./blueprints` and `./experimental-effects`; this module
 * holds no data. {@link ShipLoadout.applyBlueprint} uses this calculator, then presents
 * its result in Frontier's journal form.
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
 * // -> [{ Label: 'FSDOptimalMass', Value: 7528.039551, OriginalValue: 4670 }]
 * ```
 *
 * @packageDocumentation
 */

import type { EngineeringModifier } from './slef.js';
import type { DamageDistribution } from './modules.js';
import {
    capabilityValueForLabel,
    multiplierBaseForLabel,
    scaleForLabel,
} from './internal/module-stat-labels.js';
import { withPreciseModifierValue } from './internal/engineering-precision.js';

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
     * `"GuardianModuleResistance"` is the other non-scalar case: it grants the
     * `guardianZoneResistance` capability, and its displayed bounds are not arithmetic.
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

/** One grade of a blueprint — the modifiers it applies to a module. */
export interface BlueprintGrade {
    /** The stat modifiers this grade applies (feed to {@link computeModifiers}). */
    readonly features: readonly BlueprintFeature[];
    /**
     * Fixed damage-type split produced at this grade, when the blueprint converts a
     * weapon's damage. Shares are fractions (`0.155` = 15.5%); absent types deal no
     * damage after conversion.
     */
    readonly damageDistribution?: DamageDistribution;
}

/**
 * One experimental (special) effect — the stat modifiers and qualitative behavior it
 * applies. An experimental effect is applied in one step, unlike a blueprint whose
 * grades are rolled up to.
 */
export interface ExperimentalEffect {
    /** The in-game display name, e.g. `"Mass Manager"`, `"Auto Loader"`. */
    readonly name: string;
    /**
     * The stat contributions this effect applies (feed to {@link computeModifiers}).
     *
     * @remarks
     * May be **empty** for a purely qualitative effect — one whose game behavior is a
     * gameplay flag with no numeric magnitude the data exposes (e.g. Auto Loader
     * reloading while firing, Smart Rounds sparing untargeted ships). Such an effect
     * still carries a human-readable {@link ExperimentalEffect.description}.
     *
     * A damage-type conversion is represented separately by
     * {@link ExperimentalEffect.damageDistribution}, because a split is a nested record
     * rather than a scalar contribution.
     */
    readonly modifiers: readonly ExperimentalContribution[];
    /**
     * Fixed damage-type split produced by the effect, when it converts a weapon's damage.
     * Shares are fractions (`0.5` = 50%); absent types deal no damage after conversion.
     */
    readonly damageDistribution?: DamageDistribution;
    /**
     * A short human-readable note on what the effect does in game — present on effects
     * whose behavior is not fully captured by {@link ExperimentalEffect.modifiers}
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
 * A blueprint is keyed in {@link BLUEPRINTS} by its Frontier symbol; this is the record
 * that key maps to. Each member of `grades` carries modifier `features` and an optional
 * converted damage distribution (a blueprint need not define every grade `1`–`5`). A
 * journal id shared by two recipes is resolved against the fitted module by
 * `resolveBlueprintForModule` in `ships/blueprint-journal`.
 */
export interface Blueprint {
    /** The in-game display name, e.g. `"Increased range"`, `"Fuel Scoop — Scoop rate enhanced"`. */
    readonly name: string;
    /** The blueprint's grades, keyed by grade number as a string (`"1"`–`"5"`). */
    readonly grades: BlueprintGrades;
}

/** Serialize a stored float to the six decimal places used by journal modifier values. */
const round6 = (n: number): number => {
    const rounded = Math.round(n * 1e6) / 1e6;
    return Object.is(rounded, -0) ? 0 : rounded;
};

/** Stats whose catalogue ratio is stored as float32 before journal percentage scaling. */
const FLOAT32_SCALED_BASE_LABELS: ReadonlySet<string> = new Set([
    'EngineOptPerformance',
    'EngineMinPerformance',
    'EngineMaxPerformance',
    'ShieldGenStrength',
    'ShieldGenMinStrength',
    'ShieldGenMaxStrength',
]);

/**
 * Compute the primitive stat modifiers a blueprint (and optional experimental effect)
 * produces on a set of base stats.
 *
 * @param base - The module's base stat values, keyed by journal Modifier Label (only
 * the labels present here can be modified — a contribution to an absent stat is
 * skipped). Two labels are also *read* without being modified: `Range` resolves Long
 * Range's falloff flag, and `BurstSize` rounds an engineered clip to whole bursts, so a
 * partial `base` gets a plain round-up on a weapon that fires in bursts.
 * @param grade - A complete blueprint grade (from {@link getBlueprintGrade}). A raw
 * feature list is also accepted for callers synthesising modifiers without a catalogue
 * record.
 * @param quality - The engineering system's shared quality roll, `0`–`1`. Defaults
 * to `1` (best roll). Legacy-engineered modules advanced each attribute independently and
 * cannot be reconstructed from their single reported quality; import their journal-stated
 * modifiers instead.
 * @param experimental - A complete experimental effect (from
 * {@link getExperimentalEffect}), if any. A raw contribution list is also accepted for
 * callers synthesising effects without a catalogue record.
 * @returns One {@link EngineeringModifier} per modified catalogue label. Numeric stats
 * carry the computed `Value` and `OriginalValue`; a granted capability carries
 * `ValueStr`. Recipe-only labels such as `BurstInterval` are deliberately preserved;
 * journal serialization derives the labels Frontier exposes from these results.
 * @throws {RangeError} If `quality` is not a finite number in `[0, 1]`.
 */
export function computeModifiers(
    base: Readonly<Record<string, number>>,
    grade: BlueprintGrade | readonly BlueprintFeature[],
    quality = 1,
    experimental?: ExperimentalEffect | readonly ExperimentalContribution[],
): EngineeringModifier[] {
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new RangeError(`computeModifiers: quality must be a finite number in [0, 1]`);
    }
    const f = Math.fround;
    const roll = f(quality);
    // Gather every contribution per label, keeping each one's own method so a
    // blueprint and an experimental targeting the same label can apply differently.
    const byLabel = new Map<string, { method: ModifierMethod; value: number; stated: boolean }[]>();
    const add = (label: string, method: ModifierMethod, value: number, stated: boolean) => {
        const list = byLabel.get(label) ?? [];
        list.push({ method, value, stated });
        byLabel.set(label, list);
    };
    // `stated` marks a contribution the registry publishes as a number, rather than one
    // interpolated between two of them — see `snapToStatedWhole`.
    const features = 'features' in grade ? grade.features : grade;
    for (const feature of features) {
        const rolledValue =
            roll === 0
                ? feature.min
                : roll === 1
                  ? feature.max
                  : feature.min + (feature.max - feature.min) * roll;
        const value =
            feature.method === 'overwrite'
                ? rolledValue
                : roll === 0 || roll === 1
                  ? f(rolledValue)
                  : f(f(feature.min) + f(f(feature.max - feature.min) * roll));
        add(
            feature.label,
            feature.method,
            value,
            feature.min === feature.max || roll === 0 || roll === 1,
        );
    }
    const experimentalModifiers =
        experimental && 'modifiers' in experimental ? experimental.modifiers : experimental;
    for (const e of experimentalModifiers ?? []) {
        add(e.label, e.method, e.method === 'overwrite' ? e.value : f(e.value), true);
    }

    const modifiers: EngineeringModifier[] = [];
    let clipIsOverwritten = false;
    for (const [label, contributions] of byLabel) {
        const capabilityValue = capabilityValueForLabel(label);
        if (capabilityValue !== null) {
            modifiers.push({ Label: label, ValueStr: capabilityValue });
            continue;
        }
        const baseValue = base[label];
        const overwrite = contributions.find((c) => c.method === 'overwrite');
        const multiplierBase = multiplierBaseForLabel(label);
        const original =
            baseValue === undefined
                ? undefined
                : float32JournalValue(
                      baseValue,
                      multiplierBase,
                      FLOAT32_SCALED_BASE_LABELS.has(label) ? scaleForLabel(label) : 1,
                  );
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
            for (const c of contributions) {
                if (c.method === 'multiplicative') value = f(value * f(1 + f(c.value)));
            }
            for (const c of contributions) {
                if (c.method === 'additive') value = f(value + f(c.value));
            }
        } else {
            // A percentage-of-a-multiplier stat compounds on its multiplier, whatever
            // method the recipe declares: hull boost and shield boost on `1 + v`,
            // a resistance on its damage multiplier `1 - v`.
            let factor = f(1 + value / multiplierBase);
            for (const c of contributions) {
                if (c.method === 'overwrite') continue;
                factor = f(factor * f(1 + f((f(c.value) * 100) / multiplierBase)));
            }
            value = f(f(factor - 1) * multiplierBase);
        }
        if (overwrite) value = overwrite.value;
        // Ammunition is counted in whole rounds. A computed reserve rounds to the nearest
        // round, matching Frontier's stated values; a computed clip is handled below
        // because its rule is to round up to a whole burst. An overwrite is already a
        // published figure rather than a product, so it is left alone.
        if (label === 'AmmoClipSize') {
            if (overwrite) clipIsOverwritten = true;
            else if (original !== undefined && contributions.every((c) => c.stated)) {
                value = snapToStatedWhole(value, original);
            }
        } else if (label === 'AmmoMaximum' && !overwrite) {
            value = Math.round(value);
        }
        modifiers.push(
            withPreciseModifierValue(
                {
                    Label: label,
                    Value: round6(value),
                    // A stat the module never carried has no original value to report — except a
                    // percentage-of-a-multiplier stat, whose absence *is* a value: 0%, exactly as
                    // a journal reports it.
                    ...(original === undefined && multiplierBase === null
                        ? {}
                        : { OriginalValue: round6(original ?? 0) }),
                },
                value,
            ),
        );
    }
    const resolved = resolveFalloffFromRange(modifiers, base);
    return clipIsOverwritten ? resolved : roundClipToWholeBursts(resolved, base);
}

/** Recreate the float backing a journal percentage-of-a-multiplier value. */
function float32JournalValue(value: number, multiplierBase: number | null, scale: number): number {
    if (multiplierBase === null) {
        return Math.fround(Math.fround(value / scale) * scale);
    }
    const factor = Math.fround(1 + value / multiplierBase);
    return Math.fround(Math.fround(factor - 1) * multiplierBase);
}

/**
 * Round an engineered clip **up** to a multiple of the burst size: a recipe scales the
 * clip by an arbitrary factor — High Capacity at grade 3 takes a small cannon's 6 rounds
 * to 10.08 — and 10.08 rounds is not something a ship can load.
 *
 * The burst size is the recipe's own where it sets one, and otherwise the weapon's:
 * Double Shot gives a fragment cannon a two-round burst *and* scales the clip in the same
 * roll, so its 3 rounds become 6 rather than the 5 a bare round-up gives, while a Concord
 * Cannon's own three-round burst takes High Capacity's 12.24 to 15 rather than 13.
 *
 * Only a *computed* clip is rounded, and only in the direction the roll already moved it.
 * A stock clip is untouched — the Mk II Plasma Shock Accelerator's 18 rounds are not a
 * whole number of its 4-round bursts, and stay 18 — and so is a clip a recipe **overwrites**
 * or a journal states, since either figure is published rather than computed.
 *
 * @remarks
 * Reference: EDSY, `edsy.js` — "when modifying clip size, round
 * up to a multiple of burst size", `ceil(ammoclip / bstsize) * bstsize`, applied when the
 * blueprint roll is stored. Coriolis rounds the clip up too, without the burst step
 * (`Module.getClip`, "Clip size is always rounded up"), so the two agree wherever a weapon
 * fires one round at a time and EDSY is followed where they differ. Neither registry
 * rounds the reserve, but Frontier's own journal values establish that it is a whole-round
 * count; {@link computeModifiers} therefore rounds a computed reserve to the nearest round.
 */
function roundClipToWholeBursts(
    modifiers: EngineeringModifier[],
    base: Readonly<Record<string, number>>,
): EngineeringModifier[] {
    const clip = modifiers.find((m) => m.Label === 'AmmoClipSize');
    // Nothing to round, and nothing to round *for*: a recipe leg that leaves the clip where
    // it was — High Capacity's grade-1 minimum roll is +0% — is not a reason to move it.
    if (!clip?.Value || clip.Value === clip.OriginalValue) return modifiers;
    const burst = modifiers.find((m) => m.Label === 'BurstSize')?.Value || base['BurstSize'] || 1;
    const rounded = Math.ceil(clip.Value / burst) * burst;
    if (rounded === clip.Value) return modifiers;
    return modifiers.map((m) => (m === clip ? { ...m, Value: rounded } : m));
}

/**
 * Recover the whole magazine a **published** multiplier means, where its stated precision
 * is all that stands between the two.
 *
 * A registry states a multiplier to three or four decimals, so a leg meant to add two
 * thirds is written `0.667`: a 6-round Seeker Missile Rack under Drag Munitions computes
 * 10.002 rounds, and the recipe means 10. That thousandth matters because the clip is then
 * rounded **up** — it would buy a whole extra round, a whole extra *burst* on a burst
 * weapon, and it grows the community-goal Fragment Cannon's shipped magazine from 8 to 10 (its authored `1.6667`
 * scales a 3-round clip to 8.0001).
 *
 * **The clip alone is snapped before its directional round-up.** A reserve uses ordinary
 * nearest-integer rounding after every contribution has been folded, so the same
 * transcription noise disappears there without affecting which way the result moves.
 *
 * Two things keep this from eating a fraction a recipe means:
 *
 * - **The tolerance is what the data's precision is worth**: half a unit in the third
 *   decimal of the multiplier, scaled by the base clip it applies to. That is 0.003 rounds
 *   on a 6-round clip, against the 0.02 that Double Shot's 4.02 really adds — and clips are
 *   small enough (100 rounds at the widest) that the band stays a fraction of a round.
 * - **Only a stated multiplier is snapped.** A quality roll between two published legs is a
 *   real number with no whole magazine behind it: a small multi-cannon at High Capacity
 *   grade 5 and quality 0.07 holds 185.12 rounds, which means 186 and is left to round up.
 *   An overwrite is skipped for the same reason — it is a figure, not a product.
 *
 * Snapping is not rounding: it recovers what the registry published.
 */
function snapToStatedWhole(value: number, base: number): number {
    const whole = Math.round(value);
    return Math.abs(value - whole) <= Math.abs(base) * 5e-4 ? whole : value;
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
 * Combine several material lists into one, summing the counts of any material that
 * appears in more than one list (matched by `symbol`, case-insensitively). Use it to
 * fold a blueprint's cost together with an experimental effect's — the two data modules
 * stay decoupled, so pass in whichever lists you have:
 *
 * @example
 * ```ts
 * import { getBlueprintCost } from '@elite-dangerous-almanac/core/ships/blueprint-costs';
 * import { sumMaterials } from '@elite-dangerous-almanac/core/ships/engineering';
 * import { getExperimentalEffectCost } from '@elite-dangerous-almanac/core/ships/experimental-effect-costs';
 *
 * sumMaterials(
 *   getBlueprintCost('FSD_LongRange', 5)!.materials,
 *   getExperimentalEffectCost('special_fsd_heavy')!,
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
