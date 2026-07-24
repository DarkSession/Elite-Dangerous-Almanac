/**
 * {@link ShipLoadout} — a handle on a fitted ship that both **answers questions**
 * about a build and **edits** it.
 *
 * Load one from a SLEF export (or a journal `Loadout` event) to read back the ship's
 * identity, mass and fuel and ask for jump range and per-jump fuel; or start an
 * {@link ShipLoadout.empty | empty} hull, enumerate its {@link ShipLoadout.slots | slots},
 * and {@link ShipLoadout.setModule | fit} and {@link ShipLoadout.removeModule | remove}
 * modules. It composes the data-free pieces of this folder — the SLEF parser
 * (`./slef`), the jump-range maths (`./jump-range`), the slot model (`./slots`), and
 * the module and ship catalogues (each record carrying its own stats).
 *
 * Instances are **mutable**: `setModule`/`removeModule` change the build in place and
 * return `this` for chaining. Values a SLEF export already computed (its
 * `UnladenMass`, `FuelCapacity`, …) are trusted verbatim; for a build assembled from
 * scratch those figures are computed from the fitted modules and the hull's stats.
 * Editing an imported build adjusts the supplied aggregate figures by the changed
 * module's contribution; when that contribution is unknown, the affected figure is
 * discarded and recomputed rather than allowed to go stale.
 *
 * @remarks
 * This is the batteries-included ship facade: resolving arbitrary journal module
 * ids and engineering recipes requires the complete ship/module, blueprint, and
 * experimental-effect catalogues. Import `./slef`, `./jump-range`, or an individual
 * module catalogue instead when you only need one data-free operation or one
 * outfitting category.
 *
 * @example
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * // Read a build:
 * const build = ShipLoadout.fromSlef(slefJsonString);
 * build.maxJumpRange();  // -> 89.41  (best single jump, one jump's fuel, no cargo)
 *
 * // Assemble one:
 * import { STANDARD_MODULES, getModuleBySymbol } from '@elite-dangerous-almanac/core/ships';
 * const conda = ShipLoadout.empty('Anaconda');
 * conda.setModule('FrameShiftDrive', getModuleBySymbol('Int_Hyperdrive_Size6_Class5', STANDARD_MODULES)!);
 * conda.slotsOfKind('optional'); // every optional mount, occupied or empty, with size
 * ```
 *
 * @packageDocumentation
 */

import { parseSlef, getModifier, type LoadoutEvent, type LoadoutModule } from './slef.js';
import {
    singleJumpRange,
    fuelPerJump,
    totalRange,
    type FrameShiftDriveParams,
} from './jump-range.js';
import { getShipBySymbol, getShipSlots } from './ships.js';
import { ALL_MODULES } from './modules-all.js';
import {
    enumerateSlots,
    type BuildSlot,
    type SlotKind,
    type SlotRestriction,
    type CoreSlotType,
} from './slots.js';
import { computeModifiers } from './engineering.js';
import { BLUEPRINTS, getBlueprintGrade } from './blueprints.js';
import { EXPERIMENTAL_EFFECTS, getExperimentalEffect } from './experimental-effects.js';
import {
    blueprintTargets,
    experimentalTarget,
    moduleEngineeringTarget,
} from './engineering-compatibility.js';
import type { ModuleEngineering } from './slef.js';
import { getModuleBySymbol, type OutfittingModule } from './modules.js';

/** A ship's fuel-tank capacities, in tonnes. */
export interface FuelCapacity {
    /** Main tank capacity — the fuel jumps and supercruise draw from. */
    readonly main: number;
    /** Reserve tank capacity — the small emergency reserve. */
    readonly reserve: number;
}

/** Optional mass overrides for a single calculation. */
export interface JumpOptions {
    /** Fuel in the tank for the jump, in tonnes. Defaults to the full main tank. */
    readonly fuel?: number;
    /** Cargo aboard, in tonnes. Defaults to `0` (unladen). */
    readonly cargo?: number;
}

/** Options for {@link ShipLoadout.applyBlueprint}. */
export interface ApplyBlueprintOptions {
    /** The blueprint grade, `1`–`5`. */
    readonly grade: number;
    /** The engineering quality roll, `0`–`1`. Defaults to `1` (best roll). */
    readonly quality?: number;
    /** The experimental (special) effect's Frontier `fdname`, if any. */
    readonly experimental?: string;
}

/** A blueprint that can engineer a module, with the grades it offers. */
export interface AvailableBlueprint {
    /** The blueprint's Frontier `fdname`, e.g. `"FSD_LongRange"`. */
    readonly fdname: string;
    /** The grades the blueprint offers, ascending (e.g. `[1, 2, 3, 4, 5]`). */
    readonly grades: readonly number[];
}

/** Top-level figures a SLEF export carries, trusted over the computed fallbacks. */
interface TopFigures {
    ShipName?: string;
    ShipIdent?: string;
    HullValue?: number;
    ModulesValue?: number;
    Rebuy?: number;
    UnladenMass?: number;
    CargoCapacity?: number;
    FuelCapacity?: { Main?: number; Reserve?: number };
}

const FSD_PREFIX = 'int_hyperdrive';
const BOOSTER_PREFIX = 'int_guardianfsdbooster';
const FUEL_TANK_PREFIX = 'int_fueltank';
const PLANETARY_APPROACH_PREFIX = 'int_planetapproachsuite';

/**
 * Core-module symbol prefix → the core slot type it fills. Includes the Guardian
 * Hybrid power plant / distributor, which are core modules even though the registry
 * files them under the `internal` category.
 */
const CORE_PREFIXES: readonly (readonly [string, CoreSlotType])[] = [
    ['int_guardianpowerplant', 'powerPlant'],
    ['int_guardianpowerdistributor', 'powerDistributor'],
    ['int_powerplant', 'powerPlant'],
    ['int_engine', 'thrusters'],
    ['int_mkiiagileboost', 'thrusters'],
    ['int_hyperdrive', 'frameShiftDrive'],
    ['int_lifesupport', 'lifeSupport'],
    ['int_powerdistributor', 'powerDistributor'],
    ['int_sensors', 'sensors'],
    ['int_fueltank', 'fuelTank'],
];

/** Optional-internal groups a military slot accepts (symbol prefixes). */
const MILITARY_PREFIXES: readonly string[] = [
    'int_hullreinforcement',
    'int_metaalloyhullreinforcement',
    'int_modulereinforcement',
    'int_shieldcellbank',
    'int_guardianhullreinforcement',
    'int_guardianmodulereinforcement',
    'int_guardianshieldreinforcement',
];

/**
 * Journal Modifier Label → the {@link OutfittingModule} field holding its base
 * value. The three `*OptimalMass` labels and the two `*Strength`/`*Performance`
 * labels all share a stats field; only one is ever referenced for a given module.
 */
