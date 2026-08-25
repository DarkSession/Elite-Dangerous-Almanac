/**
 * Resolving a **pre-engineered variant into a fittable module** — the base module's
 * catalogue record with the variant's hand-set stat changes applied.
 *
 * A {@link PreEngineeredVariant} on its own is a pairing, not a module: it names the
 * base `symbol` and the engineering baked into it. To build a ship with one you need the
 * resolved article — mass, power draw, integrity and the rest as the variant actually
 * arrives, not as the stock module leaves the shipyard. That is what
 * {@link getPreEngineeredStats} returns.
 *
 * This module imports every module record to resolve stats. Its resolver is 362.4 KiB
 * minified in a consumer bundle; the complete runtime API is 395.6 KiB (43.1 KiB
 * gzipped). Consumers that only list variants can import `./pre-engineered.js` without
 * these module catalogues.
 * A journal or SLEF module can instead be classified with
 * {@link identifyPreEngineeredVariant}: it matches a reward article's reported stat signature
 * and composes an experimental effect added after purchase before comparing values. A Mercenary
 * article is identified by its Mercenary-only blueprint, including after later grade upgrades.
 *
 * **What is resolved, and what is not.** The module catalogues carry the mechanical
 * stats (mass, integrity, power, capacities, optimal mass), defence stats and weapon
 * stats. {@link unresolvedModifiers} reports any unresolvable label instead of dropping
 * it.
 *
 * @packageDocumentation
 */

import { computeModifiers } from './engineering.js';
import { getExperimentalEffect } from './experimental-effects.js';
import {
    baseStats,
    capabilityValueForLabel,
    fieldForLabel,
    labelsForDamageType,
    scaleForLabel,
} from './internal/module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import { getPreEngineeredVariants, type PreEngineeredVariant } from './pre-engineered.js';
import type { EngineeringModifier, LoadoutModule } from './slef.js';
import { combinedRateOfFire } from './weapons.js';
import { scaleDamageComponents } from './internal/damage-components.js';
import { fixedModifierFeatures } from './internal/fixed-modifier-features.js';
import { normalizeKey } from '../internal/registry-index.js';
import { requireStringIfPresent } from '../internal/argument-guards.js';
import { journalModifiersFor } from './internal/loadout-engineering.js';

/** Highest engineering grade Frontier reports for any module blueprint. */
const MAX_ENGINEERING_GRADE = 5;

/** Compute a variant's fixed block together with an experimental added to the article. */
function modifiersWithExperimental(
    variant: PreEngineeredVariant,
    experimental?: string | null,
): EngineeringModifier[] | null {
    const module = getModuleBySymbol(variant.symbol, ALL_MODULES);
    const effectName = experimental === undefined ? variant.experimental : experimental;
    if (!module || (!variant.modifiers?.length && effectName == null)) return null;
    const effect = effectName == null ? undefined : getExperimentalEffect(effectName);
    if (effectName !== null && effectName !== undefined && !effect) return null;
    return computeModifiers(
        baseStats(module),
        fixedModifierFeatures(variant.modifiers ?? []),
        1,
        effect ?? undefined,
    );
}

/**
 * The primitive fixed modifiers a pre-engineered variant applies to its base module.
 *
 * Includes the variant's baked experimental effect. Only labels the module catalogues
 * carry a base value for can be computed; unsupported hand-set labels are listed by
 * {@link unresolvedModifiers}. Labels remain in their recipe form, so burst-pattern
 * internals such as `BurstInterval` are not converted into a journal's derived
 * `RateOfFire` and `DamagePerSecond`; use {@link getPreEngineeredStats} when the resolved
 * module stats are required.
 *
 * @param variant - A pre-engineered variant.
 * @returns One modifier per computable label, or an empty array when the variant carries
 * no stat block (every `mercenary` row) or its symbol is unknown.
 *
 * @example
 * ```ts
 * import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 * import { getPreEngineeredModifiers } from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';
 *
 * const railgun = getPreEngineeredVariants('Hpt_Railgun_Fixed_Medium')
 *     .find((variant) => variant.blueprint === 'Weapon_HighCapacity');
 * if (railgun) getPreEngineeredModifiers(railgun);
 * // -> [{ Label: 'Mass', Value: 2.85, OriginalValue: 1.5 }, ...]
 * ```
 */
