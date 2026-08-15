/**
 * {@link ShipLoadout} — a mutable fitted-ship model that both **answers questions**
 * about a build and **edits** it.
 *
 * Load one from a SLEF export (or a journal `Loadout` event) to read back the ship's
 * identity, mass and fuel and ask for jump range and per-jump fuel; or start an
 * {@link ShipLoadout.default | default} or {@link ShipLoadout.empty | empty} hull,
 * enumerate its {@link ShipLoadout.slots | slots}, and
 * {@link ShipLoadout.setModule | fit} and {@link ShipLoadout.removeModule | remove}
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
    type EngineeringModifier,
    type Slef,
    type SlefHeader,
} from './slef.js';
import {
    frameShiftDriveMassFactor,
    singleJumpRange,
    fuelPerJump,
    totalRange,
    type FrameShiftDriveParams,
    type TotalRangeDetails,
} from './jump-range.js';
import { getShipBySymbol, getShipSlots } from './ships.js';
import { getDefaultLoadout } from './default-loadouts.js';
import { enumerateSlots, parseSlotName, type BuildSlot, type SlotKind } from './slots.js';
import { computeModifiers } from './engineering.js';
import { getBlueprintGrade } from './blueprints.js';
import { getDecorativeModification, isDecorativeModification } from './decorative-modifications.js';
import { getExperimentalEffect } from './experimental-effects.js';
import { getExperimentalsForModule } from './engineering-options.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import type { ModuleEngineering } from './slef.js';
import type { OutfittingModule } from './modules.js';
import { calculateModuleLimits, type ModuleLimitUsage } from './module-limits.js';
import { baseStats, labelsForDamageType, scaleForLabel } from './internal/module-stat-labels.js';
import {
    cloneLoadoutModule,
    cloneModuleStats,
    FITTED_ITEM,
    isBuiltInHullModule,
    isNonOutfittingSlot,
    matchingKeyIn,
} from './internal/loadout-state.js';
import {
    availableBlueprintsFor,
    availableExperimentalsFor,
    blueprintAvailableFor,
    blueprintRoutesFor,
    experimentalAvailableFor,
    journalModifiersFor,
    missingBaseLabels,
    primitiveEngineeringInputsFor,
} from './internal/loadout-engineering.js';
import { builtInModuleBySymbol } from './internal/module-symbol-index.js';
import {
    armourInputFor,
    cellBankInputsFor,
    effectiveModule,
    heatInputFor,
    mobilityInputFor,
    powerAvailable,
    powerConsumerFor,
    shieldInputFor,
    shieldRecoveryInputFor,
    weaponsCapacitorInputFor,
    weaponStatsFor,
} from './internal/loadout-metrics.js';
import { powerBudget, type PowerBudget, type PowerConsumer } from './power.js';
import { heatMetrics, type HeatMetrics } from './heat.js';
import { shieldMetrics, type ShieldMetrics } from './shields.js';
import { armourMetrics, type ArmourMetrics } from './armour.js';
import {
    sumWeaponMetrics,
    weaponMetrics,
    type WeaponMetrics,
    type WeaponTotals,
} from './weapons.js';
import { ammunitionCapacity, type AmmunitionCapacity } from './ammunition.js';
import { weaponsCapacitorMetrics, type WeaponsCapacitorMetrics } from './weapons-capacitor.js';
import { mobilityMetrics, type MobilityMetrics } from './mobility.js';
import {
    cellBankSummary,
    shieldRecovery,
    type CellBankSummary,
    type ShieldRecovery,
} from './shield-recovery.js';
import { identifyPreEngineeredVariant } from './pre-engineered-stats.js';
import { ALL_MODULES } from './modules-all.js';
import type { FittedModule } from './fitted-module.js';
import type { LoadoutSlot } from './loadout-slot.js';
export type { ImmovableReason, LoadoutSlot } from './loadout-slot.js';
import { loadoutSlotName } from './internal/loadout-views.js';
import { moduleFitError, moduleFitProblem } from './internal/loadout-fitting.js';
import { exportLoadoutEvent } from './internal/loadout-export.js';
import {
    normalizeLoadoutEvent,
    type ImportedTopFigures as TopFigures,
} from './internal/loadout-import.js';
import type { SourcePurchaseRecord } from './source-purchase.js';
import { deepFreeze } from '../internal/deep-freeze.js';
import { normalizeKey } from '../internal/registry-index.js';
import {
    describeValue,
    requireString,
    requireStringIfPresent,
    truncate,
} from '../internal/argument-guards.js';
import { completeResult } from './internal/calculation-result.js';
import { resolveDecorativeModificationStats } from './internal/decorative-modification-resolution.js';
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
    type LoadoutIssueParams,
    type LoadoutValidation,
    type ModuleFitConstraint,
    type ValidationModule,
} from './loadout-validation.js';

/**
 * How a slot key is named when it is not a string.
 *
 * Every method that takes one reaches the build through `#requireSlot` or `#fittedKey`,
 * so the two of them guard for all ten rather than each method repeating the check. That
 * costs the method's own name in the message, which is why this reads like the
 * neighbouring throws (`ShipLoadout: slot "…" is empty`) rather than like `empty`'s.
 */
const SLOT_KEY = 'ShipLoadout: slotKey';

/** Validate public fuel/cargo overrides before build state affects the result. */
const requireLoadOptions = (scope: string, options: JumpOptions): void => {
    for (const field of ['fuel', 'cargo'] as const) {
        const value = options[field];
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
            throw new RangeError(`${scope}: ${field} must be a finite non-negative number`);
        }
    }
};

/**
 * Stable machine-readable reason a {@link ShipLoadout} edit was refused:
 * `immutableSlot`, an incompatible fit, a duplicate one-per-ship family, or a module
 * count beyond the build's current allowance.
 */
export type LoadoutEditErrorCode =
    'immutableSlot' | 'incompatibleModule' | 'duplicateExclusiveModule' | 'moduleLimitExceeded';

/**
 * An editor request that the current hull or build constraints cannot accept.
 *
 * @remarks
 * This remains a `TypeError`, so existing `instanceof TypeError` handling continues to
 * work. Localized editors should switch on {@link code}, then use {@link constraint}
 * and {@link params} instead of parsing the English fallback in `message`.
 *
 * @example
 * ```ts
 * import {
 *   LoadoutEditError,
 *   ShipLoadout,
 * } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
 *
 * const build = ShipLoadout.empty('SideWinder');
 * const drive = getModuleBySymbol('Int_Hyperdrive_Size8_Class5', CORE_MODULES)!;
 * try {
 *   build.setModule('FrameShiftDrive', drive);
 * } catch (error) {
 *   if (error instanceof LoadoutEditError) error.constraint; // -> 'oversized'
 * }
 * ```
 */
export class LoadoutEditError extends TypeError {
    /** Stable category for the refused edit. */
    readonly code: LoadoutEditErrorCode;
    /** More specific fitting rule for an `incompatibleModule` failure. */
    readonly constraint?: ModuleFitConstraint;
    /** Language-neutral values used by the English fallback message. */
    readonly params: LoadoutIssueParams;