const STAT_LABELS: readonly (readonly [string, keyof OutfittingModule])[] = [
    ['Mass', 'mass'],
    ['Integrity', 'integrity'],
    ['PowerDraw', 'powerDraw'],
    ['BootTime', 'bootTime'],
    ['FSDOptimalMass', 'optMass'],
    ['EngineOptimalMass', 'optMass'],
    ['ShieldGenOptimalMass', 'optMass'],
    ['EngineOptPerformance', 'optMultiplier'],
    ['ShieldGenStrength', 'optMultiplier'],
    ['MaxFuelPerJump', 'maxFuel'],
    ['PowerCapacity', 'powerCapacity'],
    ['HeatEfficiency', 'heatEfficiency'],
    ['EnginesCapacity', 'enginesCapacity'],
    ['EnginesRecharge', 'enginesRecharge'],
    ['SystemsCapacity', 'systemsCapacity'],
    ['SystemsRecharge', 'systemsRecharge'],
    ['WeaponsCapacity', 'weaponsCapacity'],
    ['WeaponsRecharge', 'weaponsRecharge'],
    ['FuelCapacity', 'fuelCapacity'],
    ['CargoCapacity', 'cargoCapacity'],
    ['RegenRate', 'shieldRegenRate'],
    ['BrokenRegenRate', 'shieldBrokenRegenRate'],
    ['DefenceModifierShieldMultiplier', 'shieldBoost'],
];

/** The core slot type a standard module fills, or `null` if it is not a core module. */
function coreTypeOf(symbol: string): CoreSlotType | null {
    const s = symbol.toLowerCase();
    for (const [prefix, type] of CORE_PREFIXES) if (s.startsWith(prefix)) return type;
    return null;
}

/** The full record (identity + stats) for a module id, across every category. */
function statFor(item: string): OutfittingModule | null {
    return getModuleBySymbol(item, ALL_MODULES);
}

/** A module's base stat values keyed by journal Modifier Label, for engineering. */
function baseStats(stats: OutfittingModule): Record<string, number> {
    const base: Record<string, number> = {};
    for (const [label, field] of STAT_LABELS) {
        const value = stats[field];
        if (typeof value === 'number') base[label] = value;
    }
    return base;
}

/** Modifier labels that cannot be computed from the base stats this library carries. */
function missingBaseLabels(
    base: Readonly<Record<string, number>>,
    features: readonly { readonly label: string }[],
    experimental?: readonly { readonly label: string }[],
): string[] {
    return [
        ...new Set(
            [...features, ...(experimental ?? [])]
                .map((feature) => feature.label)
                .filter((label) => base[label] === undefined),
        ),
    ];
}

/** The blueprints that can engineer a module, with the grades each offers. */
function availableBlueprintsFor(item: string): AvailableBlueprint[] {
    const target = moduleEngineeringTarget(item);
    const stats = statFor(item);
    if (!stats) return [];
    const base = baseStats(stats);
    const out: AvailableBlueprint[] = [];
    for (const fdname of Object.keys(BLUEPRINTS)) {
        if (!blueprintTargets(fdname)?.includes(target)) continue;
        const grades = Object.entries(BLUEPRINTS[fdname]!)
            .filter(([, grade]) => missingBaseLabels(base, grade.features).length === 0)
            .map(([grade]) => Number(grade))
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
        if (grades.length > 0) out.push({ fdname, grades });
    }
    return out;
}

/** The experimental-effect `fdname`s that can be applied to a module. */
function availableExperimentalsFor(item: string): string[] {
    const target = moduleEngineeringTarget(item);
    const stats = statFor(item);
    if (!stats) return [];
    const base = baseStats(stats);
    return Object.keys(EXPERIMENTAL_EFFECTS).filter((fd) => {
        const effect = EXPERIMENTAL_EFFECTS[fd];
        return (
            experimentalTarget(fd) === target &&
            effect !== undefined &&
            missingBaseLabels(base, effect).length === 0
        );
    });
}

/** Detach a journal module from caller-owned and returned mutable objects. */
function cloneLoadoutModule(module: LoadoutModule): LoadoutModule {
    return {
        Slot: module.Slot,
        Item: module.Item,
        ...(module.On === undefined ? {} : { On: module.On }),
        ...(module.Priority === undefined ? {} : { Priority: module.Priority }),
        ...(module.Health === undefined ? {} : { Health: module.Health }),
        ...(module.Value === undefined ? {} : { Value: module.Value }),
        ...(module.Engineering === undefined
            ? {}
            : {
                  Engineering: {
                      BlueprintName: module.Engineering.BlueprintName,
                      Level: module.Engineering.Level,
                      Quality: module.Engineering.Quality,
                      ...(module.Engineering.ExperimentalEffect === undefined
                          ? {}
                          : { ExperimentalEffect: module.Engineering.ExperimentalEffect }),
                      ...(module.Engineering.ExperimentalEffect_Localised === undefined
                          ? {}
                          : {
                                ExperimentalEffect_Localised:
                                    module.Engineering.ExperimentalEffect_Localised,
                            }),
                      Modifiers: module.Engineering.Modifiers.map((modifier) => ({ ...modifier })),
                  },
              }),
    };
}

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

/** A human-readable label for a slot, derived from its key and kind. */
function slotDisplayName(slot: BuildSlot): string {
    switch (slot.kind) {
        case 'core':
            return slot.core ? CORE_NAMES[slot.core] : slot.key;
        case 'hardpoint': {
            const m = /^(Small|Medium|Large|Huge)Hardpoint(\d+)$/.exec(slot.key);
            return m ? `${m[1]} Hardpoint ${Number(m[2])}` : slot.key;
        }
        case 'utility': {
            const m = /^TinyHardpoint(\d+)$/.exec(slot.key);
            return m ? `Utility Mount ${Number(m[1])}` : slot.key;
        }
        case 'optional': {
            if (slot.restriction === 'planetaryApproachSuite') return 'Planetary Approach Suite';
            const mil = /^Military(\d+)$/.exec(slot.key);
            if (mil) return `Military Slot ${Number(mil[1])}`;
            const opt = /^Slot(\d+)_Size(\d+)$/.exec(slot.key);
            return opt ? `Optional Internal ${Number(opt[1])} (Size ${slot.size})` : slot.key;
        }
        case 'armour':
            return 'Armour';
        case 'cargoHatch':
            return 'Cargo Hatch';
    }
}

