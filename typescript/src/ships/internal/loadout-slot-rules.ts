/** Shared mount rules for loadout import, validation and editing. @internal */

import type { BuildSlot, ParsedSlot } from '../slots.js';

type SlotClassification = Pick<BuildSlot, 'kind'>;

/** Whether an operational build must keep this mount occupied. */
export function isRequiredSlot(slot: SlotClassification): boolean {
    return slot.kind === 'core' || slot.kind === 'armour';
}

/** Why the hull mount cannot be emptied, excluding build-dependent module limits. */
export function fixedSlotReason(slot: SlotClassification): 'cargoHatch' | 'requiredSlot' | null {
    if (slot.kind === 'cargoHatch') return 'cargoHatch';
    return isRequiredSlot(slot) ? 'requiredSlot' : null;
}

/** A mount import fills from the hull defaults — see {@link stockedMountKind}. */
export type StockedMountKind = 'core' | 'armour' | 'cargoHatch' | 'approachSuite';

/**
 * Which mount import stocks from the hull defaults when a source leaves it holding
 * nothing it can take, or `null` for every mount a source's own account stands for.
 *
 * Armour, the seven core internals and the cargo hatch are stocked because no ship flies
 * without them. The planetary approach suite is stocked for a different reason: every
 * hull leaves the shipyard carrying the advanced suite, which is weightless and draws no
 * power, so a build has nothing to gain by shedding it — while the exporters that omit
 * the mount omit it because they never carried it, Inara writing no entry for the suite
 * at all. Reading that silence as "sold" would land the import on a ship that cannot
 * approach a planet, so the hull's own suite goes in.
 *
 * The mount stays removable afterwards: this decides what an import with nothing to say
 * about a mount gets, not what an edit may later do to it.
 */
export function stockedMountKind(
    slot: Pick<ParsedSlot, 'kind' | 'restriction'>,
): StockedMountKind | null {
    if (slot.kind === 'core' || slot.kind === 'armour' || slot.kind === 'cargoHatch') {
        return slot.kind;
    }
    return slot.kind === 'optional' && slot.restriction === 'planetaryApproachSuite'
        ? 'approachSuite'
        : null;
}
