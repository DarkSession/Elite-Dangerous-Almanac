/** Shared fixed-mount rules for loadout validation and editing. @internal */

import type { BuildSlot } from '../slots.js';

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