/**
 * A fitted ship — read a SLEF export, or assemble a hull from scratch.
 *
 * @remarks
 * Jump calculations resolve the frame shift drive's constants from the drive's module
 * record, applying any engineering the build carries (a Long Range blueprint's
 * `FSDOptimalMass`, for instance). For a SLEF build, mass comes from the export's
 * `UnladenMass`; for an assembled build it is the hull mass plus every fitted module's
 * mass (armour defaults to the zero-mass lightweight alloy).
 */
export class ShipLoadout {
    readonly #shipSymbol: string;
    readonly #modules: Map<string, LoadoutModule>;
    readonly #top: TopFigures;
    readonly #slotVersions = new Map<string, number>();

    private constructor(shipSymbol: string, modules: Map<string, LoadoutModule>, top: TopFigures) {
        this.#shipSymbol = shipSymbol;
        this.#modules = modules;
        this.#top = top;
    }

    /**
     * Build from a SLEF export.
     *
     * @param input - The SLEF JSON string, or an already-parsed SLEF object (see
     * {@link parseSlef} for accepted shapes).
     * @param index - Which entry to take when the export holds several builds.
     * Defaults to the first.
     * @returns The loadout for that entry.
     * @throws {SyntaxError} If `input` is a string that is not valid JSON.
     * @throws {TypeError} If the export holds no usable loadout, or `index` is out of
     * range.
     */
    static fromSlef(input: string | object, index = 0): ShipLoadout {
        const entries = parseSlef(input);
        const entry = entries[index];
        if (!entry) {
            throw new TypeError(
                `ShipLoadout.fromSlef: no entry at index ${index} (have ${entries.length})`,
            );
        }
        return ShipLoadout.fromLoadout(entry.data);
    }

    /**
     * Build from a bare journal `Loadout` event (the `data` half of a SLEF entry).
     *
     * @param event - A `Loadout` event object.
     * @returns The loadout.
     */
    static fromLoadout(event: LoadoutEvent): ShipLoadout {
        const modules = new Map<string, LoadoutModule>();
        for (const m of event.Modules) modules.set(m.Slot, cloneLoadoutModule(m));
        const top: TopFigures = {};
        if (event.ShipName !== undefined) top.ShipName = event.ShipName;
        if (event.ShipIdent !== undefined) top.ShipIdent = event.ShipIdent;
        if (event.HullValue !== undefined) top.HullValue = event.HullValue;
        if (event.ModulesValue !== undefined) top.ModulesValue = event.ModulesValue;
        if (event.Rebuy !== undefined) top.Rebuy = event.Rebuy;
        if (event.UnladenMass !== undefined) top.UnladenMass = event.UnladenMass;
        if (event.CargoCapacity !== undefined) top.CargoCapacity = event.CargoCapacity;
        if (event.FuelCapacity !== undefined) top.FuelCapacity = { ...event.FuelCapacity };
        return new ShipLoadout(event.Ship, modules, top);
    }

    /**
     * Start a new, empty build for a hull — no modules fitted.
     *
     * @param shipSymbol - The hull's internal symbol, e.g. `"Anaconda"`
     * (case-insensitive).
     * @returns An empty loadout whose {@link slots} come from the hull's declared
     * layout.
     * @throws {TypeError} If no hull with that symbol has a known slot layout.
     * @example
     * ```ts
     * ShipLoadout.empty('Sidewinder').slotsOfKind('hardpoint').length; // -> 2
     * ```
     */
    static empty(shipSymbol: string): ShipLoadout {
        const layout = getShipSlots(shipSymbol);
        if (!layout) {
            throw new TypeError(`ShipLoadout.empty: no slot layout for hull "${shipSymbol}"`);
        }
        return new ShipLoadout(layout.symbol, new Map(), {});
    }

    /** The hull's internal id, e.g. `"explorer_nx"`. */
    get shipSymbol(): string {
        return this.#shipSymbol;
    }

    /** The player-given ship name, or `null` if the build has none. */
    get shipName(): string | null {
        return this.#top.ShipName ?? null;
    }

    /** The player-given ID plate, or `null` if the build has none. */
    get shipIdent(): string | null {
        return this.#top.ShipIdent ?? null;
    }

