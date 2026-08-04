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
 * `setModule` snapshots the complete record it receives, including resolved
 * pre-engineered or caller-supplied stats, so every later metric uses the article that
 * was actually fitted rather than resolving its symbol back to a stock module.
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
 * import { CORE_MODULES, getModuleBySymbol } from '@elite-dangerous-almanac/core/ships';
 * const conda = ShipLoadout.empty('Anaconda');
 * conda.setModule('FrameShiftDrive', getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!);
 * conda.slotsOfKind('optional'); // every optional mount, occupied or empty, with size
 * ```
 *
 * @packageDocumentation
 */

import {
    parseSlef,
    getLoadoutModifier,
    toSlef as toSlefEnvelope,
    stringifySlef,
    type LoadoutEvent,
    type LoadoutModule,
    type Slef,
    type SlefHeader,
} from './slef.js';
import {
    singleJumpRange,
    fuelPerJump,
    totalRange,
    type FrameShiftDriveParams,
} from './jump-range.js';
import { getShipBySymbol, getShipSlots } from './ships.js';
import {
    enumerateSlots,
    SLOT_RESTRICTION_LABELS,
    type BuildSlot,
    type SlotKind,
    type CoreSlotType,
    type SlotRestriction,
} from './slots.js';
import { computeModifiers } from './engineering.js';
import { getBlueprintGrade } from './blueprints.js';
import { getExperimentalEffect } from './experimental-effects.js';
import {
    blueprintTargets,
    experimentalTarget,
    moduleEngineeringTarget,
} from './engineering-compatibility.js';
import type { ModuleEngineering } from './slef.js';
import type { OutfittingModule } from './modules.js';
import { baseStats, missingBaseLabels, statFor } from './loadout-engineering.js';
import {
    armourInputFor,
    powerAvailable,
    powerConsumerFor,
    shieldInputFor,
    weaponStatsFor,
} from './loadout-metrics.js';
import { powerBudget, type PowerBudget, type PowerConsumer } from './power.js';
import { shieldMetrics, type ShieldMetrics } from './shields.js';
import { armourMetrics, type ArmourMetrics } from './armour.js';
import { sumWeaponMetrics, weaponMetrics, type WeaponMetrics } from './weapons.js';
import { FittedModule } from './fitted-module.js';
import { LoadoutSlot } from './loadout-slot.js';
import { deepFreeze } from '../deep-freeze.js';

export { FittedModule } from './fitted-module.js';
export { LoadoutSlot } from './loadout-slot.js';

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

/** Options for the defence figures a build reports. */
export interface DefenceOptions {
    /**
     * Pips to the systems capacitor, `0`–`4`, folded into the shield resistances.
     * Defaults to `0` — the bare shield, as an outfitting screen shows it.
     */
    readonly systemsPips?: number;
}

/** One fitted weapon and what it does, as {@link ShipLoadout.weaponMetrics} reports it. */
export interface FittedWeaponMetrics {
    /** The hardpoint's slot key, e.g. `"LargeHardpoint1"`. */
    readonly slot: string;
    /** The weapon's internal symbol. */
    readonly symbol: string;
    /** The weapon's display name, e.g. `"Multi-Cannon"`. */
    readonly name: string;
    /** Whether the weapon is switched on — a disabled weapon is excluded from the totals. */
    readonly enabled: boolean;
    /** What this weapon does per second, post-engineering. */
    readonly metrics: WeaponMetrics;
}

/** A build's firepower: every fitted weapon, and the totals across the enabled ones. */
export interface BuildWeaponMetrics {
    /** Every fitted weapon, in slot order. */
    readonly weapons: readonly FittedWeaponMetrics[];
    /** The totals across the **enabled** weapons. */
    readonly total: WeaponMetrics;
}

/** A build's jump ranges at the loads that matter, in light-years. */
export interface JumpRangeSummary {
    /**
     * Best single jump: no cargo, and only one jump's fuel aboard — the figure the game
     * and EDSY label "maximum jump range".
     */
    readonly max: number;
    /** Single jump on a full tank with an empty hold. */
    readonly unladen: number;
    /** Single jump on a full tank with a full hold. */
    readonly laden: number;
    /** Summed range of every jump on one full tank, empty hold. */
    readonly totalUnladen: number;
    /** Summed range of every jump on one full tank, full hold. */
    readonly totalLaden: number;
}

/** A blueprint that can engineer a module, with the grades it offers. */
export interface AvailableBlueprint {
    /** The blueprint's Frontier `fdname`, e.g. `"FSD_LongRange"`. */
    readonly fdname: string;
    /** The grades the blueprint offers, ascending (e.g. `[1, 2, 3, 4, 5]`). */
    readonly grades: readonly number[];
}

/** How to shape a build on the way out — see {@link ShipLoadout.toLoadoutEvent}. */
export interface LoadoutExportOptions {
    /**
     * Module order. `'fitted'` — the default — keeps the order the build carries: an
     * import's own `Modules[]` order, or the order modules were fitted. `'slots'`
     * re-orders into outfitting-panel order; a module in a slot the hull's layout does
     * not describe keeps its relative position at the end rather than being dropped.
     */
    readonly moduleOrder?: 'fitted' | 'slots';
    /**
     * Write `On: true` / `Priority: 0` on modules that carry neither — as a journal
     * always does and a build assembled here never does. Off by default, following
     * SLEF's "require what is necessary, do not force the rest".
     */
    readonly explicitPower?: boolean;
}

/** As {@link LoadoutExportOptions}, plus the SLEF envelope — see {@link ShipLoadout.toSlef}. */
export interface SlefExportOptions extends LoadoutExportOptions {
    /**
     * The envelope header. Defaults to one naming this library; an app built on it
     * should pass its own, since SLEF's header credits the *exporting application*.
     */
    readonly header?: SlefHeader;
    /** Spaces per indent for {@link ShipLoadout.toSlefString}. `0` (the default) is compact. */
    readonly indent?: number;
}

/** Insurance rebuy is a flat 5% of the hull-plus-modules value, truncated. */
const REBUY_FRACTION = 0.05;

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
 * Weapon groups a **mining** hardpoint accepts (symbol prefixes) — the Type-11
 * Prospector's four mining mounts.
 *
 * @remarks
 * The Sub-Surface Extraction Missile is here because both source registries file it
 * with the displacement missile it is a variant of, despite its unrelated symbol.
 * The Pulse Wave Analyser, which coriolis-data also lists as eligible, is not: it is
 * a utility fitting, and no utility module fits a hardpoint of any kind.
 */
const MINING_PREFIXES: readonly string[] = [
    'hpt_mininglaser', // Mining Laser, Mining Lance
    'hpt_mining_abrblstr', // Abrasion Blaster
    'hpt_mining_seismchrgwarhd', // Seismic Charge Launcher
    'hpt_mining_subsurfdispmisle', // Sub-Surface Displacement Missile
    'hpt_human_extraction', // Sub-Surface Extraction Missile
    'hpt_miningtoolv2', // Mining Volley Repeater
];

/**
 * Optional-internal groups a **cargo** slot accepts (symbol prefixes) — the Panther
 * Clipper Mk II's `Cargo01` and `Cargo02`, which are its first size-8 and first size-7
 * mounts rather than its two largest. A fuel tank counts, as it does everywhere.
 */
const CARGO_PREFIXES: readonly string[] = [
    'int_cargorack',
    'int_largecargorack',
    'int_corrosionproofcargorack',
    'int_fueltank',
];

/**
 * Optional-internal groups a **limpet-controller** slot accepts (symbol prefixes) —
 * the Type-11 Prospector's size-5 controller mount. Both prefixes are needed: the
 * multi-limpet controllers are a separate family, not a `DroneControl` variant.
 */
const LIMPET_CONTROLLER_PREFIXES: readonly string[] = ['int_dronecontrol', 'int_multidronecontrol'];

/**
 * Optional-internal groups a **vessel-hangar** slot accepts (symbol prefixes) — the
 * Type-11 Prospector's size-5 hangar mount. The one prefix covers the Mk I and Mk II
 * bays alike; the game renamed them from fighter hangars but kept the symbols.
 */
const VESSEL_HANGAR_PREFIXES: readonly string[] = ['int_fighterbay'];

/**
 * Slot restriction → the module symbol prefixes it accepts.
 *
 * @remarks
 * `planetaryApproachSuite` is absent because it is the one restriction that binds
 * both ways — the suite fits nowhere else either — so `#fitError` handles it as a
 * pair of checks rather than a membership test. What each restriction accepts *in
 * words* is not repeated here: the refusal message is built from the exported
 * {@link SLOT_RESTRICTION_LABELS}, so a label an app shows and the error it may have
 * to explain cannot drift apart.
 */
