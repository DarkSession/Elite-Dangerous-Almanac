/**
 * Resolving a decorative modification into the journal-style stat block it gives a
 * fitted module.
 *
 * A {@link DecorativeModification} stores fixed modifier contributions, while a journal
 * `Engineering.Modifiers` array stores the values those contributions produce on one
 * particular base module. {@link getDecorativeModifiers} joins the decorative `fdname`
 * and module `symbol`, performs that calculation, and returns the journal form.
 *
 * This module imports every outfitting record so it can resolve an arbitrary journal
 * module symbol. Its resolver is 326.4 KiB minified in a consumer bundle (33.2 KiB
 * gzipped). Consumers that only identify or list decorative modifications should import
 * `./decorative-modifications` instead; that catalogue stays independent of the complete
 * module registry.
 *
 * @packageDocumentation
 */

import { requireStringIfPresent } from '../internal/argument-guards.js';
import { getDecorativeModification } from './decorative-modifications.js';
import { computeModifiers, type BlueprintFeature } from './engineering.js';
import { baseStats } from './internal/module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol } from './modules.js';
import type { EngineeringModifier } from './slef.js';

/** Convert a fixed decorative contribution into the calculator's fixed feature shape. */
function asFeatures(fdname: string): readonly BlueprintFeature[] {
    return (getDecorativeModification(fdname)?.modifiers ?? []).map((modifier) => ({
        label: modifier.label,
        method: modifier.method,
        min: modifier.value,
        max: modifier.value,
    }));
}

/**
 * Compute the journal-style modifiers a decorative transformation applies to a module.
 *
 * The result has the same shape a journal `Loadout` event or SLEF export writes under
 * `Engineering.Modifiers`: numeric stats carry their post-transformation `Value` and
 * stock `OriginalValue` in the journal's units.
 *
 * Matching of both inputs is case-insensitive and trims whitespace. The decorative
 * catalogue's `modules` array records pairings that have been observed; it is not an
 * allowlist, so this resolver calculates any known transformation against any known
 * module carrying the required base stats. This lets a newly observed pairing resolve
 * before the catalogue's observational list is updated.
 *
 * @remarks
 * Resolving an arbitrary module symbol imports the complete outfitting catalogue. This
 * function is 326.4 KiB minified in a consumer bundle (33.2 KiB gzipped). Import
 * {@link getDecorativeModification} from `./decorative-modifications` instead when only
 * the decorative identity and its fixed contributions are needed.
 *
 * @param symbol - The fitted module's Frontier symbol, e.g.
 * `"Hpt_FlakMortar_Turret_Medium"`.
 * @param fdname - The decorative transformation's Frontier `fdname`, e.g.
 * `"Decorative_Green"`.
 * @returns One {@link EngineeringModifier} per computable label. A label the module does
 * not carry a required base value for is omitted. Returns an empty array if either
 * identity is unknown or no modifier label can be computed.
 * @throws {TypeError} If either argument is present and not a string. A nullish argument
 * is a miss, answered the same way as an unrecognised identity.
 *
 * @example
 * ```ts
 * import { getDecorativeModifiers } from '@elite-dangerous-almanac/core/ships/decorative-modification-stats';
 *
 * getDecorativeModifiers(
 *   'Hpt_FlakMortar_Turret_Medium',
 *   'Decorative_Green',
 * );
 * // -> [{ Label: 'Damage', Value: 0.34, OriginalValue: 34 }]
 * ```
 */
export function getDecorativeModifiers(symbol: string, fdname: string): EngineeringModifier[] {
    requireStringIfPresent(symbol, 'getDecorativeModifiers: symbol');
    requireStringIfPresent(fdname, 'getDecorativeModifiers: fdname');

    const features = asFeatures(fdname);
    if (features.length === 0) return [];
    const module = getModuleBySymbol(symbol, ALL_MODULES);
    if (!module) return [];
    return computeModifiers(baseStats(module), features);
}