    /**
     * Hull + modules mass with an empty tank and no cargo, in tonnes, or `null` if it
     * cannot be determined (no `UnladenMass` in the export and the hull's mass is not
     * in the stats catalogue).
     *
     * @remarks
     * A SLEF export's `UnladenMass` is trusted verbatim. Otherwise the mass is the
     * hull's `hullMass` plus every fitted module's mass (post-engineering), with armour
     * at the zero-mass lightweight default.
     */
    get unladenMass(): number | null {
        if (this.#top.UnladenMass !== undefined) return this.#top.UnladenMass;
        const hull = getShipBySymbol(this.#shipSymbol);
        if (!hull || hull.hullMass === undefined) return null;
        let mass = hull.hullMass;
        for (const m of this.#modules.values()) {
            const moduleMass = this.#moduleMass(m);
            if (moduleMass === null) return null;
            mass += moduleMass;
        }
        return mass;
    }

    /**
     * Fuel-tank capacities, in tonnes. A SLEF export's `FuelCapacity` is used when
     * present; otherwise the main capacity is the sum of the fitted fuel tanks and the
     * reserve comes from the hull's stats.
     */
    get fuelCapacity(): FuelCapacity {
        const cap = this.#top.FuelCapacity;
        const main = cap?.Main ?? this.#sumFuelTanks();
        const reserve = cap?.Reserve ?? getShipBySymbol(this.#shipSymbol)?.reserveFuelCapacity ?? 0;
        return { main, reserve };
    }

    /**
     * Cargo capacity, in tonnes. A SLEF export's `CargoCapacity` is used when present;
     * otherwise it is the sum of the fitted cargo racks.
     */
    get cargoCapacity(): number {
        if (this.#top.CargoCapacity !== undefined) return this.#top.CargoCapacity;
        let sum = 0;
        for (const m of this.#modules.values()) sum += statFor(m.Item)?.cargoCapacity ?? 0;
        return sum;
    }

    /** Hull cost in credits, or `null` if unknown. */
    get hullValue(): number | null {
        return this.#top.HullValue ?? null;
    }

    /** Fitted-modules cost in credits, or `null` if unknown. */
    get modulesValue(): number | null {
        return this.#top.ModulesValue ?? null;
    }

    /** Insurance rebuy cost in credits, or `null` if unknown. */
    get rebuy(): number | null {
        return this.#top.Rebuy ?? null;
    }

    /** The fitted modules, in the order they were added / exported. */
    get modules(): readonly LoadoutModule[] {
        return [...this.#modules.values()].map(cloneLoadoutModule);
    }

    /**
     * Every mount the hull offers, each a live {@link LoadoutSlot} handle that knows its
     * own key and reports the module fitted in it, in outfitting-panel order.
     *
     * The handles are **live views**: fit or clear a module and the same handle's
     * {@link LoadoutSlot.module | `module`} / {@link LoadoutSlot.occupied | `occupied`}
     * update to match. You can fit, clear, list candidates and engineer straight from a
     * slot without ever repeating its key.
     *
     * @throws {TypeError} If the hull has no known slot layout.
     * @example
     * ```ts
     * ShipLoadout.empty('Anaconda').slots().filter((s) => s.occupied); // -> [] (empty build)
     * ```
     */
    slots(): LoadoutSlot[] {
        return this.#layout().map((slot) => new LoadoutSlot(this, slot));
    }

    /**
     * The hull's mounts of one kind, each a live {@link LoadoutSlot} handle.
     *
     * @param kind - Which kind of mount to list.
     * @throws {TypeError} If the hull has no known slot layout.
     */
    slotsOfKind(kind: SlotKind): LoadoutSlot[] {
        return this.slots().filter((s) => s.kind === kind);
    }

    /**
     * The hull's seven core-internal mounts (power plant, thrusters, FSD, life support,
     * power distributor, sensors, fuel tank), as live {@link LoadoutSlot} handles.
     *
     * @throws {TypeError} If the hull has no known slot layout.
     */
    coreModules(): LoadoutSlot[] {
        return this.slotsOfKind('core');
    }

    /**
     * The hull's weapon hardpoints, as live {@link LoadoutSlot} handles.
     *
     * @throws {TypeError} If the hull has no known slot layout.
     */
    hardpoints(): LoadoutSlot[] {
        return this.slotsOfKind('hardpoint');
    }

    /**
     * The hull's tiny utility mounts, as live {@link LoadoutSlot} handles.
     *
     * @throws {TypeError} If the hull has no known slot layout.
     */
    utilityMounts(): LoadoutSlot[] {
        return this.slotsOfKind('utility');
    }

    /**
     * The hull's optional-internal mounts (including any military and planetary-approach
     * slots), as live {@link LoadoutSlot} handles.
     *
     * @throws {TypeError} If the hull has no known slot layout.
     */
    optionalModules(): LoadoutSlot[] {
        return this.slotsOfKind('optional');
    }

    /**
     * A live {@link FittedModule} handle for the module in a slot, or `null` if the slot
     * is empty.
     *
     * The handle carries its slot key, so you can engineer, de-engineer or remove the
     * module — and ask which blueprints it accepts — without repeating the key:
     * `build.getFittedModule('FrameShiftDrive')?.applyBlueprint('FSD_LongRange', { grade: 5 })`.
     *
     * @param slotKey - The slot key, e.g. `"FrameShiftDrive"`, `"Slot01_Size6"`.
     */
    getFittedModule(slotKey: string): FittedModule | null {
        return this.#modules.has(slotKey)
            ? new FittedModule(
                  this,
                  slotKey,
                  this.#slotVersions.get(slotKey) ?? 0,
                  () => this.#slotVersions.get(slotKey) ?? 0,
              )
            : null;
    }

    /**
     * The raw journal `Loadout` module object in a slot, or `null` if empty. The
     * low-level counterpart to {@link getFittedModule} for when you want the plain data
     * rather than a handle.
     *
     * @param slotKey - The slot key.
     */
    moduleAt(slotKey: string): LoadoutModule | null {
        const module = this.#modules.get(slotKey);
        return module ? cloneLoadoutModule(module) : null;
    }

    /**
     * The modules from a catalogue that fit a given slot — its size, kind and any
     * restriction all satisfied.
     *
     * @param slotKey - The slot key to fit.
     * @param catalogue - A module catalogue to filter (e.g. `INTERNAL_MODULES`); pass
     * only the category you need so bundlers keep the rest out.
     * @returns The fitting modules, in catalogue order.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If the hull has no known slot layout (a SLEF build on an
     * unrecognised hull).
     * @example
     * ```ts
     * import { ALL_MODULES } from '@elite-dangerous-almanac/core/ships';
     * // Pass ALL_MODULES to search every category (a fuel tank, say, is a STANDARD
     * // module yet fits optional slots); pass one category to narrow the bundle.
     * ShipLoadout.empty('Anaconda').modulesForSlot('FrameShiftDrive', ALL_MODULES);
     * ```
     */
    modulesForSlot(slotKey: string, catalogue: readonly OutfittingModule[]): OutfittingModule[] {
        const slot = this.#requireSlot(slotKey);
        return catalogue.filter((m) => this.#fitError(slot, m) === null);
    }

    /**
     * Fit a module into a slot, replacing whatever is there.
     *
     * @param slotKey - The slot key to fit into.
     * @param module - The module to fit (resolve it from a catalogue first, e.g. with
     * {@link getModuleBySymbol}).
     * @returns `this`, for chaining.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If `module` is null/undefined (e.g. a `getModuleBySymbol`
     * miss), the module does not fit the slot (wrong kind, too large, or a restriction
     * the module does not satisfy), or the hull has no known slot layout (a SLEF build
     * on an unrecognised hull).
     * @example
     * ```ts
     * import { STANDARD_MODULES, getModuleBySymbol } from '@elite-dangerous-almanac/core/ships';
     * const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', STANDARD_MODULES)!;
     * const tank = getModuleBySymbol('Int_FuelTank_Size6_Class3', STANDARD_MODULES)!;
     * build.setModule('FrameShiftDrive', fsd).setModule('Slot01_Size7', tank);
     * ```
     */
    setModule(slotKey: string, module: OutfittingModule): this {
        const slot = this.#requireSlot(slotKey);
        if (!module) {
            // Guards the common `getModuleBySymbol('typo', CAT)!` miss, whose `!` lies.
            throw new TypeError(
                `ShipLoadout.setModule: no module supplied for "${slotKey}" (did the module lookup return undefined?)`,
            );
        }
        const problem = this.#fitError(slot, module);
        if (problem) {
            throw new TypeError(`ShipLoadout.setModule: ${module.symbol} → ${slotKey}: ${problem}`);
        }
        this.#replaceModule(slotKey, { Slot: slotKey, Item: module.symbol });
        return this;
    }

    /**
     * Empty a slot.
     *
     * @param slotKey - The slot key to clear.
     * @returns `this`, for chaining. Clearing an already-empty slot is a no-op.
     */
    removeModule(slotKey: string): this {
        if (this.#modules.has(slotKey)) this.#replaceModule(slotKey, null);
        return this;
    }

    /**
     * Engineer the module in a slot — apply a blueprint (with a grade and quality) and
     * an optional experimental effect, computing the resulting stat modifiers.
     *
     * The modifiers are stored as an `Engineering` block on the fitted module, so the
     * build's jump-range and mass calculations pick them up automatically.
     *
     * @param slotKey - The slot whose module to engineer.
     * @param blueprintName - The blueprint's Frontier `fdname`, e.g. `"FSD_LongRange"`.
     * @param options - {@link ApplyBlueprintOptions}: `grade` (1–5), optional `quality`
     * (0–1, default 1), and optional `experimental` effect `fdname`.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty, or the blueprint/grade/experimental is
     * unknown, or `quality` is outside `[0, 1]`.
     * @throws {TypeError} If the fitted module has no stats to engineer, or the
     * blueprint/experimental targets another module family, or the catalogue does
     * not carry every base stat the recipe modifies. Incomplete engineering is
     * rejected rather than stored as a partial journal modifier block.
     * @example
     * ```ts
     * build.setModule('FrameShiftDrive', fsd)
     *      .applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
     *          grade: 5,
     *          experimental: 'special_fsd_heavy',
     *      });
     * build.maxJumpRange(); // now reflects the engineered optimal mass
     * ```
     */
    applyBlueprint(slotKey: string, blueprintName: string, options: ApplyBlueprintOptions): this {
        const module = this.#modules.get(slotKey);
        if (!module) {
            throw new RangeError(`ShipLoadout.applyBlueprint: slot "${slotKey}" is empty`);
        }
        const stats = statFor(module.Item);
        if (!stats) {
            throw new TypeError(`ShipLoadout.applyBlueprint: no stats for module "${module.Item}"`);
        }
        const features = getBlueprintGrade(blueprintName, options.grade);
        if (!features) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: no blueprint "${blueprintName}" grade ${options.grade}`,
            );
        }
        let experimental;
        if (options.experimental !== undefined) {
            experimental = getExperimentalEffect(options.experimental);
            if (!experimental) {
                throw new RangeError(
                    `ShipLoadout.applyBlueprint: unknown experimental effect "${options.experimental}"`,
                );
            }
        }
        const quality = options.quality ?? 1;
        if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: quality must be a finite number in [0, 1]`,
            );
        }
        const moduleTarget = moduleEngineeringTarget(module.Item);
        const expectedTargets = blueprintTargets(blueprintName);
        if (expectedTargets === null || !expectedTargets.includes(moduleTarget)) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: blueprint "${blueprintName}" targets ${expectedTargets?.join('/') ?? 'an unknown module family'}, not ${moduleTarget} module "${module.Item}"`,
            );
        }
        if (options.experimental !== undefined) {
            const expectedExperimentalTarget = experimentalTarget(options.experimental);
            if (
                expectedExperimentalTarget === null ||
                expectedExperimentalTarget !== moduleTarget
            ) {
                throw new TypeError(
                    `ShipLoadout.applyBlueprint: experimental effect "${options.experimental}" targets ${expectedExperimentalTarget ?? 'an unknown module family'}, not ${moduleTarget} module "${module.Item}"`,
                );
            }
        }
        const base = baseStats(stats);
        const missing = missingBaseLabels(base, features, experimental);
        if (missing.length > 0) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: cannot compute "${blueprintName}" for module "${module.Item}"; missing base stats for ${missing.join(', ')}`,
            );
        }
        const modifiers = computeModifiers(base, features, quality, experimental);
        const engineering: ModuleEngineering = {
            BlueprintName: blueprintName,
            Level: options.grade,
            Quality: quality,
            ...(options.experimental !== undefined
                ? { ExperimentalEffect: options.experimental }
                : {}),
            Modifiers: modifiers,
        };
        this.#replaceModule(slotKey, { ...module, Engineering: engineering });
        return this;
    }

    /**
     * Strip the engineering from a slot's module, restoring its base stats.
     *
     * @param slotKey - The slot to de-engineer.
     * @returns `this`, for chaining. A no-op if the slot is empty or un-engineered.
     */
    clearEngineering(slotKey: string): this {
        const module = this.#modules.get(slotKey);
        if (module?.Engineering) {
            const bare: LoadoutModule = { Slot: module.Slot, Item: module.Item };
            if (module.On !== undefined) (bare as { On?: boolean }).On = module.On;
            if (module.Priority !== undefined) {
                (bare as { Priority?: number }).Priority = module.Priority;
            }
            if (module.Health !== undefined) (bare as { Health?: number }).Health = module.Health;
            if (module.Value !== undefined) (bare as { Value?: number }).Value = module.Value;
            this.#replaceModule(slotKey, bare);
        }
        return this;
    }

    /**
     * The resolved frame-shift-drive constants for this build — post-engineering,
     * with any Guardian FSD Booster folded into `jumpBoost`.
     *
     * @throws {TypeError} If the build has no frame shift drive, or the drive's id is
     * not in the stats catalogue.
     */
    get frameShiftDrive(): FrameShiftDriveParams {
        const drive = this.#resolveDrive();
        if (drive === null) throw new TypeError('ShipLoadout: build has no frame shift drive');
        return drive;
    }

    /**
     * Best single-jump range, in light-years — no cargo, and exactly one jump's fuel
     * aboard (the lightest the ship jumps). This is the figure the game and EDSY label
     * "maximum jump range".
     *
     * @remarks
     * Returns `0` when no fuel is available — an assembled build with no fuel tank
     * fitted has an empty main tank, so there is nothing to jump on.
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     */
    maxJumpRange(): number {
        const fsd = this.frameShiftDrive;
        const fuel = Math.min(this.fuelCapacity.main, fsd.maxFuel);
        return singleJumpRange(this.#requireMass(0), fuel, fsd);
    }

    /**
     * The range of a single jump for a chosen fuel and cargo load, in light-years.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     */
    jumpRange(options: JumpOptions = {}): number {
        const fsd = this.frameShiftDrive;
        const fuel = options.fuel ?? this.fuelCapacity.main;
        return singleJumpRange(this.#requireMass(options.cargo ?? 0), fuel, fsd);
    }

    /**
     * Single-jump range on a full tank with no cargo, in light-years.
     *
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     */
    unladenJumpRange(): number {
        return this.jumpRange();
    }

    /**
     * Single-jump range on a full tank with a full cargo hold, in light-years.
     *
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     */
    ladenJumpRange(): number {
        return this.jumpRange({ cargo: this.cargoCapacity });
    }

    /**
     * The fuel a single jump of a given distance costs, in tonnes.
     *
     * @param distance - The jump distance, in light-years.
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns Fuel used, in tonnes (capped at the drive's max fuel per jump).
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     */
    fuelPerJump(distance: number, options: JumpOptions = {}): number {
        const fsd = this.frameShiftDrive;
        const fuel = options.fuel ?? this.fuelCapacity.main;
        return fuelPerJump(distance, this.#requireMass(options.cargo ?? 0), fuel, fsd);
    }

    /**
     * Total multi-jump range on a full main tank, in light-years — the sum of
     * successive jumps as the tank drains.
     *
     * @param options - `cargo` aboard, in tonnes; defaults to `0`.
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     */
    totalRange(options: { cargo?: number } = {}): number {
        return totalRange(
            this.#requireMass(options.cargo ?? 0),
            this.fuelCapacity.main,
            this.frameShiftDrive,
        );
    }

    #layout(): BuildSlot[] {
        const layout = getShipSlots(this.#shipSymbol);
        if (!layout) {
            throw new TypeError(`ShipLoadout: no slot layout for hull "${this.#shipSymbol}"`);
        }
        return enumerateSlots(layout);
    }

    #requireSlot(slotKey: string): BuildSlot {
        const slot = this.#layout().find((s) => s.key === slotKey);
        if (!slot) {
            throw new RangeError(
                `ShipLoadout: hull "${this.#shipSymbol}" has no slot "${slotKey}"`,
            );
        }
        return slot;
    }

    /** Why `module` cannot go in `slot`, or `null` if it fits. */
    #fitError(slot: BuildSlot, module: OutfittingModule): string | null {
        if (slot.kind === 'armour' || slot.kind === 'cargoHatch') {
            return `the ${slot.kind} slot cannot be changed`;
        }
        // A module restricted to another hull never fits. The registry's `ship`
        // field is unreliable here (a "None" sentinel on these modules), so the
        // restriction comes from the stats catalogue's `restrictedToShips`.
        const restricted = statFor(module.symbol)?.restrictedToShips;
        if (
            restricted &&
            !restricted.some((s) => s.toLowerCase() === this.#shipSymbol.toLowerCase())
        ) {
            return `module is restricted to ${restricted.join(', ')}`;
        }
        const sym = module.symbol.toLowerCase();
        const coreType = coreTypeOf(sym);

        switch (slot.kind) {
            case 'core': {
                // Match on the core type, not the category: the Guardian power modules
                // are core but filed under `internal`.
                if (coreType !== slot.core) return `not a ${slot.core} module`;
                break;
            }
            case 'hardpoint': {
                if (module.category !== 'hardpoint') return 'not a hardpoint weapon';
                break;
            }
            case 'utility': {
                if (module.category !== 'utility') return 'not a utility module';
                return null; // utility mounts are all the same tiny size
            }
            case 'optional': {
                const isFuelTank = sym.startsWith(FUEL_TANK_PREFIX);
                if (module.category !== 'internal' && !isFuelTank) {
                    return 'not an optional-internal module';
                }
                // A core module (except a fuel tank, which also fits optional slots)
                // belongs only in its core slot.
                if (coreType && coreType !== 'fuelTank') {
                    return 'a core module only fits its core slot';
                }
                const isPas = sym.startsWith(PLANETARY_APPROACH_PREFIX);
                if (slot.restriction === 'planetaryApproachSuite') {
                    if (!isPas) return 'slot only takes a planetary approach suite';
                } else if (isPas) {
                    return 'a planetary approach suite only fits its own slot';
                }
                if (
                    slot.restriction === 'military' &&
                    !MILITARY_PREFIXES.some((p) => sym.startsWith(p))
                ) {
                    return 'slot only takes a military-eligible module';
                }
                break;
            }
        }

        if (module.class > slot.size) {
            return `module size ${module.class} exceeds slot size ${slot.size}`;
        }
        return null;
    }

    /** Unladen mass plus the given cargo, or throw if the mass is unknown. */
    #requireMass(cargo: number): number {
        const unladen = this.unladenMass;
        if (unladen === null) {
            throw new TypeError(
                'ShipLoadout: cannot determine mass (no UnladenMass, unknown hull)',
            );
        }
        return unladen + cargo;
    }

    #sumFuelTanks(): number {
        let sum = 0;
        for (const m of this.#modules.values()) sum += statFor(m.Item)?.fuelCapacity ?? 0;
        return sum;
    }

    /** Replace one fitted module and keep imported aggregate figures coherent. */
    #replaceModule(slotKey: string, replacement: LoadoutModule | null): void {
        const previous = this.#modules.get(slotKey) ?? null;
        this.#adjustImportedFigures(previous, replacement);
        if (replacement === null) this.#modules.delete(slotKey);
        else this.#modules.set(slotKey, cloneLoadoutModule(replacement));
        this.#slotVersions.set(slotKey, (this.#slotVersions.get(slotKey) ?? 0) + 1);
    }

    /**
     * Adjust SLEF aggregates by the changed module's contribution. If either side
     * cannot be resolved, discard that aggregate so its getter recomputes safely.
     */
    #adjustImportedFigures(previous: LoadoutModule | null, next: LoadoutModule | null): void {
        const previousMass = this.#moduleMass(previous);
        const nextMass = this.#moduleMass(next);
        if (this.#top.UnladenMass !== undefined) {
            if (previousMass === null || nextMass === null) delete this.#top.UnladenMass;
            else this.#top.UnladenMass += nextMass - previousMass;
        }

        const previousCargo = this.#moduleCapacity(previous, 'CargoCapacity', 'cargoCapacity');
        const nextCargo = this.#moduleCapacity(next, 'CargoCapacity', 'cargoCapacity');
        if (this.#top.CargoCapacity !== undefined) {
            if (previousCargo === null || nextCargo === null) delete this.#top.CargoCapacity;
            else this.#top.CargoCapacity += nextCargo - previousCargo;
        }

        const previousFuel = this.#moduleCapacity(previous, 'FuelCapacity', 'fuelCapacity');
        const nextFuel = this.#moduleCapacity(next, 'FuelCapacity', 'fuelCapacity');
        if (this.#top.FuelCapacity?.Main !== undefined) {
            const reserve = this.#top.FuelCapacity.Reserve;
            if (previousFuel === null || nextFuel === null) {
                if (reserve === undefined) delete this.#top.FuelCapacity;
                else this.#top.FuelCapacity = { Reserve: reserve };
            } else {
                this.#top.FuelCapacity = {
                    Main: this.#top.FuelCapacity.Main + nextFuel - previousFuel,
                    ...(reserve === undefined ? {} : { Reserve: reserve }),
                };
            }
        }

        // No catalogue carries post-purchase module value or rebuy changes.
        delete this.#top.ModulesValue;
        delete this.#top.Rebuy;
    }

    /** A module's post-engineering mass, `0` for no module, or `null` if unknown. */
    #moduleMass(module: LoadoutModule | null): number | null {
        if (module === null) return 0;
        const modified = getModifier(module, 'Mass');
        if (modified !== null) return modified;
        const stats = statFor(module.Item);
        if (stats?.mass !== undefined) return stats.mass;
        if (module.Slot === 'CargoHatch' && module.Item.toLowerCase() === 'modularcargobaydoor') {
            return 0;
        }
        if (module.Slot === 'Armour') return this.#bulkheadMass(module.Item);
        return null;
    }

    /** Resolve a bulkhead's added mass from its stable Frontier symbol suffix. */
    #bulkheadMass(item: string): number | null {
        const layout = getShipSlots(this.#shipSymbol);
        if (!layout) return null;
        const normalized = item.toLowerCase();
        let index: number | null = null;
        if (normalized.endsWith('_armour_grade1_default')) index = 0;
        else if (normalized.endsWith('_armour_grade1'))
            index = layout.bulkheads.length === 6 ? 1 : 0;
        else if (normalized.endsWith('_armour_grade2'))
            index = layout.bulkheads.length === 6 ? 2 : 1;
        else if (normalized.endsWith('_armour_grade3'))
            index = layout.bulkheads.length === 6 ? 3 : 2;
        else if (normalized.endsWith('_armour_mirrored'))
            index = layout.bulkheads.length === 6 ? 4 : 3;
        else if (normalized.endsWith('_armour_reactive'))
            index = layout.bulkheads.length === 6 ? 5 : 4;
        return index === null ? null : (layout.bulkheads[index]?.mass ?? null);
    }

    /**
     * A fitted module's post-engineering cargo/fuel capacity. Missing stats are
     * unknown only for symbols that identify the corresponding capacity module.
     */
    #moduleCapacity(
        module: LoadoutModule | null,
        modifierLabel: 'CargoCapacity' | 'FuelCapacity',
        field: 'cargoCapacity' | 'fuelCapacity',
    ): number | null {
        if (module === null) return 0;
        const modified = getModifier(module, modifierLabel);
        if (modified !== null) return modified;
        const stats = statFor(module.Item);
        if (stats?.[field] !== undefined) return stats[field];
        const symbol = module.Item.toLowerCase();
        const shouldCarryCapacity =
            field === 'cargoCapacity'
                ? symbol.includes('cargorack')
                : symbol.startsWith(FUEL_TANK_PREFIX);
        return shouldCarryCapacity ? null : 0;
    }

