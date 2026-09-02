/**
 * Odyssey suit tools: the Energylink, Profile Analyser, Arc Cutter and Genetic Sampler,
 * the suits that carry each one, and their battery and timing stats.
 *
 * @packageDocumentation
 */

import toolsData from '../../../data/equipment/tools.jsonc' with { type: 'json' };
import { deepFreeze } from '../internal/deep-freeze.js';
import { createKeyIndex, findInKeyIndex } from '../internal/registry-index.js';

/**
 * One tool a Commander carries on foot.
 *
 * @remarks
 * A stat a tool does not have is absent rather than zero: only the Energylink
 * discharges and overloads, and only the Profile Analyser scans and clones.
 *
 * Every power figure is in the same unit as {@link Suit.batteryCapacity}, so a suit's
 * battery divided by a tool's per-second drain is the seconds of use it holds.
 */
export interface PersonalTool {
    /**
     * This library's own id, e.g. `"arc-cutter"`.
     *
     * @remarks
     * Frontier publishes no item symbol for a tool: a journal `SuitLoadout` names the
     * suit and its weapon mounts only. The id is therefore a library key, and joins to
     * no journal field.
     */
    readonly id: string;
    /**
     * English display name, e.g. `"Arc Cutter"`.
     *
     * @remarks
     * English only. No accepted source translates a tool name, so `i18n` publishes
     * none; the gap is tracked at
     * https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/29.
     */
    readonly name: string;
    /** Families of the suits that carry the tool, as {@link Suit.family} spells them. */
    readonly suitFamilies: readonly string[];
    /** Energylink: battery charge delivered to a target, in MW per second. */
    readonly rechargeRate?: number;
    /** Energylink: battery charge drawn from a target, in MW per second. */
    readonly dischargeRate?: number;
    /** Energylink: seconds one discharge lasts. */
    readonly dischargeDuration?: number;
    /**
     * Energylink: battery charge one overload costs, in MW. The Reduced Tool Battery
     * Consumption factor, named `toolEnergyDrain`, applies to this.
     */
    readonly overloadPowerUsage?: number;
    /**
     * Battery charge the tool draws while it works, in MW per second. The Reduced Tool
     * Battery Consumption factor, named `toolEnergyDrain`, applies to this.
     */
    readonly powerUsage?: number;
    /** Profile Analyser: seconds one profile scan takes. */
    readonly scanDuration?: number;
    /** Profile Analyser: seconds one profile clone takes. */
    readonly cloneDuration?: number;
}

/**
 * Every suit tool, in catalogue order.
 *
 * @remarks
 * The Reduced Tool Battery Consumption suit modification halves the `toolEnergyDrain`
 * stat, which is this catalogue's `powerUsage` and the Energylink's
 * `overloadPowerUsage`. It leaves `dischargeRate` alone, which is why the two carry
 * separate names: pass the base a factor applies to, and the discharge rate can never
 * pick one up.
 *
 * @example
 * ```ts
 * import { PERSONAL_TOOLS } from '@elite-dangerous-almanac/core/equipment/tools';
 * PERSONAL_TOOLS[0]?.name; // -> 'Energylink'
 * ```
 * @example
 * ```ts
 * import { applyPersonalModifiers } from '@elite-dangerous-almanac/core/equipment/engineering';
 * import { getPersonalModification } from '@elite-dangerous-almanac/core/equipment/modifications';
 * import { getPersonalToolById } from '@elite-dangerous-almanac/core/equipment/tools';
 *
 * const recipe = getPersonalModification('suit_reducedtoolbatteryconsumption');
 * const cutter = getPersonalToolById('arc-cutter');
 * applyPersonalModifiers('toolEnergyDrain', cutter?.powerUsage ?? 0, recipe?.modifiers ?? []);
 * // -> 0.075
 * ```
 */
export const PERSONAL_TOOLS: readonly PersonalTool[] = deepFreeze(
    toolsData as unknown as readonly PersonalTool[],
);

const BY_ID = /* @__PURE__ */ createKeyIndex(PERSONAL_TOOLS, 'id');

/**
 * Look up a suit tool by its library id, case-insensitively.
 *
 * @param id - Library id such as `"energylink"`, matched case-insensitively after
 * trimming surrounding whitespace.
 * @returns The frozen tool record, or `null` when unknown.
 * @throws {TypeError} If `id` is present and not a string. A nullish id is a miss,
 * answered like an unrecognised one.
 * @example
 * ```ts
 * import { getPersonalToolById } from '@elite-dangerous-almanac/core/equipment/tools';
 * getPersonalToolById('arc-cutter')?.suitFamilies; // -> ['utilitysuit']
 * ```
 */
export function getPersonalToolById(id: string): PersonalTool | null {
    return findInKeyIndex(BY_ID, id, 'getPersonalToolById: id');
}
