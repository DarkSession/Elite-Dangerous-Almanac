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
 * **What is resolved, and what is not.** The module catalogues carry core and
 * optional-internal stats — mass, integrity, power, capacities, optimal mass. They carry
 * no weapon stats, so a variant's `Damage`, `MaximumRange` or `AmmoClipSize` modifiers
 * have no base value to apply to and are reported by {@link unresolvedModifiers} rather
 * than silently dropped. A pre-engineered rail gun still resolves its mass, integrity
 * and power draw correctly, which is what a power-and-mass budget needs.
 *
 * @packageDocumentation
 */

import { computeModifiers, type BlueprintFeature } from './engineering.js';
import { baseStats, fieldForLabel } from './module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import type { PreEngineeredModifier, PreEngineeredVariant } from './pre-engineered.js';
import type { EngineeringModifier } from './slef.js';

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
 * The labels a variant modifies that the module catalogues hold no base value for.
 *
 * These are almost entirely weapon and scanner stats — `Damage`, `AmmoClipSize`,
 * `MaximumRange` and friends. Reported rather than dropped so a consumer can tell the
 * difference between "this variant changes nothing else" and "this catalogue cannot say".
 *
 * @param variant - A pre-engineered variant.
 * @returns The unresolvable labels, in the variant's own order.
 *
 * @example
 * ```ts
 * unresolvedModifiers(railgun); // -> ['AmmoClipSize', 'AmmoMaximum', 'Damage', ...]
 * ```
 */
export function unresolvedModifiers(variant: PreEngineeredVariant): string[] {
    return (variant.modifiers ?? [])
        .map((m) => m.label)
        .filter((label) => fieldForLabel(label) === null);
}

/**
 * A pre-engineered variant resolved into a module record you can fit.
 *
 * Returns the base module's catalogue record with every stat the variant modifies — and
 * that the catalogue carries — replaced by its engineered value. `symbol`, `name`,
 * `class`, `rating` and `cost` are the base module's throughout: a pre-engineered
 * variant is the same article with different numbers, not a different module.
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
 * const stock = getModuleBySymbol(shard.symbol, ALL_MODULES)!;
 * const fitted = getPreEngineeredStats(shard)!;
 * stock.mass;  // -> 4
 * fitted.mass; // -> 6  (the variant carries Mass +50%)
 * ```
 */
export function getPreEngineeredStats(variant: PreEngineeredVariant): OutfittingModule | null {
    const module = getModuleBySymbol(variant.symbol, ALL_MODULES);
    if (!module) return null;
    if (!variant.modifiers?.length) return module;
    const resolved: { -readonly [K in keyof OutfittingModule]: OutfittingModule[K] } = {
        ...module,
    };
    for (const { Label, Value } of computeModifiers(
        baseStats(module),
        asFeatures(variant.modifiers),
    )) {
        const field = fieldForLabel(Label);
        // Every field a label maps to holds a number, so the computed value fits.
        if (field) Object.assign(resolved, { [field]: Value });
    }
    return resolved;
}