    #resolveDrive(): FrameShiftDriveParams | null {
        let fsdModule: LoadoutModule | undefined;
        for (const m of this.#modules.values()) {
            if (m.Item.toLowerCase().startsWith(FSD_PREFIX)) {
                fsdModule = m;
                break;
            }
        }
        if (!fsdModule) return null;
        const base = statFor(fsdModule.Item);
        if (!base || base.fuelMul === undefined || base.fuelPower === undefined) {
            // A drive is fitted, but the stats catalogue has no jump constants for it
            // (an unrecognised / newer drive id). Fail with a diagnosable message
            // rather than the "no frame shift drive" one the caller would otherwise get.
            throw new TypeError(
                `ShipLoadout: no jump constants in the stats catalogue for frame shift drive "${fsdModule.Item}"`,
            );
        }

        const optMass = getModifier(fsdModule, 'FSDOptimalMass') ?? base.optMass ?? 0;
        const maxFuel = getModifier(fsdModule, 'MaxFuelPerJump') ?? base.maxFuel ?? 0;

        return {
            optMass,
            maxFuel,
            fuelMul: base.fuelMul,
            fuelPower: base.fuelPower,
            jumpBoost: this.#resolveJumpBoost(),
        };
    }

    /** The active Guardian FSD Booster's jump bonus, in LY (`0` if none/powered off). */
    #resolveJumpBoost(): number {
        for (const m of this.#modules.values()) {
            if (!m.Item.toLowerCase().startsWith(BOOSTER_PREFIX)) continue;
            if (m.On === false) continue; // an unpowered booster gives no bonus
            return statFor(m.Item)?.jumpBoost ?? 0;
        }
        return 0;
    }
}

