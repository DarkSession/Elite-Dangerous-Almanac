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
 * Split from `./pre-engineered.js` on purpose: reading the catalogue costs one small
 * data file, while resolving stats pulls in every module record. Consumers who only list
 * variants should not pay for the module catalogues.
 * A journal or SLEF module can instead be classified with
 * {@link identifyPreEngineeredVariant}: it matches the article's reported stat signature
 * and composes an experimental effect added after purchase before comparing values.
 *
 * **What is resolved, and what is not.** The module catalogues carry the mechanical
 * stats (mass, integrity, power, capacities, optimal mass), the defence stats and the
 * weapon stats, so almost every variant resolves in full — a pre-engineered rail gun
 * gets its damage, ranges and clip as well as its mass and power draw. Every variant in
 * the catalogue resolves today; a label that stopped resolving would be reported by
 * {@link unresolvedModifiers} rather than silently dropped.
 *
 * @packageDocumentation
 */

import { computeModifiers, type BlueprintFeature } from './engineering.js';
import { getExperimentalEffect } from './experimental-effects.js';
import {
    baseStats,
    capabilityValueForLabel,
    fieldForLabel,
    scaleForLabel,
} from './internal/module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import {
    getPreEngineeredVariants,
    type PreEngineeredModifier,
    type PreEngineeredVariant,
} from './pre-engineered.js';
import type { EngineeringModifier, LoadoutModule } from './slef.js';
import { combinedRateOfFire } from './weapons.js';
import { scaleDamageComponents } from './internal/damage-components.js';
import { normalizeKey } from '../internal/registry-index.js';

/** A pre-engineered modifier is a fixed article, so its min and max are the same value. */
function asFeatures(modifiers: readonly PreEngineeredModifier[]): BlueprintFeature[] {
    return modifiers.map((m) => ({
        label: m.label,
        method: m.method,
        min: m.value,
        max: m.value,
    }));
}

/** Compute a variant's fixed block together with an experimental added to the article. */
function modifiersWithExperimental(
    variant: PreEngineeredVariant,
    experimental?: string,
): EngineeringModifier[] | null {
    const module = getModuleBySymbol(variant.symbol, ALL_MODULES);
    const effectName = experimental ?? variant.experimental;
    if (!module || (!variant.modifiers?.length && effectName === undefined)) return null;
    const effect = effectName === undefined ? undefined : getExperimentalEffect(effectName);
    if (effectName !== undefined && !effect) return null;
    return computeModifiers(
        baseStats(module),
        asFeatures(variant.modifiers ?? []),
        1,
        effect ?? undefined,
    );
}

/**
 * The journal-style modifiers a pre-engineered variant applies to its base module.
 *
 * Includes the variant's baked experimental effect. Only labels the module catalogues
 * carry a base value for can be computed; unsupported hand-set labels are listed by
 * {@link unresolvedModifiers}. The result is the same shape a journal `Loadout` reports
 * under `Engineering.Modifiers`, so it can be used to construct one.
 *
 * @param variant - A pre-engineered variant.
 * @returns One modifier per computable label, or an empty array when the variant carries
 * no stat block (every `mercenary` row) or its symbol is unknown.
 *
 * @example
 * ```ts
 * import { getPreEngineeredByBlueprint } from '@elite-dangerous-almanac/core/ships/pre-engineered';
 * import { getPreEngineeredModifiers } from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';
 *
 * const [railgun] = getPreEngineeredByBlueprint('Weapon_HighCapacity');
 * if (railgun) getPreEngineeredModifiers(railgun);
 * // -> [{ Label: 'Mass', Value: 2.85, OriginalValue: 1.5 }, ...]
 * ```
 */
export function getPreEngineeredModifiers(variant: PreEngineeredVariant): EngineeringModifier[] {
    return modifiersWithExperimental(variant) ?? [];
}

/** Numeric equality at the precision of Frontier's journal float values. */
function sameJournalNumber(actual: number, expected: number): boolean {
    return Math.abs(actual - expected) <= Math.max(1e-5, Math.abs(expected) * 1e-6);
}

/** One stable comparison key for recipe and journal spellings of the same stat. */
function modifierKey(modifier: EngineeringModifier, module: OutfittingModule): string {
    return (
        fieldForLabel(modifier.Label, module) ??
        `label:${normalizeKey(modifier.Label, 'ShipLoadout.fromLoadout: module.Engineering.Modifiers[].Label')}`
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

/**
 * Identify the fixed pre-engineered/reward variant described by a fitted loadout module.
 *
 * Matching uses the reported post-engineering stat values rather than trusting the
 * blueprint tuple alone: reward variants carry hand-set values that an ordinary roll of
 * the named blueprint does not reproduce. A captured experimental effect is composed
 * with each candidate before comparison, because some fixed articles accept an effect
 * after purchase (the V1 frame-shift drives are the common example).
 *
 * Frontier journals omit some derived modifiers and older captures can predate a newly
 * established stat, so one predicted value may be absent. Every predicted value the
 * capture *does* state must agree within journal float noise, and all but at most one must
 * be present. Ambiguous or incomplete evidence returns `null` rather than guessing.
 * Variants without a published stat block cannot be identified this way.
 *
 * @param module - A module from a journal `Loadout` event or SLEF export.
 * @returns The uniquely matching catalogue variant, or `null` when the stats do not
 * identify one.
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
    if (!engineering?.Modifiers?.length) return null;
    const stock = getModuleBySymbol(module.Item, ALL_MODULES);
    if (!stock) return null;

    const actualByKey = new Map<string, EngineeringModifier>();
    for (const modifier of engineering.Modifiers) {
        actualByKey.set(modifierKey(modifier, stock), modifier);
    }
    const capturedExperimental = normalizeKey(
        engineering.ExperimentalEffect,
        'ShipLoadout.fromLoadout: module.Engineering.ExperimentalEffect',
    );
    const matches: PreEngineeredVariant[] = [];
    for (const candidate of getPreEngineeredVariants(module.Item)) {
        if (!candidate.modifiers?.length) continue;
        if (
            candidate.experimental !== undefined &&
            candidate.experimental.toLowerCase() !== capturedExperimental
        ) {
            continue;
        }
        const expected = modifiersWithExperimental(candidate, engineering.ExperimentalEffect);
        if (!expected?.length) continue;
        let matched = 0;
        let disagrees = false;
        for (const predicted of expected) {
            const actual = actualByKey.get(modifierKey(predicted, stock));
            if (!actual) continue;
            if (!sameModifier(actual, predicted)) {
                disagrees = true;
                break;
            }
            matched++;
        }
        if (!disagrees && matched >= Math.max(1, expected.length - 1)) matches.push(candidate);
    }
    return matches.length === 1 ? matches[0]! : null;
}

/**
 * The labels a variant modifies that cannot be computed for its particular base module.
 *
 * This includes labels the catalogues do not model at all and known fields whose base
 * value is absent from this particular module. Reported rather than dropped so a consumer
 * can distinguish "this variant changes nothing else" from "this catalogue cannot say".
 * Empty for every variant in the catalogue today.
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
 * A variant with no stat block (every `mercenary` row) resolves to the base record
 * unchanged, which is the honest answer — the pre-engineering those arrive with is not
 * published anywhere, so the catalogue does not guess at it.
 *
 * @param variant - A pre-engineered variant.
 * @returns The resolved module record, or `null` when the variant's symbol is not in the
 * module catalogues.
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
        return module;
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
