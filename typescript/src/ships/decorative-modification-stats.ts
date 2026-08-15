/**
 * Resolving a decorative modification into the journal-style stat block it gives a
 * fitted module.
 *
 * A {@link DecorativeModification} stores fixed modifier contributions, while a journal
 * `Engineering.Modifiers` array stores the values those contributions produce on one
 * particular base module. {@link getDecorativeModifiers} joins the decorative `fdname`
 * and module `symbol`, performs that calculation, and returns the journal form. An
 * identity absent from the catalogues returns `null`; a resolved identity whose labels
 * cannot all be computed can be inspected with {@link unresolvedDecorativeModifiers}.
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
import {
    getDecorativeModification,
    type DecorativeModification,
} from './decorative-modifications.js';
import { computeModifiers } from './engineering.js';
import { fixedModifierFeatures } from './internal/fixed-modifier-features.js';
import { baseStats } from './internal/module-stat-labels.js';
import { ALL_MODULES } from './modules-all.js';
import { getModuleBySymbol } from './modules.js';
import type { EngineeringModifier } from './slef.js';

/** A known decorative identity resolved against a known module. */
interface DecorativeResolution {
    readonly modification: DecorativeModification;
    readonly modifiers: EngineeringModifier[];
}

/** Resolve both identities and compute the fixed block for one public entry point. */
function resolveDecorativeModification(
    symbol: string,
    fdname: string,
    entryPoint: string,
): DecorativeResolution | null {
    requireStringIfPresent(symbol, `${entryPoint}: symbol`);
    requireStringIfPresent(fdname, `${entryPoint}: fdname`);

    const modification = getDecorativeModification(fdname);
    if (!modification) return null;
    const module = getModuleBySymbol(symbol, ALL_MODULES);
    if (!module) return null;
    return {
        modification,
        modifiers: computeModifiers(
            baseStats(module),
            fixedModifierFeatures(modification.modifiers),
        ),
    };
}

/**
 * Compute the journal-style modifiers a decorative transformation applies to a module.
 *
 * The result has the same shape a journal `Loadout` event or SLEF export writes under
 * `Engineering.Modifiers`: numeric stats carry their post-transformation `Value` in the
 * journal's units, plus `OriginalValue` when the catalogue field or a documented module
 * default supplies a calculator base. Without either base, a contribution that sets or
 * adds a value is still computable from zero and has no `OriginalValue`. A
 * percentage-of-a-multiplier label instead treats absence as an implicit `0%` base and
 * reports `OriginalValue: 0`. Only an ordinary label with purely multiplicative
 * contributions and no stored or default base is omitted;
 * {@link unresolvedDecorativeModifiers} reports it.
 *
 * Matching of both inputs is case-insensitive and trims whitespace. The decorative
 * catalogue's `modules` array records pairings that have been observed; it is not an
 * allowlist, so this resolver calculates any known transformation against any known
 * module. This lets a newly observed pairing resolve before the catalogue's
 * observational list is updated.
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
 * @returns One {@link EngineeringModifier} per computable label, or `null` if either
 * identity is unknown. A known pairing whose labels are all unresolvable returns an empty
 * array; use {@link unresolvedDecorativeModifiers} to distinguish that case from a
 * transformation with no other authored changes.
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
export function getDecorativeModifiers(
    symbol: string,
    fdname: string,
): EngineeringModifier[] | null {
    return (
        resolveDecorativeModification(symbol, fdname, 'getDecorativeModifiers')?.modifiers ?? null
    );
}

/**
 * Report decorative modifier labels that cannot be computed for a fitted module.
 *
 * An ordinary numeric label with only multiplicative contributions needs a calculator
 * base supplied by its catalogue field or a documented module default. Without either,
 * {@link getDecorativeModifiers} omits the label and this function reports it instead.
 * Additive and overwrite contributions can start from zero, a
 * percentage-of-a-multiplier label treats absence as an implicit `0%` base, and a
 * capability label resolves to its string value without a numeric base. None of those is
 * unresolved merely because the module record omits a base value.
 *
 * Matching and the observational-module-list behavior are identical to
 * {@link getDecorativeModifiers}.
 *
 * @remarks
 * Like {@link getDecorativeModifiers}, this function imports the complete outfitting
 * catalogue. Use {@link getDecorativeModification} when only the decorative identity
 * and its fixed contributions are needed.
 *
 * @param symbol - The fitted module's Frontier symbol.
 * @param fdname - The decorative transformation's Frontier `fdname`.
 * @returns The omitted labels, in catalogue order, or `null` if either identity is
 * unknown. An empty array means every authored label was computed.
 * @throws {TypeError} If either argument is present and not a string. A nullish argument
 * is an unknown identity and returns `null`.
 *
 * @example
 * ```ts
 * import { unresolvedDecorativeModifiers } from '@elite-dangerous-almanac/core/ships/decorative-modification-stats';
 *
 * unresolvedDecorativeModifiers(
 *   'Hpt_FlakMortar_Turret_Medium',
 *   'Decorative_Green',
 * ); // -> []
 * ```
 */
export function unresolvedDecorativeModifiers(symbol: string, fdname: string): string[] | null {
    const resolved = resolveDecorativeModification(symbol, fdname, 'unresolvedDecorativeModifiers');
    if (!resolved) return null;
    const labels = new Set(resolved.modifiers.map((modifier) => modifier.Label));
    return resolved.modification.modifiers
        .map((modifier) => modifier.label)
        .filter((label) => !labels.has(label));
}
