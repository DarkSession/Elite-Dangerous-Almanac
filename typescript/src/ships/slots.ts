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
 * It holds no data; {@link enumerateSlots} takes a {@link ShipSlots} layout (from a
 * hull's `Ship` record via `getShipSlots` in `./ships`) and expands it into keyed
 * {@link BuildSlot}s.
 *
 * @packageDocumentation
 */

/** The kind of mount a slot is. */
export type SlotKind = 'core' | 'hardpoint' | 'utility' | 'optional' | 'armour' | 'cargoHatch';

/** A restriction limiting which optional-internal modules a slot accepts. */
export type SlotRestriction = 'military' | 'planetaryApproachSuite';

/**
 * The seven fixed core-internal mounts, by function.
 *
 * @remarks
 * These are **not** slot keys. A core mount has two names: this camelCase *function*
 * (`BuildSlot.core`) and the journal's PascalCase *slot key* (`BuildSlot.key`), which
 * is what every `slotKey` argument wants. Two of the pairs are not even the same word:
 *
 * | `core` (function) | `key` (journal slot) |
 * | --- | --- |
 * | `powerPlant` | `PowerPlant` |
 * | `thrusters` | `MainEngines` |
 * | `frameShiftDrive` | `FrameShiftDrive` |
 * | `lifeSupport` | `LifeSupport` |
 * | `powerDistributor` | `PowerDistributor` |
 * | `sensors` | `Radar` |
 * | `fuelTank` | `FuelTank` |
 */
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
     *
     * @remarks
     * This is the string every `slotKey` argument takes, and it is matched **exactly**
     * — journal spelling, case-sensitive, no surrounding whitespace — because it is the
     * game's own identifier. Enumerate keys with `ShipLoadout.slots()` rather than
     * typing them. Note a core slot's {@link BuildSlot.core} function name is a
     * *different* string (`thrusters` vs the key `MainEngines`); see
     * {@link CoreSlotType}.
     */
    readonly key: string;
    /** Which kind of mount this is. */
    readonly kind: SlotKind;
    /**
     * Slot size (class). Core/optional/hardpoint slots are 1–8; utility and armour
     * use `0` placeholders because their fit rules are not size-based, while the
     * fixed cargo hatch uses `1`.
     */
    readonly size: number;
    /** The optional-internal restriction, when the slot is a restricted one. */
    readonly restriction?: SlotRestriction;
    /**
     * For a core slot, which core module type it accepts — the camelCase *function*
     * name, not the slot key (see {@link CoreSlotType}). Absent on every other kind
     * of mount.
     */
    readonly core?: CoreSlotType;
}

/**
 * The size of each of a hull's seven core-internal mounts.
 *
 * @remarks
 * Each value is the mount's class (size), `1`–`8`: the largest module that fits it.
 * Keys are the core *functions* ({@link CoreSlotType}), not journal slot keys.
 */
export interface CoreSlots {
    /** Power-plant mount size, 1–8. */
    readonly powerPlant: number;
    /** Thruster mount size, 1–8 (journal slot `MainEngines`). */
    readonly thrusters: number;
    /** Frame shift drive mount size, 1–8. */
    readonly frameShiftDrive: number;
    /** Life-support mount size, 1–8. */
    readonly lifeSupport: number;
    /** Power-distributor mount size, 1–8. */
    readonly powerDistributor: number;
    /** Sensor mount size, 1–8 (journal slot `Radar`). */
    readonly sensors: number;
    /** Main fuel-tank mount size, 1–8. */
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

/** A hull's full slot layout — the slot-bearing fields of a `Ship`, as `getShipSlots` returns. */
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

/** What a journal slot key says about the mount, as {@link parseSlotName} reads it. */
export interface ParsedSlot {
    /** Which kind of mount the key names. */
    readonly kind: SlotKind;
    /**
     * Slot size (class), 1–8, or `null` when the key does not encode one (`Radar`,
     * `TinyHardpoint1`, `Armour`, …) — the hull's layout carries the size instead.
     */
    readonly size: number | null;
    /** The optional-internal restriction the key implies (`Military01` → `military`). */
    readonly restriction?: SlotRestriction;
    /** For a core key, the core function it fills (`MainEngines` → `thrusters`). */
    readonly core?: CoreSlotType;
}

/** Core module function → its fixed journal slot key (see {@link CoreSlotType}). */
const CORE_KEY: Record<CoreSlotType, string> = {
    powerPlant: 'PowerPlant',
    thrusters: 'MainEngines',
    frameShiftDrive: 'FrameShiftDrive',
    lifeSupport: 'LifeSupport',
    powerDistributor: 'PowerDistributor',
    sensors: 'Radar',
    fuelTank: 'FuelTank',
};

/** Journal core slot key → core module function (the inverse of `CORE_KEY`). */
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