    /**
     * Construct a structured loadout-edit error.
     *
     * @param message - English fallback suitable for logs.
     * @param code - Stable category for the refused edit.
     * @param params - Language-neutral values used to render the failure.
     * @param constraint - Specific fitting rule, when `code` is `incompatibleModule`.
     */
    constructor(
        message: string,
        code: LoadoutEditErrorCode,
        params: LoadoutIssueParams,
        constraint?: ModuleFitConstraint,
    ) {
        super(message);
        this.code = code;
        this.params = deepFreeze(
            Object.fromEntries(
                Object.entries(params).map(([key, value]) => [
                    key,
                    Array.isArray(value) ? [...value] : value,
                ]),
            ) as Record<string, string | number | readonly string[]>,
        );
        if (constraint !== undefined) this.constraint = constraint;
    }
}

/** Optional mass overrides for a single calculation. */
export interface JumpOptions {
    /** Finite non-negative fuel load, in tonnes. Defaults to the full main tank. */
    readonly fuel?: number;
    /** Finite non-negative cargo load, in tonnes. Defaults to `0` (unladen). */
    readonly cargo?: number;
}

/** Options for {@link ShipLoadout.applyBlueprint}. */
export interface ApplyBlueprintOptions {
    /** The blueprint grade, `1`–`5`. */
    readonly grade: number;
    /**
     * The engineering system's shared quality roll, `0`–`1`. Defaults to `1`
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
     * Defaults to `0` for {@link ShipLoadout.shieldMetrics} and `4` for
     * {@link ShipLoadout.shieldRecovery}.
     */
    readonly systemsPips?: number;
}

/** Optional load and ENG allocation for {@link ShipLoadout.mobilityMetrics}. */
export interface MobilityOptions extends JumpOptions {
    /** Pips assigned to the engines capacitor, `0`–`4`. Defaults to `4`. */
    readonly enginesPips?: number;
}

/** Optional WEP allocation for {@link ShipLoadout.weaponsCapacitorMetrics}. */
export interface WeaponsOptions {
    /** Pips assigned to the weapons capacitor, `0`–`4`. Defaults to `4`. */
    readonly weaponsPips?: number;
}

/** Retail catalogue credits for an assembled build. */
export interface RetailCredits {
    /** Bare hull list price in credits, or `null` for an unknown hull. */
    readonly hull: number | null;
    /** Sum of every priced fitted module, in credits. A lower bound when `unpriced` is non-empty. */
    readonly modules: number;
    /** Five percent of the priced hull and modules, truncated to credits, or `null` for an unknown hull. */
    readonly rebuy: number | null;
    /** Fitted modules that could not be priced from the catalogue. */
    readonly unpriced: readonly { readonly slot: string; readonly symbol: string }[];
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

/**
 * A build's jump ranges at the loads that matter. The three single-jump values and
 * each multi-jump result's `range` are in light-years.
 */
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
    /** Summed range and jump count on one full tank, empty hold. */
    readonly totalUnladen: TotalRangeDetails;
    /** Summed range and jump count on one full tank, full hold. */
    readonly totalLaden: TotalRangeDetails;
}

