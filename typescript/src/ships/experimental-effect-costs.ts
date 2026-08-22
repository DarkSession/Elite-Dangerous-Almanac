/**
 * The **experimental-effect cost catalogue** — one-application material shopping lists
 * kept separate from effect mechanics so calculating or editing a build does not bundle
 * them.
 *
 * The matching stat modifiers and qualitative descriptions live in
 * `ships/experimental-effects`.
 *
 * Data from EDSY (`eddb.js` `expeffect`), with combat-effect costs from the Inara
 * registry; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import experimentalEffectCostsData from '../../../data/ships/experimental-effect-costs.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';
import type { EngineeringMaterial } from './engineering.js';

/**
 * Every experimental effect's one-application material list, keyed by Frontier `fdname`.
 *
 * @remarks
 * Its ids exactly match `EXPERIMENTAL_EFFECTS` from `ships/experimental-effects`. The
 * catalogues are separate runtime payloads so a mechanics-only consumer pays for neither
 * material names nor counts.
 *
 * @example
 * ```ts
 * import { EXPERIMENTAL_EFFECT_COSTS } from '@elite-dangerous-almanac/core/ships/experimental-effect-costs';
 *
 * EXPERIMENTAL_EFFECT_COSTS['special_fsd_heavy'];
 * // -> [{ symbol: 'DisruptedWakeEchoes', name: 'Atypical Disrupted Wake Echoes', count: 5 }, ...]
 * ```
 */
export const EXPERIMENTAL_EFFECT_COSTS: Readonly<Record<string, readonly EngineeringMaterial[]>> =
    deepFreeze(experimentalEffectCostsData as Record<string, readonly EngineeringMaterial[]>);

/**
 * Look up an experimental effect's one-application material cost.
 *
 * @remarks
 * Materials are the whole cost: an experimental effect charges no Merc Coin, unlike the
 * blueprints
 * {@link ships/blueprint-costs!getBlueprintMercCoinCost | getBlueprintMercCoinCost}
 * prices.
 *
 * @param fdname - The effect id, e.g. `"special_fsd_heavy"`, matched
 * case-insensitively after trimming surrounding whitespace.
 * @returns The frozen material list, or `null` if the effect is unknown.
 * @throws {TypeError} If `fdname` is present and not a string. A nullish
 * `fdname` is a miss, answered the way an unrecognised one is.
 * @example
 * ```ts
 * import { getExperimentalEffectCost } from '@elite-dangerous-almanac/core/ships/experimental-effect-costs';
 *
 * getExperimentalEffectCost('special_fsd_heavy');
 * // -> [{ symbol: 'DisruptedWakeEchoes', ... }, ...]
 * ```
 */
export function getExperimentalEffectCost(fdname: string): readonly EngineeringMaterial[] | null {
    return findByRawKey(EXPERIMENTAL_EFFECT_COSTS, fdname, 'getExperimentalEffectCost: fdname');
}
