/**
 * The **experimental-effect catalogue** — each engineering special effect's stat
 * modifiers **and material cost**, keyed by the effect's Frontier `fdname` (as it
 * appears in a journal `Loadout` event's `Engineering.ExperimentalEffect`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Each effect is an {@link ExperimentalEffect} — its `modifiers` (pass to
 * {@link computeModifiers} alongside a blueprint grade), optional fixed damage-type
 * conversion, and its `materials` (what one application costs). Read the complete record
 * with {@link getExperimentalEffect}.
 *
 * Keys are Frontier `fdname`s — the exact strings a journal `Loadout` event carries in
 * `Engineering.ExperimentalEffect` (e.g. `"special_fsd_heavy"`), not the in-game
 * display names. Enumerate the available effects with `Object.keys(EXPERIMENTAL_EFFECTS)`.
 *
 * Data from EDSY (`eddb.js` `expeffect`) — coriolis-data does not carry the numeric
 * experimental modifiers or their recipes; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import experimentalData from '../../../data/ships/experimental-effects.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import type { ExperimentalEffect } from './engineering.js';

/**
 * Every experimental effect, keyed by Frontier `fdname` (e.g. `"special_fsd_heavy"`).
 * Each carries its `modifiers` (stat contributions) and its `materials` (recipe).
 *
 * @example
 * ```ts
 * EXPERIMENTAL_EFFECTS['special_fsd_heavy'].modifiers;
 * // -> [{ label: 'Integrity', ... }, { label: 'FSDOptimalMass', ... }]
 * EXPERIMENTAL_EFFECTS['special_fsd_heavy'].materials;
 * // -> [{ symbol: 'DisruptedWakeEchoes', ... }, ...]
 * ```
 */
export const EXPERIMENTAL_EFFECTS: Readonly<Record<string, ExperimentalEffect>> = deepFreeze(
    experimentalData as Record<string, ExperimentalEffect>,
);

/**
 * Look up a complete experimental effect by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The effect id, e.g. `"special_fsd_heavy"`.
 * @returns The effect record — its display `name`, modifier contributions, optional
 * `damageDistribution`, and material recipe — or `null` if unknown.
 * @example
 * ```ts
 * const effect = getExperimentalEffect('special_fsd_heavy');
 * effect?.name;      // -> 'Mass Manager'
 * effect?.modifiers; // -> [{ label: 'Integrity', ... }, ...]
 * effect?.materials; // -> [{ symbol: 'DisruptedWakeEchoes', ... }, ...]
 * ```
 */
export function getExperimentalEffect(fdname: string): ExperimentalEffect | null {
    if (Object.hasOwn(EXPERIMENTAL_EFFECTS, fdname)) return EXPERIMENTAL_EFFECTS[fdname]!;
    const wanted = fdname.trim().toLowerCase();
    for (const key of Object.keys(EXPERIMENTAL_EFFECTS)) {
        if (key.toLowerCase() === wanted) return EXPERIMENTAL_EFFECTS[key]!;
    }
    return null;
}
