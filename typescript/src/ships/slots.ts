/**
 * The **slot model** for a ship build — data-free types and helpers that describe
 * where modules go on a hull and reconcile the two ways a slot is named.
 *
 * A hull offers a fixed set of mounts: seven core internals, a handful of weapon
 * hardpoints, some tiny utility mounts, and a column of optional internals. Some of
 * those mounts are **restricted** to one family of modules — military and
 * planetary-approach optionals on most hulls, and, on three hulls, cargo-only,
 * limpet-controller-only, vessel-hangar-only and passenger-cabin-only optionals and
 * mining-only hardpoints (see {@link SlotRestriction}). This module gives
 * each mount a stable **slot key** and a {@link BuildSlot} descriptor, and
 * {@link parseSlotName} classifies a journal slot name (as it appears in a SLEF
 * export) into the same shape — so a build loaded from SLEF and a build assembled from
 * scratch speak one vocabulary.
 *
 * It holds no data; {@link enumerateSlots} takes a {@link ShipSlots} layout (from a
 * hull's `Ship` record via `getShipSlots` in `./ships`) and expands it into keyed
 * {@link BuildSlot}s. Most hulls number their mounts by rule; on ten the game does
 * not, and a mount there carries its own `name` — see {@link enumerateSlots}.
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
 * - `passenger` — passenger cabins, Mk I and Mk II, at every class either family
 *   offers (the Lynx Highliner's two size-6 and one size-5 optionals; journal
 *   `Passenger01`–`Passenger03`).
 */
export type OptionalRestriction =
    | 'military'
    | 'planetaryApproachSuite'
    | 'cargo'
    | 'limpetController'
    | 'vesselHangar'
    | 'passenger';

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
 * The list is complete. Two rules this comment once recorded as unmodelled do not
 * exist in the game: no hardpoint takes only one *mount* (fixed, gimballed or
 * turret), and no utility mount is restricted — which is why neither ever had a
 * source saying what to store.
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
    passenger: 'passenger cabins',
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

/**
 * The fixed mount a module is built for — {@link OutfittingModule.slot}.
 *
 * @remarks
 * The eight core-internal mounts every hull has: the seven {@link CoreSlotType}
 * functions plus `armour`, which is a fixed mount too but is sized per hull rather
 * than by class, and so is not one of the seven.
 *
 * A module carries this when it fills one particular mount and nothing else. Most do
 * not: a hardpoint weapon, a utility fitting and an optional internal each fit any
 * mount of their kind that is big enough, so there is no one mount to name.
 *
 * Two records bend a rule each. A fuel tank bends this one — it is `fuelTank` and fits
 * any optional slot as well, the one module built for two kinds of mount. The Guardian
 * Hybrid power plants and distributors bend "a core module lives in `CORE_MODULES`":
 * they carry `powerPlant` / `powerDistributor` from `INTERNAL_MODULES`, which is where
 * Frontier's registry files them.
 */
export type ModuleSlot = CoreSlotType | 'armour';

