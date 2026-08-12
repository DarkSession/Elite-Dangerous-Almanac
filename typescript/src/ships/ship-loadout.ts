/**
 * {@link ShipLoadout} — a mutable fitted-ship model that both **answers questions**
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
 * Slot and fitted-module queries return deeply frozen point-in-time values; edits are
 * made only through this facade, then observed by querying again.
 *
 * **Slot keys are matched case-insensitively.** Frontier writes `FrameShiftDrive` and
 * `LargeMiningHardpoint1`, but a SLEF producer may lower-case every key as the
 * specification's own example does — Inara writes `frameshiftdrive` and
 * `largemininghardpoint1` — and both spellings name the same mount, whether you are
 * reading it or fitting into it. What a build already carries is never rewritten to
 * match, so re-exporting an import returns the producer's own spelling untouched.
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
 * declare const slefJsonString: string;
 *
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * // Read a build:
 * const build = ShipLoadout.fromSlef(slefJsonString);
 * build.maxJumpRange();  // -> 89.41  (best single jump, one jump's fuel, no cargo)
 *
 * // Assemble one:
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
 * const conda = ShipLoadout.empty('Anaconda');
 * conda.setModule('FrameShiftDrive', getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!);
 * conda.slots('optional'); // every optional mount, occupied or empty, with size
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
import { enumerateSlots, parseSlotName, type BuildSlot, type SlotKind } from './slots.js';
import { computeModifiers } from './engineering.js';
import { getBlueprintGrade } from './blueprints.js';
import { isDecorativeModification } from './decorative-modifications.js';
import { getExperimentalEffect } from './experimental-effects.js';
import { getBlueprintsForModule, getExperimentalsForModule } from './engineering-options.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import type { ModuleEngineering } from './slef.js';
import type { OutfittingModule } from './modules.js';
import { baseStats, labelsForDamageType, scaleForLabel } from './internal/module-stat-labels.js';
import {
    cloneLoadoutModule,
    cloneModuleStats,
    isBuiltInHullModule,
    isNonOutfittingSlot,
    matchingKeyIn,
} from './internal/loadout-state.js';
import {
    availableBlueprintsFor,
    availableExperimentalsFor,
    blueprintAvailableFor,
    experimentalAvailableFor,
    isEngineerable,
    missingBaseLabels,
} from './internal/loadout-engineering.js';
import { builtInModuleBySymbol } from './internal/module-symbol-index.js';
import {
    armourInputFor,
    effectiveModule,
    powerAvailable,
    powerConsumerFor,
    shieldInputFor,
    weaponStatsFor,
} from './internal/loadout-metrics.js';
import { powerBudget, type PowerBudget, type PowerConsumer } from './power.js';
import { shieldMetrics, type ShieldMetrics } from './shields.js';
import { armourMetrics, type ArmourMetrics } from './armour.js';
import {
    sumWeaponMetrics,
    weaponMetrics,
    type WeaponMetrics,
    type WeaponTotals,
} from './weapons.js';
import { ammunitionCapacity, type AmmunitionCapacity } from './ammunition.js';
import { identifyPreEngineeredVariant } from './pre-engineered-stats.js';
import { ALL_MODULES } from './modules-all.js';
import type { FittedModule } from './fitted-module.js';
import type { LoadoutSlot } from './loadout-slot.js';
import { loadoutSlotName } from './internal/loadout-views.js';
import { moduleFitError } from './internal/loadout-fitting.js';
import { exportLoadoutEvent } from './internal/loadout-export.js';
import {
    normalizeLoadoutEvent,
    type ImportedTopFigures as TopFigures,
} from './internal/loadout-import.js';
import type { SourcePurchaseRecord } from './source-purchase.js';
import { deepFreeze } from '../internal/deep-freeze.js';
import { normalizeKey } from '../internal/registry-index.js';
import { describeValue, requireString, truncate } from '../internal/argument-guards.js';
import { completeResult } from './internal/calculation-result.js';
import {
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
    type CalculationResult,
    type FuelCapacity,
    type LoadoutCalculationModule,
} from './loadout-calculations.js';
import {
    validateLoadout,
    type LoadoutValidation,
    type ValidationModule,
} from './loadout-validation.js';

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
    /**
     * The current engineering system's shared quality roll, `0`–`1`. Defaults to `1`
     * (best roll). A legacy-engineered module's independently advanced attributes cannot be
     * reconstructed from its single reported quality; import its stated modifiers instead.
     */
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
    /**
     * How many rounds it holds when fully rearmed, post-engineering — `null` for a laser,
     * which carries none. A capacity, not a rearm state: see {@link FittedModule.ammunition}.
     */
    readonly ammunition: AmmunitionCapacity | null;
}

/** A build's firepower: every fitted weapon, and the totals across the enabled ones. */
export interface BuildWeaponMetrics {
    /** Every fitted weapon, in slot order. */
    readonly weapons: readonly FittedWeaponMetrics[];
    /** The additive totals across the **enabled** weapons. */
    readonly total: WeaponTotals;
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
    /**
     * Which credits to quote. `'retail'` — the default — prices the build from the
     * catalogue: the bare hull's `hullCost`, every fitted module's list price, and a
     * `Rebuy` of 5% of the two.
     *
     * `'source'` quotes the build's {@link ShipLoadout.sourcePurchase | source purchase
     * record} instead — `HullValue`, `ModulesValue`, `Rebuy` and the per-module `Value`
     * figures exactly as the capture stated them, and nothing where it stated nothing.
     * An unedited capture therefore re-exports its own credits unchanged.
     *
     * Each captured figure is pinned to what it was paid for, so an edit narrows the
     * export rather than staling it. A slot whose module has been swapped is left
     * unpriced, because the figure was paid for the article that *was* fitted; and
     * `ModulesValue` and `Rebuy` are dropped once any priced module has been swapped or
     * removed, since they then cover an article no longer aboard. Removing a module the
     * capture listed but never priced is the one case this cannot detect: only the
     * capture ever knew which unpriced modules its total counted.
     *
     * `HullValue` always stands: a captured hull figure names no slot, so no edit
     * narrows it. Note that on a game capture it counts the hull *with* its stock
     * fittings, and removing one of those leaves it overstating what is aboard.
     *
     * A build with no source record — one assembled here, or a capture that quoted no
     * credits — exports no credit figure at all rather than falling back to retail.
     */
    readonly credits?: 'retail' | 'source';
}

/** As {@link LoadoutExportOptions}, plus the SLEF envelope — see {@link ShipLoadout.toSlef}. */
export interface SlefExportOptions extends LoadoutExportOptions {
    /**
     * The envelope header identifying the exporting application.
     *
     * SLEF attribution belongs to the application producing the export, not to this
     * calculation library, so callers must provide it.
     */
    readonly header: SlefHeader;
    /** Spaces per indent for {@link ShipLoadout.toSlefString}. `0` (the default) is compact. */
    readonly indent?: number;
}

const FSD_PREFIX = 'int_hyperdrive';
const BOOSTER_PREFIX = 'int_guardianfsdbooster';
const FUEL_TANK_PREFIX = 'int_fueltank';

