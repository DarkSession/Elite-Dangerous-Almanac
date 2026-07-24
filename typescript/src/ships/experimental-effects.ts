/**
 * The **experimental-effect catalogue** — each engineering special effect's stat
 * contributions, keyed by the effect's Frontier `fdname` (as it appears in a journal
 * `Loadout` event's `Engineering.ExperimentalEffect`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Pass an effect's contributions to {@link computeModifiers} alongside a blueprint
 * grade.
 *
 * Keys are Frontier `fdname`s — the exact strings a journal `Loadout` event carries in
 * `Engineering.ExperimentalEffect` (e.g. `"special_fsd_heavy"`), not the in-game
 * display names. Enumerate the available effects with `Object.keys(EXPERIMENTAL_EFFECTS)`.
 *
 * Data from EDSY (`eddb.js` `expeffect`) — coriolis-data does not carry the numeric
 * experimental modifiers; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import experimentalData from '../../../data/ships/experimental-effects.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';
import type { ExperimentalContribution } from './engineering.js';

/**
 * Every experimental effect, keyed by Frontier `fdname` (e.g. `"special_fsd_heavy"`).
 *
 * @example
 * ```ts
 * EXPERIMENTAL_EFFECTS['special_fsd_heavy'];
 * // -> [{ label: 'Integrity', ... }, { label: 'FSDOptimalMass', ... }]
 * ```
 */
export const EXPERIMENTAL_EFFECTS: Readonly<Record<string, readonly ExperimentalContribution[]>> =
    deepFreeze(experimentalData as Record<string, readonly ExperimentalContribution[]>);

/**
 * Look up an experimental effect by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The effect id, e.g. `"special_fsd_heavy"`.
 * @returns The effect's contributions, or `null` if unknown.
 */
export function getExperimentalEffect(fdname: string): readonly ExperimentalContribution[] | null {
    if (Object.hasOwn(EXPERIMENTAL_EFFECTS, fdname)) return EXPERIMENTAL_EFFECTS[fdname]!;
    const wanted = fdname.trim().toLowerCase();
    for (const key of Object.keys(EXPERIMENTAL_EFFECTS)) {
        if (key.toLowerCase() === wanted) return EXPERIMENTAL_EFFECTS[key]!;
    }
    return null;
}
