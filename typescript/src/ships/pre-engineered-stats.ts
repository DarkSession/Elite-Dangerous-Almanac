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
import {
    baseStats,
    capabilityValueForLabel,
    fieldForLabel,
    scaleForLabel,
} from './module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import type { PreEngineeredModifier, PreEngineeredVariant } from './pre-engineered.js';
import type { EngineeringModifier } from './slef.js';
import { combinedRateOfFire } from './weapons.js';

/** A pre-engineered modifier is a fixed article, so its min and max are the same value. */
function asFeatures(modifiers: readonly PreEngineeredModifier[]): BlueprintFeature[] {
    return modifiers.map((m) => ({
        label: m.label,
        method: m.method,
        min: m.value,
        max: m.value,
    }));
}

/**
 * The journal-style modifiers a pre-engineered variant applies to its base module.
 *
 * Only labels the module catalogues carry a base value for can be computed; the rest are
 * listed by {@link unresolvedModifiers}. The result is the same shape a journal
 * `Loadout` reports under `Engineering.Modifiers`, so it can be used to construct one.
 *
 * @param variant - A pre-engineered variant.
 * @returns One modifier per computable label, or an empty array when the variant carries
 * no stat block (every `mercenary` row) or its symbol is unknown.
 *
 * @example
 * ```ts
 * const [railgun] = getPreEngineeredByBlueprint('Weapon_HighCapacity');
 * getPreEngineeredModifiers(railgun);
 * // -> [{ Label: 'Mass', Value: 2.85, OriginalValue: 1.5 }, ...]
 * ```
 */
export function getPreEngineeredModifiers(variant: PreEngineeredVariant): EngineeringModifier[] {
    const module = getModuleBySymbol(variant.symbol, ALL_MODULES);
    if (!module || !variant.modifiers?.length) return [];
    return computeModifiers(baseStats(module), asFeatures(variant.modifiers));
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
 * const [shard] = getPreEngineeredVariants('Hpt_Guardian_ShardCannon_Fixed_Medium');
 * const stock = getModuleBySymbol(shard.symbol)!;
 * const fitted = getPreEngineeredStats(shard)!;
 * stock.mass;  // -> 4
 * fitted.mass; // -> 6  (the variant carries Mass +50%)
 * ```
 */
export function getPreEngineeredStats(variant: PreEngineeredVariant): OutfittingModule | null {
    const module = getModuleBySymbol(variant.symbol, ALL_MODULES);
    if (!module) return null;
    if (!variant.modifiers?.length && !variant.engineeringLocked) return module;
    const modifiers = variant.modifiers ?? [];
    const resolved: { -readonly [K in keyof OutfittingModule]: OutfittingModule[K] } = {
        ...module,
        ...(variant.engineeringLocked ? { engineeringLocked: true } : {}),
    };
    for (const { Label, Value, ValueStr } of computeModifiers(
        baseStats(module),
        asFeatures(modifiers),
    )) {
        const field = fieldForLabel(Label, module);
        // Numeric values return to the catalogue's units (a journal reports a resistance
        // as `40` where the catalogue stores `0.4`). A string-valued capability is stored
        // as the boolean it grants.
        if (field && Value !== undefined) {
            Object.assign(resolved, { [field]: Value / scaleForLabel(Label) });
        } else if (field && ValueStr !== undefined && capabilityValueForLabel(Label) !== null) {
            Object.assign(resolved, { [field]: true });
        }
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
    if (module.damageComponents) {
        const scale =
            module.damage !== undefined && module.damage !== 0 && resolved.damage !== undefined
                ? resolved.damage / module.damage
                : 1;
        resolved.damageComponents = {
            ...(module.damageComponents.kinetic === undefined
                ? {}
                : { kinetic: module.damageComponents.kinetic * scale }),
            ...(module.damageComponents.thermal === undefined
                ? {}
                : { thermal: module.damageComponents.thermal * scale }),
            ...(module.damageComponents.explosive === undefined
                ? {}
                : { explosive: module.damageComponents.explosive * scale }),
            ...(module.damageComponents.absolute === undefined
                ? {}
                : { absolute: module.damageComponents.absolute * scale }),
            ...(module.damageComponents.antiXeno === undefined
                ? {}
                : { antiXeno: module.damageComponents.antiXeno * scale }),
            ...(module.damageComponents.unclassified === undefined
                ? {}
                : {
                      unclassified: module.damageComponents.unclassified.map(
                          (value) => value * scale,
                      ),
                  }),
        };
    }
    return resolved;
}