/**
 * A live handle on one of a hull's mounts, as returned by {@link ShipLoadout.slots},
 * {@link ShipLoadout.coreModules}, {@link ShipLoadout.hardpoints} and friends.
 *
 * The slot knows its own key, so you can list what fits it, fit or clear a module and
 * reach the fitted module's engineering without ever repeating the key. It is a **live
 * view** onto its {@link ShipLoadout}: {@link module} and {@link occupied} reflect the
 * current build every time you read them.
 *
 * @example
 * ```ts
 * const [drive] = ShipLoadout.empty('Anaconda').coreModules().filter((s) => s.core === 'frameShiftDrive');
 * drive.modulesForSlot(STANDARD_MODULES);            // what fits this exact slot
 * drive.fit(getModuleBySymbol('Int_Hyperdrive_Size6_Class5', STANDARD_MODULES)!)
 *      .applyBlueprint('FSD_LongRange', { grade: 5 }); // fit, then engineer, no key repeated
 * ```
 */
export class LoadoutSlot implements BuildSlot {
    /** Stable, journal-compatible slot key, e.g. `"FrameShiftDrive"`, `"Slot01_Size6"`. */
    readonly key: string;
    /** Which kind of mount this is. */
    readonly kind: SlotKind;
    /** Slot size (class); `0` for utility/armour/cargo-hatch placeholders. */
    readonly size: number;
    /** The optional-internal restriction, when the slot is a restricted one. */
    readonly restriction?: SlotRestriction;
    /** For a core slot, which core module type it accepts. */
    readonly core?: CoreSlotType;
    /** A human-readable label, e.g. `"Frame Shift Drive"`, `"Huge Hardpoint 1"`. */
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

