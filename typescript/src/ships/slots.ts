/**
 * The **slot model** for a ship build — data-free types and helpers that describe
 * where modules go on a hull and reconcile the two ways a slot is named.
 *
 * A hull offers a fixed set of mounts: seven core internals, a handful of weapon
 * hardpoints, some tiny utility mounts, and a column of optional internals. Some of
 * those mounts are **restricted** to one family of modules — military and
 * planetary-approach optionals on most hulls, and, on two hulls, cargo-only,
 * limpet-controller-only and vessel-hangar-only optionals and mining-only hardpoints
 * (see {@link SlotRestriction}). This module gives
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

import { deepFreeze } from '../deep-freeze.js';

/** The kind of mount a slot is. */
export type SlotKind = 'core' | 'hardpoint' | 'utility' | 'optional' | 'armour' | 'cargoHatch';

/**
 * A restriction limiting which weapons a **hardpoint** accepts.
 *
 * @remarks
 * Only the Type-11 Prospector has any: four of its eight mounts take mining tools
 * (mining lasers and the Mining Lance, abrasion blasters, seismic charge launchers,
 * sub-surface displacement and extraction missiles, and the Mining Volley Repeater)
 * and nothing else. The journal names such a mount with a `Mining` infix —
 * `LargeMiningHardpoint1` — so {@link parseSlotName} recognises one on sight.
 */
export type HardpointRestriction = 'mining';

/**
 * A restriction limiting which **optional-internal** modules a slot accepts.
 *
 * - `military` — hull, module, shield and Guardian reinforcement packages and shield
 *   cell banks (journal `Military01`).
 * - `planetaryApproachSuite` — the approach suite alone, which in turn fits nowhere
 *   else (journal `PlanetaryApproachSuite`).
 * - `cargo` — cargo racks (ordinary, Mk II and corrosion-resistant) and fuel tanks;
 *   the Panther Clipper Mk II's first size-8 and first size-7 optionals (journal
 *   `Cargo01` and `Cargo02`).
 * - `limpetController` — any limpet controller, single-purpose or multi (the Type-11
 *   Prospector's size-5 optional; journal `LimpetController01`).
 * - `vesselHangar` — Mk I and Mk II vessel hangars, the modules the game called
 *   fighter hangars before the Operations update (the Type-11 Prospector's other
 *   size-5 optional; journal `FighterBay01`).
 */
export type OptionalRestriction =
    'military' | 'planetaryApproachSuite' | 'cargo' | 'limpetController' | 'vesselHangar';

/**
 * A restriction limiting which modules a slot accepts — every value either kind of
 * restricted mount can carry.
 *
 * @remarks
 * In practice a {@link BuildSlot} of kind `hardpoint` only ever carries a
 * {@link HardpointRestriction} and one of kind `optional` only ever carries an
 * {@link OptionalRestriction} — but `BuildSlot` is a flat interface, not a
 * discriminated union, so **checking `slot.kind` does not narrow this type**. An
 * exhaustive `switch` over a hardpoint's restriction still has to handle (or cast
 * away) the optional-only values; there is no `never` case to lean on.
 *
 * The list is what the hull layouts model, not every rule the game has: passenger
 * cabin-reserved optionals (the Lynx Highliner's three) are still stored as ordinary
 * slots — see https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/11.
 *
 * The journal spells two of these differently from the value: `vesselHangar` mounts
 * are named `FighterBay01` (the game renamed the modules but not the slots), and
 * `planetaryApproachSuite` is the only one whose key carries no number.
 */
export type SlotRestriction = HardpointRestriction | OptionalRestriction;

/**
 * What each restriction accepts, as a short phrase fit for an outfitting UI.
 *
 * @remarks
 * This is the same wording `ShipLoadout.setModule` uses when it refuses a module, so
 * a label you show and the error a consumer sees cannot drift apart. It describes the
 * module *families* a mount takes; for the actual fitting records, call
 * `ShipLoadout.modulesForSlot` with the catalogue you care about.
 * @example
 * ```ts
 * const slot = ShipLoadout.empty('LakonMiner').hardpoints()[0]!;
 * slot.restriction && SLOT_RESTRICTION_LABELS[slot.restriction]; // -> 'mining tools'
 * ```
 */