/**
 * A fitted ship — read a SLEF export, or assemble a hull from scratch.
 *
 * @remarks
 * Jump calculations resolve the frame shift drive's constants from the drive's module
 * record, applying any engineering the build carries (a Long Range blueprint's
 * `FSDOptimalMass`, for instance). For a SLEF build, mass comes from the export's
 * `UnladenMass`; for an assembled build it is the hull mass plus every fitted module's
 * mass (armour defaults to the zero-mass lightweight alloy).
 *
 * @example
 * Read a build a player already flies, and ask it what an outfitting screen shows.
 * Every figure below is one build's — a Krait Phantom explorer. Figures the capture
 * already stated — `unladenMass` here — are trusted verbatim; the rest are computed
 * from the fit.
 *
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * // A `Loadout` line lifted from a player journal, parsed.
 * declare const event: LoadoutEvent;
 *
 * const build = ShipLoadout.fromLoadout(event);
 *
 * build.shipSymbol; // -> 'krait_light'
 * build.shipName; // -> 'Jenny Longuet'
 * build.unladenMass; // -> 388.830017   (tonnes)
 *
 * build.maxJumpRange(); // -> 60.5478   (ly, best single jump)
 * build.powerBudget().withinBudget; // -> true
 * build.shieldMetrics()?.strength; // -> 743.12  (MJ)
 * build.armourMetrics().hitPoints; // -> 307.8
 * ```
 *
 * @example
 * Assemble a hull instead. `empty` starts from the shipyard layout, `slots` enumerates
 * the mounts, and `setModule` fits one — chainable, because the build is mutable.
 *
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
 *
 * const conda = ShipLoadout.empty('Anaconda');
 * conda.slots().length; // -> 39   (every mount, occupied or not)
 * conda.slots('optional').length; // -> 14
 * conda.validation.complete; // -> false  (nothing fitted yet)
 *
 * const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES);
 * if (fsd) conda.setModule('FrameShiftDrive', fsd);
 * ```
 *
 * @example
 * Write a build back out. Retail credits are what the catalogue prices the fit at; pass
 * `credits: 'source'` to export the figures a capture stated it paid instead — see
 * {@link ShipLoadout.sourcePurchase}.
 *
 * ```ts
 * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * declare const build: ShipLoadout;
 *
 * build.toLoadoutEvent(); // retail: hull cost plus every module's list price
 * build.toLoadoutEvent({ credits: 'source' }); // the capture's own figures
 * build.toSlefString({ header: { appName: 'MyApp', appVersion: '1.0.0' } });
 * ```
 */
export class ShipLoadout {
    readonly #shipSymbol: string;
    readonly #modules: Map<string, LoadoutModule>;
    readonly #moduleStats: Map<string, OutfittingModule>;
    readonly #top: TopFigures;
    readonly #sourcePurchase: SourcePurchaseRecord | null;
    /**
     * Bumped by every edit that changes what a fitted module *is* — which slots are
     * filled, by which article, with which engineering. The derived views below are
     * rebuilt when it moves and reused when it does not.
     *
     * @remarks
     * `#patchModule` deliberately does not bump it. Powering a module up or down, or
     * moving it between priority groups, changes no slot key, symbol or modifier, and
     * neither view keyed on this reads `On` or `Priority` — `powerBudget` and
     * `toLoadoutEvent`, which do, read `#modules` directly and are not cached. (The
     * layout cache is not a view of module state at all and hangs off nothing.)
     */
    #version = 0;
    /**
     * The hull's expanded mounts: `undefined` until first asked, `null` for a hull
     * with no known layout. Needs no version — `#shipSymbol` is `readonly`, so a
     * build's layout is fixed for its whole life.
     */
    #layoutCache: readonly BuildSlot[] | null | undefined;
    #calculationCache: { version: number; value: readonly LoadoutCalculationModule[] } | null =
        null;
    #validationCache: { version: number; value: LoadoutValidation } | null = null;