const RESTRICTED_SLOT_PREFIXES: Record<
    Exclude<SlotRestriction, 'planetaryApproachSuite'>,
    readonly string[]
> = {
    mining: MINING_PREFIXES,
    military: MILITARY_PREFIXES,
    cargo: CARGO_PREFIXES,
    limpetController: LIMPET_CONTROLLER_PREFIXES,
    vesselHangar: VESSEL_HANGAR_PREFIXES,
};

/**
 * Why a module symbol fails a slot's restriction, or `null` if it satisfies it (or
 * the slot has none). The planetary approach suite is not checked here — see
 * {@link RESTRICTED_SLOT_PREFIXES}.
 */
function restrictionError(slot: BuildSlot, symbol: string): string | null {
    const restriction = slot.restriction;
    if (!restriction || restriction === 'planetaryApproachSuite') return null;
    if (RESTRICTED_SLOT_PREFIXES[restriction].some((prefix) => symbol.startsWith(prefix))) {
        return null;
    }
    return `slot only takes ${SLOT_RESTRICTION_LABELS[restriction]}`;
}

/**
 * The journal's **cosmetic** slot families, matched against a lower-cased slot key.
 *
 * @remarks
 * A real journal `Loadout` event lists far more than fitted modules: the cockpit, ship
 * kits, nameplates, decals, bobbles, paint jobs, engine and weapon colours, voice packs
 * and string lights. None is an outfitting module — the catalogues deliberately do not
 * carry them (see `data/ships/SOURCES.md`) — and all contribute neither mass nor credits.
 */
const COSMETIC_SLOT_PATTERNS: readonly RegExp[] = [
    /^shipcockpit$/,
    /^paintjob$/,
    /^decal\d*$/,
    /^shipname\d*$/,
    /^shipid\d*$/,
    /^bobble\d*$/,
    /^shipkit\w*$/,
    /^enginecolour$/,
    /^weaponcolour$/,
    /^vesselvoice$/,
    /^stringlights$/,
];