export function getPreEngineeredModifiers(variant: PreEngineeredVariant): EngineeringModifier[] {
    return modifiersWithExperimental(variant) ?? [];
}

/** Translate a variant and the effect present in a capture to journal-shaped modifiers. */
function journalModifiersWithExperimental(
    variant: PreEngineeredVariant,
    experimental?: string | null,
): EngineeringModifier[] {
    const module = getModuleBySymbol(variant.symbol, ALL_MODULES);
    if (!module) return [];
    const modifiers = journalModifiersFor(
        module,
        modifiersWithExperimental(variant, experimental) ?? [],
    );
    const effectName = experimental === undefined ? variant.experimental : experimental;
    const damageDistribution = effectName
        ? getExperimentalEffect(effectName)?.damageDistribution
        : undefined;
    if (!damageDistribution) return modifiers;
    for (const type of ['kinetic', 'thermal', 'explosive', 'absolute'] as const) {
        const value = damageDistribution[type];
        const label = labelsForDamageType(type)[0];
        if (value === undefined || label === undefined) continue;
        modifiers.push({
            Label: label,
            Value: value * scaleForLabel(label),
            OriginalValue: (module.damageDistribution?.[type] ?? 0) * scaleForLabel(label),
        });
    }
    return modifiers;
}

/**
 * The journal-shaped fixed modifiers a pre-engineered variant reports when fitted.
 *
 * Primitive recipe labels are translated to the labels a `Loadout` event uses for the
 * variant's exact base module. A baked damage conversion is expanded into the journal's
 * per-damage-type modifiers. Festive variants therefore resolve through the same path as
 * every other fixed article.
 *
 * @param variant - A pre-engineered variant.
 * @returns Its computable fixed modifiers in journal representation, or an empty array
 * when its symbol is unknown or no fixed stat block is published.
 *
 * @example
 * ```ts
 * import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 * import { getPreEngineeredJournalModifiers } from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';
 *
 * const red = getPreEngineeredVariants('Hpt_FlakMortar_Turret_Medium')
 *     .find((variant) => variant.blueprint === 'Decorative_Red')!;
 * getPreEngineeredJournalModifiers(red);
 * // -> [{ Label: 'DamagePerSecond', Value: 0.17, OriginalValue: 17 }, { Label: 'Damage', Value: 0.34, OriginalValue: 34 }]
 * ```
 */
export function getPreEngineeredJournalModifiers(
    variant: PreEngineeredVariant,
): EngineeringModifier[] {
    return journalModifiersWithExperimental(variant);
}

/** Numeric equality at the precision of Frontier's journal float values. */
function sameJournalNumber(actual: number, expected: number): boolean {
    return Math.abs(actual - expected) <= Math.max(1e-5, Math.abs(expected) * 1e-6);
}

/** One stable comparison key for recipe and journal spellings of the same stat. */
function modifierKey(modifier: EngineeringModifier, module: OutfittingModule): string {
    return (
        fieldForLabel(modifier.Label, module) ??
        `label:${normalizeKey(modifier.Label, 'identifyPreEngineeredVariant: module.Engineering.Modifiers[].Label')}`
    );
}

/** Whether a captured modifier agrees with the value a candidate article predicts. */
function sameModifier(actual: EngineeringModifier, expected: EngineeringModifier): boolean {
    if (expected.Value !== undefined) {
        return actual.Value !== undefined && sameJournalNumber(actual.Value, expected.Value);
    }
    // Capability values are localized inconsistently (`Active`, a `$...;` token, or both).
    // Their presence is the durable fact; a candidate capability must remain string-valued.
    return expected.ValueStr !== undefined && actual.ValueStr !== undefined;
}

