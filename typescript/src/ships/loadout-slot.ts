/**
 * A live slot handle for {@link ShipLoadout}.
 *
 * Kept separate from the loadout facade so slot presentation and fluent editing
 * remain a small, independently maintainable concern.
 *
 * @packageDocumentation
 */

import type { OutfittingModule } from './modules.js';
import type { ShipLoadout } from './ship-loadout.js';
import type { BuildSlot, CoreSlotType, SlotKind, SlotRestriction } from './slots.js';
import type { FittedModule } from './fitted-module.js';

/** Human-readable name for a core mount, by function. */
const CORE_NAMES: Record<CoreSlotType, string> = {
    powerPlant: 'Power Plant',
    thrusters: 'Thrusters',
    frameShiftDrive: 'Frame Shift Drive',
    lifeSupport: 'Life Support',
    powerDistributor: 'Power Distributor',
    sensors: 'Sensors',
    fuelTank: 'Fuel Tank',
};

/**
 * Human-readable label for a numbered restricted optional mount, by restriction. The
 * planetary approach suite is absent: its key carries no number and its label is fixed.
 *
 * @remarks
 * These are this library's wording, not the game's outfitting-panel text, so an app
 * with its own copy or its own translations should not treat {@link LoadoutSlot.name}
 * as authoritative.
 */
const RESTRICTED_OPTIONAL_NAMES: Partial<Record<SlotRestriction, string>> = {
    military: 'Military Slot',
    cargo: 'Cargo Slot',
    limpetController: 'Limpet Controller Slot',
    vesselHangar: 'Vessel Hangar Slot',
    passenger: 'Passenger Slot',
};

/**
 * The run of digits a key ends with, or `null` when it does not end in one.
 *
 * Scanned from the end rather than matched with `/(\d+)$/`: that pattern has no
 * start anchor, so the engine retries the digit run from every position in the key
 * and one long digit-heavy key costs quadratic time. Every key a {@link ShipLoadout}
 * builds comes from the bundled hull catalogue, so this is not an untrusted-input
 * path — but an app holding the constructor can name a mount anything, and the scan
 * is linear in the key's length for nothing.
 */
function trailingDigits(key: string): string | null {
    let start = key.length;
    while (start > 0) {
        const code = key.charCodeAt(start - 1);
        if (code < 0x30 || code > 0x39) break;
        start--;
    }
    return start === key.length ? null : key.slice(start);
}

/** A human-readable label for a slot, derived from its key and kind. */
function slotDisplayName(slot: BuildSlot): string {
    switch (slot.kind) {
        case 'core':
            return slot.core ? CORE_NAMES[slot.core] : slot.key;
        case 'hardpoint': {
            const match = /^(Small|Medium|Large|Huge)(Mining)?Hardpoint(\d+)$/.exec(slot.key);
            if (!match) return slot.key;
            const mining = match[2] ? ' Mining' : '';
            return `${match[1]}${mining} Hardpoint ${Number(match[3])}`;
        }
        case 'utility': {
            const match = /^TinyHardpoint(\d+)$/.exec(slot.key);
            return match ? `Utility Mount ${Number(match[1])}` : slot.key;
        }
        case 'optional': {
            if (slot.restriction === 'planetaryApproachSuite') return 'Planetary Approach Suite';
            if (slot.restriction) {
                const numbered = trailingDigits(slot.key);
                const label = RESTRICTED_OPTIONAL_NAMES[slot.restriction];
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

/**
 * A live handle on one of a hull's mounts, as returned by
 * {@link ShipLoadout.slots}, {@link ShipLoadout.coreModules},
 * {@link ShipLoadout.hardpoints} and friends.
 *
 * The slot knows its own key, so consumers can list what fits it, fit or clear a
 * module, and reach the fitted module's engineering without repeating the key.
 * It remains a live view of its loadout after edits.
 *
 * @example
 * ```ts
 * const drive = ShipLoadout.empty('Anaconda')
 *   .coreModules()
 *   .find((slot) => slot.core === 'frameShiftDrive')!;
 * drive.fit(fsd).applyBlueprint('FSD_LongRange', { grade: 5 });
 * ```
 */
export class LoadoutSlot implements BuildSlot {
    /** Stable, journal-compatible slot key, e.g. `"FrameShiftDrive"`. */
    readonly key: string;
    /** Which kind of mount this is. */
    readonly kind: SlotKind;
    /** Slot size (class); `0` for utility and armour placeholders. */
    readonly size: number;
    /**
     * The mount's restriction, when it is a restricted one — this mount takes that
     * family of modules and nothing else. {@link SLOT_RESTRICTION_LABELS} names the
     * family for a user; {@link LoadoutSlot.modulesForSlot} lists what actually fits.
     */
    readonly restriction?: SlotRestriction;
    /** For a core slot, the core module function it accepts. */
    readonly core?: CoreSlotType;
    /** Human-readable label, e.g. `"Frame Shift Drive"`. */
    readonly name: string;

    readonly #loadout: ShipLoadout;

    /** @internal Constructed by {@link ShipLoadout}; not part of the public API. */
    constructor(loadout: ShipLoadout, slot: BuildSlot) {
        this.#loadout = loadout;
        this.key = slot.key;
        this.kind = slot.kind;
        this.size = slot.size;
        if (slot.restriction !== undefined) this.restriction = slot.restriction;
        if (slot.core !== undefined) this.core = slot.core;
        this.name = slotDisplayName(slot);
    }

    /** The module fitted here as a live {@link FittedModule}, or `null` if empty. */
    get module(): FittedModule | null {
        return this.#loadout.getFittedModule(this.key);
    }

    /** Whether a module is fitted in this slot right now. */
    get occupied(): boolean {
        return this.#loadout.moduleAt(this.key) !== null;
    }

    /**
     * Return the modules from a catalogue that fit this slot — size, kind and any
     * {@link LoadoutSlot.restriction} all satisfied, so a restricted mount lists only
     * its own family.
     *
     * @param catalogue - A module catalogue or filtered subset.
     * @returns Fitting modules in catalogue order.
     */
    modulesForSlot(catalogue: readonly OutfittingModule[]): OutfittingModule[] {
        return this.#loadout.modulesForSlot(this.key, catalogue);
    }

    /**
     * Fit a module into this slot.
     *
     * @param module - The module record to fit.
     * @returns A live handle for the newly fitted module.
     * @throws {TypeError} If `module` is null/undefined, or it does not fit — wrong
     * kind, too large for the mount, restricted to another hull, or refused by this
     * mount's {@link LoadoutSlot.restriction}. The message names the module, the slot
     * and the reason. Use {@link LoadoutSlot.modulesForSlot} to offer only fits.
     * @example
     * ```ts
     * const mount = ShipLoadout.empty('LakonMiner').hardpoints()[0]!;
     * mount.fit(plasmaAccelerator);
     * // TypeError: ShipLoadout.setModule: Hpt_PlasmaAccelerator_Fixed_Large
     * //   → LargeMiningHardpoint1: slot only takes mining tools
     * ```
     */
    fit(module: OutfittingModule): FittedModule {
        this.#loadout.setModule(this.key, module);
        return this.#loadout.getFittedModule(this.key)!;
    }

    /**
     * Empty this slot and return the slot for chaining.
     *
     * @throws {TypeError} For the fixed cargo hatch.
     */
    clear(): this {
        this.#loadout.removeModule(this.key);
        return this;
    }
}