    private constructor(
        shipSymbol: string,
        modules: Map<string, LoadoutModule>,
        top: TopFigures,
        sourcePurchase: SourcePurchaseRecord | null = null,
        moduleStats = new Map<string, OutfittingModule>(),
    ) {
        this.#shipSymbol = shipSymbol;
        this.#modules = modules;
        this.#top = top;
        this.#sourcePurchase = sourcePurchase;
        this.#moduleStats = moduleStats;
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
    static fromSlef(input: unknown, index = 0): ShipLoadout {
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
     * @remarks
     * Capture/instance state (`timestamp`, `ShipID`, `HullHealth`, `Hot`) and engineering
     * provenance (`Engineer`, `EngineerID`, `BlueprintID`) are deliberately excluded
     * from the durable build. See {@link LoadoutEvent} and {@link ModuleEngineering}.
     * A pre-engineered/reward module is identified from its reported stat signature when
     * the evidence uniquely matches a catalogue variant. Its complete fixed stat block is
     * then used as the fitted record, including values the capture omits; a separately
     * applied experimental effect is included when matching and remains authoritative in
     * the captured modifiers. Under-specified or ambiguous evidence stays unidentified.
     * An ordinary weapon recipe on a Guardian weapon identifies a final pre-engineered
     * article; the import preserves that identity, uses the catalogue's complete hand-set
     * stat block when the exact article is known, exposes no engineering options for it,
     * and refuses attempts to engineer it further. Explicit journal modifiers remain
     * authoritative over that stat block.
     *
     * The event's credit figures are kept twice over: as the live `hullValue` /
     * `modulesValue` / `rebuy`, which an edit may invalidate, and as the immutable
     * {@link sourcePurchase} record, which no edit touches.
     */
    static fromLoadout(event: LoadoutEvent): ShipLoadout {
        const imported = normalizeLoadoutEvent(event);
        return new ShipLoadout(
            imported.shipSymbol,
            imported.modules,
            imported.top,
            imported.sourcePurchase,
            imported.moduleStats,
        );
    }

    /**
     * Start a new, empty build for a hull — no modules fitted.
     *
     * @param shipSymbol - The hull's internal symbol, e.g. `"Anaconda"`
     * (case-insensitive).
     * @returns An empty loadout whose {@link slots} come from the hull's declared
     * layout.
     * @throws {TypeError} If `shipSymbol` is not a string, or no hull with that symbol
     * has a known slot layout.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * ShipLoadout.empty('Sidewinder').slots('hardpoint').length; // -> 2
     * ```
     */
    static empty(shipSymbol: string): ShipLoadout {
        const layout = getShipSlots(requireString(shipSymbol, 'ShipLoadout.empty: shipSymbol'));
        if (!layout) {
            // Shortened so this method's two failures agree: the guard above describes an
            // oversized argument in bounded form, and quoting one back in full here would
            // undo that. Messages elsewhere still reproduce a caller's string in full —
            // https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/213.
            throw new TypeError(
                `ShipLoadout.empty: no slot layout for hull "${truncate(shipSymbol)}"`,
            );
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
     * cannot be determined (no `UnladenMass` in the export and either the hull or a
     * fitted module has no known mass).
     *
     * @remarks
     * A SLEF export's `UnladenMass` is trusted verbatim. Otherwise the mass is the
     * hull's `hullMass` plus every fitted module's mass (post-engineering), with armour
     * at the zero-mass lightweight default.
     */
    get unladenMass(): number | null {
        return this.unladenMassResult.value;
    }

    /**
     * Unladen mass with diagnostics for every missing input.
     *
     * @returns A complete imported or computed mass, otherwise `null` plus the hull or
     * module fields that prevented the calculation.
     */
    get unladenMassResult(): CalculationResult<number> {
        return this.#top.UnladenMass === undefined
            ? this.#computedUnladenMass()
            : completeResult(this.#top.UnladenMass);
    }

    /**
     * Unladen mass worked out from the hull and the fitted modules, ignoring any figure
     * an import supplied — incomplete when the hull's mass or any module's is unknown.
     */
    #computedUnladenMass(): CalculationResult<number> {
        return calculateUnladenMass(
            getShipBySymbol(this.#shipSymbol)?.hullMass ?? null,
            this.#calculationModules(),
        );
    }

    /**
     * Fuel-tank capacities, in tonnes, or `null` when a tank or the hull's reserve
     * capacity is unknown. A SLEF export's `FuelCapacity` is used when present;
     * otherwise the main capacity is the sum of the fitted fuel tanks and the reserve
     * comes from the hull's stats.
     */
    get fuelCapacity(): FuelCapacity | null {
        return this.fuelCapacityResult.value;
    }

    /** Fuel capacity with diagnostics instead of unknown tanks collapsing to zero. */
    get fuelCapacityResult(): CalculationResult<FuelCapacity> {
        const cap = this.#top.FuelCapacity;
        if (cap?.Main !== undefined && cap.Reserve !== undefined) {
            return completeResult(Object.freeze({ main: cap.Main, reserve: cap.Reserve }));
        }
        const computed = this.#computedFuelCapacity();
        if (computed.value === null) return computed;
        return completeResult(
            Object.freeze({
                main: cap?.Main ?? computed.value.main,
                reserve: cap?.Reserve ?? computed.value.reserve,
            }),
        );
    }

    /**
     * Cargo capacity, in tonnes, or `null` when a fitted optional module cannot be
     * classified. A SLEF export's `CargoCapacity` is used when present; otherwise it is
     * the sum of the fitted cargo racks.
     */
    get cargoCapacity(): number | null {
        return this.cargoCapacityResult.value;
    }

    /** Cargo capacity with diagnostics instead of unknown racks collapsing to zero. */
    get cargoCapacityResult(): CalculationResult<number> {
        return this.#top.CargoCapacity === undefined
            ? this.#computedCargoCapacity()
            : completeResult(this.#top.CargoCapacity);
    }

    /**
     * Cargo capacity summed from the fitted racks, ignoring any imported figure —
     * incomplete if a fitted rack's capacity is unknown, since reporting the rest as the
     * total would understate it.
     */
    #computedCargoCapacity(): CalculationResult<number> {
        return calculateCargoCapacity(this.#calculationModules());
    }

    /**
     * Fuel capacity from the fitted tanks and the hull, ignoring any import — incomplete
     * if a tank is unknown or the hull's reserve is (an unrecognised hull).
     */
    #computedFuelCapacity(): CalculationResult<FuelCapacity> {
        return calculateFuelCapacity(
            getShipBySymbol(this.#shipSymbol)?.reserveFuelCapacity ?? null,
            this.#calculationModules(),
        );
    }

    /**
     * Hull cost in credits as the build currently states it, or `null` if unknown.
     *
     * @remarks
     * This is the live figure, kept coherent with edits: an import's own `HullValue`
     * until something invalidates it. For the capture's figure as captured — which no
     * edit changes — read {@link sourcePurchase}.
     */
    get hullValue(): number | null {
        return this.#top.HullValue ?? null;
    }

    /**
     * Fitted-modules cost in credits as the build currently states it, or `null` if
     * unknown — including after an edit discarded an import's figure, since no catalogue
     * records what a replaced module was bought for. {@link sourcePurchase} keeps the
     * captured figure regardless.
     */
    get modulesValue(): number | null {
        return this.#top.ModulesValue ?? null;
    }

    /**
     * Insurance rebuy cost in credits as the build currently states it, or `null` if
     * unknown. Discarded by an edit for the same reason as {@link modulesValue}, and
     * likewise preserved by {@link sourcePurchase}.
     */
    get rebuy(): number | null {
        return this.#top.Rebuy ?? null;
    }

    /**
     * What the capture this build came from said was **paid** for it — a read-only
     * {@link SourcePurchaseRecord}, or `null` for a build assembled here or imported
     * from a capture that quoted no credits at all.
     *
     * @remarks
     * The record is provenance about the source, so it is fixed at import and **survives
     * every edit**: fit, remove or engineer whatever you like and it still reports the
     * figures the capture carried, for the modules the capture carried them for. That is
     * what {@link hullValue}, {@link modulesValue} and {@link rebuy} cannot do — they
     * describe the build in hand, so an edit that invalidates one drops it.
     *
     * The two answer different questions and neither substitutes for the other. A
     * captured price belongs to one commander's purchase history, discounts included;
     * the library's own figures are catalogue retail. Export picks between them
     * explicitly, and quotes retail unless asked otherwise — see
     * {@link LoadoutExportOptions.credits}.
     *
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     * import { getSourceModuleValue } from '@elite-dangerous-almanac/core/ships/source-purchase';
     *
     * declare const slefJson: string;
     *
     * const build = ShipLoadout.fromSlef(slefJson);
     * const paid = build.sourcePurchase!;
     * paid.hullValue; // -> 189326510, as captured
     * getSourceModuleValue(paid, 'powerplant')?.value; // -> what that plant cost its owner
     *
     * build.removeModule('Slot05_Size4');
     * build.modulesValue;                 // -> null   (the live figure is now unknowable)
     * paid.modulesValue;                  // -> 192625195, still what the capture said
     * ```
     */
    get sourcePurchase(): SourcePurchaseRecord | null {
        return this.#sourcePurchase;
    }

    /**
     * Structural validity and operational completeness of this build.
     *
     * @remarks
     * Optional, hardpoint and utility mounts may be empty. Armour and all seven core
     * mounts must be filled for `complete` to be true. An unknown hull or module is
     * incomplete; a module in a nonexistent or incompatible slot is invalid.
     */
    get validation(): LoadoutValidation {
        const cached = this.#validationCache;
        if (cached !== null && cached.version === this.#version) return cached.value;
        const slots = this.#layoutOrNull();
        const byKey = new Map(slots?.map((slot) => [slot.key.toLowerCase(), slot]) ?? []);
        const modules: ValidationModule[] = [...this.#modules.values()].map((module) => {
            const stats = this.#statsFor(module);
            const slot = byKey.get(module.Slot.toLowerCase());
            const builtIn =
                (stats === null && isNonOutfittingSlot(module.Slot)) || isBuiltInHullModule(module);
            return {
                slot: module.Slot,
                symbol: module.Item,
                known: stats !== null || builtIn,
                requiresKnownSlot: !builtIn,
                fitError:
                    stats && slot && !builtIn
                        ? moduleFitError(this.#shipSymbol, slot, stats)
                        : null,
            };
        });
        const value = validateLoadout({ shipSymbol: this.#shipSymbol, slots, modules });
        this.#validationCache = { version: this.#version, value };
        return value;
    }

    /**
     * Frozen point-in-time views of the hull's mounts in outfitting-panel order.
     *
     * @param kind - Optionally keep only one mount kind. Omit it for every mount.
     * @returns Detached slot views. Fetch again after an edit to observe new state.
     * @throws {TypeError} If the hull has no known slot layout.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const emptyHardpoints = ShipLoadout.empty('Sidewinder').slots('hardpoint');
     * emptyHardpoints.every((slot) => slot.module === null); // true
     * ```
     */
    slots(kind?: SlotKind): readonly LoadoutSlot[] {
        const slots =
            kind === undefined ? this.#layout() : this.#layout().filter((s) => s.kind === kind);
        return deepFreeze(
            slots.map((slot) => ({
                ...slot,
                name: loadoutSlotName(slot),
                module: this.fittedModuleAt(slot.key),
            })),
        );
    }

    /**
     * A deeply frozen, point-in-time view of the module in a slot.
     *
     * @param slotKey - Slot key, matched case-insensitively.
     * @returns A detached view, or `null` when the slot is empty or unknown.
     */
    fittedModuleAt(slotKey: string): FittedModule | null {
        const module = this.#fittedModuleFor(slotKey);
        if (!module) return null;
        const raw = cloneLoadoutModule(module);
        const stats = this.#statsFor(module);
        const effective = effectiveModule(raw, stats);
        return deepFreeze({
            slot: module.Slot,
            symbol: raw.Item,
            on: raw.On,
            priority: raw.Priority,
            health: raw.Health,
            value: raw.Value,
            engineering: raw.Engineering,
            raw,
            stats: stats === null ? null : cloneModuleStats(stats),
            effectiveStats: effective === null ? null : cloneModuleStats(effective),
            ammunition: ammunitionCapacity(effective),
            preEngineeredVariant: identifyPreEngineeredVariant(raw),
        });
    }

    /**
     * Every fitted module as a deeply frozen point-in-time view.
     *
     * @returns Detached module snapshots in the order the build carries them. The array
     * and every nested record are frozen; query again after an edit for current state.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * build.fittedModules().map((module) => `${module.slot}: ${module.symbol}`);
     * ```
     */
    fittedModules(): readonly FittedModule[] {
        return deepFreeze(
            [...this.#modules.keys()].flatMap((key) => {
                const fitted = this.fittedModuleAt(key);
                return fitted === null ? [] : [fitted];
            }),
        );
    }

    /**
     * Return the computable blueprints offered to a fitted module.
     *
     * @param slotKey - Slot key, matched case-insensitively.
     * @returns Frozen blueprint descriptors in engineering-menu order, or an empty
     * array when the slot is empty, unresolved, final, or has no engineering menu.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * build.availableBlueprints('FrameShiftDrive').map(({ fdname }) => fdname);
     * ```
     */
    availableBlueprints(slotKey: string): readonly AvailableBlueprint[] {
        const module = this.#fittedModuleFor(slotKey);
        return deepFreeze(
            module ? availableBlueprintsFor(module.Item, this.#statsFor(module)) : [],
        );
    }

    /**
     * Return the computable experimental effects offered to a fitted module.
     *
     * @param slotKey - Slot key, matched case-insensitively.
     * @returns Frozen Frontier effect ids in engineering-menu order, or an empty array
     * when the slot is empty, unresolved, final, or has no experimental menu.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * build.availableExperimentalEffects('FrameShiftDrive');
     * // -> ['special_fsd_heavy', ...]
     * ```
     */
    availableExperimentalEffects(slotKey: string): readonly string[] {
        const module = this.#fittedModuleFor(slotKey);
        return deepFreeze(
            module ? availableExperimentalsFor(module.Item, this.#statsFor(module)) : [],
        );
    }

    /**
     * The modules that fit a given slot — its size, kind and any restriction all
     * satisfied.
     *
     * @param slotKey - The slot key to fit, matched case-insensitively (journal spelling).
     * @returns The fitting modules, in complete-catalogue order.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If the hull has no known slot layout (a SLEF build on an
     * unrecognised hull).
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * ShipLoadout.empty('Anaconda').modulesForSlot('FrameShiftDrive');
     * ```
     */
    modulesForSlot(slotKey: string): OutfittingModule[] {
        const slot = this.#requireSlot(slotKey);
        return ALL_MODULES.filter(
            (module) => moduleFitError(this.#shipSymbol, slot, module) === null,
        );
    }

    /**
     * Fit a module into a slot, replacing whatever is there.
     *
     * @param slotKey - The slot key to fit into, matched case-insensitively (journal
     * spelling). An occupied slot keeps the key the build already spells it with, so
     * fitting into an import never renames one of its mounts.
     * @param module - The module to fit (resolve it from a catalogue first, e.g. with
     * {@link getModuleBySymbol}). The complete record is snapshotted, so a result from
     * `getPreEngineeredStats` or a caller-supplied catalogue keeps its resolved stats.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If `module` is null/undefined (e.g. a `getModuleBySymbol`
     * miss) or is not an outfitting module at all, the module does not fit the slot
     * (wrong kind, too large, or a restriction the module does not satisfy), or the hull
     * has no known slot layout (a SLEF build on an unrecognised hull).
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
     * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
     * const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!;
     * const tank = getModuleBySymbol('Int_FuelTank_Size6_Class3', CORE_MODULES)!;
     * build.setModule('FrameShiftDrive', fsd).setModule('Slot01_Size7', tank);
     * ```
     */
    setModule(slotKey: string, module: OutfittingModule): this {
        const slot = this.#requireSlot(slotKey);
        if (module === null || module === undefined) {
            // Guards the common `getModuleBySymbol('typo', CAT)!` miss, whose `!` lies.
            // Nothing else takes this branch: another falsy value is not a lookup miss,
            // and claiming it was would send the caller looking in the wrong place.
            throw new TypeError(
                `ShipLoadout.setModule: no module supplied for "${slotKey}" (did the module lookup return undefined?)`,
            );
        }
        // Every fit rule reads the record's symbol, so anything else — a bare id, a
        // journal fragment — must be named here rather than failing inside the rules.
        if (typeof (module as { symbol?: unknown }).symbol !== 'string') {
            throw new TypeError(
                `ShipLoadout.setModule: module for "${slotKey}" must be an outfitting module, received ${describeValue(module)}`,
            );
        }
        const problem = moduleFitError(this.#shipSymbol, slot, module);
        if (problem) {
            throw new TypeError(`ShipLoadout.setModule: ${module.symbol} → ${slotKey}: ${problem}`);
        }
        // Replacing keeps the key the build already uses; a fresh fit takes the hull
        // layout's canonical spelling rather than whatever casing the caller typed.
        const key = this.#fittedKey(slotKey) ?? slot.key;
        this.#replaceModule(key, { Slot: key, Item: module.symbol }, cloneModuleStats(module));
        return this;
    }

    /**
     * Empty a slot.
     *
     * @param slotKey - The slot key to clear, matched case-insensitively (journal
     * spelling).
     * @returns `this`, for chaining. Clearing an already-empty slot is a no-op.
     * @throws {TypeError} If `slotKey` is the built-in cargo hatch, which cannot be
     * removed or replaced.
     */
    removeModule(slotKey: string): this {
        if (slotKey.toLowerCase() === 'cargohatch') {
            throw new TypeError('ShipLoadout.removeModule: the cargoHatch slot cannot be changed');
        }
        const key = this.#fittedKey(slotKey);
        if (key !== null) this.#replaceModule(key, null);
        return this;
    }

    /**
     * Engineer the module in a slot — apply a blueprint (with a grade and quality) and
     * an optional experimental effect, computing the resulting stat modifiers.
     *
     * The modifiers are stored as an `Engineering` block on the fitted module, so the
     * build's jump-range and mass calculations pick them up automatically. The block keeps
     * the `BlueprintName` you passed, so it reads back the way the build declared it.
     *
     * **Which recipe an id names can depend on the module.** The game writes
     * `Sensor_LongRange` and `Sensor_WideAngle` for both a sensor suite's modification and a
     * utility scanner's, and the two roll different stats in opposite directions — Long
     * Range costs the suite mass and the scanner power draw. So the id is resolved against
     * the module's menu before anything is computed, and a wake scanner engineered
     * `Sensor_LongRange` gets the scanner's numbers, which `BLUEPRINTS` keys
     * `Scanner_LongRange`. Reading a stored block back the same way means resolving it the
     * same way: `resolveBlueprintForModule` in `ships/blueprint-journal` is that lookup.
     *
     * @param slotKey - The slot whose module to engineer, matched case-insensitively
     * (journal spelling).
     * @param fdname - The blueprint recipe's Frontier `fdname`, e.g. `"FSD_LongRange"`.
     * @param options - {@link ApplyBlueprintOptions}: `grade` (1–5), optional `quality`
     * (0–1, default 1), and optional `experimental` effect `fdname`.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty, or the blueprint/grade/experimental is
     * unknown, or `quality` is outside `[0, 1]`.
     * @throws {TypeError} If the fitted module has no stats to engineer; or the id names a
     * decorative modification, which names no recipe (see
     * {@link DECORATIVE_MODIFICATIONS}); or the module is not offered the blueprint — by
     * its engineering menu, by the journal spelling of an entry on that menu, by the
     * generic spelling of a recipe that menu lists under a family's name, or by being sold
     * already carrying it; the fitted article is final and accepts no further engineering;
     * or the module is not offered the experimental effect, which its
     * menu alone decides; or the catalogue does not carry every base stat the recipe
     * modifies. Incomplete engineering is rejected rather than stored as a partial journal
     * modifier block.
     * @example
     * ```ts
     * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
     * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * const fsd = getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)!;
     *
     * build.setModule('FrameShiftDrive', fsd)
     *      .applyBlueprint('FrameShiftDrive', 'FSD_LongRange', {
     *          grade: 5,
     *          experimental: 'special_fsd_heavy',
     *      });
     * build.maxJumpRange(); // now reflects the engineered optimal mass
     * ```
     */
    applyBlueprint(slotKey: string, fdname: string, options: ApplyBlueprintOptions): this {
        const module = this.#fittedModuleFor(slotKey);
        if (!module) {
            throw new RangeError(`ShipLoadout.applyBlueprint: slot "${slotKey}" is empty`);
        }
        const stats = this.#statsFor(module);
        if (!stats) {
            throw new TypeError(`ShipLoadout.applyBlueprint: no stats for module "${module.Item}"`);
        }
        // Which recipe an id names can depend on the module it is named for: the game
        // writes `Sensor_LongRange` on a utility scanner and on a sensor suite, and the two
        // roll different stats. Resolve before reading the grade, so the numbers folded are
        // the ones this module rolls rather than the other family's.
        const recipe = resolveBlueprintForModule(module.Item, fdname);
        // Name both spellings once they differ, so an error about the recipe this module
        // rolls cannot read as an error about the id the caller passed.
        const named = recipe === fdname ? `"${fdname}"` : `"${fdname}" (${recipe} on this module)`;
        // A decorative transformation reaches this method as a real id that names no
        // recipe: the game writes it in the same field, but it has no grade, costs nothing
        // and no engineer applies one. Say that, rather than letting the grade lookup below
        // report a genuine id as an unknown blueprint. It does move a stat, so the refusal
        // names where that is — a caller wanting a festive launcher's damage wants
        // `DECORATIVE_MODIFICATIONS`, not a grade this recipe never had.
        if (isDecorativeModification(recipe)) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: ${named} is a decorative modification, not a blueprint; no engineer applies one, and the stat changes it arrives with are in DECORATIVE_MODIFICATIONS`,
            );
        }
        if (!Number.isInteger(options.grade) || options.grade < 1 || options.grade > 5) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: no blueprint ${named} grade ${options.grade}`,
            );
        }
        const grade = getBlueprintGrade(recipe, options.grade);
        if (!grade) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: no blueprint ${named} grade ${options.grade}`,
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
        if (stats.engineeringLocked) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: module "${module.Item}" is a final pre-engineered article and accepts no further engineering`,
            );
        }
        // The engineering menu is the authority on what a module accepts, so the same
        // catalogue answers `getBlueprintsForModule` and this gate. A module with no menu
        // is not necessarily unengineerable: some are sold already carrying a recipe, and
        // `blueprintAvailableFor` knows that, so ask it before blaming the module.
        if (!blueprintAvailableFor(module.Item, fdname)) {
            throw new TypeError(
                isEngineerable(module.Item)
                    ? `ShipLoadout.applyBlueprint: module "${module.Item}" is not offered blueprint ${named}; it takes ${getBlueprintsForModule(module.Item).join(', ')}`
                    : `ShipLoadout.applyBlueprint: no registry lists an engineering menu for module "${module.Item}"`,
            );
        }
        if (
            options.experimental !== undefined &&
            !experimentalAvailableFor(module.Item, options.experimental)
        ) {
            const offered = getExperimentalsForModule(module.Item);
            throw new TypeError(
                `ShipLoadout.applyBlueprint: module "${module.Item}" is not offered experimental effect "${options.experimental}"; it takes ${offered.length > 0 ? offered.join(', ') : 'no experimental effect'}`,
            );
        }
        const base = baseStats(stats);
        const missing = missingBaseLabels(stats, base, grade.features, experimental?.modifiers);
        if (missing.length > 0) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: cannot compute ${named} for module "${module.Item}"; missing base stats for ${missing.join(', ')}`,
            );
        }
        // A converting experimental supersedes a blueprint conversion, just as it
        // supersedes the stock split. Both catalogue shapes feed the same journal-label
        // synthesis below.
        const damageDistribution = experimental?.damageDistribution ?? grade.damageDistribution;
        const modifiers = computeModifiers(base, grade, quality, experimental);
        if (damageDistribution) {
            for (const type of ['kinetic', 'thermal', 'explosive', 'absolute'] as const) {
                const value = damageDistribution[type];
                if (value === undefined) continue;
                const label = labelsForDamageType(type)[0];
                if (label === undefined) continue;
                modifiers.push({
                    Label: label,
                    Value: value * scaleForLabel(label),
                    OriginalValue: (stats.damageDistribution?.[type] ?? 0) * scaleForLabel(label),
                });
            }
        }
        const engineering: ModuleEngineering = {
            BlueprintName: fdname,
            Level: options.grade,
            Quality: quality,
            ...(options.experimental !== undefined
                ? { ExperimentalEffect: options.experimental }
                : {}),
            Modifiers: modifiers,
        };
        this.#replaceModule(module.Slot, { ...module, Engineering: engineering });
        return this;
    }

    /**
     * Strip the engineering from a slot's module, restoring its base stats.
     *
     * @param slotKey - The slot to de-engineer, matched case-insensitively (journal
     * spelling).
     * @returns `this`, for chaining. A no-op if the slot is empty or un-engineered.
     * @throws {TypeError} If the fitted article is final pre-engineered and its baked
     * engineering cannot be removed.
     */
    clearEngineering(slotKey: string): this {
        const module = this.#fittedModuleFor(slotKey);
        if (module && this.#statsFor(module)?.engineeringLocked) {
            throw new TypeError(
                `ShipLoadout.clearEngineering: module "${module.Item}" is a final pre-engineered article and its engineering cannot be removed`,
            );
        }
        if (module?.Engineering) {
            const bare: LoadoutModule = { Slot: module.Slot, Item: module.Item };
            if (module.On !== undefined) (bare as { On?: boolean }).On = module.On;
            if (module.Priority !== undefined) {
                (bare as { Priority?: number }).Priority = module.Priority;
            }
            if (module.Health !== undefined) (bare as { Health?: number }).Health = module.Health;
            if (module.Value !== undefined) (bare as { Value?: number }).Value = module.Value;
            this.#replaceModule(module.Slot, bare);
        }
        return this;
    }

    /**
     * Switch a fitted module on or off.
     *
     * @param slotKey - The slot's journal key, e.g. `"PowerPlant"`, matched
     * case-insensitively.
     * @param on - `true` to power it, `false` to switch it off.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
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
     * @param slotKey - The slot's journal key, matched case-insensitively.
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
     * would wrongly discard `ModulesValue` and `Rebuy`. Existing immutable snapshots
     * intentionally keep their earlier power state; a fresh query observes the patch.
     */
    #patchModule(slotKey: string, patch: Pick<Partial<LoadoutModule>, 'On' | 'Priority'>): void {
        const module = this.#fittedModuleFor(slotKey);
        if (!module) {
            throw new RangeError(`ShipLoadout: slot "${slotKey}" is empty`);
        }
        this.#modules.set(module.Slot, cloneLoadoutModule({ ...module, ...patch }));
    }

    /**
     * This build as a journal `Loadout` event — the `data` half of a SLEF entry.
     *
     * @param options - Module ordering and how sparse to be about power state.
     * @returns A fresh event. Every top-level figure is **recomputed** from the hull and
     * the fitted modules rather than echoed from whatever an import supplied — the one
     * exception being the credits, when `credits: 'source'` asks for the capture's own.
     * Any figure that cannot be worked out is **left out** rather than emitted as a stale
     * or zero value — SLEF requires nothing beyond `Ship` and `Modules`.
     *
     * Credits are quoted at **retail** by default: the bare hull's `hullCost` plus every
     * fitted module's catalogue list price, with `Rebuy` 5% of the two. A source's own
     * `HullValue` / `ModulesValue` / `Value` figures are deliberately not quoted here,
     * because they record one commander's purchase history — the Deep Black's modules
     * are all 12.25% off list — and purchase discounts are not a property of the build.
     * They are not lost either: pass `credits: 'source'` to export the
     * {@link sourcePurchase} record instead, as provenance rather than as a price.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * const event = build.toLoadoutEvent();
     * event.MaxJumpRange; // recomputed, not the exporter's claim
     * event.HullValue;    // the catalogue's list price
     *
     * build.toLoadoutEvent({ credits: 'source' }).HullValue; // what the capture paid
     * ```
     */
    toLoadoutEvent(options: LoadoutExportOptions = {}): LoadoutEvent {
        const hull = getShipBySymbol(this.#shipSymbol);
        const unladenMass = this.#computedUnladenMass().value;
        const cargoCapacity = this.#computedCargoCapacity().value;
        const fuel = this.#computedFuelCapacity().value;
        const maxJumpRange = this.#exportableJumpRange(unladenMass);
        return exportLoadoutEvent(
            {
                shipSymbol: this.#shipSymbol,
                ...(this.#top.ShipName === undefined ? {} : { shipName: this.#top.ShipName }),
                ...(this.#top.ShipIdent === undefined ? {} : { shipIdent: this.#top.ShipIdent }),
                modules: this.#modules,
                ...(options.moduleOrder === 'slots' ? { layout: this.#layoutOrNull() } : {}),
                sourcePurchase: this.#sourcePurchase,
                retailHullValue: hull?.hullCost ?? null,
                unladenMass,
                cargoCapacity,
                fuelCapacity: fuel,
                maxJumpRange,
                statsFor: (module) => this.#statsFor(module),
            },
            options,
        );
    }

    /**
     * This build as a one-entry SLEF export.
     *
     * @param options - Ordering, power state, and the envelope header.
     * @returns The export. Several builds travel together as
     * `toSlef([a.toLoadoutEvent(), b.toLoadoutEvent()])` using the function of the same
     * name from `./slef`.
     */
    toSlef(options: SlefExportOptions): Slef {
        return toSlefEnvelope(this.toLoadoutEvent(options), options.header);
    }

    /**
     * This build as SLEF JSON — ready to write to a file or put on the clipboard.
     *
     * @param options - As {@link toSlef}, plus `indent` (compact by default).
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * build.toSlefString({ header: { appName: 'MyApp', appVersion: '1.0.0' } });
     * ```
     */
    toSlefString(options: SlefExportOptions): string {
        return stringifySlef(this.toSlef(options), { indent: options.indent ?? 0 });
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
        const tank = this.#computedFuelCapacity().value;
        if (tank === null) return null;
        return singleJumpRange(unladenMass, Math.min(tank.main, drive.maxFuel), drive);
    }

    /**
     * The resolved frame-shift-drive constants for this build — post-engineering,
     * with any Guardian FSD Booster folded into `jumpBoost`.
     *
     * @throws {TypeError} If the build has no frame shift drive, or its required jump
     * constants are missing from the stats catalogue.
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
     * @throws {TypeError} If the build has no usable frame shift drive, or its mass or
     * fuel capacity cannot be determined.
     */
    maxJumpRange(): number {
        const fsd = this.frameShiftDrive;
        const fuel = Math.min(this.#requireFuelCapacity().main, fsd.maxFuel);
        return singleJumpRange(this.#requireMass(0), fuel, fsd);
    }

    /**
     * The range of a single jump for a chosen fuel and cargo load, in light-years.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns The jump's range, in light-years.
     * @throws {TypeError} If the build has no usable frame shift drive or its mass
     * cannot be determined; also if fuel capacity is unknown and `options.fuel` is
     * omitted.
     */
    jumpRange(options: JumpOptions = {}): number {
        const fsd = this.frameShiftDrive;
        const fuel = options.fuel ?? this.#requireFuelCapacity().main;
        return singleJumpRange(this.#requireMass(options.cargo ?? 0), fuel, fsd);
    }

    /**
     * Single-jump range on a full tank with a full cargo hold, in light-years.
     *
     * @returns The jump's range, in light-years.
     * @throws {TypeError} If the build has no usable frame shift drive, or its mass,
     * fuel capacity or cargo capacity cannot be determined.
     */
    ladenJumpRange(): number {
        return this.jumpRange({ cargo: this.#requireCargoCapacity() });
    }

    /**
     * The fuel a single jump of a given distance costs, in tonnes.
     *
     * @param distance - The jump distance, in light-years.
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns Fuel used, in tonnes (capped at the drive's max fuel per jump).
     * @throws {TypeError} If the build has no usable frame shift drive or its mass
     * cannot be determined; also if fuel capacity is unknown and `options.fuel` is
     * omitted.
     */
    fuelPerJump(distance: number, options: JumpOptions = {}): number {
        const fsd = this.frameShiftDrive;
        const fuel = options.fuel ?? this.#requireFuelCapacity().main;
        return fuelPerJump(distance, this.#requireMass(options.cargo ?? 0), fuel, fsd);
    }

    /**
     * Total multi-jump range on a full main tank, in light-years — the sum of
     * successive jumps as the tank drains.
     *
     * @param options - `cargo` aboard, in tonnes; defaults to `0`.
     * @returns The summed range of every jump on one full tank, in light-years.
     * @throws {TypeError} If the build has no usable frame shift drive, or its mass or
     * fuel capacity cannot be determined.
     */
    totalRange(options: { readonly cargo?: number } = {}): number {
        return totalRange(
            this.#requireMass(options.cargo ?? 0),
            this.#requireFuelCapacity().main,
            this.frameShiftDrive,
        );
    }

    /**
     * Every jump figure at once — best, unladen, laden, and the multi-jump totals.
     *
     * @returns The {@link JumpRangeSummary}, in light-years. For a partial load, call
     * {@link jumpRange} with the `fuel` and `cargo` you actually have.
     * @throws {TypeError} If the build has no usable frame shift drive, or its mass,
     * fuel capacity or cargo capacity cannot be determined.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * const jumps = build.jumpRangeSummary();
     * jumps.max;    // -> 89.41  (one jump's fuel, empty hold)
     * jumps.laden;  // -> the range with the hold full
     * // Half a tank and 32 t aboard, once the tank is known:
     * const fuel = build.fuelCapacityResult;
     * if (fuel.complete) build.jumpRange({ fuel: fuel.value.main / 2, cargo: 32 });
     * ```
     */
    jumpRangeSummary(): JumpRangeSummary {
        const cargo = this.#requireCargoCapacity();
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
     * and nothing is powered. A fitted module whose draw the catalogue cannot supply is
     * named in {@link PowerBudget.unknownDraws} rather than counted as drawing nothing,
     * which makes every total a lower bound while that list is non-empty.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
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
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
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
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
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
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * const guns = build.weaponMetrics();
     * guns.total.damagePerSecond;          // -> burst DPS across the hardpoints
     * guns.total.sustainedDamagePerSecond; // -> with reloads folded in
     * guns.total.energyPerSecond;          // -> MW asked of the WEP capacitor
     * guns.total.powerDraw;                // -> MW asked of the power plant when deployed
     * guns.weapons[0]?.metrics.damageByType.thermal;
     * guns.weapons[0]?.ammunition?.total;  // -> rounds aboard when fully rearmed
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
                ammunition: ammunitionCapacity(stats),
            });
        }
        return {
            weapons,
            total: sumWeaponMetrics(
                weapons.filter((weapon) => weapon.enabled).map((weapon) => weapon.metrics),
            ),
        };
    }

    /**
     * The hull's mounts, or `null` when its layout is unknown. Expanded once per build:
     * `#requireSlot` alone asks for it on every `setModule`, so assembling a 38-module
     * ship re-derived all 39 mounts 38 times over.
     *
     * The array is frozen because it is now shared between callers rather than built
     * fresh for each. That is a tripwire against a future caller sorting or splicing it
     * in place, not a consumer guarantee: no element and no reference to this array
     * escapes the class, so nothing outside can observe the freeze.
     */
    #layoutOrNull(): readonly BuildSlot[] | null {
        if (this.#layoutCache === undefined) {
            const layout = getShipSlots(this.#shipSymbol);
            this.#layoutCache = layout === null ? null : Object.freeze(enumerateSlots(layout));
        }
        return this.#layoutCache;
    }

    /** Discard the derived views: something a fitted module *is* has changed. */
    #invalidate(): void {
        this.#version++;
    }

    #layout(): readonly BuildSlot[] {
        const layout = this.#layoutOrNull();
        if (!layout) {
            throw new TypeError(`ShipLoadout: no slot layout for hull "${this.#shipSymbol}"`);
        }
        return layout;
    }

    #requireSlot(slotKey: string): BuildSlot {
        const wanted = slotKey.toLowerCase();
        const slot = this.#layout().find((s) => s.key.toLowerCase() === wanted);
        if (!slot) {
            throw new RangeError(
                `ShipLoadout: hull "${this.#shipSymbol}" has no slot "${slotKey}"`,
            );
        }
        return slot;
    }

    /**
     * The key this build stores the module in `slotKey` under, or `null` when the slot
     * is empty. {@link matchingKeyIn} is where the matching rule and its reasons live.
     */
    #fittedKey(slotKey: string): string | null {
        return matchingKeyIn(this.#modules, slotKey);
    }

    /** The module fitted in `slotKey`, or `undefined` when the slot is empty. */
    #fittedModuleFor(slotKey: string): LoadoutModule | undefined {
        const key = this.#fittedKey(slotKey);
        return key === null ? undefined : this.#modules.get(key);
    }

    /** Unwrap a calculation result required by a public convenience calculation. */
    #require<T>(result: CalculationResult<T>, what: string): T {
        if (result.value === null) {
            throw new TypeError(
                `ShipLoadout: cannot determine ${what} (${result.issues.map((i) => i.message).join('; ')})`,
            );
        }
        return result.value;
    }

    /** Unladen mass plus the given cargo, or throw if the mass is unknown. */
    #requireMass(cargo: number): number {
        return this.#require(this.unladenMassResult, 'mass') + cargo;
    }

    /** Require the complete fuel capacity for a calculation that cannot omit it. */
    #requireFuelCapacity(): FuelCapacity {
        return this.#require(this.fuelCapacityResult, 'fuel capacity');
    }

    /** Require the complete cargo capacity for a calculation that cannot omit it. */
    #requireCargoCapacity(): number {
        return this.#require(this.cargoCapacityResult, 'cargo capacity');
    }

    /** Resolve fitted modules once into the data-free aggregate-calculation shape. */
    #calculationModules(): readonly LoadoutCalculationModule[] {
        const cached = this.#calculationCache;
        if (cached !== null && cached.version === this.#version) return cached.value;
        const value = this.#resolveCalculationModules();
        this.#calculationCache = { version: this.#version, value };
        return value;
    }

    #resolveCalculationModules(): readonly LoadoutCalculationModule[] {
        return [...this.#modules.values()].map((module) => {
            const stats = this.#statsFor(module);
            const symbol = module.Item.toLowerCase();
            const parsedSlot = parseSlotName(module.Slot);
            const unresolvedOutfitting =
                stats === null && !isNonOutfittingSlot(module.Slot) && !isBuiltInHullModule(module);
            const isCargoRack =
                stats?.cargoCapacity !== undefined ||
                stats?.engineeringGroup === 'cargoRacks' ||
                symbol.includes('cargorack');
            const isFuelTank =
                stats?.fuelCapacity !== undefined ||
                stats?.slot === 'fuelTank' ||
                symbol.startsWith(FUEL_TANK_PREFIX);
            const mayCarryCapacity =
                unresolvedOutfitting && (parsedSlot === null || parsedSlot.kind === 'optional');
            const mayCarryFuel =
                mayCarryCapacity ||
                (unresolvedOutfitting &&
                    parsedSlot?.kind === 'core' &&
                    parsedSlot.core === 'fuelTank');
            return {
                slot: module.Slot,
                symbol: module.Item,
                mass: this.#moduleMass(module),
                ...(isCargoRack || mayCarryCapacity
                    ? {
                          cargoCapacity: isCargoRack
                              ? this.#moduleCapacity(module, 'CargoCapacity', 'cargoCapacity')
                              : null,
                      }
                    : {}),
                ...(isFuelTank || mayCarryFuel
                    ? {
                          fuelCapacity: isFuelTank
                              ? this.#moduleCapacity(module, 'FuelCapacity', 'fuelCapacity')
                              : null,
                      }
                    : {}),
            };
        });
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
        this.#invalidate();
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

        // Re-fitting the same article does not change its purchase price, even when the
        // supplied stats replace or remove its engineering details.
        if (normalizeKey(previous?.Item) === normalizeKey(next?.Item)) return;

        // No catalogue carries post-purchase module value or rebuy changes.
        delete this.#top.ModulesValue;
        delete this.#top.Rebuy;
    }

    /**
     * A module's post-engineering mass, `0` for no module, or `null` if unknown.
     *
     * @remarks
     * Classified the same way as {@link #moduleValue}: the catalogue first, the slot only
     * for an article it cannot identify, and then only to ask whether it is a mount.
     */
    #moduleMass(module: LoadoutModule | null, statsOverride?: OutfittingModule): number | null {
        if (module === null) return 0;
        const modified = getLoadoutModifier(module, 'Mass');
        if (modified !== null) return modified;
        const stats = statsOverride ?? this.#statsFor(module);
        if (stats?.mass !== undefined) return stats.mass;
        // The cargo hatch is built into the hull and weighs nothing, and its id varies by
        // hull family: a Lynx Highliner fits `ModularCargoBayDoorFDL` where most hulls fit
        // `ModularCargoBayDoor`. Matching the family rather than the one id is what lets a
        // capture of such a hull compute a mass at all — Frontier's own `UnladenMass` for
        // that capture agrees once the hatch contributes zero.
        if (isBuiltInHullModule(module)) return 0;
        return stats === null && isNonOutfittingSlot(module.Slot) ? 0 : null;
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
        // A record that names its mount is believed; the symbol answers when none does.
        // A cargo rack has no mount to name — it fits any optional one — so on that side
        // the symbol is the only answer there has ever been.
        const isFuelTank = stats?.slot
            ? stats.slot === 'fuelTank'
            : symbol.startsWith(FUEL_TANK_PREFIX);
        const shouldCarryCapacity =
            field === 'cargoCapacity' ? symbol.includes('cargorack') : isFuelTank;
        return shouldCarryCapacity ? null : 0;
    }

    #resolveDrive(): FrameShiftDriveParams | null {
        let fsdModule: LoadoutModule | undefined;
        for (const m of this.#modules.values()) {
            // A record that names its mount is believed; the symbol answers when none
            // does — a drive this snapshot's catalogue has no record for, which is the
            // case the error message below is written for.
            const stats = this.#statsFor(m);
            const isDrive = stats?.slot
                ? stats.slot === 'frameShiftDrive'
                : m.Item.toLowerCase().startsWith(FSD_PREFIX);
            if (isDrive) {
                fsdModule = m;
                break;
            }
        }
        if (!fsdModule) return null;
        const base = this.#statsFor(fsdModule);
        if (!base || base.fuelMul === undefined || base.fuelPower === undefined) {
            // A drive is fitted, but the stats catalogue has no jump constants for its
            // unrecognised id. Fail with a diagnosable message
            // rather than the "no frame shift drive" one the caller would otherwise get.
            throw new TypeError(
                `ShipLoadout: no jump constants in the stats catalogue for frame shift drive "${fsdModule.Item}"`,
            );
        }

        const optMass = getLoadoutModifier(fsdModule, 'FSDOptimalMass') ?? base.optMass;
        const maxFuel = getLoadoutModifier(fsdModule, 'MaxFuelPerJump') ?? base.maxFuel;
        if (optMass === undefined || maxFuel === undefined) {
            const missing = [
                ...(optMass === undefined ? ['optMass'] : []),
                ...(maxFuel === undefined ? ['maxFuel'] : []),
            ];
            throw new TypeError(
                `ShipLoadout: frame shift drive "${fsdModule.Item}" has no ${missing.join(' or ')} in the stats catalogue`,
            );
        }

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
            const stats = this.#statsFor(m);
            if (
                stats?.engineeringGroup !== 'fsdBoosters' &&
                !m.Item.toLowerCase().startsWith(BOOSTER_PREFIX)
            ) {
                continue;
            }
            if (m.On === false) continue; // an unpowered booster gives no bonus
            if (stats?.jumpBoost === undefined) {
                throw new TypeError(
                    `ShipLoadout: FSD booster "${m.Item}" has no jumpBoost in the stats catalogue`,
                );
            }
            return stats.jumpBoost;
        }
        return 0;
    }

    /** Resolve the snapshotted fitted record, or fall back to the built-in catalogue. */
    #statsFor(module: LoadoutModule | null): OutfittingModule | null {
        if (module === null) return null;
        const stats = this.#moduleStats.get(module.Slot) ?? builtInModuleBySymbol(module.Item);
        if (stats) return stats;
        // Frontier gives some hull families their own cargo-hatch symbol even though the
        // fitted article has the standard hatch's stats. Resolve that family here so its
        // power draw is available as well as its already-known zero mass and price.
        return isBuiltInHullModule(module) ? builtInModuleBySymbol('ModularCargoBayDoor') : null;
    }
}
