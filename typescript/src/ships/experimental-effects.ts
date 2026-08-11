/**
 * The **experimental-effect mechanics catalogue** — each engineering special effect's
 * stat modifiers and qualitative behavior, keyed by the effect's Frontier `fdname` (as it
 * appears in a journal `Loadout` event's `Engineering.ExperimentalEffect`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Each effect is an {@link ExperimentalEffect} — its `modifiers` (pass to
 * {@link computeModifiers} alongside a blueprint grade), optional fixed damage-type
 * conversion, and optional qualitative description. Read it with
 * {@link getExperimentalEffect}. Material shopping lists live separately in
 * `ships/experimental-effect-costs`, so build calculations do not bundle them.
 *
 * Keys are Frontier `fdname`s — the exact strings a journal `Loadout` event carries in
 * `Engineering.ExperimentalEffect` (e.g. `"special_fsd_heavy"`), not the in-game
 * display names. Enumerate the available effects with `Object.keys(EXPERIMENTAL_EFFECTS)`.
 *
 * Data from EDSY (`eddb.js` `expeffect`) — coriolis-data does not carry the numeric
 * experimental modifiers; see [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

import experimentalData from '../../../data/ships/experimental-effects.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { findByRawKey } from '../internal/registry-index.js';
import type { ExperimentalEffect } from './engineering.js';

/**
 * Every experimental effect, keyed by Frontier `fdname` (e.g. `"special_fsd_heavy"`).
 * Each carries its `modifiers` (stat contributions), optional damage conversion, and
 * optional qualitative description.
 *
 * @example
 * ```ts
 * import { EXPERIMENTAL_EFFECTS } from '@elite-dangerous-almanac/core/ships/experimental-effects';
 *
 * EXPERIMENTAL_EFFECTS['special_fsd_heavy']?.modifiers;
 * // -> [{ label: 'Integrity', ... }, { label: 'FSDOptimalMass', ... }]
 * ```
 */
export const EXPERIMENTAL_EFFECTS: Readonly<Record<string, ExperimentalEffect>> = deepFreeze(
    experimentalData as Record<string, ExperimentalEffect>,
);

/**
 * Look up an experimental effect by its Frontier `fdname`, case-insensitively.
 *
 * @param fdname - The effect id, e.g. `"special_fsd_heavy"`.
 * @returns The effect record — its display `name`, modifier contributions, optional
 * `damageDistribution`, and optional qualitative description — or `null` if unknown.
 * @example
 * ```ts
 * import { getExperimentalEffect } from '@elite-dangerous-almanac/core/ships/experimental-effects';
 *
 * const effect = getExperimentalEffect('special_fsd_heavy');
 * effect?.name;      // -> 'Mass Manager'
 * effect?.modifiers; // -> [{ label: 'Integrity', ... }, ...]
 * ```
 */
export function getExperimentalEffect(fdname: string): ExperimentalEffect | null {
    return findByRawKey(EXPERIMENTAL_EFFECTS, fdname);
}
