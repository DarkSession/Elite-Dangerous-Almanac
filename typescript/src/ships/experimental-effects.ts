/**
 * The **experimental-effect catalogue** — each engineering special effect's stat
 * modifiers **and material cost**, keyed by the effect's Frontier `fdname` (as it
 * appears in a journal `Loadout` event's `Engineering.ExperimentalEffect`).
 *
 * Its own module (and data file) so consumers who never engineer a build do not bundle
 * it. Each effect is an {@link ExperimentalEffect} — its `modifiers` (pass to
 * {@link computeModifiers} alongside a blueprint grade, or read via
 * {@link getExperimentalEffect}) and its `materials` (what one application costs, via
 * {@link getExperimentalEffectMaterials}).
 *
 * Keys are Frontier `fdname`s — the exact strings a journal `Loadout` event carries in
 * `Engineering.ExperimentalEffect` (e.g. `"special_fsd_heavy"`), not the in-game
 * display names. Enumerate the available effects with `Object.keys(EXPERIMENTAL_EFFECTS)`.
 *
 * Data from EDSY (`eddb.js` `expeffect`) — coriolis-data does not carry the numeric
 * experimental modifiers or their recipes; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

import experimentalData from '../../../data/ships/experimental-effects.jsonc' with { type: 'json' };
import { deepFreeze } from '../deep-freeze.js';
import type {
    ExperimentalContribution,
    ExperimentalEffect,
    EngineeringMaterial,
} from './engineering.js';

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
 * Look up an experimental effect's stat modifiers by its Frontier `fdname`,
 * case-insensitively — what it changes, ready for {@link computeModifiers}.
 *
 * @param fdname - The effect id, e.g. `"special_fsd_heavy"`.
 * @returns The effect's modifier contributions, or `null` if unknown.
 */
export function getExperimentalEffect(fdname: string): readonly ExperimentalContribution[] | null {
    return resolveEffect(fdname)?.modifiers ?? null;
}

/**
 * Look up the materials one application of an experimental effect costs, by its Frontier
 * `fdname`, case-insensitively — what it costs.
 *
 * An experimental effect is a single application (one roll), so this is the whole cost.
 * Fold it in with a blueprint's {@link getBlueprintCost} via
 * {@link sumMaterials} for the grand total of an engineered module.
 *
 * @param fdname - The effect id, e.g. `"special_fsd_heavy"`.
 * @returns The effect's material requirements, or `null` if the effect is unknown. Join
 * each material's `symbol` to the `materials` domain for its own grade and category.
 * @example
 * ```ts
 * getExperimentalEffectMaterials('special_fsd_heavy');
 * // -> [{ symbol: 'DisruptedWakeEchoes', name: 'Atypical Disrupted Wake Echoes', count: 5 }, ...]
 * ```
 */
export function getExperimentalEffectMaterials(
    fdname: string,
): readonly EngineeringMaterial[] | null {
    return resolveEffect(fdname)?.materials ?? null;
}

/**
 * Look up an experimental effect's in-game display name by its Frontier `fdname`,
 * case-insensitively.
 *
 * @param fdname - The effect id, e.g. `"special_fsd_heavy"`.
 * @returns The display name (e.g. `"Mass Manager"`), or `null` if the effect is unknown.
 */
export function getExperimentalEffectName(fdname: string): string | null {
    return resolveEffect(fdname)?.name ?? null;
}

/** Resolve an effect record by `fdname`, case-insensitively (shared by the lookups). */
function resolveEffect(fdname: string): ExperimentalEffect | null {
    if (Object.hasOwn(EXPERIMENTAL_EFFECTS, fdname)) return EXPERIMENTAL_EFFECTS[fdname]!;
    const wanted = fdname.trim().toLowerCase();
    for (const key of Object.keys(EXPERIMENTAL_EFFECTS)) {
        if (key.toLowerCase() === wanted) return EXPERIMENTAL_EFFECTS[key]!;
    }
    return null;
}
