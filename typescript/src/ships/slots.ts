/**
 * The **slot model** for a ship build — data-free types and helpers that describe
 * where modules go on a hull and reconcile the two ways a slot is named.
 *
 * A hull offers a fixed set of mounts: seven core internals, a handful of weapon
 * hardpoints, some tiny utility mounts, and a column of optional internals (a few of
 * which are restricted to military or planetary-approach modules). This module gives
 * each mount a stable **slot key** and a {@link BuildSlot} descriptor, and
 * {@link parseSlotName} classifies a journal slot name (as it appears in a SLEF
 * export) into the same shape — so a build loaded from SLEF and a build assembled from
 * scratch speak one vocabulary.
 *
 * It holds no data; {@link enumerateSlots} takes a {@link ShipSlots} layout (from
 * `./ship-slots`) and expands it into keyed {@link BuildSlot}s.
 *
 * @packageDocumentation
 */

/** The kind of mount a slot is. */
export type SlotKind = 'core' | 'hardpoint' | 'utility' | 'optional' | 'armour' | 'cargoHatch';

/** A restriction limiting which optional-internal modules a slot accepts. */
export type SlotRestriction = 'military' | 'planetaryApproachSuite';

/** The seven fixed core-internal mounts, by function. */
export type CoreSlotType =
    | 'powerPlant'
    | 'thrusters'
    | 'frameShiftDrive'
    | 'lifeSupport'
    | 'powerDistributor'
    | 'sensors'
    | 'fuelTank';

/** One mount on a hull — its stable key, kind, and size. */
export interface BuildSlot {
    /**
     * Stable, journal-compatible slot key, e.g. `"PowerPlant"`, `"HugeHardpoint1"`,
     * `"TinyHardpoint2"`, `"Slot01_Size6"`, `"Military01"`, `"PlanetaryApproachSuite"`.
     */
    readonly key: string;
    /** Which kind of mount this is. */
    readonly kind: SlotKind;
    /**
     * Slot size (class). Core/optional/hardpoint slots are 1–8; utility, armour and
     * the cargo hatch are `0`/`1` placeholders (nothing sized fits them).
     */
    readonly size: number;
    /** The optional-internal restriction, when the slot is a restricted one. */
    readonly restriction?: SlotRestriction;
    /** For a core slot, which core module type it accepts. */
    readonly core?: CoreSlotType;
}

/** The size of each of a hull's seven core-internal mounts. */
export interface CoreSlots {
    readonly powerPlant: number;
    readonly thrusters: number;
    readonly frameShiftDrive: number;
    readonly lifeSupport: number;
    readonly powerDistributor: number;
    readonly sensors: number;
    readonly fuelTank: number;
}

/** One optional-internal mount in a hull's layout. */
export interface OptionalSlotSpec {
    /** Slot size (class), 1–8. */
    readonly size: number;
    /** A restriction, if this mount only takes military or planetary-approach modules. */
    readonly restriction?: SlotRestriction;
}

/** One armour (bulkhead) option and the mass it adds to the hull. */
export interface BulkheadOption {
    /** Display name, e.g. `"Lightweight Alloy"`, `"Reactive Surface Composite"`. */
    readonly name: string;
    /** Mass this bulkhead adds over the (zero-mass) lightweight default, in tonnes. */
    readonly mass: number;
}

/** A hull's full slot layout, as carried in `data/ships/ship-slots.jsonc`. */
export interface ShipSlots {
    /** Hull symbol, matching the registry's `Ship.symbol`. */
    readonly symbol: string;
    /** The seven core-internal sizes. */
    readonly core: CoreSlots;
    /** Weapon-hardpoint sizes, largest first (1 Small – 4 Huge). */
    readonly hardpoints: readonly number[];
    /** Number of tiny utility mounts. */
    readonly utility: number;
    /** Optional-internal mounts, largest first. */
    readonly optional: readonly OptionalSlotSpec[];
    /** The five armour options and their added mass. */
    readonly bulkheads: readonly BulkheadOption[];
}

/** Result of {@link parseSlotName}. `size` is `null` when the name does not encode it. */
export interface ParsedSlot {
    readonly kind: SlotKind;
    readonly size: number | null;
    readonly restriction?: SlotRestriction;
    readonly core?: CoreSlotType;
}

/** Core module type → its fixed journal slot key. */
const CORE_KEY: Record<CoreSlotType, string> = {
    powerPlant: 'PowerPlant',
    thrusters: 'MainEngines',
    frameShiftDrive: 'FrameShiftDrive',
    lifeSupport: 'LifeSupport',
    powerDistributor: 'PowerDistributor',
    sensors: 'Radar',
    fuelTank: 'FuelTank',
};

/** Journal core slot key → core module type (the inverse of {@link CORE_KEY}). */
const CORE_TYPE: Record<string, CoreSlotType> = {
    PowerPlant: 'powerPlant',
    MainEngines: 'thrusters',
    FrameShiftDrive: 'frameShiftDrive',
    LifeSupport: 'lifeSupport',
    PowerDistributor: 'powerDistributor',
    Radar: 'sensors',
    FuelTank: 'fuelTank',
};