export const SLOT_RESTRICTION_LABELS: Readonly<Record<SlotRestriction, string>> = deepFreeze({
    mining: 'mining tools',
    military: 'reinforcement packages and shield cell banks',
    planetaryApproachSuite: 'planetary approach suites',
    cargo: 'cargo racks and fuel tanks',
    limpetController: 'limpet controllers',
    vesselHangar: 'vessel hangars',
});

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
     * `"TinyHardpoint2"`, `"Slot01_Size6"`, `"Military01"`,
     * `"PlanetaryApproachSuite"`, and on a restricted mount
     * `"LargeMiningHardpoint1"`, `"Cargo01"`, `"LimpetController01"`,
     * `"FighterBay01"`.
     *
     * @remarks
     * This is the string every `slotKey` argument takes. It is matched
     * **case-insensitively** and otherwise exactly — no surrounding whitespace, no
     * abbreviation — because a SLEF producer may lower-case the game's own identifier,
     * as the specification's own example does. Enumerate keys with
     * `ShipLoadout.slots()` rather than typing them. Note a core slot's
     * {@link BuildSlot.core} function name is a *different* string (`thrusters` vs the
     * key `MainEngines`); see {@link CoreSlotType}.
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
    /**
     * The restriction, when the mount is a restricted one — a
     * {@link HardpointRestriction} on a `hardpoint` slot, an
     * {@link OptionalRestriction} on an `optional` one. Absent on every other kind.
     *
     * @remarks
     * {@link SLOT_RESTRICTION_LABELS} turns this into a phrase to show a user;
     * `ShipLoadout.modulesForSlot` turns it into the modules that actually fit.
     */
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

/** One weapon hardpoint in a hull's layout. */
export interface HardpointSlotSpec {
    /** Mount size (class), `1` Small – `4` Huge. */
    readonly size: number;
    /**
     * A restriction, if this mount only takes one family of weapons. Only the
     * Type-11 Prospector has any; see {@link HardpointRestriction}.
     */
    readonly restriction?: HardpointRestriction;
}

/** One optional-internal mount in a hull's layout. */
export interface OptionalSlotSpec {
    /** Slot size (class), 1–8. */
    readonly size: number;
    /**
     * A restriction, if this mount only takes one family of modules; see
     * {@link OptionalRestriction}.
     */
    readonly restriction?: OptionalRestriction;
}

/**
 * A hull's full slot layout — the slot-bearing fields of a `Ship`, as `getShipSlots`
 * returns.
 *
 * @remarks
 * The armour mount is not listed here because it is not sized: a hull's armour options
 * are ordinary modules in `CORE_MODULES`, tied to the hull by their
 * {@link OutfittingModule.ship} field. List them with `getModulesForShip`.
 */
