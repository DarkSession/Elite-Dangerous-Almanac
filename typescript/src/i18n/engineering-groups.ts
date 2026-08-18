/** Localized engineering option-group names, isolated from engineering statistics. */

import namesData from '../../../data/i18n/engineering-group-names.jsonc' with { type: 'json' };
import {
    createLocalizedNameIndex,
    getLocalizedName,
    type LocalizedNameMap,
} from './internal/localized-name.js';

const NAMES = /* @__PURE__ */ createLocalizedNameIndex(namesData as LocalizedNameMap);

/**
 * Look up an engineering option group's display name.
 *
 * @param groupId - The stable group id used by `EngineeringOptionGroup.groupId`.
 * @param locale - A BCP 47 locale. The current source supplies canonical English only.
 * @returns The localized group name, or `null` for an unknown group or unavailable locale.
 * @throws {TypeError} If a present `groupId` or `locale` is not a string.
 * @example
 * ```ts
 * import { getEngineeringGroupName } from '@elite-dangerous-almanac/core/i18n/engineering-groups';
 *
 * getEngineeringGroupName('frameShiftDrives', 'en'); // -> 'Frame Shift Drives'
 * getEngineeringGroupName('frameShiftDrives', 'de'); // -> null
 * ```
 */
export function getEngineeringGroupName(groupId: string, locale: string): string | null {
    return getLocalizedName(NAMES, groupId, locale, 'getEngineeringGroupName', 'groupId');
}