/** Ordered so `CORE_ORDER[i]` follows the outfitting panel. */
const CORE_ORDER: readonly CoreSlotType[] = [
    'powerPlant',
    'thrusters',
    'frameShiftDrive',
    'lifeSupport',
    'powerDistributor',
    'sensors',
    'fuelTank',
];

/** Hardpoint size (class) → journal size-class name. */
const HARDPOINT_CLASS: Record<number, string> = { 1: 'Small', 2: 'Medium', 3: 'Large', 4: 'Huge' };

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Expand a hull's {@link ShipSlots} layout into keyed {@link BuildSlot}s, in
 * outfitting-panel order: hardpoints, utility mounts, armour, the seven core
 * internals, then the optional internals, then the cargo hatch.
 *
 * The keys are journal-compatible, so the same key identifies a mount whether the
 * build was assembled from scratch or loaded from a SLEF export.
 *
 * @param layout - The hull's slot layout.
 * @returns Every mount the hull offers, as {@link BuildSlot}s.
 * @example
 * ```ts
 * enumerateSlots(getShipSlots('Anaconda')!).filter((s) => s.kind === 'hardpoint');
 * // -> [{ key: 'HugeHardpoint1', size: 4, ... }, { key: 'LargeHardpoint1', size: 3, ... }, ...]
 * ```
 */
export function enumerateSlots(layout: ShipSlots): BuildSlot[] {
    const slots: BuildSlot[] = [];

    // Hardpoints, numbered within each size class in layout order.
    const hpCount: Record<number, number> = {};
    for (const size of layout.hardpoints) {
        const cls = HARDPOINT_CLASS[size];
        if (!cls) continue;
        const n = (hpCount[size] = (hpCount[size] ?? 0) + 1);
        slots.push({ key: `${cls}Hardpoint${n}`, kind: 'hardpoint', size });
    }

    // Utility (tiny) mounts.
    for (let i = 1; i <= layout.utility; i++) {
        slots.push({ key: `TinyHardpoint${i}`, kind: 'utility', size: 0 });
    }

    // Armour, then the seven core internals.
    slots.push({ key: 'Armour', kind: 'armour', size: 0 });
    for (const core of CORE_ORDER) {
        slots.push({ key: CORE_KEY[core], kind: 'core', size: layout.core[core], core });
    }

    // Optional internals: normal ones share a running `SlotNN_SizeS` number;
    // military and planetary-approach mounts get their own journal names.
    let slotN = 1;
    let milN = 1;
    for (const spec of layout.optional) {
        if (spec.restriction === 'military') {
            slots.push({
                key: `Military${pad2(milN++)}`,
                kind: 'optional',
                size: spec.size,
                restriction: 'military',
            });
        } else if (spec.restriction === 'planetaryApproachSuite') {
            slots.push({
                key: 'PlanetaryApproachSuite',
                kind: 'optional',
                size: spec.size,
                restriction: 'planetaryApproachSuite',
            });
        } else {
            slots.push({
                key: `Slot${pad2(slotN++)}_Size${spec.size}`,
                kind: 'optional',
                size: spec.size,
            });
        }
    }

    slots.push({ key: 'CargoHatch', kind: 'cargoHatch', size: 1 });
    return slots;
}

/**
 * Classify a journal slot name — the `Slot` field of a SLEF/journal module — into a
 * {@link ParsedSlot}.
 *
 * @param slot - The journal slot name, e.g. `"FrameShiftDrive"`, `"MediumHardpoint2"`,
 * `"Slot03_Size5"`, `"Military01"`.
 * @returns The classification, or `null` if the name is not a recognised slot. `size`
 * is `null` for names that do not encode a size (a bare `Military01`).
 * @example
 * ```ts
 * parseSlotName('Slot03_Size5'); // -> { kind: 'optional', size: 5 }
 * parseSlotName('HugeHardpoint1'); // -> { kind: 'hardpoint', size: 4 }
 * parseSlotName('Radar'); // -> { kind: 'core', size: null, core: 'sensors' }
 * ```
 */
export function parseSlotName(slot: string): ParsedSlot | null {
    const core = CORE_TYPE[slot];
    if (core) return { kind: 'core', size: null, core };
    if (slot === 'Armour') return { kind: 'armour', size: 0 };
    if (slot === 'CargoHatch') return { kind: 'cargoHatch', size: 1 };
    if (slot === 'PlanetaryApproachSuite') {
        return { kind: 'optional', size: null, restriction: 'planetaryApproachSuite' };
    }

    const hardpoint = /^(Small|Medium|Large|Huge)Hardpoint\d+$/.exec(slot);
    if (hardpoint) {
        const size = { Small: 1, Medium: 2, Large: 3, Huge: 4 }[hardpoint[1] as string];
        return { kind: 'hardpoint', size: size ?? null };
    }
    if (/^TinyHardpoint\d+$/.test(slot)) return { kind: 'utility', size: 0 };
    if (/^Military\d+$/.test(slot))
        return { kind: 'optional', size: null, restriction: 'military' };

    const optional = /^Slot\d+_Size(\d+)$/.exec(slot);
    if (optional) return { kind: 'optional', size: Number(optional[1]) };

    return null;
}