    /** The module fitted here as a live {@link FittedModule} handle, or `null` if empty. */
    get module(): FittedModule | null {
        return this.#loadout.getFittedModule(this.key);
    }

    /** Whether a module is fitted in this slot right now. */
    get occupied(): boolean {
        return this.#loadout.moduleAt(this.key) !== null;
    }

    /**
     * The modules from a catalogue that fit this slot — its size, kind and any
     * restriction all satisfied. The slot key is implied.
     *
     * @param catalogue - A module catalogue to filter (e.g. `INTERNAL_MODULES`, or
     * `ALL_MODULES` to search every category); pass only the category you need so
     * bundlers keep the rest out.
     * @returns The fitting modules, in catalogue order.
     */
    modulesForSlot(catalogue: readonly OutfittingModule[]): OutfittingModule[] {
        return this.#loadout.modulesForSlot(this.key, catalogue);
    }

    /**
     * Fit a module into this slot, replacing whatever is there.
     *
     * @param module - The module to fit (resolve it from a catalogue first).
     * @returns A live {@link FittedModule} handle for the newly fitted module, so you
     * can engineer it in the same chain.
     * @throws {TypeError} If the module does not fit (wrong kind, too large, or a
     * restriction it does not satisfy), or is null/undefined.
     */
    fit(module: OutfittingModule): FittedModule {
        this.#loadout.setModule(this.key, module);
        return this.#loadout.getFittedModule(this.key)!;
    }

