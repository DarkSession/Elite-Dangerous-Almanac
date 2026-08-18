/** Localized loadout-slot and slot-restriction display labels. */

import { loadoutSlotName } from '../ships/internal/loadout-views.js';
import { SLOT_RESTRICTION_LABELS, type BuildSlot, type SlotRestriction } from '../ships/slots.js';
import { getLocalizedText } from './internal/localized-name.js';

/**
 * Resolve a loadout slot's display name for a locale.
 *
 * @param slot - A slot returned by `enumerateSlots` or `ShipLoadout.slots`.
 * @param locale - A BCP 47 locale. Current slot-label sources supply English only.
 * @returns The slot's English display name for an English locale, otherwise `null`.
 * @throws {TypeError} If `locale` is not a string.
 * @example
 * ```ts
 * import { getLoadoutSlotName } from '@elite-dangerous-almanac/core/i18n/slots';
 * import { enumerateSlots } from '@elite-dangerous-almanac/core/ships/slots';
 * import { getShipSlots } from '@elite-dangerous-almanac/core/ships/ships';
 *
 * const powerPlant = enumerateSlots(getShipSlots('SideWinder')!).find(
 *   (slot) => slot.kind === 'core' && slot.core === 'powerPlant',
 * )!;
 * getLoadoutSlotName(powerPlant, 'en'); // -> 'Power Plant'
 * ```
 */
export function getLoadoutSlotName(slot: BuildSlot, locale: string): string | null {
    return getLocalizedText({ en: loadoutSlotName(slot) }, locale, 'getLoadoutSlotName');
}

/**
 * Resolve the short display label for a restricted slot.
 *
 * @param restriction - A `BuildSlot.restriction` value.
 * @param locale - A BCP 47 locale. Current restriction-label sources supply English only.
 * @returns The English label for an English locale, otherwise `null`.
 * @throws {TypeError} If `locale` is not a string.
 * @example
 * ```ts
 * import { getSlotRestrictionLabel } from '@elite-dangerous-almanac/core/i18n/slots';
 *
 * getSlotRestrictionLabel('mining', 'en-GB'); // -> 'mining tools'
 * getSlotRestrictionLabel('mining', 'fr'); // -> null
 * ```
 */
export function getSlotRestrictionLabel(
    restriction: SlotRestriction,
    locale: string,
): string | null {
    const label = Object.hasOwn(SLOT_RESTRICTION_LABELS, restriction)
        ? SLOT_RESTRICTION_LABELS[restriction]
        : undefined;
    return getLocalizedText(
        label === undefined ? null : { en: label },
        locale,
        'getSlotRestrictionLabel',
    );
}