/**
 * Whether a journal slot key names a cosmetic mount rather than an outfitting one.
 *
 * @remarks
 * Recognised **positively**, from {@link COSMETIC_SLOT_PATTERNS}, rather than as "a name
 * `parseSlotName` does not know". The two are not the same thing: an unfamiliar
 * name is at least as likely to be a slot family the game has added, or a producer that
 * lower-cases its slot keys as the SLEF specification's own example does, and calling
 * that free and weightless would understate a build's mass and credits without saying so.
 * An article the catalogue can identify is therefore counted whatever its slot is called,
 * and only a genuinely unidentifiable one is classified by slot at all — see
 * {@link ShipLoadout.toLoadoutEvent}.
 */
function isCosmeticSlot(slotKey: string): boolean {
    const key = slotKey.toLowerCase();
    return COSMETIC_SLOT_PATTERNS.some((pattern) => pattern.test(key));
}

/** The core slot type a standard module fills, or `null` if it is not a core module. */
function coreTypeOf(symbol: string): CoreSlotType | null {
    const s = symbol.toLowerCase();
    for (const [prefix, type] of CORE_PREFIXES) if (s.startsWith(prefix)) return type;
    return null;
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
                      ...(module.Engineering.Modifiers === undefined
                          ? {}
                          : {
                                Modifiers: module.Engineering.Modifiers.map((modifier) => ({
                                    ...modifier,
                                })),
                            }),
                  },
              }),
    };
}