    /**
     * Empty this slot.
     *
     * @returns The slot, for chaining. Clearing an already-empty slot is a no-op.
     */
    clear(): this {
        this.#loadout.removeModule(this.key);
        return this;
    }
}

/**
 * A live handle on the module fitted in one slot, as returned by
 * {@link ShipLoadout.getFittedModule} and {@link LoadoutSlot.module}.
 *
 * The handle carries its slot key, so its engineering methods need no key. Its journal
 * fields ({@link item}, {@link engineering}, and the capitalised {@link Item} /
 * {@link Engineering} aliases) are **live** — they read the current build, so a handle
 * stays valid across its own {@link applyBlueprint} / {@link clearEngineering} calls.
 * Once the slot is emptied (via {@link remove}, or the module being replaced elsewhere),
 * the handle is spent: reading its fields throws a `TypeError` rather than returning
 * stale data.
 *
 * @example
 * ```ts
 * const fsd = build.getFittedModule('FrameShiftDrive')!;
 * fsd.getAvailableBlueprints();                  // -> [{ fdname: 'FSD_LongRange', grades: [1..5] }, ...]
 * fsd.applyBlueprint('FSD_LongRange', { grade: 5, experimental: 'special_fsd_heavy' });
 * fsd.clearEngineering();                        // back to base stats
 * ```
 */
export class FittedModule {
    readonly #loadout: ShipLoadout;
    readonly #slotKey: string;
    #slotVersion: number;
    readonly #currentSlotVersion: () => number;

    /** @internal Constructed by {@link ShipLoadout}; not part of the public API. */
    constructor(
        loadout: ShipLoadout,
        slotKey: string,
        slotVersion: number,
        currentSlotVersion: () => number,
    ) {
        this.#loadout = loadout;
        this.#slotKey = slotKey;
        this.#slotVersion = slotVersion;
        this.#currentSlotVersion = currentSlotVersion;
    }

    #raw(): LoadoutModule {
        if (this.#slotVersion !== this.#currentSlotVersion()) {
            throw new TypeError(
                `FittedModule: slot "${this.#slotKey}" no longer contains this fitted module`,
            );
        }
        const module = this.#loadout.moduleAt(this.#slotKey);
        if (!module) {
            throw new TypeError(
                `FittedModule: slot "${this.#slotKey}" is now empty (the module was removed)`,
            );
        }
        return module;
    }

    /** The slot key this module occupies, e.g. `"FrameShiftDrive"`. */
    get slot(): string {
        return this.#slotKey;
    }

    /** The slot key, journal spelling (alias of {@link slot}). */
    get Slot(): string {
        return this.#slotKey;
    }

    /** The module's Frontier symbol, e.g. `"int_hyperdrive_size6_class5"`. */
    get item(): string {
        return this.#raw().Item;
    }

    /** The module's Frontier symbol, journal spelling (alias of {@link item}). */
    get Item(): string {
        return this.#raw().Item;
    }

    /** Whether the module is powered on, or `undefined` if the build does not say. */
    get On(): boolean | undefined {
        return this.#raw().On;
    }

    /** The module's power priority, or `undefined` if the build does not say. */
    get Priority(): number | undefined {
        return this.#raw().Priority;
    }

    /** The module's health (0–1), or `undefined` if the build does not say. */
    get Health(): number | undefined {
        return this.#raw().Health;
    }

    /** The module's credit value, or `undefined` if the build does not say. */
    get Value(): number | undefined {
        return this.#raw().Value;
    }

    /** The applied engineering, or `undefined` if the module is not engineered. */
    get engineering(): ModuleEngineering | undefined {
        return this.#raw().Engineering;
    }

    /** The applied engineering, journal spelling (alias of {@link engineering}). */
    get Engineering(): ModuleEngineering | undefined {
        return this.#raw().Engineering;
    }

    /** The underlying raw journal `Loadout` module object. */
    get raw(): LoadoutModule {
        return this.#raw();
    }

    /** This module's full catalogue record (identity + base stats), or `null`. */
    get stats(): OutfittingModule | null {
        return statFor(this.#raw().Item);
    }

    /**
     * Engineer this module — apply a blueprint (with a grade and quality) and an
     * optional experimental effect, computing and storing the resulting stat modifiers.
     * The slot key is implied.
     *
     * @param blueprintName - The blueprint's Frontier `fdname`, e.g. `"FSD_LongRange"`.
     * @param options - {@link ApplyBlueprintOptions}: `grade` (1–5), optional `quality`
     * (0–1, default 1), and optional `experimental` effect `fdname`.
     * @returns This handle, for chaining.
     * @throws {RangeError} If the blueprint/grade/experimental is unknown, or `quality`
     * is outside `[0, 1]`.
     * @throws {TypeError} If the module has no stats to engineer, or the
     * blueprint/experimental targets another module family.
     */
    applyBlueprint(blueprintName: string, options: ApplyBlueprintOptions): this {
        this.#raw();
        this.#loadout.applyBlueprint(this.#slotKey, blueprintName, options);
        this.#slotVersion = this.#currentSlotVersion();
        return this;
    }

    /**
     * Strip the engineering from this module, restoring its base stats.
     *
     * @returns This handle, for chaining. A no-op if the module is un-engineered.
     */
    clearEngineering(): this {
        this.#raw();
        this.#loadout.clearEngineering(this.#slotKey);
        this.#slotVersion = this.#currentSlotVersion();
        return this;
    }

    /**
     * The blueprints that can engineer this module, each with the grades it offers.
     *
     * @returns The compatible blueprints, in catalogue order.
     * Only grades whose complete modifier set can be computed from this module's
     * carried base stats are returned.
     * @example
     * ```ts
     * build.getFittedModule('FrameShiftDrive')!.getAvailableBlueprints();
     * // -> [{ fdname: 'FSD_LongRange', grades: [1, 2, 3, 4, 5] }, ...]
     * ```
     */
    getAvailableBlueprints(): AvailableBlueprint[] {
        return availableBlueprintsFor(this.#raw().Item);
    }

    /**
     * The experimental-effect `fdname`s that can be applied to this module.
     *
     * @returns The compatible experimental-effect ids, in catalogue order.
     * Effects requiring a base stat this catalogue does not carry are omitted.
     */
    getAvailableExperimentalEffects(): string[] {
        return availableExperimentalsFor(this.#raw().Item);
    }

    /** Remove this module from its slot. */
    remove(): void {
        this.#raw();
        this.#loadout.removeModule(this.#slotKey);
    }
}