/** One mount on a hull — its stable key, kind, and size. */
export interface BuildSlot {
    /**
     * Stable, journal-compatible slot key, e.g. `"PowerPlant"`, `"HugeHardpoint1"`,
     * `"TinyHardpoint2"`, `"Slot01_Size6"`, `"Military01"`,
     * `"PlanetaryApproachSuite"`, and on a restricted mount
     * `"LargeMiningHardpoint1"`, `"Cargo01"`, `"LimpetController01"`,
     * `"FighterBay01"`, `"Passenger01"`.
     *
     * @remarks
     * This is the string every `slotKey` argument takes. It is matched
     * **case-insensitively** and otherwise exactly — no surrounding whitespace, no
     * abbreviation — because a SLEF producer may lower-case the game's own identifier,
     * as the specification's own example does. Enumerate keys with
     * `ShipLoadout.slots()` rather than typing them. Note a core slot's
     * {@link BuildSlot.core} function name is a *different* string (`thrusters` vs the
     * key `MainEngines`); see {@link CoreSlotType}.
     *
     * **Do not compute one.** The numbering looks regular and on ten hulls is
     * not: the Anaconda's smallest optionals are `Slot13_Size2` and `Slot14_Size1`
     * with no slots 11 or 12, the Type-9 Heavy starts at `Slot00_Size8`, the Type-7
     * Transporter uses the number `09` twice, and the Keelback's `Slot03_Size3` sits
     * on a size-**4** mount. Such a mount carries its own `name`; see
     * {@link enumerateSlots}.
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
    /**
     * The mount's own journal slot key, when the numbering rules do not reproduce it
     * — the Type-8 Transporter's `SmallHardpoint4`, the Caspian Explorer's
     * out-of-order mediums. Absent when the rules are right; see
     * {@link enumerateSlots} for which hulls carry names and why.
     */
    readonly name?: string;
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
    /**
     * The mount's own journal slot key, when the numbering rules do not reproduce it
     * — the Anaconda's `Slot14_Size1`, the Type-9 Heavy's `Slot00_Size8`, the
     * Keelback's `Slot03_Size3`. Absent when the rules are right; see
     * {@link enumerateSlots} for which hulls carry names and why.
     *
     * @remarks
     * **The `_SizeN` in the key may disagree with {@link OptionalSlotSpec.size}**,
     * which is always the mount's real class — the Keelback's `Slot03_Size3` names a
     * size-4 mount. That is Frontier's own text, kept verbatim.
     */
    readonly name?: string;
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
     * Slot size (class), 1–8, or `null` when the key does not encode one and the mount
     * has one to encode (`Radar`, `Military01`, `Cargo01`, …) — the hull's layout
     * carries the size instead.
     *
     * @remarks
     * `null` is not the only "no size here" answer. A mount whose fit rules are not
     * size-based reads `0` rather than `null` — `TinyHardpoint1` and `Armour` both do,
     * matching {@link BuildSlot.size} — and `CargoHatch` reads `1`. So test
     * `parsed.size` for falsiness, or against the {@link ParsedSlot.kind} you expect;
     * `=== null` alone treats a utility mount as a sized slot.
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
 *
 * @remarks
 * A `Map` rather than an object literal: {@link parseSlotName} looks this up with an
 * arbitrary caller-supplied string, and an object would answer `'constructor'` and
 * `'__proto__'` with something inherited from `Object.prototype` instead of a miss.
 */
const CORE_TYPE: ReadonlyMap<string, CoreSlotType> = new Map([
    ['powerplant', 'powerPlant'],
    ['mainengines', 'thrusters'],
    ['frameshiftdrive', 'frameShiftDrive'],
    ['lifesupport', 'lifeSupport'],
    ['powerdistributor', 'powerDistributor'],
    ['radar', 'sensors'],
    ['fueltank', 'fuelTank'],
] as const);

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
    passenger: 'Passenger',
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Expand a hull's {@link ShipSlots} layout into keyed {@link BuildSlot}s, in
 * outfitting-panel order: hardpoints, utility mounts, armour, the seven core
 * internals, then the optional internals, then the cargo hatch.
 *
 * The keys are journal-compatible, so the same key identifies a mount whether the
 * build was assembled from scratch or loaded from a SLEF export — SLEF being the
 * journal's own `Loadout` event in an envelope, its `Slot` strings are these.
 *
 * @param layout - The hull's slot layout.
 * @returns Every mount the hull offers, as {@link BuildSlot}s.
 * @remarks
 * Unrestricted optionals are numbered `Slot01_SizeN`, `Slot02_SizeN`, … with no gaps,
 * and hardpoints `1, 2, 3` within each size class. **Ten hulls disagree**, and no
 * rule derives what they do instead, so a mount on one of them carries its own
 * {@link OptionalSlotSpec.name} / {@link HardpointSlotSpec.name} and that wins:
 *
 * | Hull | What the game names it |
 * | --- | --- |
 * | Anaconda | `Slot13_Size2`, `Slot14_Size1` — no 11 or 12 |
 * | Type-9 Heavy | starts at `Slot00_Size8`; then jumps `Slot08` → `Slot11` |
 * | Type-10 Defender, Federal Dropship, Vulture | a gap before the last mounts |
 * | Type-7 Transporter | the number `09` twice, and five suffixes misreport the size |
 * | Keelback, Asp Scout | one suffix misreports the size |
 * | Type-8 Transporter | `SmallHardpoint2` then `SmallHardpoint4` |
 * | Caspian Explorer | mediums run `6, 5, 1, 2, 3, 4` — out of order, not just gapped |
 *
 * The Panther Clipper Mk II, Type-11 Prospector and Lynx Highliner carry names too,
 * pinning what the rules already derive. The Lynx is the one that had to be *earned*:
 * its `Slot02_Size5` follows three `PassengerNN` mounts, which only comes out right
 * because a `passenger` mount is a restricted one and so consumes no `SlotNN` number.
 * A hull that names any mount of a kind names all of them, so a derived key and a name
 * never compete for the same string.
 * @example
 * ```ts
 * enumerateSlots(getShipSlots('Anaconda')!).filter((s) => s.kind === 'hardpoint');
 * // -> [{ key: 'HugeHardpoint1', size: 4, ... }, { key: 'LargeHardpoint1', size: 3, ... }, ...]
 * enumerateSlots(getShipSlots('Anaconda')!)
 *     .filter((s) => s.kind === 'optional' && !s.restriction)
 *     .at(-1)?.key; // -> 'Slot14_Size1', not 'Slot12_Size1'
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
            key: spec.name ?? `${cls}${infix}Hardpoint${n}`,
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
        const override = spec.name;
        if (restriction === 'planetaryApproachSuite') {
            slots.push({
                key: override ?? 'PlanetaryApproachSuite',
                kind: 'optional',
                size: spec.size,
                restriction,
            });
        } else if (restriction) {
            const n = (restrictedN[restriction] = (restrictedN[restriction] ?? 0) + 1);
            slots.push({
                key: override ?? `${OPTIONAL_PREFIX[restriction]}${pad2(n)}`,
                kind: 'optional',
                size: spec.size,
                restriction,
            });
        } else {
            // `slotN` advances whether or not a name overrides it, so the derived key
            // for a given mount does not depend on how many earlier mounts were named.
            const derived = `Slot${pad2(slotN++)}_Size${spec.size}`;
            slots.push({
                key: override ?? derived,
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
 *
 * **A `_SizeN` suffix is what the name says, not what the mount is.** On three hulls
 * the game's own key disagrees with the mount it names — the Keelback's
 * `Slot03_Size3` is a size-4 mount, the Asp Scout's `Slot01_Size4` a size-5 one, and
 * five of the Type-7 Transporter's ten are off. To size a mount, find it in the hull's
 * layout ({@link enumerateSlots}) rather than trusting the number returned here.
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
    const core = CORE_TYPE.get(key);
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
    // The Lynx Highliner's three cabin mounts, which the game reserves for passenger
    // cabins — the name says so on its own, like every other restricted mount.
    if (/^passenger\d+$/.test(key))
        return { kind: 'optional', size: null, restriction: 'passenger' };

    const optional = /^slot\d+_size(\d+)$/.exec(key);
    if (optional) return { kind: 'optional', size: Number(optional[1]) };

    return null;
}
