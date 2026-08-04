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
};

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
                const numbered = /(\d+)$/.exec(slot.key);
                const label = RESTRICTED_OPTIONAL_NAMES[slot.restriction];
                return label && numbered ? `${label} ${Number(numbered[1])}` : slot.key;
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
    /** The mount's restriction, when it is a restricted one. */
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
     * Return the modules from a catalogue that fit this slot.
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