/** Whether a capture contains enough of one predicted modifier representation. */
function matchesModifierSignature(
    actualByKey: ReadonlyMap<string, EngineeringModifier>,
    expected: readonly EngineeringModifier[],
    module: OutfittingModule,
): boolean {
    let matched = 0;
    for (const predicted of expected) {
        const actual = actualByKey.get(modifierKey(predicted, module));
        if (!actual) continue;
        if (!sameModifier(actual, predicted)) return false;
        matched++;
    }
    return matched >= Math.max(1, expected.length - 1);
}

/**
 * Identify the fixed pre-engineered/reward variant described by a fitted loadout module.
 *
 * Reward matching uses the reported post-engineering stat values rather than trusting the
 * blueprint tuple alone: reward variants carry hand-set values that an ordinary roll of
 * the named blueprint does not reproduce. A captured experimental effect is composed
 * with each candidate before comparison, because some fixed articles accept an effect
 * after purchase (the V1 frame-shift drives are the common example).
 *
 * Mercenary articles are the exception: their bespoke blueprint is available only after
 * buying the article, while their unpublished purchase modifier block cannot identify it.
 * The module symbol and blueprint therefore identify the purchase at grade 1 and after
 * upgrading it through grades 2–5. The fitted grade and experimental effect remain the
 * loadout's current engineering state; the returned variant carries the original purchase
 * grade and Merc Coin price.
 *
 * A locked fixed article is also identified by its unique
 * symbol/blueprint/grade/experimental tuple when a SLEF capture omits the `Modifiers` key
 * entirely. A present empty or partial array does not use this shortcut: older library
 * exports can carry an ordinary roll with the same tuple, and its values must not be
 * replaced by reward stats. A third-party export can omit the array from such a roll;
 * that record is indistinguishable from the fixed article, so the catalogue identity
 * wins.
 *
 * Frontier journals and captures may omit a derived modifier, so one predicted value may
 * be absent. Every stated predicted value must agree within journal float noise, and all
 * but at most one must be present. Ambiguous or incomplete evidence returns `null` rather
 * than guessing.
 * Other variants without a published stat block cannot be identified.
 *
 * @param module - A module from a journal `Loadout` event or SLEF export.
 * @returns The uniquely matching catalogue variant, or `null` when the stats do not
 * identify one.
 * @throws {TypeError} If a field it reads is present and not a string — `module.Item`,
 * a modifier's `Label`, or the block's `BlueprintName` or `ExperimentalEffect`. A module
 * with no engineering block answers `null` before any of them is read.
 *
 * @example
 * ```ts
 * import { identifyPreEngineeredVariant } from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';
 * import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const loadoutEvent: LoadoutEvent;
 *
 * const fitted = loadoutEvent.Modules.find((m) => m.Slot === 'FrameShiftDrive')!;
 * identifyPreEngineeredVariant(fitted)?.acquisition; // -> 'techBroker', or null
 * ```
 */