export interface ShipSlots {
    /** Hull symbol, matching the registry's `Ship.symbol`. */
    readonly symbol: string;
    /** The seven core-internal sizes. */
    readonly core: CoreSlots;
    /** Weapon hardpoints, largest first. */
    readonly hardpoints: readonly HardpointSlotSpec[];
    /** Number of tiny utility mounts. */
    readonly utility: number;
    /** Optional-internal mounts, largest first. */
    readonly optional: readonly OptionalSlotSpec[];
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
    /**
     * The restriction the key implies (`Military01` → `military`,
     * `LargeMiningHardpoint1` → `mining`). Frontier gives every restricted mount its
     * own journal name, so a key alone is enough to tell.
     */
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

/**
 * Journal core slot key → core module function (the inverse of `CORE_KEY`), keyed in
 * lower case because {@link parseSlotName} classifies a key whatever its casing.
 */
const CORE_TYPE: Record<string, CoreSlotType> = {
    powerplant: 'powerPlant',
    mainengines: 'thrusters',
    frameshiftdrive: 'frameShiftDrive',
    lifesupport: 'lifeSupport',
    powerdistributor: 'powerDistributor',
    radar: 'sensors',
    fueltank: 'fuelTank',
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

/**
 * Journal name infix a restricted hardpoint carries between its size class and
 * `Hardpoint` — `Large` + `Mining` + `Hardpoint1`.
 */
const HARDPOINT_INFIX: Record<HardpointRestriction, string> = { mining: 'Mining' };

/**
 * Journal key prefix for a numbered restricted optional — `Cargo` + `01`. The
 * planetary approach suite is absent because its key carries no number.
 */
const OPTIONAL_PREFIX: Record<Exclude<OptionalRestriction, 'planetaryApproachSuite'>, string> = {
    military: 'Military',
    cargo: 'Cargo',
    limpetController: 'LimpetController',
    vesselHangar: 'FighterBay',
};

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

    // Hardpoints, numbered within each size class in layout order. A restricted mount
    // shares that per-class numbering and takes an infix, so the Type-11's four medium
    // mounts run MediumMiningHardpoint1, MediumMiningHardpoint2, MediumHardpoint3.
    const hpCount: Record<number, number> = {};
    for (const spec of layout.hardpoints) {
        const cls = HARDPOINT_CLASS[spec.size];
        if (!cls) continue;
        const n = (hpCount[spec.size] = (hpCount[spec.size] ?? 0) + 1);
        const infix = spec.restriction ? HARDPOINT_INFIX[spec.restriction] : '';
        const slot: BuildSlot = {
            key: `${cls}${infix}Hardpoint${n}`,
            kind: 'hardpoint',
            size: spec.size,
            ...(spec.restriction ? { restriction: spec.restriction } : {}),
        };
        slots.push(slot);
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

    // Optional internals: unrestricted ones share a running `SlotNN_SizeS` number, and
    // a restricted mount takes a name of its own, numbered within its own restriction —
    // so a restricted slot never consumes a `SlotNN` number.
    let slotN = 1;
    const restrictedN: Partial<Record<OptionalRestriction, number>> = {};
    for (const spec of layout.optional) {
        const restriction = spec.restriction;
        if (restriction === 'planetaryApproachSuite') {
            slots.push({
                key: 'PlanetaryApproachSuite',
                kind: 'optional',
                size: spec.size,
                restriction,
            });
        } else if (restriction) {
            const n = (restrictedN[restriction] = (restrictedN[restriction] ?? 0) + 1);
            slots.push({
                key: `${OPTIONAL_PREFIX[restriction]}${pad2(n)}`,
                kind: 'optional',
                size: spec.size,
                restriction,
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
 * `"Slot03_Size5"`, `"Military01"`, `"LargeMiningHardpoint1"`. Matched
 * **case-insensitively** — see the remarks.
 * @returns The classification, or `null` if the name is not a recognised slot. `size`
 * is `null` for names that do not encode a size (a bare `Military01`).
 * @remarks
 * Every restricted mount has a journal name of its own, so the restriction is read
 * off the name and needs no hull layout. The size still may: `Cargo01` says only
 * that the mount takes cargo, and `getShipSlots` carries how big it is.
 *
 * **Casing is not significant.** Frontier writes `FrameShiftDrive`, but a SLEF
 * producer may lower-case every slot key as the specification's own example does —
 * Inara writes `powerplant` and `largemininghardpoint1` — and both name the same
 * mount. The returned `core` and `restriction` values keep this library's own
 * camelCase spelling whatever the input looked like.
 * @example
 * ```ts
 * parseSlotName('Slot03_Size5'); // -> { kind: 'optional', size: 5 }
 * parseSlotName('HugeHardpoint1'); // -> { kind: 'hardpoint', size: 4 }
 * parseSlotName('LargeMiningHardpoint1');
 * // -> { kind: 'hardpoint', size: 3, restriction: 'mining' }
 * parseSlotName('Radar'); // -> { kind: 'core', size: null, core: 'sensors' }
 * parseSlotName('powerplant'); // -> { kind: 'core', size: null, core: 'powerPlant' }
 * ```
 */
export function parseSlotName(slot: string): ParsedSlot | null {
    // Every comparison below is against the lower-cased key, so a producer's casing
    // never decides whether a mount is recognised.
    const key = slot.toLowerCase();
    const core = CORE_TYPE[key];
    if (core) return { kind: 'core', size: null, core };
    if (key === 'armour') return { kind: 'armour', size: 0 };
    if (key === 'cargohatch') return { kind: 'cargoHatch', size: 1 };
    if (key === 'planetaryapproachsuite') {
        return { kind: 'optional', size: null, restriction: 'planetaryApproachSuite' };
    }

    const hardpoint = /^(small|medium|large|huge)(mining)?hardpoint\d+$/.exec(key);
    if (hardpoint) {
        const size = { small: 1, medium: 2, large: 3, huge: 4 }[hardpoint[1] as string];
        return {
            kind: 'hardpoint',
            size: size ?? null,
            ...(hardpoint[2] ? { restriction: 'mining' as const } : {}),
        };
    }
    if (/^tinyhardpoint\d+$/.test(key)) return { kind: 'utility', size: 0 };
    if (/^military\d+$/.test(key)) return { kind: 'optional', size: null, restriction: 'military' };
    if (/^cargo\d+$/.test(key)) return { kind: 'optional', size: null, restriction: 'cargo' };
    if (/^limpetcontroller\d+$/.test(key))
        return { kind: 'optional', size: null, restriction: 'limpetController' };
    if (/^fighterbay\d+$/.test(key))
        return { kind: 'optional', size: null, restriction: 'vesselHangar' };

    const optional = /^slot\d+_size(\d+)$/.exec(key);
    if (optional) return { kind: 'optional', size: Number(optional[1]) };

    return null;
}