/** Snapshot caller-supplied stats so later caller mutation cannot alter the build. */
function cloneModuleStats(module: OutfittingModule): OutfittingModule {
    return deepFreeze({
        ...module,
        ...(module.restrictedToShips === undefined
            ? {}
            : { restrictedToShips: [...module.restrictedToShips] }),
        ...(module.damageDistribution === undefined
            ? {}
            : { damageDistribution: { ...module.damageDistribution } }),
    });
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
    readonly #moduleStats = new Map<string, OutfittingModule>();
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
        return this.#top.UnladenMass ?? this.#computedUnladenMass();
    }

    /**
     * Unladen mass worked out from the hull and the fitted modules, ignoring any figure
     * an import supplied. `null` when the hull's mass or any module's is unknown.
     */
    #computedUnladenMass(): number | null {
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
        return this.#top.CargoCapacity ?? this.#computedCargoCapacity() ?? 0;
    }

    /**
     * Cargo capacity summed from the fitted racks, ignoring any imported figure, or
     * `null` if a fitted rack's capacity is unknown — reporting the rest as the total
     * would understate it.
     */
    #computedCargoCapacity(): number | null {
        let sum = 0;
        for (const m of this.#modules.values()) {
            const capacity = this.#moduleCapacity(m, 'CargoCapacity', 'cargoCapacity');
            if (capacity === null) return null;
            sum += capacity;
        }
        return sum;
    }

    /**
     * Fuel capacity from the fitted tanks and the hull, ignoring any import, or `null`
     * if a tank is unknown or the hull's reserve is (an unrecognised hull).
     */
    #computedFuelCapacity(): FuelCapacity | null {
        const reserve = getShipBySymbol(this.#shipSymbol)?.reserveFuelCapacity;
        if (reserve === undefined) return null;
        let main = 0;
        for (const m of this.#modules.values()) {
            const capacity = this.#moduleCapacity(m, 'FuelCapacity', 'fuelCapacity');
            if (capacity === null) return null;
            main += capacity;
        }
        return { main, reserve };
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
     * @returns Every mount on the hull, in layout order: core, hardpoints, utility,
     * optional, armour and the cargo hatch.
     */
    slots(): LoadoutSlot[] {
        return this.#layout().map((slot) => new LoadoutSlot(this, slot));
    }

    /**
     * The hull's mounts of one kind, each a live {@link LoadoutSlot} handle.
     *
     * @param kind - Which kind of mount to list.
     * @returns The hull's mounts of that kind, in layout order (empty if it has none).
     * @throws {TypeError} If the hull has no known slot layout.
     */
    slotsOfKind(kind: SlotKind): LoadoutSlot[] {
        return this.slots().filter((s) => s.kind === kind);
    }

    /**
     * The hull's seven core-internal mounts (power plant, thrusters, FSD, life support,
     * power distributor, sensors, fuel tank), as live {@link LoadoutSlot} handles.
     *
     * @returns The seven core mounts, in layout order.
     * @throws {TypeError} If the hull has no known slot layout.
     */
    coreModules(): LoadoutSlot[] {
        return this.slotsOfKind('core');
    }

    /**
     * The hull's weapon hardpoints, as live {@link LoadoutSlot} handles.
     *
     * @returns The hardpoint mounts, largest first.
     * @throws {TypeError} If the hull has no known slot layout.
     */
    hardpoints(): LoadoutSlot[] {
        return this.slotsOfKind('hardpoint');
    }

    /**
     * The hull's tiny utility mounts, as live {@link LoadoutSlot} handles.
     *
     * @returns The utility mounts (empty if the hull has none).
     * @throws {TypeError} If the hull has no known slot layout.
     */
    utilityMounts(): LoadoutSlot[] {
        return this.slotsOfKind('utility');
    }

    /**
     * The hull's optional-internal mounts (including any military and planetary-approach
     * slots), as live {@link LoadoutSlot} handles.
     *
     * @returns The optional-internal mounts, largest first.
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
     * @param slotKey - The slot key, e.g. `"FrameShiftDrive"`, `"Slot01_Size6"`. Matched
     * exactly, in the journal's own spelling — enumerate keys with {@link slots} rather
     * than typing them (a core slot's `core` function name, e.g. `thrusters`, is not its
     * key, `MainEngines`).
     * @returns A live handle on the fitted module, or `null` when the slot is empty or
     * the key is not a slot on this hull.
     */
    getFittedModule(slotKey: string): FittedModule | null {
        return this.#modules.has(slotKey)
            ? new FittedModule(
                  this,
                  slotKey,
                  this.#slotVersions.get(slotKey) ?? 0,
                  () => this.#slotVersions.get(slotKey) ?? 0,
                  () => this.#statsFor(this.#modules.get(slotKey) ?? null),
              )
            : null;
    }

    /**
     * The raw journal `Loadout` module object in a slot, or `null` if empty. The
     * low-level counterpart to {@link getFittedModule} for when you want the plain data
     * rather than a handle.
     *
     * @param slotKey - The slot key, matched exactly (journal spelling).
     * @returns The raw module object, or `null` when the slot is empty.
     */
    moduleAt(slotKey: string): LoadoutModule | null {
        const module = this.#modules.get(slotKey);
        return module ? cloneLoadoutModule(module) : null;
    }

    /**
     * The modules from a catalogue that fit a given slot — its size, kind and any
     * restriction all satisfied.
     *
     * @param slotKey - The slot key to fit, matched exactly (journal spelling).
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
     * @param slotKey - The slot key to fit into, matched exactly (journal spelling).
     * @param module - The module to fit (resolve it from a catalogue first, e.g. with
     * {@link getModuleBySymbol}). The complete record is snapshotted, so a result from
     * `getPreEngineeredStats` or a caller-supplied catalogue keeps its resolved stats.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If `module` is null/undefined (e.g. a `getModuleBySymbol`
     * miss), the module does not fit the slot (wrong kind, too large, or a restriction
     * the module does not satisfy), or the hull has no known slot layout (a SLEF build
     * on an unrecognised hull).
     * @example
     * ```ts
     * import { CORE_MODULES, getModuleBySymbol } from '@elite-dangerous-almanac/core/ships';
     * const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!;
     * const tank = getModuleBySymbol('Int_FuelTank_Size6_Class3', CORE_MODULES)!;
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
        this.#replaceModule(
            slotKey,
            { Slot: slotKey, Item: module.symbol },
            cloneModuleStats(module),
        );
        return this;
    }

    /**
     * Empty a slot.
     *
     * @param slotKey - The slot key to clear, matched exactly (journal spelling).
     * @returns `this`, for chaining. Clearing an already-empty slot is a no-op.
     * @throws {TypeError} If `slotKey` is the built-in cargo hatch, which cannot be
     * removed or replaced.
     */
    removeModule(slotKey: string): this {
        if (slotKey === 'CargoHatch') {
            throw new TypeError('ShipLoadout.removeModule: the cargoHatch slot cannot be changed');
        }
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
     * @param slotKey - The slot whose module to engineer, matched exactly (journal spelling).
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
        const stats = this.#statsFor(module);
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
     * @param slotKey - The slot to de-engineer, matched exactly (journal spelling).
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
     * Switch a fitted module on or off.
     *
     * @param slotKey - The slot's journal key, e.g. `"PowerPlant"`.
     * @param on - `true` to power it, `false` to switch it off.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty.
     * @example
     * ```ts
     * build.setModuleEnabled('TinyHardpoint6', false); // an unpowered heat sink
     * ```
     */
    setModuleEnabled(slotKey: string, on: boolean): this {
        this.#patchModule(slotKey, { On: on });
        return this;
    }

    /**
     * Set a fitted module's power-priority group.
     *
     * @param slotKey - The slot's journal key.
     * @param priority - The journal's **zero-based** group, `0`–`4`. Note that the
     * outfitting panel — and {@link powerBudget}'s `bands[].priority` — number the same
     * five groups `1`–`5`.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty, or `priority` is not an integer in `[0, 4]`.
     */
    setModulePriority(slotKey: string, priority: number): this {
        if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
            throw new RangeError(
                `ShipLoadout: power priority must be an integer 0-4, got ${priority}`,
            );
        }
        this.#patchModule(slotKey, { Priority: priority });
        return this;
    }

    /**
     * Change a fitted module's power state in place.
     *
     * @remarks
     * Deliberately **not** routed through `#replaceModule`: powering a module up or down
     * changes no mass, capacity, value or rebuy, so running the aggregate adjustment
     * would wrongly discard `ModulesValue` and `Rebuy`. It also leaves `#slotVersions`
     * alone, so live {@link FittedModule} handles stay valid and see the change — they
     * re-read through {@link moduleAt} on every access.
     */
    #patchModule(slotKey: string, patch: Pick<Partial<LoadoutModule>, 'On' | 'Priority'>): void {
        const module = this.#modules.get(slotKey);
        if (!module) throw new RangeError(`ShipLoadout: slot "${slotKey}" is empty`);
        this.#modules.set(slotKey, cloneLoadoutModule({ ...module, ...patch }));
    }

    /**
     * This build as a journal `Loadout` event — the `data` half of a SLEF entry.
     *
     * @param options - Module ordering and how sparse to be about power state.
     * @returns A fresh event. Every top-level figure is **recomputed** from the hull and
     * the fitted modules rather than echoed from whatever an import supplied, and any
     * figure that cannot be worked out is **left out** rather than emitted as a stale or
     * zero value — SLEF requires nothing beyond `Ship` and `Modules`.
     *
     * Credits are quoted at **retail**: the bare hull's `hullCost` plus every fitted
     * module's catalogue list price, with `Rebuy` 5% of the two. A source's own
     * `HullValue` / `ModulesValue` / `Value` figures are deliberately ignored, because
     * they record one commander's purchase at one station — the Deep Black's modules are
     * all 12.25% off list — and a station discount is not a property of the build.
     * @example
     * ```ts
     * const event = build.toLoadoutEvent();
     * event.MaxJumpRange; // recomputed, not the exporter's claim
     * ```
     */
    toLoadoutEvent(options: LoadoutExportOptions = {}): LoadoutEvent {
        const hull = getShipBySymbol(this.#shipSymbol);
        const unladenMass = this.#computedUnladenMass();
        const cargoCapacity = this.#computedCargoCapacity();
        const fuel = this.#computedFuelCapacity();
        // Credits are quoted at **retail** — the bare hull plus every fitted module at
        // the catalogue's list price. What a build reports instead is what one commander
        // paid at one station: the Deep Black's modules all sit at 0.8775 of list, a
        // 12.25% outfitting discount, and the game and EDSY do not even agree on whether
        // `HullValue` means the bare hull or the hull with its stock fittings. None of
        // that is a property of the build, so none of it is carried through.
        const hullValue = hull?.hullCost ?? null;
        const modulesValue = this.#computedModulesValue();
        const modules = this.#exportModules(options);
        const maxJumpRange = this.#exportableJumpRange(unladenMass);
        const rebuy =
            hullValue === null || modulesValue === null
                ? null
                : Math.trunc((hullValue + modulesValue) * REBUY_FRACTION);

        return {
            event: 'Loadout',
            Ship: this.#shipSymbol.toLowerCase(),
            ...(this.#top.ShipName === undefined ? {} : { ShipName: this.#top.ShipName }),
            ...(this.#top.ShipIdent === undefined ? {} : { ShipIdent: this.#top.ShipIdent }),
            ...(hullValue === null ? {} : { HullValue: hullValue }),
            ...(modulesValue === null ? {} : { ModulesValue: modulesValue }),
            ...(unladenMass === null ? {} : { UnladenMass: unladenMass }),
            ...(cargoCapacity === null ? {} : { CargoCapacity: cargoCapacity }),
            ...(maxJumpRange === null ? {} : { MaxJumpRange: maxJumpRange }),
            ...(fuel === null ? {} : { FuelCapacity: { Main: fuel.main, Reserve: fuel.reserve } }),
            ...(rebuy === null ? {} : { Rebuy: rebuy }),
            Modules: modules,
        };
    }

    /**
     * This build as a one-entry SLEF export.
     *
     * @param options - Ordering, power state, and the envelope header.
     * @returns The export. Several builds travel together as
     * `toSlef([a.toLoadoutEvent(), b.toLoadoutEvent()])` using the function of the same
     * name from `./slef`.
     */
    toSlef(options: SlefExportOptions = {}): Slef {
        return toSlefEnvelope(this.toLoadoutEvent(options), options.header);
    }

    /**
     * This build as SLEF JSON — ready to write to a file or put on the clipboard.
     *
     * @param options - As {@link toSlef}, plus `indent` (compact by default).
     * @example
     * ```ts
     * build.toSlefString({ header: { appName: 'MyApp', appVersion: '1.0.0' } });
     * ```
     */
    toSlefString(options: SlefExportOptions = {}): string {
        return stringifySlef(this.toSlef(options), { indent: options.indent ?? 0 });
    }

    /** The fitted modules as journal records, in the requested order. */
    #exportModules(options: LoadoutExportOptions): LoadoutModule[] {
        const ordered =
            options.moduleOrder === 'slots'
                ? this.#slotOrderedModules()
                : [...this.#modules.values()];
        return ordered.map((m) => {
            const on = m.On ?? (options.explicitPower ? true : undefined);
            const priority = m.Priority ?? (options.explicitPower ? 0 : undefined);
            // The module's list price, so the parts add up to the build's `ModulesValue`.
            // Something with no price of its own — a decal, the cockpit — keeps no
            // `Value`, exactly as the game writes it.
            const value = this.#moduleValue(m);
            return {
                Slot: m.Slot,
                // The journal and every SLEF producer write lower-case ids; a build
                // assembled here carries catalogue casing, so normalise on the way out.
                Item: m.Item.toLowerCase(),
                ...(on === undefined ? {} : { On: on }),
                ...(priority === undefined ? {} : { Priority: priority }),
                ...(m.Health === undefined ? {} : { Health: m.Health }),
                ...(typeof value === 'number' ? { Value: value } : {}),
                ...(m.Engineering === undefined
                    ? {}
                    : { Engineering: cloneLoadoutModule(m).Engineering! }),
            };
        });
    }

    /**
     * The fitted modules in outfitting-panel order. Anything in a slot the hull's
     * layout does not describe keeps its relative order at the end — never dropped.
     */
    #slotOrderedModules(): LoadoutModule[] {
        const layout = getShipSlots(this.#shipSymbol);
        if (!layout) {
            throw new TypeError(
                `ShipLoadout.toLoadoutEvent: no slot layout for hull "${this.#shipSymbol}", so modules cannot be ordered by slot`,
            );
        }
        const remaining = new Map(this.#modules);
        const ordered: LoadoutModule[] = [];
        for (const slot of enumerateSlots(layout)) {
            const module = remaining.get(slot.key);
            if (module) {
                ordered.push(module);
                remaining.delete(slot.key);
            }
        }
        return [...ordered, ...remaining.values()];
    }

    /**
     * Fitted-modules value in credits at **list price**, summed from the catalogue.
     *
     * @remarks
     * `null` when any fitted module has no published price, so the caller omits the
     * figure rather than under-reporting it.
     */
    #computedModulesValue(): number | null {
        let sum = 0;
        for (const m of this.#modules.values()) {
            const value = this.#moduleValue(m);
            if (value === 'unknown') return null;
            if (value !== 'free') sum += value;
        }
        return sum;
    }

    /**
     * What one fitted module costs at list price — or why it costs nothing.
     *
     * @returns The price in credits; `'free'` for a cosmetic, which is not an outfitting
     * module at all; `'unknown'` when it should have a price and the catalogue has none.
     * @remarks
     * Deliberately ignores the module's own `Value`. That figure records what a
     * particular commander paid at a particular station, discount and all, which is not
     * a property of the build — see {@link toLoadoutEvent}.
     *
     * The catalogue has the first say: an article it can identify is priced whatever its
     * slot is called. The slot is consulted only when the article is unidentifiable, and
     * then only to recognise a cosmetic — see {@link isCosmeticSlot}.
     */
    #moduleValue(module: LoadoutModule): number | 'free' | 'unknown' {
        // Prefers the snapshot taken when the module was fitted, so a caller-supplied
        // record prices as the article that was actually fitted.
        const stats = this.#statsFor(module);
        if (stats !== null) return stats.cost ?? 'unknown';
        return isCosmeticSlot(module.Slot) ? 'free' : 'unknown';
    }

    /** `maxJumpRange()` when the build can answer it, else `null` — never throws. */
    #exportableJumpRange(unladenMass: number | null): number | null {
        if (unladenMass === null) return null;
        let drive: FrameShiftDriveParams | null;
        try {
            drive = this.#resolveDrive();
        } catch {
            // An unrecognised drive id has no jump constants; omit rather than fail.
            return null;
        }
        if (drive === null) return null;
        // Mirrors maxJumpRange(): one jump's fuel, no cargo — but off the recomputed
        // mass and tank rather than anything an import supplied.
        const tank = this.#computedFuelCapacity();
        if (tank === null) return null;
        return singleJumpRange(unladenMass, Math.min(tank.main, drive.maxFuel), drive);
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
     * @returns The best single jump, in light-years.
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
     * @returns The jump's range, in light-years.
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
     * @returns The jump's range, in light-years.
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     */
    unladenJumpRange(): number {
        return this.jumpRange();
    }

    /**
     * Single-jump range on a full tank with a full cargo hold, in light-years.
     *
     * @returns The jump's range, in light-years.
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
     * @returns The summed range of every jump on one full tank, in light-years.
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

    /**
     * Every jump figure at once — best, unladen, laden, and the multi-jump totals.
     *
     * @returns The {@link JumpRangeSummary}, in light-years. For a partial load, call
     * {@link jumpRange} with the `fuel` and `cargo` you actually have.
     * @throws {TypeError} If the build has no frame shift drive, or the mass cannot be
     * determined.
     * @example
     * ```ts
     * const jumps = build.jumpRangeSummary();
     * jumps.max;    // -> 89.41  (one jump's fuel, empty hold)
     * jumps.laden;  // -> the range with the hold full
     * // Half a tank and 32 t aboard:
     * build.jumpRange({ fuel: build.fuelCapacity.main / 2, cargo: 32 });
     * ```
     */
    jumpRangeSummary(): JumpRangeSummary {
        const cargo = this.cargoCapacity;
        return {
            max: this.maxJumpRange(),
            unladen: this.jumpRange(),
            laden: this.jumpRange({ cargo }),
            totalUnladen: this.totalRange(),
            totalLaden: this.totalRange({ cargo }),
        };
    }

    /**
     * The build's power budget: what the plant makes, what the modules draw with
     * hardpoints retracted and deployed, and which priority groups stay lit.
     *
     * Draws are post-engineering, modules switched off in the journal are skipped, and
     * weapons (plus the utility fittings that are not always powered) count only
     * towards the deployed total.
     *
     * @returns The {@link PowerBudget}. With no power plant fitted, `available` is `0`
     * and nothing is powered.
     * @example
     * ```ts
     * const power = build.powerBudget();
     * power.available;                  // -> 20.4 MW generated
     * power.deployed;                   // -> 19.02 MW drawn, hardpoints out
     * power.withinBudget;               // -> true
     * power.bands[4]?.poweredDeployed;  // -> is priority group 5 still lit?
     * ```
     */
    powerBudget(): PowerBudget {
        const modules = [...this.#modules.values()];
        const consumers: PowerConsumer[] = [];
        for (const module of modules) {
            const consumer = powerConsumerFor(module, this.#statsFor(module));
            if (consumer) consumers.push(consumer);
        }
        return powerBudget(
            powerAvailable(modules, (module) => this.#statsFor(module)),
            consumers,
        );
    }

    /**
     * The build's shields: strength in megajoules, where it comes from, and the
     * effective resistances.
     *
     * Shield strength scales with the **hull's** mass, not the build's, so fitting
     * more modules never weakens it. Boosters, Guardian shield reinforcement and any
     * engineering are all folded in; switched-off modules are ignored.
     *
     * @param options - {@link DefenceOptions}. `systemsPips` (0–4) folds the SYS
     * capacitor's own resistance into the reported figures; it defaults to `0`, which
     * is what an outfitting screen shows.
     * @returns The {@link ShieldMetrics}, or `null` when the build has no shield
     * generator fitted (or has one switched off).
     * @example
     * ```ts
     * const shields = build.shieldMetrics();
     * shields?.strength;              // -> MJ
     * shields?.resistances.thermal;   // -> negative on a stock generator
     * build.shieldMetrics({ systemsPips: 4 })?.resistances.thermal; // -> with 4 pips to SYS
     * ```
     */
    shieldMetrics(options: DefenceOptions = {}): ShieldMetrics | null {
        const input = shieldInputFor(
            this.#shipSymbol,
            [...this.#modules.values()],
            options.systemsPips ?? 0,
            (module) => this.#statsFor(module),
        );
        if (!input.generator) return null;
        return shieldMetrics(input);
    }

    /**
     * The build's armour: hull hit points, the bulkhead and reinforcement each
     * contribute, and the effective resistances.
     *
     * @returns The {@link ArmourMetrics}. A build with no armour module fitted is
     * reported on the stock lightweight alloy the hull leaves the shipyard with, which
     * is what the game does.
     * @example
     * ```ts
     * const hull = build.armourMetrics();
     * hull.hitPoints;                  // -> total hull points
     * hull.resistances.explosive;      // -> lightweight alloy is explosively weak
     * hull.effectiveHitPoints.thermal; // -> thermal damage the hull can soak
     * ```
     */
    armourMetrics(): ArmourMetrics {
        return armourMetrics(
            armourInputFor(this.#shipSymbol, [...this.#modules.values()], (module) =>
                this.#statsFor(module),
            ),
        );
    }

    /**
     * The build's firepower: DPS, sustained DPS, weapons-capacitor draw, heat and power
     * draw for every fitted weapon, plus the totals.
     *
     * Every figure is post-engineering. A weapon switched off in the journal is still
     * listed — with its own metrics — but left out of the totals.
     *
     * @returns The {@link BuildWeaponMetrics}.
     * @example
     * ```ts
     * const guns = build.weaponMetrics();
     * guns.total.damagePerSecond;          // -> burst DPS across the hardpoints
     * guns.total.sustainedDamagePerSecond; // -> with reloads folded in
     * guns.total.energyPerSecond;          // -> MW asked of the WEP capacitor
     * guns.total.powerDraw;                // -> MW asked of the power plant when deployed
     * guns.weapons[0]?.metrics.damageByType.thermal;
     * ```
     */
    weaponMetrics(): BuildWeaponMetrics {
        const weapons: FittedWeaponMetrics[] = [];
        for (const module of this.#modules.values()) {
            const record = this.#statsFor(module);
            const stats = weaponStatsFor(module, record);
            if (!stats) continue;
            weapons.push({
                slot: module.Slot,
                symbol: module.Item,
                name: record?.name ?? module.Item,
                enabled: module.On !== false,
                metrics: weaponMetrics(stats),
            });
        }
        return {
            weapons,
            total: sumWeaponMetrics(
                weapons.filter((weapon) => weapon.enabled).map((weapon) => weapon.metrics),
            ),
        };
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
        if (slot.kind === 'cargoHatch') {
            return 'the cargoHatch slot cannot be changed';
        }
        if (slot.kind === 'armour') {
            const hull = getShipBySymbol(this.#shipSymbol);
            if (module.category !== 'core' || module.ship === undefined) {
                return 'not a ship armour module';
            }
            if (!hull || module.ship.toLowerCase() !== hull.name.toLowerCase()) {
                return `armour belongs to ${module.ship}, not ${hull?.name ?? this.#shipSymbol}`;
            }
            return null; // armour size is hull-specific rather than slot-sized
        }
        // A module restricted to another hull never fits. The registry's `ship`
        // field is unreliable here (a "None" sentinel on these modules), so use
        // the normalized stats field carried by the module record itself.
        const restricted = module.restrictedToShips;
        if (
            restricted &&
            !restricted.some((s) => s.toLowerCase() === this.#shipSymbol.toLowerCase())
        ) {
            // Name the hulls the way a player would recognise them, keeping the
            // symbol so the message is still greppable against journal data.
            const hulls = restricted.map((s) => {
                const hull = getShipBySymbol(s);
                return hull ? `${hull.name} (${s})` : s;
            });
            return `module is restricted to ${hulls.join(', ')}`;
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
                const restricted = restrictionError(slot, sym);
                if (restricted) return restricted;
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
                    if (!isPas) {
                        return `slot only takes ${SLOT_RESTRICTION_LABELS.planetaryApproachSuite}`;
                    }
                } else if (isPas) {
                    return 'a planetary approach suite only fits its own slot';
                }
                const restricted = restrictionError(slot, sym);
                if (restricted) return restricted;
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
        for (const m of this.#modules.values()) {
            sum += this.#moduleCapacity(m, 'FuelCapacity', 'fuelCapacity') ?? 0;
        }
        return sum;
    }

    /** Replace one fitted module and keep imported aggregate figures coherent. */
    #replaceModule(
        slotKey: string,
        replacement: LoadoutModule | null,
        replacementStats?: OutfittingModule,
    ): void {
        const previous = this.#modules.get(slotKey) ?? null;
        this.#adjustImportedFigures(previous, replacement, replacementStats);
        if (replacement === null) {
            this.#modules.delete(slotKey);
            this.#moduleStats.delete(slotKey);
        } else {
            this.#modules.set(slotKey, cloneLoadoutModule(replacement));
            if (replacementStats !== undefined) this.#moduleStats.set(slotKey, replacementStats);
        }
        this.#slotVersions.set(slotKey, (this.#slotVersions.get(slotKey) ?? 0) + 1);
    }

    /**
     * Adjust SLEF aggregates by the changed module's contribution. If either side
     * cannot be resolved, discard that aggregate so its getter recomputes safely.
     */
    #adjustImportedFigures(
        previous: LoadoutModule | null,
        next: LoadoutModule | null,
        nextStats?: OutfittingModule,
    ): void {
        const previousMass = this.#moduleMass(previous);
        const nextMass = this.#moduleMass(next, nextStats);
        if (this.#top.UnladenMass !== undefined) {
            if (previousMass === null || nextMass === null) delete this.#top.UnladenMass;
            else this.#top.UnladenMass += nextMass - previousMass;
        }

        const previousCargo = this.#moduleCapacity(previous, 'CargoCapacity', 'cargoCapacity');
        const nextCargo = this.#moduleCapacity(next, 'CargoCapacity', 'cargoCapacity', nextStats);
        if (this.#top.CargoCapacity !== undefined) {
            if (previousCargo === null || nextCargo === null) delete this.#top.CargoCapacity;
            else this.#top.CargoCapacity += nextCargo - previousCargo;
        }

        const previousFuel = this.#moduleCapacity(previous, 'FuelCapacity', 'fuelCapacity');
        const nextFuel = this.#moduleCapacity(next, 'FuelCapacity', 'fuelCapacity', nextStats);
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

    /**
     * A module's post-engineering mass, `0` for no module, or `null` if unknown.
     *
     * @remarks
     * Classified the same way as {@link #moduleValue}: the catalogue first, the slot only
     * for an article it cannot identify, and then only to spot a cosmetic.
     */
    #moduleMass(module: LoadoutModule | null, statsOverride?: OutfittingModule): number | null {
        if (module === null) return 0;
        const modified = getLoadoutModifier(module, 'Mass');
        if (modified !== null) return modified;
        const stats = statsOverride ?? this.#statsFor(module);
        if (stats?.mass !== undefined) return stats.mass;
        if (module.Slot === 'CargoHatch' && module.Item.toLowerCase() === 'modularcargobaydoor') {
            return 0;
        }
        return stats === null && isCosmeticSlot(module.Slot) ? 0 : null;
    }

    /**
     * A fitted module's post-engineering cargo/fuel capacity. Missing stats are
     * unknown only for symbols that identify the corresponding capacity module.
     */
    #moduleCapacity(
        module: LoadoutModule | null,
        modifierLabel: 'CargoCapacity' | 'FuelCapacity',
        field: 'cargoCapacity' | 'fuelCapacity',
        statsOverride?: OutfittingModule,
    ): number | null {
        if (module === null) return 0;
        const modified = getLoadoutModifier(module, modifierLabel);
        if (modified !== null) return modified;
        const stats = statsOverride ?? this.#statsFor(module);
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
        const base = this.#statsFor(fsdModule);
        if (!base || base.fuelMul === undefined || base.fuelPower === undefined) {
            // A drive is fitted, but the stats catalogue has no jump constants for it
            // (an unrecognised / newer drive id). Fail with a diagnosable message
            // rather than the "no frame shift drive" one the caller would otherwise get.
            throw new TypeError(
                `ShipLoadout: no jump constants in the stats catalogue for frame shift drive "${fsdModule.Item}"`,
            );
        }

        const optMass = getLoadoutModifier(fsdModule, 'FSDOptimalMass') ?? base.optMass ?? 0;
        const maxFuel = getLoadoutModifier(fsdModule, 'MaxFuelPerJump') ?? base.maxFuel ?? 0;

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
            return this.#statsFor(m)?.jumpBoost ?? 0;
        }
        return 0;
    }

    /** Resolve the snapshotted fitted record, or fall back to the built-in catalogue. */
    #statsFor(module: LoadoutModule | null): OutfittingModule | null {
        if (module === null) return null;
        return this.#moduleStats.get(module.Slot) ?? statFor(module.Item);
    }
}