export function identifyPreEngineeredVariant(module: LoadoutModule): PreEngineeredVariant | null {
    const engineering = module.Engineering;
    if (!engineering) return null;
    // Named here rather than left to the catalogue lookup below, so a wrong-typed field
    // reports the function the caller reached for instead of the one it delegates to.
    requireStringIfPresent(module.Item, 'identifyPreEngineeredVariant: module.Item');
    const stock = getModuleBySymbol(module.Item, ALL_MODULES);
    if (!stock) return null;

    const capturedBlueprint = normalizeKey(
        engineering.BlueprintName,
        'identifyPreEngineeredVariant: module.Engineering.BlueprintName',
    );
    const variants = getPreEngineeredVariants(module.Item);
    const blueprintMatches = variants.filter(
        (candidate) => candidate.blueprint.toLowerCase() === capturedBlueprint,
    );
    const blueprintMatch = blueprintMatches.length === 1 ? blueprintMatches[0]! : null;
    const capturedGrade = engineering.Level;
    if (
        blueprintMatch?.acquisition === 'mercenary' &&
        Number.isInteger(capturedGrade) &&
        capturedGrade >= blueprintMatch.grade &&
        capturedGrade <= MAX_ENGINEERING_GRADE
    ) {
        return blueprintMatch;
    }
    if (engineering.Modifiers === undefined) {
        const capturedExperimental = normalizeKey(
            engineering.ExperimentalEffect,
            'identifyPreEngineeredVariant: module.Engineering.ExperimentalEffect',
        );
        const identityMatches = blueprintMatches.filter(
            (candidate) =>
                candidate.engineeringLocked === true &&
                candidate.grade === capturedGrade &&
                (candidate.experimental === undefined
                    ? capturedExperimental === undefined &&
                      engineering.ExperimentalEffect_Localised === undefined
                    : candidate.experimental.toLowerCase() === capturedExperimental),
        );
        return identityMatches.length === 1 ? identityMatches[0]! : null;
    }
    if (!engineering.Modifiers?.length) return null;

    const actualByKey = new Map<string, EngineeringModifier>();
    for (const modifier of engineering.Modifiers) {
        actualByKey.set(modifierKey(modifier, stock), modifier);
    }
    requireStringIfPresent(
        engineering.ExperimentalEffect,
        'identifyPreEngineeredVariant: module.Engineering.ExperimentalEffect',
    );
    const matches: PreEngineeredVariant[] = [];
    for (const candidate of variants) {
        if (!candidate.modifiers?.length) continue;
        if (candidate.grade !== engineering.Level) continue;
        // The festive articles share the same stat block, so their journal identity is
        // what distinguishes the green, red and yellow variants. Other rewards still
        // match primarily by their hand-set signature because aliases and incomplete
        // captures make the blueprint spelling weaker evidence there.
        if (
            candidate.acquisition === 'eventReward' &&
            (engineering.ExperimentalEffect !== undefined ||
                engineering.ExperimentalEffect_Localised !== undefined ||
                capturedBlueprint !== candidate.blueprint.toLowerCase())
        ) {
            continue;
        }
        const primitive = modifiersWithExperimental(
            candidate,
            engineering.ExperimentalEffect ?? null,
        );
        if (!primitive?.length) continue;
        // Captures in the wild use both Frontier's primitive stat labels and its derived
        // outfitting-panel labels. The setter emits the latter, so accept either complete
        // representation without mixing partial evidence from the two.
        const matched =
            matchesModifierSignature(actualByKey, primitive, stock) ||
            matchesModifierSignature(
                actualByKey,
                journalModifiersWithExperimental(candidate, engineering.ExperimentalEffect ?? null),
                stock,
            );
        if (matched) matches.push(candidate);
    }
    return matches.length === 1 ? matches[0]! : null;
}

/**
 * The labels a variant modifies that cannot be computed for its particular base module.
 *
 * This includes labels the catalogues do not model at all and known fields whose base
 * value is absent from this particular module. Reporting these labels lets a consumer
 * distinguish "this variant changes nothing else" from "this catalogue cannot say".
 * Every catalogue variant returns an empty array.
 *
 * @param variant - A pre-engineered variant.
 * @returns The unresolvable labels, in the variant's own order.
 *
 * @example
 * ```ts
 * import type { PreEngineeredVariant } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 * import { unresolvedModifiers } from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';
 *
 * declare const railgun: PreEngineeredVariant;
 *
 * unresolvedModifiers(railgun); // -> []  (every label it changes resolves)
 * ```
 */
export function unresolvedModifiers(variant: PreEngineeredVariant): string[] {
    const resolved = new Set(getPreEngineeredModifiers(variant).map((modifier) => modifier.Label));
    return (variant.modifiers ?? [])
        .map((modifier) => modifier.label)
        .filter((label) => !resolved.has(label));
}

