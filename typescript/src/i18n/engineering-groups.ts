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
 * @param locale - A BCP 47 locale. English covers every group; the current source also
 * supplies sparse Portuguese and Russian. Per-locale coverage is recorded in
 * [`data/i18n/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/i18n/SOURCES.md).
 * @returns The localized group name, or `null` for an unknown group or unavailable locale.
 * @throws {TypeError} If a present `groupId` or `locale` is not a string.
 * @example
 * ```ts
 * import { getEngineeringGroupName } from '@elite-dangerous-almanac/core/i18n/engineering-groups';
 *
 * getEngineeringGroupName('frameShiftDrives', 'pt-BR'); // -> 'Motores de Distorção de Fase'
 * getEngineeringGroupName('frameShiftDrives', 'de'); // -> null
 * ```
 */
export function getEngineeringGroupName(groupId: string, locale: string): string | null {
    return getLocalizedName(NAMES, groupId, locale, 'getEngineeringGroupName', 'groupId');
}