/** A blueprint candidate for a module symbol, with its grades and availability route. */
export interface AvailableBlueprint {
    /** The blueprint's Frontier `fdname`, e.g. `"FSD_LongRange"`. */
    readonly fdname: string;
    /** The grades the blueprint offers, ascending (e.g. `[1, 2, 3, 4, 5]`). */
    readonly grades: readonly number[];
    /**
     * Why the recipe is listed: `'ordinary'` for the stock module's engineering menu,
     * or `'mercenary'` for a bespoke recipe attached to a Mercenary purchase.
     *
     * @remarks
     * A Mercenary article shares its module symbol with the stock article, so a loadout
     * cannot tell which one was purchased. `'mercenary'` means the recipe is available
     * only through that purchase route; it does not identify the fitted article as one.
     */
    readonly route: 'ordinary' | 'mercenary';
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
    /** Primitive modifiers retained for calculations after journal presentation. */
    readonly #primitiveModifiers = new Map<string, readonly EngineeringModifier[]>();
    readonly #top: TopFigures;
    readonly #sourcePurchase: SourcePurchaseRecord | null;
    /**
     * Bumped by every edit that changes what a fitted module *is* — which slots are
     * filled, by which article, with which engineering. Calculation and validation
     * results are rebuilt when it moves and reused when it does not.
     *
     * @remarks
     * `#patchModule` deliberately does not bump it. Powering a module up or down, or
     * moving it between priority groups, changes no calculation or validation input —
     * `powerBudget` and `toLoadoutEvent`, which do read that state, are not cached.
     */
    #version = 0;
    /** Bumped by every edit reflected in a public slot or fitted-module snapshot. */
    #viewVersion = 0;
    /**
     * The hull's expanded mounts: `undefined` until first asked, `null` for a hull
     * with no known layout. Needs no version — `#shipSymbol` is `readonly`, so a
     * build's layout is fixed for its whole life.
     */
    #layoutCache: readonly BuildSlot[] | null | undefined;
    #calculationCache: { version: number; value: readonly LoadoutCalculationModule[] } | null =
        null;
    #validationCache: { version: number; value: LoadoutValidation } | null = null;
    #fittedModuleCache: { version: number; value: Map<string, FittedModule> } | null = null;
    #slotCache: {
        version: number;
        value: Map<SlotKind | undefined, readonly LoadoutSlot[]>;
    } | null = null;

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
                `ShipLoadout.fromSlef: no entry at index ${truncate(index)} (have ${entries.length})`,
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
     *
     * Modules are imported as one complete snapshot: their array order does not affect
     * per-ship count allowances, and any aggregate violation is reported by
     * {@link validation}. Use this factory rather than replaying a complete loadout
     * through the incremental {@link setModule} editor.
     *
     * @throws {TypeError} If the event is not shaped like one. What is checked is the
     * structure a build is assembled from, and the types of the fields naming things in
     * it: `event` must be an object with an array of module objects in `Modules`; each
     * module needs a string `Slot` and `Item`, and no two may claim the same slot; a
     * module's `Engineering` must be an object, and that block's `Modifiers` an array of
     * objects each carrying a string `Label`, whenever their key is there **at all**;
     * and `event.Ship`, the block's `BlueprintName` and its `ExperimentalEffect` must be
     * strings **when they carry a value**. Every remaining field — every number, every
     * flag, a modifier's value beside its label — is trusted, so use
     * {@link ShipLoadout.fromSlef} (or {@link parseSlef}) for input you did not produce,
     * which reports all of them.
     *
     * A modifier's `Label` is required rather than checked-when-present because it is
     * the only thing saying which stat moved: {@link fittedModuleAt} and the
     * pre-engineered identification both read it unconditionally, so an entry without
     * one would import cleanly and then break the build it produced.
     *
     * `Engineering` and its `Modifiers` are the fields where a `null` is not the same as
     * an omission, because a relay writing `null` for a block or list it does not have
     * would otherwise be read as one. An **absent** `Ship` *is* an omission, and not a
     * failure: it is a hull nothing can name, which {@link validation} reports as
     * `unknownHull`. Nor is a partial `Engineering` block — a capture may state
     * modifiers without naming the recipe.
     */
    static fromLoadout(event: LoadoutEvent): ShipLoadout {
        // Is it an object at all? Everything past that is `normalizeLoadoutEvent`'s,
        // which takes one reading of every field before checking any of it — a caller's
        // accessor cannot answer the check and the use differently. Only the structure
        // and the fields that name things are checked there; every value in them is
        // trusted, and `fromSlef` is the entry point that reports a bad one.
        //
        // An absent `Ship` is deliberately not one of these: it is a hull the catalogue
        // cannot name, which `validation` reports as `unknownHull` rather than throwing.
        if (event === null || typeof event !== 'object') {
            throw new TypeError(
                `ShipLoadout.fromLoadout: event must be a Loadout event, received ${describeValue(event)}`,
            );
        }
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

    /**
     * Start a new build with the modules supplied on a stock ship.
     *
     * @param shipSymbol - The hull's internal symbol, e.g. `"SideWinder"`
     * (case-insensitive).
     * @returns A complete, ready-to-edit stock loadout. The build is independent of the
     * frozen shared catalogue: edits affect this instance only.
     * @throws {TypeError} If `shipSymbol` is not a string, or no default loadout exists
     * for that hull.
     * @remarks
     * This batteries-included factory resolves calculations through the complete module
     * catalogue already used by `ShipLoadout`. If only the stock slot/module identities
     * are needed, `getDefaultLoadout` from `./default-loadouts` avoids that cost.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const stock = ShipLoadout.default('SideWinder');
     * stock.validation.complete; // -> true
     * stock.fittedModuleAt('FrameShiftDrive')?.symbol;
     * // -> 'Int_Hyperdrive_Size2_Class1'
     * ```
     */
    static default(shipSymbol: string): ShipLoadout {
        const requested = requireString(shipSymbol, 'ShipLoadout.default: shipSymbol');
        const loadout = getDefaultLoadout(requested);
        if (!loadout) {
            throw new TypeError(
                `ShipLoadout.default: no default loadout for hull "${truncate(shipSymbol)}"`,
            );
        }
        return new ShipLoadout(
            loadout.symbol,
            new Map(
                loadout.modules.map((module) => [
                    module.slot,
                    { Slot: module.slot, Item: module.symbol },
                ]),
            ),
            {},
        );
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
     * Hull cost in credits represented by the build, or `null` if unknown.
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
     * Fitted-modules cost in credits represented by the build, or `null` if
     * unknown — including after an edit discarded an import's figure, since no catalogue
     * records what a replaced module was bought for. {@link sourcePurchase} keeps the
     * captured figure regardless.
     */
    get modulesValue(): number | null {
        return this.#top.ModulesValue ?? null;
    }

    /**
     * Insurance rebuy cost in credits represented by the build, or `null` if
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
     * build.modulesValue;                 // -> null   unavailable after the edit
     * paid.modulesValue;                  // -> 192625195, the captured figure
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
     * incomplete; a module in a nonexistent or incompatible slot is invalid. Exclusive
     * families and per-ship module-count allowances must also be satisfied.
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
            const fitProblem =
                stats && slot && !builtIn ? moduleFitProblem(this.#shipSymbol, slot, stats) : null;
            return {
                slot: module.Slot,
                symbol: module.Item,
                known: stats !== null || builtIn,
                requiresKnownSlot: !builtIn,
                fitError: fitProblem?.message ?? null,
                ...(fitProblem === null ? {} : { fitConstraint: fitProblem.constraint }),
                ...(fitProblem?.params === undefined ? {} : { fitParams: fitProblem.params }),
                ...(stats?.exclusionGroup === undefined
                    ? {}
                    : { exclusionGroup: stats.exclusionGroup }),
                ...(stats?.limitGroup === undefined ? {} : { limitGroup: stats.limitGroup }),
                ...(stats?.limitIncrease === undefined
                    ? {}
                    : { limitIncrease: stats.limitIncrease }),
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
     * @returns Detached slot views. Repeated reads at the same build version reuse the
     * same frozen array and records; every state-changing edit makes the next read produce
     * new snapshots.
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
        let cached = this.#slotCache;
        if (cached === null || cached.version !== this.#viewVersion) {
            cached = { version: this.#viewVersion, value: new Map() };
            this.#slotCache = cached;
        }
        const existing = cached.value.get(kind);
        if (existing !== undefined) return existing;

        const slots =
            kind === undefined
                ? this.#layout()
                : this.#layout().filter((slot) => slot.kind === kind);
        const currentLimits = this.#moduleLimits();
        const value = deepFreeze(
            slots.map((slot) => {
                const stats = this.#moduleStatsAt(slot.key);
                const immovableReason =
                    slot.key.toLowerCase() === 'cargohatch'
                        ? ('cargoHatch' as const)
                        : stats?.limitIncrease !== undefined &&
                            this.#moduleLimitRegression(slot.key, null, currentLimits, stats) !==
                                null
                          ? ('moduleLimit' as const)
                          : null;
                return {
                    ...slot,
                    name: loadoutSlotName(slot),
                    module: this.fittedModuleAt(slot.key),
                    removable: immovableReason === null,
                    ...(immovableReason === null ? {} : { immovableReason }),
                };
            }),
        );
        cached.value.set(kind, value);
        return value;
    }

    /**
     * A deeply frozen, point-in-time view of the module in a slot.
     *
     * @param slotKey - Slot key, matched case-insensitively.
     * @returns A detached view, or `null` when the slot is empty or unknown. Repeated
     * reads at the same build version reuse the same frozen record; every state-changing
     * edit makes the next read produce a new snapshot.
     * @throws {TypeError} If `slotKey` is not a string.
     */
    fittedModuleAt(slotKey: string): FittedModule | null {
        const module = this.#fittedModuleFor(slotKey);
        if (!module) return null;
        let cached = this.#fittedModuleCache;
        if (cached === null || cached.version !== this.#viewVersion) {
            cached = { version: this.#viewVersion, value: new Map() };
            this.#fittedModuleCache = cached;
        }
        const existing = cached.value.get(module.Slot);
        if (existing !== undefined) return existing;
        const raw = cloneLoadoutModule(module);
        const stats = this.#statsFor(module);
        const effective = effectiveModule(this.#moduleForEffectiveStats(module), stats);
        const value = deepFreeze({
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
        cached.value.set(module.Slot, value);
        return value;
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
     * Return the computable blueprint candidates for a fitted module symbol.
     *
     * @param slotKey - Slot key, matched case-insensitively.
     * @returns Frozen blueprint descriptors: the ordinary engineering menu first, then
     * bespoke Mercenary upgrade recipes. An `'ordinary'` candidate is available to the
     * stock module; a `'mercenary'` candidate requires the caller to confirm that the
     * fitted article is the matching Mercenary purchase, because its symbol alone cannot.
     * Returns an empty array when the slot is empty, unresolved or final, or the module
     * symbol has neither route.
     * @throws {TypeError} If `slotKey` is not a string.
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
     * @throws {TypeError} If `slotKey` is not a string.
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
     * satisfied, with candidates that would worsen a one-per-ship or module-count limit
     * omitted.
     *
     * @param slotKey - The slot key to fit, matched case-insensitively (journal spelling).
     * @returns The fitting modules, in complete-catalogue order.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If `slotKey` is not a string, or the hull has no known slot
     * layout (a SLEF build on an unrecognised hull).
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * ShipLoadout.empty('Anaconda').modulesForSlot('FrameShiftDrive');
     * ```
     */
    modulesForSlot(slotKey: string): OutfittingModule[] {
        const slot = this.#requireSlot(slotKey);
        const occupied = new Set(
            [...this.#modules.values()].flatMap((fitted) => {
                if (fitted.Slot.toLowerCase() === slot.key.toLowerCase()) return [];
                const group = this.#statsFor(fitted)?.exclusionGroup;
                return group === undefined ? [] : [group];
            }),
        );
        const currentLimits = this.#moduleLimits();
        const currentStats = this.#moduleStatsAt(slot.key);
        return ALL_MODULES.filter(
            (module) =>
                moduleFitError(this.#shipSymbol, slot, module) === null &&
                (module.exclusionGroup === undefined || !occupied.has(module.exclusionGroup)) &&
                this.#moduleLimitRegression(slot.key, module, currentLimits, currentStats) === null,
        );
    }

    /**
     * Fit a module into a slot, replacing whatever is there.
     *
     * @remarks
     * This is an incremental editor: every call must avoid worsening the current
     * build's module-count excess. Fit an allowance-increasing module before the weapons
     * it permits. To consume a complete order-independent snapshot, use
     * {@link ShipLoadout.fromLoadout}.
     *
     * @param slotKey - The slot key to fit into, matched case-insensitively (journal
     * spelling). An occupied slot keeps the key the build already spells it with, so
     * fitting into an import never renames one of its mounts.
     * @param module - The module to fit (resolve it from a catalogue first, e.g. with
     * {@link getModuleBySymbol}). The complete record is snapshotted, so a result from
     * `getPreEngineeredStats` or a caller-supplied catalogue keeps its resolved stats.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If `slotKey` is not a string; `module` is null/undefined (e.g. a
     * `getModuleBySymbol` miss) or is not an outfitting module at all; or the hull has no
     * known slot layout (a SLEF build on an unrecognised hull).
     * @throws {LoadoutEditError} If the module does not fit the slot (wrong kind, too
     * large, or a restriction the module does not satisfy), conflicts with a one-per-ship
     * family already fitted elsewhere, or worsens a per-ship module-count excess.
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
                `ShipLoadout.setModule: no module supplied for "${truncate(slotKey)}" (did the module lookup return undefined?)`,
            );
        }
        // Every fit rule reads the record's symbol, so anything else — a bare id, a
        // journal fragment — must be named here rather than failing inside the rules.
        if (typeof (module as { symbol?: unknown }).symbol !== 'string') {
            throw new TypeError(
                `ShipLoadout.setModule: module for "${truncate(slotKey)}" must be an outfitting module, received ${describeValue(module)}`,
            );
        }
        const problem = moduleFitProblem(this.#shipSymbol, slot, module);
        if (problem) {
            if (problem.constraint === 'immutableSlot') {
                throw new LoadoutEditError(
                    `ShipLoadout.setModule: ${truncate(module.symbol)} → ${truncate(slotKey)}: ${problem.message}`,
                    'immutableSlot',
                    { slot: slot.key },
                );
            }
            throw new LoadoutEditError(
                `ShipLoadout.setModule: ${truncate(module.symbol)} → ${truncate(slotKey)}: ${problem.message}`,
                'incompatibleModule',
                {
                    ...problem.params,
                    slot: slot.key,
                    symbol: module.symbol,
                    constraint: problem.constraint,
                },
                problem.constraint,
            );
        }
        if (module.exclusionGroup !== undefined) {
            const conflict = [...this.#modules.values()].find(
                (fitted) =>
                    fitted.Slot.toLowerCase() !== slot.key.toLowerCase() &&
                    this.#statsFor(fitted)?.exclusionGroup === module.exclusionGroup,
            );
            if (conflict) {
                throw new LoadoutEditError(
                    `ShipLoadout.setModule: ${truncate(module.symbol)} → ${truncate(slotKey)}: ${module.exclusionGroup} is limited to one per ship (already fitted in ${truncate(conflict.Slot)})`,
                    'duplicateExclusiveModule',
                    {
                        exclusionGroup: module.exclusionGroup,
                        slot: slot.key,
                        symbol: module.symbol,
                        previousSlot: conflict.Slot,
                        previousSymbol: conflict.Item,
                    },
                );
            }
        }
        const limitProblem = this.#moduleLimitRegression(slot.key, module);
        if (limitProblem !== null) {
            throw new LoadoutEditError(
                `ShipLoadout.setModule: ${truncate(module.symbol)} → ${truncate(slotKey)}: ${limitProblem.group} would have ${limitProblem.count} modules but the ship allows ${limitProblem.limit}`,
                'moduleLimitExceeded',
                {
                    group: limitProblem.group,
                    count: limitProblem.count,
                    limit: limitProblem.limit,
                    slot: slot.key,
                    symbol: module.symbol,
                },
            );
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
     * @throws {TypeError} If `slotKey` is not a string.
     * @throws {LoadoutEditError} If the slot is the built-in cargo hatch, which cannot
     * be removed or replaced, or removing the module would worsen a per-ship
     * module-count excess.
     */
    removeModule(slotKey: string): this {
        // Read before `#fittedKey` does, so this one method guards for itself.
        if (requireString(slotKey, SLOT_KEY).toLowerCase() === 'cargohatch') {
            throw new LoadoutEditError(
                'ShipLoadout.removeModule: the cargoHatch slot cannot be changed',
                'immutableSlot',
                { slot: 'CargoHatch' },
            );
        }
        const key = this.#fittedKey(slotKey);
        if (key !== null) {
            const limitProblem = this.#moduleLimitRegression(key, null);
            if (limitProblem !== null) {
                const fitted = this.#modules.get(key);
                throw new LoadoutEditError(
                    `ShipLoadout.removeModule: ${truncate(slotKey)}: ${limitProblem.group} would have ${limitProblem.count} modules but the ship allows ${limitProblem.limit}`,
                    'moduleLimitExceeded',
                    {
                        group: limitProblem.group,
                        count: limitProblem.count,
                        limit: limitProblem.limit,
                        slot: key,
                        ...(fitted === undefined ? {} : { symbol: fitted.Item }),
                    },
                );
            }
            this.#replaceModule(key, null);
        }
        return this;
    }

    /**
     * Engineer the module in a slot — apply a blueprint (with a grade and quality) and
     * an optional experimental effect, computing the resulting stat modifiers.
     *
     * The modifiers are stored with journal-equivalent labels and numeric values on the
     * fitted module, so the build's jump-range and mass calculations pick them up
     * automatically. The optional journal display-direction hint `LessIsGood` is omitted.
     * The block keeps the `BlueprintName` you passed, so it reads back the way the build
     * declared it. Values use Frontier's float32 arithmetic, and weapon recipe internals
     * such as `BurstInterval` are exposed as the derived `RateOfFire` and
     * `DamagePerSecond` labels a journal writes. Module-specific aliases likewise use the
     * journal spelling (`MaximumRange` for a module's maximum range and `Range` for a
     * scanner range).
     * Recipe-only values remain available through {@link FittedModule.effectiveStats} and
     * build calculations even though a journal does not serialize their labels; this is
     * what keeps burst and reload-cycle calculations faithful after applying a recipe.
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
     * (0–1, default 1), and optional `experimental` effect `fdname`. A nullish
     * `experimental` means no effect, the same as leaving it out. Each is read once,
     * before anything is checked, so an accessor cannot answer the check and the use
     * differently.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty, or the blueprint/grade/experimental is
     * unknown, or `quality` is outside `[0, 1]`.
     * @throws {TypeError} If `slotKey` or `fdname` is not a string, `options` is not an
     * object, or `options.experimental` carries a value that is not a string — a nullish
     * one is no effect, not a wrong type; the fitted module has no stats to engineer; or the id names a
     * decorative modification, which names no recipe (see
     * {@link DECORATIVE_MODIFICATIONS}); or the module is not offered the blueprint — by
     * its engineering menu, by the journal spelling of an entry on that menu, by the
     * generic spelling of a recipe that menu lists under a family's name, or by being a
     * Mercenary article sold at grade 1 with that bespoke recipe; the fitted article is
     * final and accepts no further engineering;
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
     * build.maxJumpRange(); // uses the engineered optimal mass
     * ```
     */
    applyBlueprint(slotKey: string, fdname: string, options: ApplyBlueprintOptions): this {
        // Both ids are checked before the build's state, so a wrong-typed one is named
        // rather than reported as whatever the slot happened to hold — and named here
        // rather than by whichever catalogue lookup reaches it first.
        requireString(fdname, 'ShipLoadout.applyBlueprint: fdname');
        if (options === null || typeof options !== 'object') {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: options must be an object with a grade, received ${describeValue(options)}`,
            );
        }
        // Read each option exactly once, before any of it is checked. `options` is a
        // caller's object, so a property can be an accessor that answers differently
        // every time: validating one read and using another would let a checked value be
        // swapped for an unchecked one between the two — into a message naming the
        // catalogue lookup it reached, or into the build itself as a stored grade no
        // check ever saw.
        const wantedGrade = options.grade;
        const wantedQuality = options.quality;
        // Nullish means no effect. Normalize it once so validation and all consumers read
        // the same value.
        const wantedExperimental = options.experimental ?? undefined;
        requireStringIfPresent(
            wantedExperimental,
            'ShipLoadout.applyBlueprint: options.experimental',
        );
        const module = this.#fittedModuleFor(slotKey);
        if (!module) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: slot "${truncate(slotKey)}" is empty`,
            );
        }
        const stats = this.#statsFor(module);
        if (!stats) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: no stats for module "${truncate(module.Item)}"`,
            );
        }
        // Which recipe an id names can depend on the module it is named for: the game
        // writes `Sensor_LongRange` on a utility scanner and on a sensor suite, and the two
        // roll different stats. Resolve before reading the grade, so the numbers folded are
        // the ones this module rolls rather than the other family's.
        const recipe = resolveBlueprintForModule(module.Item, fdname);
        // Name both spellings once they differ, so an error about the recipe this module
        // rolls cannot read as an error about the id the caller passed.
        const named =
            recipe === fdname
                ? `"${truncate(fdname)}"`
                : `"${truncate(fdname)}" (${truncate(recipe)} on this module)`;
        // A decorative transformation reaches this method as a real id that names no
        // recipe: the game writes it in the same field, but it has no grade, costs nothing
        // and no engineer applies one. Say that, rather than letting the grade lookup below
        // report a genuine id as an unknown blueprint. It does move a stat, so the refusal
        // names where that is — a caller wanting a festive launcher's damage wants
        // `DECORATIVE_MODIFICATIONS`, not a grade this recipe never had.
        if (isDecorativeModification(recipe)) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: ${named} is a decorative modification, not a blueprint; use applyDecorativeModification to fit its fixed stat changes`,
            );
        }
        if (!Number.isInteger(wantedGrade) || wantedGrade < 1 || wantedGrade > 5) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: no blueprint ${named} grade ${truncate(wantedGrade)}`,
            );
        }
        const grade = getBlueprintGrade(recipe, wantedGrade);
        if (!grade) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: no blueprint ${named} grade ${truncate(wantedGrade)}`,
            );
        }
        let experimental;
        if (wantedExperimental !== undefined) {
            experimental = getExperimentalEffect(wantedExperimental);
            if (!experimental) {
                throw new RangeError(
                    `ShipLoadout.applyBlueprint: unknown experimental effect "${truncate(wantedExperimental)}"`,
                );
            }
        }
        const quality = wantedQuality ?? 1;
        if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
            throw new RangeError(
                `ShipLoadout.applyBlueprint: quality must be a finite number in [0, 1]`,
            );
        }
        if (stats.engineeringLocked) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: module "${truncate(module.Item)}" is a final pre-engineered article and accepts no further engineering`,
            );
        }
        // The engineering menu is the authority on what a module accepts, so the same
        // catalogue answers `getBlueprintsForModule` and this gate. A module with no menu
        // may still be a grade-1 Mercenary article carrying a bespoke upgrade recipe;
        // `blueprintAvailableFor` knows that, so ask it before blaming the module.
        if (!blueprintAvailableFor(module.Item, fdname)) {
            const offered = [...blueprintRoutesFor(module.Item)].map(
                ([blueprint, route]) => `${blueprint} (${route})`,
            );
            throw new TypeError(
                offered.length > 0
                    ? `ShipLoadout.applyBlueprint: module "${truncate(module.Item)}" is not offered blueprint ${named}; available candidates are ${offered.join(', ')}`
                    : `ShipLoadout.applyBlueprint: no registry lists an engineering menu for module "${truncate(module.Item)}"`,
            );
        }
        if (
            wantedExperimental !== undefined &&
            !experimentalAvailableFor(module.Item, wantedExperimental)
        ) {
            const offered = getExperimentalsForModule(module.Item);
            throw new TypeError(
                `ShipLoadout.applyBlueprint: module "${truncate(module.Item)}" is not offered experimental effect "${truncate(wantedExperimental)}"; it takes ${offered.length > 0 ? offered.join(', ') : 'no experimental effect'}`,
            );
        }
        const base = baseStats(stats);
        const canonical = primitiveEngineeringInputsFor(stats, grade, experimental);
        const missing = missingBaseLabels(
            stats,
            base,
            canonical.grade.features,
            canonical.experimental?.modifiers,
        );
        if (missing.length > 0) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: cannot compute ${named} for module "${truncate(module.Item)}"; missing base stats for ${missing.join(', ')}`,
            );
        }
        // A converting experimental supersedes a blueprint conversion, just as it
        // supersedes the stock split. Both catalogue shapes feed the same journal-label
        // synthesis below.
        const damageDistribution = experimental?.damageDistribution ?? grade.damageDistribution;
        const primitiveModifiers = computeModifiers(
            base,
            canonical.grade,
            quality,
            canonical.experimental,
        );
        const modifiers = journalModifiersFor(stats, primitiveModifiers);
        if (damageDistribution) {
            for (const type of ['kinetic', 'thermal', 'explosive', 'absolute'] as const) {
                const value = damageDistribution[type];
                if (value === undefined) continue;
                const label = labelsForDamageType(type)[0];
                if (label === undefined) continue;
                const damageModifier = {
                    Label: label,
                    Value: value * scaleForLabel(label),
                    OriginalValue: (stats.damageDistribution?.[type] ?? 0) * scaleForLabel(label),
                };
                modifiers.push(damageModifier);
                primitiveModifiers.push(damageModifier);
            }
        }
        const engineering: ModuleEngineering = {
            BlueprintName: fdname,
            Level: wantedGrade,
            Quality: quality,
            ...(wantedExperimental !== undefined ? { ExperimentalEffect: wantedExperimental } : {}),
            Modifiers: modifiers,
        };
        this.#replaceModule(
            module.Slot,
            { ...module, Engineering: engineering },
            undefined,
            primitiveModifiers,
        );
        return this;
    }

    /**
     * Apply a fixed, grade-less decorative transformation to the module in a slot.
     *
     * The transformation is resolved through the decorative catalogue and stored as a
     * journal/SLEF `Engineering` block containing only `BlueprintName` and `Modifiers` —
     * no grade or quality is invented. Only this slot is replaced, so effective state
     * retained for every other engineered module remains untouched.
     *
     * @param slotKey - The slot whose module to transform, matched case-insensitively
     * (journal spelling).
     * @param fdname - The decorative transformation's Frontier `fdname`, e.g.
     * `"Decorative_Red"`.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty or the decorative identity is unknown.
     * @throws {TypeError} If `slotKey` or `fdname` is not a string, or one or more of the
     * decorative transformation's stat labels cannot be computed for the fitted module;
     * the fitted module carries no stat snapshot; or it is a final pre-engineered article
     * and accepts no further modification. Incomplete transformations are rejected
     * rather than stored as partial modifier blocks.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
     * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
     *
     * const build = ShipLoadout.empty('Krait_MkII');
     * const flak = getModuleBySymbol(
     *   'Hpt_FlakMortar_Turret_Medium',
     *   HARDPOINT_MODULES,
     * )!;
     *
     * build.setModule('MediumHardpoint1', flak)
     *      .applyDecorativeModification('MediumHardpoint1', 'Decorative_Red');
     * build.fittedModuleAt('MediumHardpoint1')?.engineering?.BlueprintName;
     * // -> 'Decorative_Red'
     * ```
     */
    applyDecorativeModification(slotKey: string, fdname: string): this {
        requireString(fdname, 'ShipLoadout.applyDecorativeModification: fdname');
        const module = this.#fittedModuleFor(slotKey);
        if (!module) {
            throw new RangeError(
                `ShipLoadout.applyDecorativeModification: slot "${truncate(slotKey)}" is empty`,
            );
        }
        const modification = getDecorativeModification(fdname);
        if (!modification) {
            throw new RangeError(
                `ShipLoadout.applyDecorativeModification: unknown decorative modification "${truncate(fdname)}"`,
            );
        }
        const stats = this.#statsFor(module);
        if (!stats) {
            throw new TypeError(
                `ShipLoadout.applyDecorativeModification: no stats for module "${truncate(module.Item)}"`,
            );
        }
        if (stats.engineeringLocked) {
            throw new TypeError(
                `ShipLoadout.applyDecorativeModification: module "${truncate(module.Item)}" is a final pre-engineered article and accepts no further modification`,
            );
        }
        const { modifiers, primitiveModifiers, unresolved } = resolveDecorativeModificationStats(
            stats,
            modification,
        );
        if (unresolved.length > 0) {
            throw new TypeError(
                `ShipLoadout.applyDecorativeModification: cannot compute decorative modification "${truncate(fdname)}" for module "${truncate(module.Item)}"; missing base stats for ${unresolved.join(', ')}`,
            );
        }
        const engineering: ModuleEngineering = {
            BlueprintName: fdname,
            Modifiers: modifiers,
        };
        this.#replaceModule(
            module.Slot,
            { ...module, Engineering: engineering },
            undefined,
            primitiveModifiers,
        );
        return this;
    }

    /**
     * Strip blueprint engineering or a decorative transformation from a slot's module,
     * restoring its base stats.
     *
     * @param slotKey - The slot to de-engineer, matched case-insensitively (journal
     * spelling).
     * @returns `this`, for chaining. A no-op if the slot is empty or unmodified.
     * @throws {TypeError} If `slotKey` is not a string, or the fitted article is final
     * pre-engineered and its baked engineering cannot be removed.
     */
    clearEngineering(slotKey: string): this {
        const module = this.#fittedModuleFor(slotKey);
        if (module && this.#statsFor(module)?.engineeringLocked) {
            throw new TypeError(
                `ShipLoadout.clearEngineering: module "${truncate(module.Item)}" is a final pre-engineered article and its engineering cannot be removed`,
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
     * @throws {TypeError} If `slotKey` is not a string.
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
     * @throws {TypeError} If `slotKey` is not a string.
     */
    setModulePriority(slotKey: string, priority: number): this {
        if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
            throw new RangeError(
                `ShipLoadout: power priority must be an integer 0-4, got ${truncate(priority)}`,
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
            throw new RangeError(`ShipLoadout: slot "${truncate(slotKey)}" is empty`);
        }
        this.#modules.set(module.Slot, cloneLoadoutModule({ ...module, ...patch }));
        this.#viewVersion++;
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
     * The fitted frame shift drive's dimensionless mass factor at a chosen load.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank and
     * `cargo` to `0`.
     * @returns `optMass / loadedMass`: `1` at the drive's optimised mass, below `1`
     * above it and above `1` below it.
     * @remarks
     * This is the mass term used by the jump equation, not the three-point performance
     * curve used by thrusters and shield generators. Main-tank fuel contributes to the
     * loaded mass; the Guardian FSD Booster's additive range does not contribute to the
     * factor.
     * @throws {TypeError} If the build has no usable frame shift drive or its mass
     * cannot be determined; also if fuel capacity is unknown and `options.fuel` is
     * omitted.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or loaded
     * mass is zero.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.frameShiftDriveMassFactor({ fuel: 8, cargo: 32 }); // dimensionless
     * ```
     */
    frameShiftDriveMassFactor(options: JumpOptions = {}): number {
        requireLoadOptions('ShipLoadout.frameShiftDriveMassFactor', options);
        const fuel = options.fuel ?? this.#requireFuelCapacity().main;
        return frameShiftDriveMassFactor(
            this.#requireMass(options.cargo ?? 0),
            fuel,
            this.frameShiftDrive,
        );
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
     * @throws {RangeError} If fuel or cargo is not finite and non-negative.
     */
    jumpRange(options: JumpOptions = {}): number {
        requireLoadOptions('ShipLoadout.jumpRange', options);
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
     * @throws {RangeError} If fuel or cargo is not finite and non-negative.
     */
    fuelPerJump(distance: number, options: JumpOptions = {}): number {
        requireLoadOptions('ShipLoadout.fuelPerJump', options);
        const fsd = this.frameShiftDrive;
        const fuel = options.fuel ?? this.#requireFuelCapacity().main;
        return fuelPerJump(distance, this.#requireMass(options.cargo ?? 0), fuel, fsd);
    }

    /**
     * Total multi-jump range and jump count on a full main tank.
     *
     * @param options - `cargo` aboard, in tonnes; defaults to `0`.
     * @returns Summed range in light-years and the jumps made before the tank is empty.
     * @throws {TypeError} If the build has no usable frame shift drive, or its mass or
     * fuel capacity cannot be determined.
     * @throws {RangeError} If cargo is not finite and non-negative.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.totalRange().jumps; // jumps available from one full main tank
     * ```
     */
    totalRange(options: { readonly cargo?: number } = {}): TotalRangeDetails {
        requireLoadOptions('ShipLoadout.totalRange', options);
        return totalRange(
            this.#requireMass(options.cargo ?? 0),
            this.#requireFuelCapacity().main,
            this.frameShiftDrive,
        );
    }

    /**
     * Every jump figure at once — best, unladen, laden, and the multi-jump totals.
     *
     * @returns The {@link JumpRangeSummary}. Single-jump figures and each total's
     * `range` are in light-years. For a partial load, call {@link jumpRange} with the
     * `fuel` and `cargo` you actually have.
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
     * The build's heat: what it idles at, what it runs at flying and jumping, and
     * whether firing everything cooks it.
     *
     * Every figure is post-engineering. The heat a build makes follows what the plant
     * actually feeds, so a module switched off — or one in a priority group the plant
     * cannot keep lit — contributes nothing.
     *
     * @returns The {@link HeatMetrics}, or `null` when the build has no powered power
     * plant or its hull is unknown. A build carrying a module the catalogues cannot
     * resolve is answered rather than refused, with that module named in
     * {@link HeatMetrics.unknownDraws}: read what that entry says about the figures
     * before showing them, because they are then a projection over the rest of the build
     * rather than an answer for it.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * const heat = build.heatMetrics();
     * heat?.idle.gauge;                      // -> 0.23, i.e. the gauge reads 23%
     * heat?.firingSustained.overheats;       // -> false: the guns run cool enough to hold
     * heat?.firingDrained.secondsToOverheat; // -> how long an alpha strike has on an empty WEP
     * ```
     */
    heatMetrics(): HeatMetrics | null {
        const input = heatInputFor(
            this.#shipSymbol,
            this.#modulesForEffectiveStats(),
            this.powerBudget(),
            (module) => this.#statsFor(module),
        );
        return input ? heatMetrics(input) : null;
    }

    /**
     * The build's speed, boost and rotation rates at a chosen load and ENG allocation.
     *
     * @remarks
     * Main-tank fuel contributes to the flight model's loaded mass. Reserve-tank fuel
     * does not: although the statistics panel includes it in the displayed current
     * mass, ten observed builds reproduce their angular rates only when the reserve is
     * excluded from the thruster mass curve.
     *
     * @param options - Fuel defaults to a full main tank, cargo to `0`, and ENG pips to `4`.
     * @returns Loaded {@link MobilityMetrics}, or `null` when no powered, fully described
     * thrusters are fitted.
     * @throws {TypeError} If mass or an omitted main-tank fuel load cannot be determined.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or
     * `enginesPips` is outside `[0, 4]`.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.mobilityMetrics({ cargo: 32, fuel: 8, enginesPips: 2 })?.speed; // -> m/s
     * ```
     */
    mobilityMetrics(options: MobilityOptions = {}): MobilityMetrics | null {
        const enginesPips = options.enginesPips ?? 4;
        if (!Number.isFinite(enginesPips) || enginesPips < 0 || enginesPips > 4) {
            throw new RangeError(
                'ShipLoadout.mobilityMetrics: enginesPips must be a finite number from 0 to 4',
            );
        }
        requireLoadOptions('ShipLoadout.mobilityMetrics', options);
        const input = mobilityInputFor(
            this.#shipSymbol,
            [...this.#modules.values()],
            () => {
                const main =
                    options.fuel ??
                    this.#top.FuelCapacity?.Main ??
                    this.#requireFuelCapacity().main;
                return this.#requireMass(options.cargo ?? 0) + main;
            },
            enginesPips,
            (module) => this.#statsFor(module),
        );
        return input ? mobilityMetrics(input) : null;
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
     * Time for this build's shield to rise after collapse and then regenerate to full.
     *
     * @param options - SYS pips in `[0, 4]`, defaulting to `4`.
     * @returns Recovery rates and seconds, or `null` with no powered shield generator.
     * A missing distributor or insufficient zero-pip recharge produces `Infinity`.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.shieldRecovery({ systemsPips: 4 })?.recoveryTime; // -> seconds from collapse to 50%
     * ```
     */
    shieldRecovery(options: DefenceOptions = {}): ShieldRecovery | null {
        const systemsPips = options.systemsPips ?? 4;
        if (!Number.isFinite(systemsPips) || systemsPips < 0 || systemsPips > 4) {
            throw new RangeError(
                'ShipLoadout.shieldRecovery: systemsPips must be a finite number from 0 to 4',
            );
        }
        const input = shieldRecoveryInputFor(
            this.#shipSymbol,
            [...this.#modules.values()],
            systemsPips,
            (module) => this.#statsFor(module),
        );
        return input ? shieldRecovery(input) : null;
    }

    /**
     * Every fitted shield cell bank and the complete rearmed reinforcement pool.
     *
     * @returns A frozen {@link CellBankSummary}; no banks is an empty list and zero totals.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.cellBanks().totalRestorable; // -> MJ across every fitted cell
     * ```
     */
    cellBanks(): CellBankSummary {
        const banks = cellBankInputsFor([...this.#modules.values()], (module) =>
            this.#statsFor(module),
        );
        const layout = this.#layoutOrNull();
        if (layout) {
            const order = new Map(
                layout.map((slot, index) => [slot.key.toLowerCase(), index] as const),
            );
            banks.sort(
                (left, right) =>
                    (order.get(left.slot.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
                    (order.get(right.slot.toLowerCase()) ?? Number.MAX_SAFE_INTEGER),
            );
        }
        return cellBankSummary(banks);
    }

    /**
     * Price this build from current catalogue list prices without creating a journal event.
     *
     * @returns Hull, module and five-percent rebuy credits. `modules` and `rebuy` remain
     * lower bounds when {@link RetailCredits.unpriced} is non-empty; built-in hull fittings are free.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * ShipLoadout.default('Anaconda').retailCredits().hull; // -> 142456440
     * ```
     */
    retailCredits(): RetailCredits {
        const hull = getShipBySymbol(this.#shipSymbol)?.hullCost ?? null;
        let modules = 0;
        const unpriced: { slot: string; symbol: string }[] = [];
        for (const module of this.#modules.values()) {
            const stats = this.#statsFor(module);
            if (stats?.cost !== undefined) {
                modules += stats.cost;
            } else if (
                stats !== null ||
                (!isNonOutfittingSlot(module.Slot) && !isBuiltInHullModule(module))
            ) {
                unpriced.push({ slot: module.Slot, symbol: module.Item });
            }
        }
        return deepFreeze({
            hull,
            modules,
            rebuy: hull === null ? null : Math.trunc((hull + modules) * 0.05),
            unpriced,
        });
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
            const stats = weaponStatsFor(this.#moduleForEffectiveStats(module), record);
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
     * WEP-capacitor recharge and endurance while every powered weapon fires.
     *
     * @param options - WEP pips in `[0, 4]`, defaulting to `4`.
     * @returns Actual recharge, sustained draw, net drain and seconds from full to
     * empty. The deployed power budget is applied to the distributor and weapons, so a
     * module the plant sheds contributes nothing. A module with an unresolved power
     * draw is assumed powered, consistently with {@link powerBudget}; inspect its
     * `unknownDraws` when that distinction matters. With no powered distributor,
     * capacity and recharge are zero. A load that draws no more than recharge reports
     * `Infinity` for `timeToDrain`.
     * @throws {RangeError} If `weaponsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.weaponsCapacitorMetrics({ weaponsPips: 2 }).timeToDrain; // seconds
     * ```
     */
    weaponsCapacitorMetrics(options: WeaponsOptions = {}): WeaponsCapacitorMetrics {
        const weaponsPips = options.weaponsPips ?? 4;
        if (!Number.isFinite(weaponsPips) || weaponsPips < 0 || weaponsPips > 4) {
            throw new RangeError(
                'ShipLoadout.weaponsCapacitorMetrics: weaponsPips must be a finite number from 0 to 4',
            );
        }
        return weaponsCapacitorMetrics(
            weaponsCapacitorInputFor(
                this.#modulesForEffectiveStats(),
                weaponsPips,
                this.powerBudget(),
                (module) => this.#statsFor(module),
            ),
        );
    }

    /**
     * The hull's mounts, or `null` when its layout is unknown. Expanded and cached once
     * per build because fitting methods query the layout repeatedly.
     *
     * The cached array is frozen to prevent internal callers from sorting or splicing it
     * in place. No reference to the array or its elements escapes the class.
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
        this.#viewVersion++;
    }

    #layout(): readonly BuildSlot[] {
        const layout = this.#layoutOrNull();
        if (!layout) {
            throw new TypeError(
                `ShipLoadout: no slot layout for hull "${truncate(this.#shipSymbol)}"`,
            );
        }
        return layout;
    }

    #requireSlot(slotKey: string): BuildSlot {
        const wanted = requireString(slotKey, SLOT_KEY).toLowerCase();
        const slot = this.#layout().find((s) => s.key.toLowerCase() === wanted);
        if (!slot) {
            throw new RangeError(
                `ShipLoadout: hull "${truncate(this.#shipSymbol)}" has no slot "${truncate(slotKey)}"`,
            );
        }
        return slot;
    }

    /**
     * The key this build stores the module in `slotKey` under, or `null` when the slot
     * is empty. {@link matchingKeyIn} is where the matching rule and its reasons live.
     */
    #fittedKey(slotKey: string): string | null {
        return matchingKeyIn(this.#modules, requireString(slotKey, SLOT_KEY));
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

    /** Resolve the current fit's per-ship module-count usage. */
    #moduleLimits(): readonly ModuleLimitUsage[] {
        const entries = [...this.#modules.values()].flatMap((module) => {
            const stats = this.#statsFor(module);
            return stats === null ? [] : [stats];
        });
        return calculateModuleLimits(entries);
    }

    /** Resolve the catalogue stats currently fitted in one slot. */
    #moduleStatsAt(slotKey: string): OutfittingModule | null {
        const fitted = this.#fittedModuleFor(slotKey);
        return fitted === undefined ? null : this.#statsFor(fitted);
    }

    /** Internal fitted state with recipe-only modifiers restored for effective calculations. */
    #moduleForEffectiveStats(module: LoadoutModule): LoadoutModule {
        const modifiers = this.#primitiveModifiers.get(module.Slot);
        if (modifiers === undefined || module.Engineering === undefined) return module;
        return {
            ...module,
            Engineering: { ...module.Engineering, Modifiers: modifiers },
        };
    }

    /** Every fitted module in its effective-calculation representation. */
    #modulesForEffectiveStats(): LoadoutModule[] {
        return [...this.#modules.values()].map((module) => this.#moduleForEffectiveStats(module));
    }

    /** A proposed edit's newly increased limit excess, or `null` when it worsens none. */
    #moduleLimitRegression(
        slotKey: string,
        replacement: OutfittingModule | null,
        current = this.#moduleLimits(),
        previous = this.#moduleStatsAt(slotKey),
    ): ModuleLimitUsage | null {
        if (
            previous?.limitGroup === undefined &&
            previous?.limitIncrease === undefined &&
            replacement?.limitGroup === undefined &&
            replacement?.limitIncrease === undefined
        ) {
            return null;
        }
        for (const usage of current) {
            const count =
                usage.count -
                Number(previous?.limitGroup === usage.group) +
                Number(replacement?.limitGroup === usage.group);
            const increase =
                usage.increase -
                (previous?.limitIncrease?.group === usage.group
                    ? previous.limitIncrease.amount
                    : 0) +
                (replacement?.limitIncrease?.group === usage.group
                    ? replacement.limitIncrease.amount
                    : 0);
            const limit = usage.baseLimit + increase;
            const excess = Math.max(0, count - limit);
            if (excess > usage.excess) {
                return { ...usage, increase, limit, count, excess };
            }
        }
        return null;
    }

    /** Replace one fitted module and keep imported aggregate figures coherent. */
    #replaceModule(
        slotKey: string,
        replacement: LoadoutModule | null,
        replacementStats?: OutfittingModule,
        primitiveModifiers?: readonly EngineeringModifier[],
    ): void {
        const previous = this.#modules.get(slotKey) ?? null;
        this.#adjustImportedFigures(previous, replacement, replacementStats);
        if (replacement === null) {
            this.#modules.delete(slotKey);
            this.#moduleStats.delete(slotKey);
            this.#primitiveModifiers.delete(slotKey);
        } else {
            this.#modules.set(slotKey, cloneLoadoutModule(replacement));
            if (replacementStats !== undefined) this.#moduleStats.set(slotKey, replacementStats);
            if (primitiveModifiers === undefined) this.#primitiveModifiers.delete(slotKey);
            else this.#primitiveModifiers.set(slotKey, primitiveModifiers);
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
        if (normalizeKey(previous?.Item, FITTED_ITEM) === normalizeKey(next?.Item, FITTED_ITEM)) {
            return;
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
                `ShipLoadout: no jump constants in the stats catalogue for frame shift drive "${truncate(fsdModule.Item)}"`,
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
                `ShipLoadout: frame shift drive "${truncate(fsdModule.Item)}" has no ${missing.join(' or ')} in the stats catalogue`,
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
                    `ShipLoadout: FSD booster "${truncate(m.Item)}" has no jumpBoost in the stats catalogue`,
                );
            }
            return stats.jumpBoost;
        }
        return 0;
    }

    /** Resolve the snapshotted fitted record, or fall back to the built-in catalogue. */
    #statsFor(module: LoadoutModule | null): OutfittingModule | null {
        if (module === null) return null;
        const stats =
            this.#moduleStats.get(module.Slot) ?? builtInModuleBySymbol(module.Item, FITTED_ITEM);
        if (stats) return stats;
        // Frontier gives some hull families their own cargo-hatch symbol even though the
        // fitted article has the standard hatch's stats. Resolve that family here so its
        // power draw is available as well as its already-known zero mass and price.
        return isBuiltInHullModule(module)
            ? builtInModuleBySymbol('ModularCargoBayDoor', 'ShipLoadout: built-in module')
            : null;
    }
}