/**
 * A pre-engineered variant resolved into a module record you can fit.
 *
 * Returns the base module's catalogue record with every stat the variant modifies — and
 * that the catalogue carries — replaced by its engineered value. `symbol`, `name`,
 * `class`, `rating` and `cost` are the base module's throughout: a pre-engineered
 * variant is the same article with different numbers, not a different module. A final
 * variant also carries `engineeringLocked: true`, so fitting the resolved article keeps
 * that restriction.
 * Exact damage components scale with an engineered `damage` value so their proportions
 * and the anti-xeno overlay remain coherent with the resolved scalar.
 *
 * A variant with no stat block (every `mercenary` row) resolves to a copy of the base
 * record with nothing changed, which is the honest answer — the pre-engineering those
 * arrive with is not published anywhere, so the catalogue does not guess at it.
 *
 * @param variant - A pre-engineered variant.
 * @returns The resolved module record, or `null` when the variant's symbol is not in the
 * module catalogues. It is always a record of your own — never the shared catalogue
 * singleton — so you may adjust it before fitting it; its nested values are still the
 * catalogue's frozen ones, so replace them rather than write into them.
 *
 * @example
 * ```ts
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 * import { getPreEngineeredStats } from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';
 *
 * const shard = getPreEngineeredVariants('Hpt_Guardian_ShardCannon_Fixed_Medium')[0]!;
 * const stock = getModuleBySymbol(shard.symbol)!;
 * const fitted = getPreEngineeredStats(shard)!;
 * stock.mass;  // -> 4
 * fitted.mass; // -> 6  (the variant carries Mass +50%)
 * ```
 */
export function getPreEngineeredStats(variant: PreEngineeredVariant): OutfittingModule | null {
    const module = getModuleBySymbol(variant.symbol, ALL_MODULES);
    if (!module) return null;
    if (
        !variant.modifiers?.length &&
        !variant.engineeringLocked &&
        variant.experimental === undefined
    )
        // A copy, not `module` itself. Both return paths hand back a record the caller
        // owns, so whether a write to the result succeeds never depends on which of them
        // ran — and the shared catalogue singleton is never handed out at all.
        return { ...module };
    const modifiers = variant.modifiers ?? [];
    const resolved: { -readonly [K in keyof OutfittingModule]: OutfittingModule[K] } = {
        ...module,
        ...(variant.engineeringLocked ? { engineeringLocked: true } : {}),
    };
    for (const { Label, Value, ValueStr } of getPreEngineeredModifiers(variant)) {
        const field = fieldForLabel(Label, module);
        // Numeric values return to the catalogue's units (a journal reports a resistance
        // as `40` where the catalogue stores `0.4`). A string-valued capability is stored
        // as the boolean it grants.
        if (field && field !== 'damageDistribution' && Value !== undefined) {
            Object.assign(resolved, { [field]: Value / scaleForLabel(Label) });
        } else if (field && ValueStr !== undefined && capabilityValueForLabel(Label) !== null) {
            Object.assign(resolved, { [field]: true });
        }
    }
    const experimentalDamageDistribution = variant.experimental
        ? getExperimentalEffect(variant.experimental)?.damageDistribution
        : undefined;
    if (experimentalDamageDistribution) {
        resolved.damageDistribution = { ...experimentalDamageDistribution };
        delete resolved.damageComponents;
    }
    // A variant that changes the burst pattern changes the rate of fire with it, even
    // though the recipe never names it — the rate is derived from the firing cycle.
    if (
        resolved.rateOfFire !== undefined &&
        !modifiers.some((m) => m.label === 'RateOfFire') &&
        modifiers.some(
            (m) =>
                m.label === 'BurstSize' ||
                m.label === 'BurstRateOfFire' ||
                m.label === 'BurstInterval',
        )
    ) {
        const rate = combinedRateOfFire(resolved);
        if (rate !== undefined) resolved.rateOfFire = rate;
    }
    if (module.damageComponents && !experimentalDamageDistribution) {
        resolved.damageComponents = scaleDamageComponents(
            module.damageComponents,
            module.damage,
            resolved.damage,
        );
    }
    return resolved;
}
