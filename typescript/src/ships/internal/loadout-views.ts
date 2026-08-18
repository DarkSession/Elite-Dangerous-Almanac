/** Presentation helpers for immutable loadout views. @internal */

import type { BuildSlot, CoreSlotType, SlotRestriction } from '../slots.js';

const CORE_NAMES: Record<CoreSlotType, string> = {
    powerPlant: 'Power Plant',
    thrusters: 'Thrusters',
    frameShiftDrive: 'Frame Shift Drive',
    lifeSupport: 'Life Support',
    powerDistributor: 'Power Distributor',
    sensors: 'Sensors',
    fuelTank: 'Fuel Tank',
};

const RESTRICTED_OPTIONAL_NAMES: Partial<Record<SlotRestriction, string>> = {
    military: 'Military Slot',
    cargo: 'Cargo Slot',
    limpetController: 'Limpet Controller Slot',
    vesselHangar: 'Vessel Hangar Slot',
    passenger: 'Passenger Slot',
};

function trailingDigits(key: string): string | null {
    let start = key.length;
    while (start > 0) {
        const code = key.charCodeAt(start - 1);
        if (code < 0x30 || code > 0x39) break;
        start--;
    }
    return start === key.length ? null : key.slice(start);
}

/** Derive the library's display label for a slot. */
export function loadoutSlotName(slot: BuildSlot): string {
    switch (slot.kind) {
        case 'core':
            return Object.hasOwn(CORE_NAMES, slot.core) ? CORE_NAMES[slot.core] : slot.key;
        case 'hardpoint': {
            const match = /^(Small|Medium|Large|Huge)(Mining)?Hardpoint(\d+)$/.exec(slot.key);
            if (!match) return slot.key;
            return `${match[1]}${match[2] ? ' Mining' : ''} Hardpoint ${Number(match[3])}`;
        }
        case 'utility': {
            const match = /^TinyHardpoint(\d+)$/.exec(slot.key);
            return match ? `Utility Mount ${Number(match[1])}` : slot.key;
        }
        case 'optional': {
            if (slot.restriction === 'planetaryApproachSuite') return 'Planetary Approach Suite';
            if (slot.restriction) {
                const numbered = trailingDigits(slot.key);
                const label = Object.hasOwn(RESTRICTED_OPTIONAL_NAMES, slot.restriction)
                    ? RESTRICTED_OPTIONAL_NAMES[slot.restriction]
                    : undefined;
                return label && numbered ? `${label} ${Number(numbered)}` : slot.key;
            }
            const optional = /^Slot(\d+)_Size(\d+)$/.exec(slot.key);
            return optional
                ? `Optional Internal ${Number(optional[1])} (Size ${slot.size})`
                : slot.key;
        }
        case 'armour':
            return 'Armour';
        case 'cargoHatch':
            return 'Cargo Hatch';
    }
}
