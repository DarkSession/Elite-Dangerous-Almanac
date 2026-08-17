/** Shared fixed-mount rules for loadout validation and editing. @internal */

import type { BuildSlot } from '../slots.js';

/** Whether an operational build must keep this mount occupied. */
export function isRequiredSlot(slot: BuildSlot): boolean {
    return slot.kind === 'core' || slot.kind === 'armour';
}

/** Why the hull mount cannot be emptied, excluding build-dependent module limits. */
export function fixedSlotReason(slot: BuildSlot): 'cargoHatch' | 'requiredSlot' | null {
    if (slot.kind === 'cargoHatch') return 'cargoHatch';
    return isRequiredSlot(slot) ? 'requiredSlot' : null;
}
