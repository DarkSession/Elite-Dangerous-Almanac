/**
 * {@link ShipLoadout} — a mutable fitted-ship model that both **answers questions**
 * about a build and **edits** it.
 *
 * Load one from a SLEF export or a journal `Loadout` event, or start from a
 * {@link ShipLoadout.default | default} or {@link ShipLoadout.empty | empty} hull, then
 * enumerate its {@link ShipLoadout.slots | slots} and fit modules. Edits change the
 * build in place and return `this`; everything a query returns is a deeply frozen
 * snapshot, so query again after an edit rather than re-reading an earlier value.
 *
 * **Slot keys are matched case-insensitively.** Frontier writes `FrameShiftDrive`, a
 * SLEF producer may write `frameshiftdrive`, and both name the same mount. A build's own
 * spelling is never rewritten, so re-exporting an import returns it untouched.
 *
 * @remarks
 * This is the batteries-included ship facade: it carries the complete ship, module,
 * blueprint and experimental-effect catalogues. Import `./slef`, `./jump-range`, or one
 * module catalogue instead when you need a single data-free operation.
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
import { getShipBySymbol, type Ship } from './ships.js';
import { getDefaultLoadout } from './default-loadouts.js';
import { enumerateSlots, parseSlotName, type BuildSlot, type SlotKind } from './slots.js';
import { computeModifiers, sumMaterials, type EngineeringMaterial } from './engineering.js';
import { getBlueprintCost } from './blueprint-costs.js';
import { getExperimentalEffectCost } from './experimental-effect-costs.js';
import { getBlueprintGrade } from './blueprints.js';
import { getExperimentalEffect } from './experimental-effects.js';
import { getExperimentalsForModule } from './engineering-options.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import type { ModuleEngineering } from './slef.js';
import type { OutfittingModule, ProjectileRangeBoundaries } from './modules.js';
import { calculateModuleLimits, type ModuleLimitUsage } from './module-limits.js';
import { baseStats, labelsForDamageType, scaleForLabel } from './internal/module-stat-labels.js';
import {
    cloneLoadoutModule,
    cloneModuleStats,
    FITTED_ITEM,
    isBuiltInHullModule,
    isCargoHatchSlot,
    isNonOutfittingSlot,
    matchingKeyIn,
    ownKeyIn,
    orderBySlotLayout,
} from './internal/loadout-state.js';
import {
    availableBlueprintsFor,
    availableExperimentalsFor,
    blueprintAvailableFor,
    blueprintRoutesFor,
    experimentalAvailableFor,
    journalModifiersFor,
    missingBaseLabels,
    ordinaryEngineeringProof,
    primitiveEngineeringInputsFor,
} from './internal/loadout-engineering.js';
import { builtInModuleBySymbol } from './internal/module-symbol-index.js';
import {
    armourInputFor,
    cellBankInputsFor,
    distributorInputFor,
    effectiveModule,
    heatInputFor,
    mobilityInputResultFor,
    powerAvailable,
    powerConsumerFor,
    shieldInputResultFor,
    shieldRecoveryInputResultFor,
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
import { distributorMetrics, type DistributorMetrics } from './distributor.js';
import { mobilityMetrics, type MobilityMetrics } from './mobility.js';
import {
    cellBankSummary,
    shieldRecovery,
    type CellBankSummary,
    type ShieldRecovery,
} from './shield-recovery.js';
import {
    getPreEngineeredJournalModifiers,
    getPreEngineeredModifiers,
    getPreEngineeredStats,
    identifyPreEngineeredVariant,
    unresolvedModifiers,
} from './pre-engineered-stats.js';
import { getPreEngineeredVariants, type PreEngineeredVariant } from './pre-engineered.js';
import { ALL_MODULES } from './modules-all.js';
import type { FittedModule } from './fitted-module.js';
export type { FittedModule } from './fitted-module.js';
import type { LoadoutSlot } from './loadout-slot.js';
export type { ImmovableReason, LoadoutSlot } from './loadout-slot.js';
import type { LoadoutImportOutcome } from './loadout-import-outcome.js';
export type { LoadoutImportOutcome } from './loadout-import-outcome.js';
import { loadoutSlotName } from './internal/loadout-views.js';
import { fixedSlotReason } from './internal/loadout-slot-rules.js';
import { moduleFitError, moduleFitProblem } from './internal/loadout-fitting.js';
import { exportLoadoutEvent } from './internal/loadout-export.js';
import {
    normalizeLoadoutEvent,
    type ImportedLoadoutState,
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
import { completeResult, incompleteResult } from './internal/calculation-result.js';
import {
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
    type CalculationIssue,
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
 * How a slot key is named when it is not a string. Every method that takes one guards with
 * this label, so the message names none of them.
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

/** Validate a facade ENG-pip option before build state can short-circuit the metric. */
const requireEnginesPips = (scope: string, enginesPips: number): number => {
    if (!Number.isFinite(enginesPips) || enginesPips < 0 || enginesPips > 4) {
        throw new RangeError(`${scope}: enginesPips must be a finite number from 0 to 4`);
    }
    return enginesPips;
};

/** Validate a facade SYS-pip option before build state can short-circuit the metric. */
const requireSystemsPips = (scope: string, systemsPips: number): number => {
    if (!Number.isFinite(systemsPips) || systemsPips < 0 || systemsPips > 4) {
        throw new RangeError(`${scope}: systemsPips must be a finite number from 0 to 4`);
    }
    return systemsPips;
};

/**
 * Stable machine-readable reason a {@link ShipLoadout} edit was refused. `immutableSlot`
 * identifies a mount that cannot be changed at all; `requiredSlot` identifies a core or
 * armour mount that must remain occupied. A required mount can be replaced but not
 * emptied.
 * The remaining codes identify an incompatible fit, a duplicate one-per-ship family,
 * or a module count beyond the build's current allowance.
 */
export type LoadoutEditErrorCode =
    | 'immutableSlot'
    | 'requiredSlot'
    | 'incompatibleModule'
    | 'duplicateExclusiveModule'
    | 'moduleLimitExceeded';

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
        this.params = deepFreeze(structuredClone(params));
        if (constraint !== undefined) this.constraint = constraint;
    }
}

/** Result of {@link ShipLoadout.repairFixedMount}, discriminated by `status`. */
export type FixedMountRepairResult =
    | {
          /** The hull default was installed. */
          readonly status: 'repaired';
          /** Slot key in the build's own spelling. */
          readonly slot: string;
          /** Installed module symbol. */
          readonly symbol: string;
      }
    | {
          /** The fixed mount already held a valid module. */
          readonly status: 'unchanged';
          /** Slot key in the build's own spelling. */
          readonly slot: string;
          /** Current module symbol. */
          readonly symbol: string;
      }
    | {
          /** No resolvable hull default exists for the fixed mount. */
          readonly status: 'defaultUnavailable';
          /** Slot key in the build's own spelling when one exists, otherwise the request. */
          readonly slot: string;
          /** Default module symbol, when the loadout names one but its stats are unavailable. */
          readonly symbol?: string;
      }
    | {
          /** The requested mount is not fixed. */
          readonly status: 'refused';
          /** Slot key in the build's own spelling when one exists, otherwise the request. */
          readonly slot: string;
          /** Stable refusal reason. */
          readonly reason: 'notFixedMount';
      };

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

/** Stable reason {@link ShipLoadout.setExperimentalEffect} cannot perform an edit. */
export type ExperimentalEffectMutationCode =
    | 'emptySlot'
    | 'notEngineered'
    | 'unknownExperimentalEffect'
    | 'unsupportedExperimentalEffect'
    | 'finalArticle'
    | 'unsupportedEngineering'
    | 'unidentifiedPreEngineeredVariant'
    | 'unresolvedModifiers';

/** Successful effect-only engineering edit. */
export interface ExperimentalEffectUpdated {
    /** Discriminator for an edit that changed the fitted module. */
    readonly kind: 'updated';
    /** Effect id before the edit, or `null` when none was present. */
    readonly previousExperimental: string | null;
    /** Effect id after the edit, or `null` when it was removed. */
    readonly experimental: string | null;
}

/** Effect-only edit that requested the fitted module's current effect. */
export interface ExperimentalEffectUnchanged {
    /** Discriminator for a no-op edit. */
    readonly kind: 'unchanged';
    /** Current effect id, or `null` when none is present. */
    readonly experimental: string | null;
}

/** Effect-only edit that cannot be performed losslessly. */
export interface ExperimentalEffectUnsupported {
    /** Discriminator for a refused edit. */
    readonly kind: 'unsupported';
    /** Stable machine-readable reason for the refusal. */
    readonly code: ExperimentalEffectMutationCode;
    /** Language-neutral values describing the fitted article and requested edit. */
    readonly params: LoadoutIssueParams;
}

/** Result of {@link ShipLoadout.setExperimentalEffect}. */
export type ExperimentalEffectMutationResult =
    ExperimentalEffectUpdated | ExperimentalEffectUnchanged | ExperimentalEffectUnsupported;

/** Construct a detached immutable refusal result. */
const experimentalEffectUnsupported = (
    code: ExperimentalEffectMutationCode,
    params: LoadoutIssueParams,
): ExperimentalEffectUnsupported => deepFreeze({ kind: 'unsupported', code, params });

/** Stable reason {@link ShipLoadout.completeEngineeringGrade} cannot normalize a grade. */
export type EngineeringNormalizationCode =
    | 'emptySlot'
    | 'notEngineered'
    | 'invalidQuality'
    | 'unknownExperimentalEffect'
    | 'unsupportedExperimentalEffect'
    | 'finalArticle'
    | 'unsupportedEngineering'
    | 'unidentifiedPreEngineeredVariant'
    | 'unresolvedModifiers';

/** Engineering state that already needs no normalization. */
export interface EngineeringNormalizationUnchanged {
    /** Discriminator for a no-op normalization. */
    readonly kind: 'unchanged';
}

/** Engineering state recomputed at completed quality. */
export interface EngineeringNormalized {
    /** Discriminator for a successful normalization. */
    readonly kind: 'normalized';
    /** Quality reported by the fitted module before normalization, in `[0, 1)`. */
    readonly previousQuality: number;
    /** Completed engineering quality. Always `1`. */
    readonly quality: 1;
}

/** Engineering state that cannot be normalized losslessly. */
export interface EngineeringNormalizationUnsupported {
    /** Discriminator for a refused normalization. */
    readonly kind: 'unsupported';
    /** Stable machine-readable reason for the refusal. */
    readonly code: EngineeringNormalizationCode;
    /** Language-neutral values describing the fitted engineering identity. */
    readonly params: LoadoutIssueParams;
}

/** Result of {@link ShipLoadout.completeEngineeringGrade}. */
export type EngineeringNormalizationResult =
    EngineeringNormalizationUnchanged | EngineeringNormalized | EngineeringNormalizationUnsupported;

/** Construct a detached immutable normalization refusal. */
const engineeringNormalizationUnsupported = (
    code: EngineeringNormalizationCode,
    params: LoadoutIssueParams,
): EngineeringNormalizationUnsupported => deepFreeze({ kind: 'unsupported', code, params });
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

/** A standard fuel-and-cargo condition shared by jump and mobility views. */
export type StandardLoad = 'maximum' | 'unladen' | 'laden';

/** Fuel and cargo carried for a {@link StandardLoad}, both in tonnes. */
export interface StandardLoadInputs {
    /** Main-tank fuel carried, in tonnes. */
    readonly fuel: number;
    /** Cargo carried, in tonnes. */
    readonly cargo: number;
}

/** Optional WEP allocation for {@link ShipLoadout.weaponsCapacitorMetrics}. */
export interface WeaponsOptions {
    /** Pips assigned to the weapons capacitor, `0`–`4`. Defaults to `4`. */
    readonly weaponsPips?: number;
}

/** Optional SYS, ENG and WEP allocations for {@link ShipLoadout.distributorMetrics}. */
export interface DistributorOptions {
    /** Pips assigned to the systems capacitor, `0`–`4`. Defaults to `4`. */
    readonly systemsPips?: number;
    /** Pips assigned to the engines capacitor, `0`–`4`. Defaults to `4`. */
    readonly enginesPips?: number;
    /** Pips assigned to the weapons capacitor, `0`–`4`. Defaults to `4`. */
    readonly weaponsPips?: number;
}

/**
 * Retail catalogue credits for an assembled build, as {@link ShipLoadout.buildCost} prices it.
 */
export interface BuildCredits {
    /**
     * Priced hull and modules together, in credits.
     *
     * A Mercenary article is bought with Merc Coin and has no credit price at all, but it
     * is counted here at the catalogue list price of the stock module it is built on, and
     * again in {@link BuildCost.mercCoins} at what it actually cost. Subtract the stock
     * module's price to quote credits a shop would really ask.
     */
    readonly total: number;
    /** Bare hull list price in credits. */
    readonly hull: number;
    /** Sum of every priced fitted module, in credits. A lower bound when `unpriced` is non-empty. */
    readonly modules: number;
    /**
     * Five percent of `total`, truncated to credits: what insurance bills to rebuild the
     * fit at catalogue prices. For what a capture said its own rebuy was, read
     * {@link ShipLoadout.rebuy}.
     */
    readonly rebuy: number;
    /** Fitted modules that could not be priced from the catalogue. */
    readonly unpriced: readonly { readonly slot: string; readonly symbol: string }[];
}

/**
 * What an assembled build costs to own, in all three currencies the game charges for it.
 *
 * Every figure prices the **current fit** from the catalogues rather than reporting what a
 * capture said was paid; for the latter read {@link ShipLoadout.sourcePurchase}.
 */
export interface BuildCost {
    /** Shop credits for the hull and its fitted modules. */
    readonly credits: BuildCredits;
    /**
     * Merc Coin billed by the build: every Mercenary article's shop price plus every
     * blueprint's currency cost, including ordinary engineering-menu recipes that charge it.
     * A Mercenary article's blueprint is charged only above the grade it was sold at.
     */
    readonly mercCoins: number;
    /**
     * What the build's blueprints and experimental effects consume, one entry per distinct
     * material, counts summed across modules.
     *
     * Pre-engineered articles arrive engineered, so only what a player still has to roll on
     * top of one is charged. A fixed reward carries no craft recipe at all and contributes
     * nothing, and so does a modification whose recipe the catalogues do not price — a
     * capture may name a blueprint or effect no registry lists, and an unpriceable
     * modification is silently absent rather than reported the way
     * {@link BuildCredits.unpriced} reports an unpriceable module.
     */
    readonly materials: readonly EngineeringMaterial[];
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
    /** Maximum effective range in metres, absent when the fitted weapon does not state one. */
    readonly maximumRange?: number;
    /** Damage-falloff start in metres, absent when the fitted weapon does not state one. */
    readonly falloffRange?: number;
    /**
     * Exact projectile boundary metadata, absent when unavailable. These are not
     * effective distances and remain separate from {@link maximumRange} and
     * {@link falloffRange}.
     */
    readonly projectileRange?: ProjectileRangeBoundaries;
    /** Armour-piercing rating, absent when unavailable. */
    readonly armourPiercing?: number;
}

/** A build's firepower: every fitted weapon, and the totals across the enabled ones. */
export interface BuildWeaponMetrics {
    /**
     * Every fitted weapon in hull slot order. Weapons in unknown or unmapped slots
     * follow the known slots in their original source order.
     */
    readonly weapons: readonly FittedWeaponMetrics[];
    /** The additive totals across the **enabled** weapons. */
    readonly total: WeaponTotals;
}

/**
 * A build's jump ranges at the loads that matter. The three single-jump values and
 * each total result's `range` are in light-years.
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
    /** Summed range and jump count on one jump's fuel, empty hold. */
    readonly totalMax: TotalRangeDetails;
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
     * A Mercenary article shares its module symbol with the stock article. Its bespoke
     * blueprint is nevertheless available only through that purchase, so a fitted module
     * carrying the blueprint identifies the article even after a later grade upgrade.
     * `'mercenary'` means the recipe requires that purchase route.
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
     * `'source'` quotes the {@link ShipLoadout.sourcePurchase | source purchase record}
     * instead — `HullValue`, `ModulesValue`, `Rebuy` and the per-module `Value` figures
     * exactly as the capture stated them, and nothing at all for a build that has no such
     * record. Each figure stays pinned to what it was paid for, so a fit that stops
     * matching the capture **narrows** the export rather than staling it: a swapped slot
     * exports unpriced, and `ModulesValue` and `Rebuy` go once any priced module has been
     * swapped or removed, or a core internal stocked at import. `HullValue` names no slot
     * and always stands. The guide *Working with SLEF* covers the boundary cases,
     * including the one narrowing this cannot detect — a module the capture listed but
     * never priced.
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

/** The stats every build sums from its fit, so a supplied record may not drop one. */
const AGGREGATE_STATS = ['mass', 'cargoCapacity', 'fuelCapacity'] as const;

/**
 * A fitted ship — read a SLEF export, or assemble a hull from scratch.
 *
 * @example
 * Read a build a player already flies, and ask it what an outfitting screen shows.
 * Every figure below is one build's — a Krait Phantom explorer. Figures the capture
 * already stated — `unladenMass` here — are trusted verbatim while the fit they
 * describe survives import; the rest are computed from the fit.
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
 */
export class ShipLoadout {
    readonly #ship: Ship;
    readonly #shipSymbol: string;
    readonly #modules: Map<string, LoadoutModule>;
    readonly #moduleStats: Map<string, OutfittingModule>;
    /** Primitive modifiers retained for calculations after journal presentation. */
    readonly #primitiveModifiers: Map<string, readonly EngineeringModifier[]>;
    readonly #top: TopFigures;
    readonly #sourcePurchase: SourcePurchaseRecord | null;
    readonly #importOutcomes: readonly LoadoutImportOutcome[];
    /** Frozen slot views by filter; the two module mutation paths clear it. */
    readonly #slotCache = new Map<SlotKind | undefined, readonly LoadoutSlot[]>();
    /** The hull's expanded mounts, populated on first use. */
    #layoutCache: readonly BuildSlot[] | undefined;

    private constructor(
        ship: Ship,
        shipSymbol: string,
        modules: Map<string, LoadoutModule>,
        top: TopFigures,
        sourcePurchase: SourcePurchaseRecord | null = null,
        moduleStats = new Map<string, OutfittingModule>(),
        primitiveModifiers = new Map<string, readonly EngineeringModifier[]>(),
        importOutcomes: readonly LoadoutImportOutcome[] = deepFreeze([]),
    ) {
        this.#ship = ship;
        this.#shipSymbol = shipSymbol;
        this.#modules = modules;
        this.#top = top;
        this.#sourcePurchase = sourcePurchase;
        this.#moduleStats = moduleStats;
        this.#primitiveModifiers = primitiveModifiers;
        this.#importOutcomes = importOutcomes;
    }

    /**
     * Build from a SLEF export.
     *
     * @param input - The SLEF JSON string, or an already-parsed SLEF object (see
     * {@link parseSlef} for accepted shapes).
     * @param index - Which entry to take when the export holds several builds.
     * Defaults to the first.
     * @returns The loadout for that entry.
     * @remarks Module normalization follows {@link ShipLoadout.fromLoadout}; inspect
     * {@link importOutcomes} for modules that were emptied or defaulted.
     * @throws {SyntaxError} If `input` is a string that is not valid JSON.
     * @throws {TypeError} If the export holds no usable loadout, `index` is out of range,
     * or the selected entry names a hull absent from the catalogue.
     */
    static fromSlef(input: unknown, index = 0): ShipLoadout {
        const entries = parseSlef(input);
        const entry = entries[index];
        if (!entry) {
            throw new TypeError(
                `ShipLoadout.fromSlef: no entry at index ${truncate(index)} (have ${entries.length})`,
            );
        }
        const imported = normalizeLoadoutEvent(entry.data);
        const ship = getShipBySymbol(imported.shipSymbol);
        if (!ship) {
            throw new TypeError(
                `ShipLoadout.fromSlef: unknown hull "${truncate(imported.shipSymbol)}"`,
            );
        }
        return ShipLoadout.#fromImported(imported, ship);
    }

    /**
     * Build from a bare journal `Loadout` event (the `data` half of a SLEF entry).
     *
     * @param event - A `Loadout` event object.
     * @returns The loadout.
     * @remarks
     * Capture and instance state (`timestamp`, `ShipID`, `HullHealth`, `Hot`) and
     * engineering provenance (`Engineer`, `EngineerID`, `BlueprintID`) stay out of the
     * durable build. A pre-engineered article — a reward, a Mercenary purchase, a
     * Guardian weapon — is identified where the capture's evidence names one uniquely,
     * and the catalogue's stat block then supplies the values the capture omits; the
     * capture's own modifiers stay authoritative over it.
     *
     * Modules are imported as one complete snapshot, so their order does not affect
     * per-ship count allowances. An entry stands as the event stated it when the mount
     * can hold the article the catalogue resolves, when its slot is a known cosmetic or
     * hull-geometry key (`PaintJob`, `ShipCockpit`, a numbered decal, …), or when it is
     * the built-in cargo hatch. Everything else is normalized, and every change is
     * recorded by {@link importOutcomes}: an unresolved module in a removable mount is
     * discarded, while armour, the seven core internals and the cargo hatch are filled
     * from the hull defaults whenever the event left no article that mount can hold — an
     * unresolved symbol, a resolved one the mount refuses, and no entry at all are
     * corrected alike, each keeping the source's `On`, `Priority` and `Health`. A
     * removable mount may stand empty, so an article *it* refuses stays where the event
     * put it and is reported by {@link validation} instead.
     *
     * Normalization makes the captured aggregates untrustworthy, so they are dropped:
     * {@link unladenMass}, {@link cargoCapacity} and {@link fuelCapacity} are recomputed
     * from the fit that remains, {@link modulesValue} and {@link rebuy} read `null`, and
     * {@link sourcePurchase} still reports what the capture stated. A mount stocked from
     * *absence* is the exception where its stock article is free and weightless — the
     * bulkhead and the cargo hatch both are — and every figure stands.
     *
     * Use this factory rather than replaying a complete loadout through the incremental
     * {@link setModule} editor.
     *
     * @throws {TypeError} If the event is not shaped like one. What is checked is the
     * structure a build is assembled from and the fields that name things in it: `event`
     * must be an object with an array of module objects in `Modules`, each carrying a
     * string `Slot` and `Item`, no two claiming the same slot; `event.Ship` must name a
     * known hull; an `Engineering` block must be an object and its `Modifiers` an array
     * of objects each carrying a string `Label`, whenever the key is there at all; that
     * block's `BlueprintName` and `ExperimentalEffect` must be strings when they carry a
     * value. A modifier's `Label` is required rather than checked-when-present because it
     * is the only thing saying which stat moved. Every remaining field — every number,
     * every flag, a modifier's value beside its label — is trusted, so use
     * {@link ShipLoadout.fromSlef} (or {@link parseSlef}) for input you did not produce,
     * which reports all of them.
     */
    static fromLoadout(event: LoadoutEvent): ShipLoadout {
        // Is it an object at all? Every other check is `normalizeLoadoutEvent`'s, which
        // reads each field once before checking any of it — a caller's accessor cannot
        // answer the check and the use differently.
        if (event === null || typeof event !== 'object') {
            throw new TypeError(
                `ShipLoadout.fromLoadout: event must be a Loadout event, received ${describeValue(event)}`,
            );
        }
        const imported = normalizeLoadoutEvent(event);
        const ship = getShipBySymbol(imported.shipSymbol);
        if (!ship) {
            throw new TypeError(
                `ShipLoadout.fromLoadout: unknown hull "${truncate(imported.shipSymbol)}"`,
            );
        }
        return ShipLoadout.#fromImported(imported, ship);
    }

    /** Assemble already-normalized state whose hull has been resolved. */
    static #fromImported(imported: ImportedLoadoutState, ship: Ship): ShipLoadout {
        return new ShipLoadout(
            ship,
            imported.shipSymbol,
            imported.modules,
            imported.top,
            imported.sourcePurchase,
            imported.moduleStats,
            imported.primitiveModifiers,
            imported.outcomes,
        );
    }

    /**
     * Start a new build for a hull with only its stock core modules fitted.
     *
     * @param shipSymbol - The hull's internal symbol, e.g. `"Anaconda"`
     * (case-insensitive).
     * @returns A loadout on the hull's stock bulkhead, core internals and cargo hatch,
     * with every hardpoint, utility mount and optional internal left open. Use
     * {@link default} for a build that also carries the hull's stock weapons and
     * optional internals.
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
        const requested = requireString(shipSymbol, 'ShipLoadout.empty: shipSymbol');
        const ship = getShipBySymbol(requested);
        if (!ship) {
            // Truncated so this method's two failures agree; messages elsewhere still
            // quote a caller's string in full —
            // https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/213.
            throw new TypeError(
                `ShipLoadout.empty: no slot layout for hull "${truncate(shipSymbol)}"`,
            );
        }
        // The same mounts import stocks, from the same hull defaults: a build without
        // them is a ship that cannot fly.
        const fitted = (getDefaultLoadout(ship.symbol)?.modules ?? []).filter((module) => {
            const parsed = parseSlotName(module.slot);
            return parsed !== null && fixedSlotReason(parsed) !== null;
        });
        return new ShipLoadout(
            ship,
            ship.symbol,
            new Map(
                fitted.map((module) => [module.slot, { Slot: module.slot, Item: module.symbol }]),
            ),
            {},
        );
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
        const ship = getShipBySymbol(requested);
        if (!ship) {
            throw new TypeError(
                `ShipLoadout.default: no default loadout for hull "${truncate(shipSymbol)}"`,
            );
        }
        const loadout = getDefaultLoadout(ship.symbol)!;
        return new ShipLoadout(
            ship,
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
     * Hull + modules mass with an empty tank and no cargo, in tonnes.
     *
     * @remarks
     * A capture's own `UnladenMass` stands while the fit it described survives import
     * (see {@link fromLoadout}); otherwise this is the hull's `hullMass` plus every
     * fitted module's post-engineering mass, and {@link importOutcomes} is the only
     * report that the figure is the normalized fit's rather than the capture's.
     */
    get unladenMass(): number {
        return this.#top.UnladenMass ?? this.#computedUnladenMass();
    }

    /**
     * Unladen mass worked out from the hull and the fitted modules, ignoring any figure
     * an import supplied.
     */
    #computedUnladenMass(): number {
        return calculateUnladenMass(this.#ship.hullMass, this.#calculationModules());
    }

    /**
     * Fuel-tank capacities, in tonnes — a capture's `FuelCapacity` on the same terms as
     * {@link unladenMass}, otherwise the fitted tanks plus the hull's own reserve.
     */
    get fuelCapacity(): FuelCapacity {
        const cap = this.#top.FuelCapacity;
        if (cap?.Main !== undefined && cap.Reserve !== undefined) {
            return Object.freeze({ main: cap.Main, reserve: cap.Reserve });
        }
        const computed = this.#computedFuelCapacity();
        return Object.freeze({
            main: cap?.Main ?? computed.main,
            reserve: cap?.Reserve ?? computed.reserve,
        });
    }

    /**
     * Cargo capacity, in tonnes — a capture's `CargoCapacity` on the same terms as
     * {@link unladenMass}, otherwise the sum of the fitted racks.
     */
    get cargoCapacity(): number {
        return this.#top.CargoCapacity ?? this.#computedCargoCapacity();
    }

    /** Cargo capacity summed from the fitted racks, ignoring any imported figure. */
    #computedCargoCapacity(): number {
        return calculateCargoCapacity(this.#calculationModules());
    }

    /** Fuel capacity from the fitted tanks and the hull, ignoring any import. */
    #computedFuelCapacity(): FuelCapacity {
        return calculateFuelCapacity(this.#ship.reserveFuelCapacity, this.#calculationModules());
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
     * unknown — including after an edit or import normalization discarded an import's
     * figure, since no catalogue records what a replaced module was bought for. Unlike
     * mass and capacity it is not recomputed from what remains; {@link sourcePurchase}
     * keeps the captured figure and {@link buildCost} prices the current fit.
     */
    get modulesValue(): number | null {
        return this.#top.ModulesValue ?? null;
    }

    /**
     * Insurance rebuy cost in credits represented by the build, or `null` if
     * unknown. Discarded by an edit or by import normalization for the same reason as
     * {@link modulesValue}, and likewise kept by {@link sourcePurchase};
     * {@link buildCost} rebuys the current fit at catalogue prices instead.
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
     * A captured price belongs to one commander's purchase history, discounts included;
     * the library's own figures are catalogue retail. Export quotes retail unless asked
     * otherwise — see {@link LoadoutExportOptions.credits}.
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
     * Changes made while importing this build, in source order, followed by the fixed
     * mounts stocked from the hull defaults because the source named none, in the
     * defaults' own order.
     *
     * @returns A deeply frozen list. It is empty for builds created with
     * {@link ShipLoadout.empty} or {@link ShipLoadout.default}, and for imports that
     * needed no normalization.
     * @remarks
     * Each entry names the exact slot, and the source identity where the source gave one.
     * `emptied` means an unknown module was removed from a removable mount; `defaulted`
     * names the stock article fitted to armour, a core internal or the cargo hatch, with
     * a `null` `sourceSymbol` when the source named nothing there at all.
     */
    get importOutcomes(): readonly LoadoutImportOutcome[] {
        return this.#importOutcomes;
    }

    /**
     * Structural validity and operational completeness of this build.
     *
     * @remarks
     * `valid` asks whether the fit is legal: a module in a nonexistent or incompatible
     * slot, a duplicated exclusive family, or a module count past the build's allowance
     * makes it `false`. `complete` asks that *and* whether armour and the seven core
     * mounts are filled — every build fills those, so on a build the two answers agree.
     * Neither question reports import normalization, so read {@link importOutcomes}
     * beside them.
     */
    get validation(): LoadoutValidation {
        const slots = this.#layout();
        const byKey = new Map(slots.map((slot) => [slot.key.toLowerCase(), slot]));
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
        return validateLoadout({ shipSymbol: this.#shipSymbol, slots, modules });
    }

    /**
     * Frozen point-in-time views of the hull's mounts in outfitting-panel order.
     *
     * @param kind - Optionally keep only one mount kind. Omit it for every mount.
     * @returns Detached, frozen slot views. Repeated reads for the same `kind` reuse the
     * same snapshots until a state-changing edit.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const emptyHardpoints = ShipLoadout.empty('Sidewinder').slots('hardpoint');
     * emptyHardpoints.every((slot) => slot.module === null); // true
     * ```
     */
    slots(kind?: SlotKind): readonly LoadoutSlot[] {
        const cached = this.#slotCache.get(kind);
        if (cached !== undefined) return cached;
        const slots =
            kind === undefined
                ? this.#layout()
                : this.#layout().filter((slot) => slot.kind === kind);
        const currentLimits = this.#moduleLimits();
        const value = deepFreeze(
            slots.map((slot) => {
                const stats = this.#moduleStatsAt(slot.key);
                const fixedReason = fixedSlotReason(slot);
                const immovableReason =
                    fixedReason !== null
                        ? fixedReason
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
        this.#slotCache.set(kind, value);
        return value;
    }

    /**
     * A deeply frozen, point-in-time view of the module in a slot.
     *
     * @param slotKey - Slot key, matched case-insensitively.
     * @returns A detached, frozen view, or `null` when the slot is empty or unknown.
     * @throws {TypeError} If `slotKey` is not a string.
     */
    fittedModuleAt(slotKey: string): FittedModule | null {
        const module = this.#fittedModuleFor(slotKey);
        if (!module) return null;
        const raw = cloneLoadoutModule(module);
        const stats = this.#statsFor(module);
        const effective = effectiveModule(this.#moduleForEffectiveStats(module), stats);
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
     * Return the computable blueprint candidates for a fitted module symbol.
     *
     * @param slotKey - Slot key, matched case-insensitively.
     * @returns Frozen blueprint descriptors: the ordinary engineering menu first, then
     * bespoke Mercenary upgrade recipes. An `'ordinary'` candidate is available to the
     * stock module; a `'mercenary'` candidate is purchase-specific. Applying that bespoke
     * blueprint identifies the matching Mercenary article even though its bare module
     * symbol does not.
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
     * @throws {TypeError} If `slotKey` is not a string.
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
     * Refit a fixed mount from this hull's stock loadout.
     *
     * @remarks
     * This is the repair path for the mounts {@link setModule} does not expose as ordinary
     * edits — in practice the built-in cargo hatch. The stock article keeps the mount's
     * `On`, `Priority` and `Health` and none of the replaced module's engineering or
     * captured value, as import normalization does. Every entry point already fills these
     * mounts, so a build this package produced answers `unchanged`.
     *
     * @param slotKey - Fixed slot key, matched case-insensitively.
     * @returns A frozen {@link FixedMountRepairResult}. Refusals leave the build unchanged.
     * @throws {TypeError} If `slotKey` is not a string.
     * @throws {RangeError} If a known hull has no slot with that key.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const imported: ShipLoadout;
     * imported.repairFixedMount('CargoHatch').status; // -> 'unchanged'
     * ```
     */
    repairFixedMount(slotKey: string): FixedMountRepairResult {
        const requested = requireString(slotKey, SLOT_KEY);
        const wanted = requested.toLowerCase();
        const slot = this.#requireSlot(requested);
        const fittedKey = this.#fittedKey(requested);
        const resultSlot = fittedKey ?? requested;
        const canonicalKey = slot.key;
        if (fixedSlotReason(slot) === null) {
            return deepFreeze({ status: 'refused', slot: resultSlot, reason: 'notFixedMount' });
        }

        const current = this.#fittedModuleFor(requested);
        const currentStats = current ? this.#statsFor(current) : null;
        const valid =
            current !== undefined &&
            currentStats !== null &&
            (slot.kind === 'cargoHatch'
                ? isBuiltInHullModule(current)
                : moduleFitProblem(this.#shipSymbol, slot, currentStats) === null);
        if (valid) {
            return deepFreeze({
                status: 'unchanged',
                slot: current.Slot,
                symbol: current.Item,
            });
        }

        const defaultModule = getDefaultLoadout(this.#shipSymbol)?.modules.find(
            (module) => module.slot.toLowerCase() === wanted,
        );
        if (!defaultModule) {
            return deepFreeze({ status: 'defaultUnavailable', slot: resultSlot });
        }
        const ownKey = ownKeyIn(this.#modules, canonicalKey);
        const replacement = {
            Slot: ownKey,
            Item: defaultModule.symbol,
            ...(current?.On === undefined ? {} : { On: current.On }),
            ...(current?.Priority === undefined ? {} : { Priority: current.Priority }),
            ...(current?.Health === undefined ? {} : { Health: current.Health }),
        };
        const replacementStats =
            builtInModuleBySymbol(defaultModule.symbol, 'ShipLoadout.repairFixedMount') ??
            (isBuiltInHullModule(replacement)
                ? builtInModuleBySymbol('ModularCargoBayDoor', 'ShipLoadout.repairFixedMount')
                : null);
        if (!replacementStats) {
            return deepFreeze({
                status: 'defaultUnavailable',
                slot: resultSlot,
                symbol: defaultModule.symbol,
            });
        }

        this.#replaceModule(ownKey, replacement, replacementStats);
        return deepFreeze({
            status: 'repaired',
            slot: ownKey,
            symbol: defaultModule.symbol,
        });
    }

    /**
     * Fit a module into a slot, replacing whatever is there.
     *
     * @remarks
     * This is an incremental editor: every call must avoid worsening the current build's
     * module-count excess, so fit an allowance-increasing module before the weapons it
     * permits. Use {@link ShipLoadout.fromLoadout} to consume a complete snapshot
     * instead, where order does not matter.
     *
     * Fitting is a fresh mount: the slot's `On`, `Priority` and `Health` are reset. Set
     * them again if your screen keeps a priority group across a swap.
     *
     * @param slotKey - The slot key to fit into, matched case-insensitively (journal
     * spelling). An occupied slot keeps the key the build already spells it with, so
     * fitting into an import never renames one of its mounts.
     * @param module - The module to fit (resolve it from a catalogue first, e.g. with
     * {@link getModuleBySymbol}). The complete record is snapshotted, so a result from
     * `getPreEngineeredStats` or a record you adjusted yourself keeps its stats — but it
     * must name an article the built-in catalogue carries, and it may not drop that
     * article's `mass`, `cargoCapacity` or `fuelCapacity`, which every build sums, nor
     * state one as anything but a finite number.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the hull has no slot with that key.
     * @throws {TypeError} If `slotKey` is not a string, or `module` fails any of the
     * conditions above — null/undefined (e.g. a `getModuleBySymbol` miss), not an
     * outfitting module, an uncatalogued symbol, or a missing or non-finite summed stat.
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
            throw new TypeError(
                `ShipLoadout.setModule: no module supplied for "${truncate(slotKey)}" (did the module lookup return undefined?)`,
            );
        }
        // Every fit rule reads the record's symbol, so anything else — a bare id, a
        // journal fragment — is named here, from the argument itself, before the snapshot
        // below turns it into a plain object the caller would not recognise.
        if (typeof (module as { symbol?: unknown }).symbol !== 'string') {
            throw new TypeError(
                `ShipLoadout.setModule: module for "${truncate(slotKey)}" must be an outfitting module, received ${describeValue(module)}`,
            );
        }
        // Snapshot before a single figure is checked, so a caller's accessor cannot
        // answer the checks below one way and the fit that gets stored another.
        module = cloneModuleStats(module);
        // The record may state engineered figures, but the article has to be one the
        // catalogue knows and has to keep every figure a build sums. Absent is not zero:
        // a record without its mass would understate the ship rather than fail, and
        // nobody would question the answer.
        const catalogued = builtInModuleBySymbol(module.symbol, FITTED_ITEM);
        if (catalogued === null) {
            throw new TypeError(
                `ShipLoadout.setModule: no module is catalogued as "${truncate(module.symbol)}"`,
            );
        }
        for (const field of AGGREGATE_STATS) {
            const stated: unknown = module[field];
            if (stated === undefined) {
                if (catalogued[field] === undefined) continue;
                throw new TypeError(
                    `ShipLoadout.setModule: the supplied record for "${truncate(module.symbol)}" has no ${field}`,
                );
            }
            // A non-finite figure would be summed as zero or, worse, concatenated.
            if (typeof stated !== 'number' || !Number.isFinite(stated)) {
                throw new TypeError(
                    `ShipLoadout.setModule: the supplied record for "${truncate(module.symbol)}" states a ${field} of ${describeValue(stated)}`,
                );
            }
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
        this.#replaceModule(key, { Slot: key, Item: module.symbol }, module);
        return this;
    }

    /**
     * Empty a slot.
     *
     * @param slotKey - The slot key to clear, matched case-insensitively (journal
     * spelling).
     * @returns `this`, for chaining. Clearing an already-empty removable slot is a no-op.
     * @throws {TypeError} If `slotKey` is not a string.
     * @throws {LoadoutEditError} If the slot is the built-in cargo hatch; is a required
     * core or armour mount; or removing the module would worsen a per-ship module-count
     * excess. Required mounts may be replaced with {@link setModule} but cannot be
     * emptied.
     */
    removeModule(slotKey: string): this {
        // Read before `#fittedKey` does, so this one method guards for itself.
        const wanted = requireString(slotKey, SLOT_KEY).toLowerCase();
        if (wanted === 'cargohatch') {
            throw new LoadoutEditError(
                'ShipLoadout.removeModule: the cargoHatch slot cannot be changed',
                'immutableSlot',
                { slot: 'CargoHatch' },
            );
        }
        const parsed = parseSlotName(slotKey);
        const slot = this.#layout().find((candidate) => candidate.key.toLowerCase() === wanted);
        if (parsed !== null && fixedSlotReason(parsed) === 'requiredSlot') {
            const fittedKey = this.#fittedKey(slotKey);
            const key = slot?.key ?? fittedKey ?? slotKey;
            throw new LoadoutEditError(
                `ShipLoadout.removeModule: the ${truncate(key)} slot is required and cannot be emptied`,
                'requiredSlot',
                { slot: key },
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
     * The modifiers are stored on the fitted module with journal-equivalent labels and
     * Frontier's float32 arithmetic, so the build's own calculations pick them up. The
     * block keeps the `BlueprintName` you passed. Weapon recipe internals such as
     * `BurstInterval` are exposed as the derived `RateOfFire` and `DamagePerSecond`
     * labels a journal writes, and module-specific aliases use the journal spelling too
     * (`MaximumRange`, `Range`); recipe-only values a journal serializes no label for
     * stay available through {@link FittedModule.effectiveStats}, which is what keeps
     * burst and reload-cycle calculations faithful.
     *
     * **Which recipe an id names can depend on the module.** The game writes
     * `Sensor_LongRange` for both a sensor suite's modification and a utility scanner's,
     * and the two roll different stats in opposite directions, so the id is resolved
     * against the module's own menu before anything is computed. Reading a stored block
     * back means resolving it the same way: `resolveBlueprintForModule` in
     * `ships/blueprint-journal` is that lookup.
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
     * one is no effect, not a wrong type. Also if the fitted module has no stats to
     * engineer, is final and accepts no further engineering, is not offered the blueprint
     * by its own menu, is not offered the experimental effect by it, or the id names a
     * fixed event-reward identity rather than a craftable recipe — use
     * {@link setPreEngineeredVariant} for those. Finally, if the catalogue does not carry
     * every base stat the recipe modifies: incomplete engineering is rejected rather than
     * stored as a partial journal modifier block.
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
        // Read each option exactly once, before any of it is checked: a caller's accessor
        // could otherwise answer the check and the use differently, storing a grade no
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
        const fittedStats = this.#statsFor(module);
        if (!fittedStats) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: no stats for module "${truncate(module.Item)}"`,
            );
        }
        // Resolve before reading the grade, so the numbers folded are the ones this
        // module rolls rather than another family's — see the remarks above.
        const recipe = resolveBlueprintForModule(module.Item, fdname);
        // Name both spellings once they differ, so an error about the recipe this module
        // rolls cannot read as an error about the id the caller passed.
        const named =
            recipe === fdname
                ? `"${truncate(fdname)}"`
                : `"${truncate(fdname)}" (${truncate(recipe)} on this module)`;
        // A festive fixed variant reaches this method as a real journal identity that
        // names no craftable recipe. It is fitted as a pre-engineered variant, not applied
        // to an arbitrary stock module.
        const written = fdname.trim().toLowerCase();
        const resolved = recipe.trim().toLowerCase();
        if (
            getPreEngineeredVariants(module.Item).some(
                (variant) =>
                    variant.acquisition === 'eventReward' &&
                    (variant.blueprint.toLowerCase() === written ||
                        variant.blueprint.toLowerCase() === resolved),
            )
        ) {
            throw new TypeError(
                `ShipLoadout.applyBlueprint: ${named} is a fixed pre-engineered identity, not a craftable blueprint; use setPreEngineeredVariant to fit its fixed article`,
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
        if (fittedStats.engineeringLocked) {
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
        // A fixed variant's effective snapshot is not a new stock module. Replacing its
        // engineering starts from the catalogue article, otherwise the new recipe would
        // be folded over the fixed values a second time (and clearing it would retain
        // those values as an unlabelled base).
        const stats = this.#engineeringBaseStats(module) ?? fittedStats;
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
            stats,
            primitiveModifiers,
        );
        return this;
    }

    /**
     * Add, replace or remove only the fitted module's experimental effect.
     *
     * Ordinary and Mercenary engineering is recomputed at its current blueprint, grade
     * and quality. A fixed reward instead retains its hand-authored modifiers and
     * purchase identity while the requested effect is composed with them. Refused edits
     * leave the build unchanged and return stable structured data.
     *
     * @param slotKey - The engineered slot, matched case-insensitively.
     * @param experimental - Experimental-effect `fdname`, or `null` to remove the effect.
     * @returns A frozen result identifying an update, no-op or lossless refusal.
     * @throws {TypeError} If `slotKey` or a non-null `experimental` is not a string.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * build.setExperimentalEffect('FrameShiftDrive', 'special_fsd_heavy');
     * build.setExperimentalEffect('FrameShiftDrive', null);
     * ```
     */
    setExperimentalEffect(
        slotKey: string,
        experimental: string | null,
    ): ExperimentalEffectMutationResult {
        if (experimental !== null) {
            requireString(experimental, 'ShipLoadout.setExperimentalEffect: experimental');
        }
        const wanted = experimental;
        const module = this.#fittedModuleFor(slotKey);
        if (!module) return experimentalEffectUnsupported('emptySlot', { slot: slotKey });

        const stats = this.#statsFor(module);
        if (!stats) {
            return experimentalEffectUnsupported('unsupportedEngineering', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }
        const engineering = module.Engineering;
        if (!engineering) {
            return experimentalEffectUnsupported('notEngineered', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }
        if (stats.engineeringLocked) {
            return experimentalEffectUnsupported('finalArticle', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }

        const previous = engineering.ExperimentalEffect ?? null;
        if (
            (previous === null && wanted === null) ||
            (previous !== null &&
                wanted !== null &&
                previous.trim().toLowerCase() === wanted.trim().toLowerCase())
        ) {
            return deepFreeze({ kind: 'unchanged', experimental: previous });
        }

        const variant = identifyPreEngineeredVariant(module);
        let effect;
        if (wanted !== null) {
            effect = getExperimentalEffect(wanted);
            if (!effect) {
                return experimentalEffectUnsupported('unknownExperimentalEffect', {
                    slot: module.Slot,
                    symbol: module.Item,
                    experimental: wanted,
                });
            }
            const restoresBakedEffect =
                variant?.experimental !== undefined &&
                variant.experimental.trim().toLowerCase() === wanted.trim().toLowerCase();
            if (!experimentalAvailableFor(module.Item, wanted) && !restoresBakedEffect) {
                return experimentalEffectUnsupported('unsupportedExperimentalEffect', {
                    slot: module.Slot,
                    symbol: module.Item,
                    experimental: wanted,
                });
            }
        }
        if (variant && variant.acquisition !== 'mercenary') {
            const stock = this.#engineeringBaseStats(module);
            if (!stock) {
                return experimentalEffectUnsupported('unsupportedEngineering', {
                    slot: module.Slot,
                    symbol: module.Item,
                });
            }
            const missing = missingBaseLabels(stock, baseStats(stock), [], effect?.modifiers);
            if (missing.length > 0) {
                return experimentalEffectUnsupported('unresolvedModifiers', {
                    slot: module.Slot,
                    symbol: module.Item,
                    labels: missing,
                });
            }

            const { experimental: originalEffect, ...withoutEffect } = variant;
            void originalEffect;
            const adjusted: PreEngineeredVariant =
                wanted === null ? withoutEffect : { ...withoutEffect, experimental: wanted };
            const resolved = getPreEngineeredStats(withoutEffect);
            if (!resolved) {
                return experimentalEffectUnsupported('unsupportedEngineering', {
                    slot: module.Slot,
                    symbol: module.Item,
                });
            }
            const replacement: ModuleEngineering = {
                BlueprintName: engineering.BlueprintName,
                Level: engineering.Level,
                Quality: engineering.Quality,
                ...(wanted === null ? {} : { ExperimentalEffect: wanted }),
                Modifiers: getPreEngineeredJournalModifiers(adjusted),
            };
            this.#replaceModule(
                module.Slot,
                { ...module, Engineering: replacement },
                cloneModuleStats(resolved),
                getPreEngineeredModifiers(adjusted),
            );
        } else {
            const blueprint = engineering.BlueprintName;
            const grade = engineering.Level;
            const quality = engineering.Quality;
            if (
                typeof blueprint !== 'string' ||
                !Number.isInteger(grade) ||
                grade < 1 ||
                grade > 5
            ) {
                return experimentalEffectUnsupported('unsupportedEngineering', {
                    slot: module.Slot,
                    symbol: module.Item,
                });
            }
            const currentEffect =
                previous === null ? undefined : (getExperimentalEffect(previous) ?? null);
            if (ordinaryEngineeringProof(module.Item, engineering, currentEffect) === 'unproven') {
                return experimentalEffectUnsupported('unidentifiedPreEngineeredVariant', {
                    slot: module.Slot,
                    symbol: module.Item,
                    blueprint,
                });
            }
            const recipe = resolveBlueprintForModule(module.Item, blueprint);
            const blueprintGrade = getBlueprintGrade(recipe, grade);
            if (
                !blueprintGrade ||
                !blueprintAvailableFor(module.Item, blueprint) ||
                !Number.isFinite(quality) ||
                quality < 0 ||
                quality > 1
            ) {
                return experimentalEffectUnsupported('unsupportedEngineering', {
                    slot: module.Slot,
                    symbol: module.Item,
                    blueprint,
                    grade,
                });
            }
            const base = this.#engineeringBaseStats(module) ?? stats;
            const canonical = primitiveEngineeringInputsFor(base, blueprintGrade, effect);
            const missing = missingBaseLabels(
                base,
                baseStats(base),
                canonical.grade.features,
                canonical.experimental?.modifiers,
            );
            if (missing.length > 0) {
                return experimentalEffectUnsupported('unresolvedModifiers', {
                    slot: module.Slot,
                    symbol: module.Item,
                    labels: missing,
                });
            }
            this.applyBlueprint(module.Slot, blueprint, {
                grade,
                quality,
                ...(wanted === null ? {} : { experimental: wanted }),
            });
        }

        return deepFreeze({
            kind: 'updated',
            previousExperimental: previous,
            experimental: wanted,
        });
    }

    /**
     * Recompute the fitted module's current engineering identity at quality `1`.
     *
     * Imported modifier values remain authoritative until this method is called. An
     * ordinary or Mercenary recipe is rerolled through the package calculator; a fixed
     * reward rebuilds its hand-authored modifiers and optional effect without losing its
     * purchase identity. A refusal never changes the loadout.
     *
     * @param slotKey - The engineered slot, matched case-insensitively.
     * @returns A frozen result identifying a normalized, unchanged or unsupported state.
     * @throws {TypeError} If `slotKey` is not a string.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const partial = ShipLoadout.default('SideWinder').applyBlueprint(
     *     'FrameShiftDrive',
     *     'FSD_LongRange',
     *     { grade: 5, quality: 0.42 },
     * );
     * const imported = ShipLoadout.fromLoadout(partial.toLoadoutEvent());
     * imported.completeEngineeringGrade('FrameShiftDrive').kind; // -> 'normalized'
     * imported.fittedModuleAt('FrameShiftDrive')?.engineering?.Quality; // -> 1
     * ```
     */
    completeEngineeringGrade(slotKey: string): EngineeringNormalizationResult {
        const module = this.#fittedModuleFor(slotKey);
        if (!module) return engineeringNormalizationUnsupported('emptySlot', { slot: slotKey });

        const stats = this.#statsFor(module);
        if (!stats) {
            return engineeringNormalizationUnsupported('unsupportedEngineering', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }
        const engineering = module.Engineering;
        if (!engineering) {
            return engineeringNormalizationUnsupported('notEngineered', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }
        if (stats.engineeringLocked) {
            return engineeringNormalizationUnsupported('finalArticle', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }
        if (engineering.Quality === 1) {
            return deepFreeze({ kind: 'unchanged' });
        }
        const previousQuality = engineering.Quality;
        if (!Number.isFinite(previousQuality) || previousQuality < 0 || previousQuality > 1) {
            return engineeringNormalizationUnsupported('invalidQuality', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }

        const experimental = engineering.ExperimentalEffect ?? null;
        const effect =
            experimental === null ? undefined : (getExperimentalEffect(experimental) ?? undefined);
        if (experimental !== null && !effect) {
            return engineeringNormalizationUnsupported('unknownExperimentalEffect', {
                slot: module.Slot,
                symbol: module.Item,
                experimental,
            });
        }
        const blueprint = engineering.BlueprintName;
        const grade = engineering.Level;
        if (typeof blueprint !== 'string' || !Number.isInteger(grade) || grade < 1 || grade > 5) {
            return engineeringNormalizationUnsupported('unsupportedEngineering', {
                slot: module.Slot,
                symbol: module.Item,
            });
        }
        const variant = identifyPreEngineeredVariant(module);
        const restoresBakedEffect =
            variant?.experimental !== undefined &&
            variant.experimental.trim().toLowerCase() === experimental?.trim().toLowerCase();
        if (
            experimental !== null &&
            !experimentalAvailableFor(module.Item, experimental) &&
            !restoresBakedEffect
        ) {
            return engineeringNormalizationUnsupported('unsupportedExperimentalEffect', {
                slot: module.Slot,
                symbol: module.Item,
                experimental,
            });
        }

        if (variant && variant.acquisition !== 'mercenary') {
            const stock = this.#engineeringBaseStats(module);
            if (!stock) {
                return engineeringNormalizationUnsupported('unsupportedEngineering', {
                    slot: module.Slot,
                    symbol: module.Item,
                });
            }
            const missing = missingBaseLabels(stock, baseStats(stock), [], effect?.modifiers);
            if (missing.length > 0) {
                return engineeringNormalizationUnsupported('unresolvedModifiers', {
                    slot: module.Slot,
                    symbol: module.Item,
                    labels: missing,
                });
            }

            const { experimental: originalEffect, ...withoutEffect } = variant;
            void originalEffect;
            const adjusted: PreEngineeredVariant =
                experimental === null ? withoutEffect : { ...withoutEffect, experimental };
            const resolved = getPreEngineeredStats(withoutEffect);
            if (!resolved) {
                return engineeringNormalizationUnsupported('unsupportedEngineering', {
                    slot: module.Slot,
                    symbol: module.Item,
                });
            }
            const replacement: ModuleEngineering = {
                BlueprintName: engineering.BlueprintName,
                Level: engineering.Level,
                Quality: 1,
                ...(experimental === null ? {} : { ExperimentalEffect: experimental }),
                Modifiers: getPreEngineeredJournalModifiers(adjusted),
            };
            this.#replaceModule(
                module.Slot,
                { ...module, Engineering: replacement },
                cloneModuleStats(resolved),
                getPreEngineeredModifiers(adjusted),
            );
        } else {
            const proof = ordinaryEngineeringProof(module.Item, engineering, effect);
            if (
                proof === 'unproven' ||
                (proof === 'proven' && !blueprintAvailableFor(module.Item, blueprint))
            ) {
                return engineeringNormalizationUnsupported('unidentifiedPreEngineeredVariant', {
                    slot: module.Slot,
                    symbol: module.Item,
                    blueprint,
                });
            }
            const recipe = resolveBlueprintForModule(module.Item, blueprint);
            const blueprintGrade = getBlueprintGrade(recipe, grade);
            if (!blueprintGrade || !blueprintAvailableFor(module.Item, blueprint)) {
                return engineeringNormalizationUnsupported('unsupportedEngineering', {
                    slot: module.Slot,
                    symbol: module.Item,
                    blueprint,
                    grade,
                });
            }
            const base = this.#engineeringBaseStats(module) ?? stats;
            const canonical = primitiveEngineeringInputsFor(base, blueprintGrade, effect);
            const missing = missingBaseLabels(
                base,
                baseStats(base),
                canonical.grade.features,
                canonical.experimental?.modifiers,
            );
            if (missing.length > 0) {
                return engineeringNormalizationUnsupported('unresolvedModifiers', {
                    slot: module.Slot,
                    symbol: module.Item,
                    labels: missing,
                });
            }
            this.applyBlueprint(module.Slot, blueprint, {
                grade,
                quality: 1,
                ...(experimental === null ? {} : { experimental }),
            });
        }

        return deepFreeze({ kind: 'normalized', previousQuality, quality: 1 });
    }

    /**
     * Fit a pre-engineered variant into a slot, replacing whatever is there.
     *
     * The variant's fixed stats and journal engineering block are resolved together.
     * Articles carry `Level`, `Quality: 1`, any baked experimental effect and their fixed
     * modifiers. Because the variant names its base module, a decorative identity cannot
     * be applied to an unrelated damage-bearing module.
     * A Mercenary variant whose fixed modifier block has not been published retains the
     * stock catalogue stats and omits `Modifiers` rather than claiming it changes none.
     *
     * @param slotKey - The slot key to fit into, matched case-insensitively.
     * @param variant - The pre-engineered catalogue variant to fit.
     * @returns `this`, for chaining.
     * @throws {TypeError} If `variant` is not a pre-engineered variant or one of its
     * authored modifier labels cannot be resolved for its base module.
     * @throws {RangeError} If no catalogue row matches the supplied module, blueprint,
     * grade, experimental effect and acquisition route.
     * @throws {LoadoutEditError} If the variant's base module does not fit the slot or
     * violates a fitted-module limit.
     * @example
     * ```ts
     * import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const festive = getPreEngineeredVariants('Hpt_FlakMortar_Turret_Medium')
     *     .find((variant) => variant.blueprint === 'Decorative_Red')!;
     * const build = ShipLoadout.empty('Krait_MkII')
     *     .setPreEngineeredVariant('MediumHardpoint1', festive);
     * build.fittedModuleAt('MediumHardpoint1')?.effectiveStats?.damage; // -> 0.34
     * ```
     */
    setPreEngineeredVariant(slotKey: string, variant: PreEngineeredVariant): this {
        if (variant === null || typeof variant !== 'object') {
            throw new TypeError(
                `ShipLoadout.setPreEngineeredVariant: variant must be a pre-engineered variant, received ${describeValue(variant)}`,
            );
        }
        requireString(variant.symbol, 'ShipLoadout.setPreEngineeredVariant: variant.symbol');
        requireString(variant.blueprint, 'ShipLoadout.setPreEngineeredVariant: variant.blueprint');
        requireString(
            variant.acquisition,
            'ShipLoadout.setPreEngineeredVariant: variant.acquisition',
        );
        requireStringIfPresent(
            variant.experimental,
            'ShipLoadout.setPreEngineeredVariant: variant.experimental',
        );
        const known = getPreEngineeredVariants(variant.symbol).find(
            (candidate) =>
                candidate.blueprint.toLowerCase() === variant.blueprint.toLowerCase() &&
                candidate.grade === variant.grade &&
                (candidate.experimental?.toLowerCase() ?? '') ===
                    (variant.experimental?.toLowerCase() ?? '') &&
                candidate.acquisition === variant.acquisition,
        );
        if (!known) {
            throw new RangeError(
                `ShipLoadout.setPreEngineeredVariant: no catalogued variant "${truncate(variant.blueprint)}" for module "${truncate(variant.symbol)}"`,
            );
        }
        const stats = getPreEngineeredStats(known)!;
        const unresolved = unresolvedModifiers(known);
        if (unresolved.length > 0) {
            throw new TypeError(
                `ShipLoadout.setPreEngineeredVariant: cannot resolve "${truncate(variant.blueprint)}" for module "${truncate(variant.symbol)}"; missing base stats for ${unresolved.join(', ')}`,
            );
        }
        this.setModule(slotKey, stats);
        const module = this.#fittedModuleFor(slotKey)!;
        const engineering: ModuleEngineering = {
            BlueprintName: known.blueprint,
            Level: known.grade,
            Quality: 1,
            ...(known.experimental === undefined ? {} : { ExperimentalEffect: known.experimental }),
            ...(known.modifiers?.length
                ? { Modifiers: getPreEngineeredJournalModifiers(known) }
                : {}),
        };
        this.#replaceModule(
            module.Slot,
            { ...module, Engineering: engineering },
            cloneModuleStats(stats),
            getPreEngineeredModifiers(known),
        );
        return this;
    }

    /**
     * Strip engineering from a slot's module,
     * restoring its base stats.
     *
     * @param slotKey - The slot to de-engineer, matched case-insensitively (journal
     * spelling).
     * @returns `this`, for chaining. A no-op if the slot is empty or unmodified.
     * @throws {TypeError} If `slotKey` is not a string, or the fitted article is final
     * pre-engineered and its baked engineering cannot be removed.
     * @remarks
     * Clearing a Mercenary article removes its purchase-exclusive blueprint identity.
     * Its {@link FittedModule.preEngineeredVariant} then reads `null`.
     */
    clearEngineering(slotKey: string): this {
        const module = this.#fittedModuleFor(slotKey);
        if (module && this.#statsFor(module)?.engineeringLocked) {
            throw new TypeError(
                `ShipLoadout.clearEngineering: module "${truncate(module.Item)}" is a final pre-engineered article and its engineering cannot be removed`,
            );
        }
        if (module?.Engineering) {
            const baseStats = this.#engineeringBaseStats(module);
            const bare: LoadoutModule = { Slot: module.Slot, Item: module.Item };
            if (module.On !== undefined) (bare as { On?: boolean }).On = module.On;
            if (module.Priority !== undefined) {
                (bare as { Priority?: number }).Priority = module.Priority;
            }
            if (module.Health !== undefined) (bare as { Health?: number }).Health = module.Health;
            if (module.Value !== undefined) (bare as { Value?: number }).Value = module.Value;
            this.#replaceModule(module.Slot, bare, baseStats ?? undefined);
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
        this.#slotCache.clear();
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
        const unladenMass = this.#computedUnladenMass();
        const cargoCapacity = this.#computedCargoCapacity();
        const fuel = this.#computedFuelCapacity();
        const maxJumpRange = this.#exportableJumpRange(unladenMass);
        return exportLoadoutEvent(
            {
                shipSymbol: this.#shipSymbol,
                ...(this.#top.ShipName === undefined ? {} : { shipName: this.#top.ShipName }),
                ...(this.#top.ShipIdent === undefined ? {} : { shipIdent: this.#top.ShipIdent }),
                modules: this.#modules,
                layout: this.#layout(),
                sourcePurchase: this.#sourcePurchase,
                retailHullValue: this.#ship.hullCost,
                unladenMass,
                cargoCapacity,
                fuelCapacity: fuel,
                maxJumpRange,
                // A stocked core internal the capture never listed is an article aboard
                // that nobody paid for, and comparing the priced slots cannot see it: the
                // capture has no entry to disagree with. A stock bulkhead or hatch costs
                // nothing, so neither moves the totals.
                sourceTotalsVoided: this.#importOutcomes.some(
                    (outcome) =>
                        outcome.sourceSymbol === null &&
                        parseSlotName(outcome.slot)?.kind === 'core',
                ),
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
    #exportableJumpRange(unladenMass: number): number | null {
        let drive: FrameShiftDriveParams | null;
        try {
            drive = this.#resolveDrive();
        } catch {
            // A supplied drive record without jump constants throws; omit rather than
            // fail an export over it.
            return null;
        }
        if (drive === null) return null;
        // Mirrors maxJumpRange(): one jump's fuel, no cargo — but off the recomputed
        // mass and tank rather than anything an import supplied.
        const tank = this.#computedFuelCapacity();
        return singleJumpRange(unladenMass, Math.min(tank.main, drive.maxFuel), drive);
    }

    /**
     * The resolved frame-shift-drive constants for this build — post-engineering,
     * with any Guardian FSD Booster folded into `jumpBoost`.
     *
     * @throws {TypeError} If the fitted drive's record is missing any of its required
     * jump constants.
     */
    get frameShiftDrive(): FrameShiftDriveParams {
        const drive = this.#resolveDrive();
        if (drive === null) throw new TypeError('ShipLoadout: build has no frame shift drive');
        return drive;
    }

    /** The fuel one jump can burn: the whole main tank, or the drive limit if lower. */
    #maxJumpFuel(fsd: FrameShiftDriveParams): number {
        return Math.min(this.fuelCapacity.main, fsd.maxFuel);
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
     * @throws {TypeError} If the build has no usable frame shift drive.
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
        const fuel = options.fuel ?? this.fuelCapacity.main;
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
     * @returns The best single jump, in light-years, or `0` for a capture that states a
     * main tank of `0`.
     * @throws {TypeError} If the build has no usable frame shift drive.
     */
    maxJumpRange(): number {
        const fsd = this.frameShiftDrive;
        return singleJumpRange(this.#requireMass(0), this.#maxJumpFuel(fsd), fsd);
    }

    /**
     * The range of a single jump for a chosen fuel and cargo load, in light-years.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns The jump's range, in light-years.
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative.
     */
    jumpRange(options: JumpOptions = {}): number {
        requireLoadOptions('ShipLoadout.jumpRange', options);
        const fsd = this.frameShiftDrive;
        const fuel = options.fuel ?? this.fuelCapacity.main;
        return singleJumpRange(this.#requireMass(options.cargo ?? 0), fuel, fsd);
    }

    /**
     * Single-jump range on a full tank with a full cargo hold, in light-years.
     *
     * @returns The jump's range, in light-years.
     * @throws {TypeError} If the build has no usable frame shift drive.
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
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative.
     */
    fuelPerJump(distance: number, options: JumpOptions = {}): number {
        requireLoadOptions('ShipLoadout.fuelPerJump', options);
        const fsd = this.frameShiftDrive;
        const fuel = options.fuel ?? this.fuelCapacity.main;
        return fuelPerJump(distance, this.#requireMass(options.cargo ?? 0), fuel, fsd);
    }

    /**
     * Total range and jump count for a chosen fuel and cargo load.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns Summed range in light-years and the jumps made before the tank is empty.
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or the
     * fuel load would require more than 100,000 jumps.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.totalRange().jumps; // jumps available from one full main tank
     * build.totalRange({ fuel: 8, cargo: 32 }).range; // range for that partial load
     * ```
     */
    totalRange(options: JumpOptions = {}): TotalRangeDetails {
        requireLoadOptions('ShipLoadout.totalRange', options);
        return totalRange(
            this.#requireMass(options.cargo ?? 0),
            options.fuel ?? this.fuelCapacity.main,
            this.frameShiftDrive,
        );
    }

    /**
     * Resolve one of the package's standard load conditions for jump and mobility views.
     *
     * @param load - `'maximum'` for one jump's fuel and no cargo, `'unladen'` for a
     * full main tank and no cargo, or `'laden'` for a full main tank and full hold.
     * @returns Fuel and cargo in tonnes. Only `'maximum'` can come back incomplete: it
     * validates the whole fitted drive, jump booster included, so a complete one can be
     * passed straight to {@link jumpRange}.
     * @throws {RangeError} If `load` is not a recognised standard load.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * const load = build.standardLoadResult('maximum');
     * if (load.complete) build.mobilityMetrics({ ...load.value, enginesPips: 2 });
     * ```
     */
    standardLoadResult(load: StandardLoad): CalculationResult<StandardLoadInputs> {
        if (load !== 'maximum' && load !== 'unladen' && load !== 'laden') {
            throw new RangeError(
                "ShipLoadout.standardLoadResult: load must be 'maximum', 'unladen', or 'laden'",
            );
        }

        const fuel = this.fuelCapacity;
        const cargo = load === 'laden' ? this.cargoCapacity : 0;
        const mass = load === 'maximum' ? this.unladenMass : 0;
        const issues: CalculationIssue[] = [];
        let drive: FrameShiftDriveParams | null = null;
        let maximumFuel: number | null = null;
        if (load === 'maximum') {
            const fitted = this.#frameShiftDrive()?.module;
            let driveError: Error | null = null;
            try {
                drive = this.#resolveDrive();
                maximumFuel = drive?.maxFuel ?? null;
            } catch (error) {
                if (!(error instanceof Error)) throw error;
                driveError = error;
            }
            if (maximumFuel === null) {
                issues.push({
                    field: 'frameShiftDrive',
                    reason: fitted ? 'unresolved' : 'missing',
                    slot: fitted?.Slot ?? 'FrameShiftDrive',
                    ...(fitted ? { symbol: fitted.Item } : {}),
                    message:
                        driveError?.message ?? 'FrameShiftDrive: no frame shift drive is fitted',
                    params: fitted
                        ? {
                              field: 'frameShiftDrive',
                              reason: 'unresolved',
                              slot: fitted.Slot,
                              symbol: fitted.Item,
                          }
                        : {
                              field: 'frameShiftDrive',
                              reason: 'missing',
                              slot: 'FrameShiftDrive',
                          },
                });
            }
        }
        if (issues.length > 0) {
            return incompleteResult(issues as [CalculationIssue, ...CalculationIssue[]]);
        }
        const value = Object.freeze({
            fuel: load === 'maximum' ? Math.min(fuel.main, maximumFuel!) : fuel.main,
            cargo,
        });
        if (load === 'maximum') {
            try {
                this.jumpRange(value);
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                const fitted = this.#frameShiftDrive()?.module;
                const field: CalculationIssue['field'] =
                    drive !== null && (!Number.isFinite(drive.maxFuel) || drive.maxFuel < 0)
                        ? 'frameShiftDrive'
                        : !Number.isFinite(value.fuel) || value.fuel < 0
                          ? 'fuelCapacity'
                          : !Number.isFinite(mass) || mass < 0
                            ? 'mass'
                            : 'frameShiftDrive';
                const driveParams =
                    field === 'frameShiftDrive' && fitted
                        ? { slot: fitted.Slot, symbol: fitted.Item }
                        : {};
                return incompleteResult([
                    {
                        field,
                        reason: 'invalid',
                        ...driveParams,
                        message: error.message,
                        params: { field, reason: 'invalid', ...driveParams },
                    },
                ]);
            }
        }
        return completeResult(value);
    }

    /**
     * Every jump figure at once — best, unladen, laden, and each load's total.
     *
     * @returns The {@link JumpRangeSummary}. Single-jump figures and each total's
     * `range` are in light-years. For a partial load, call {@link jumpRange} for one
     * jump or {@link totalRange} for every jump with the `fuel` and `cargo` you
     * actually have.
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     *
     * const jumps = build.jumpRangeSummary();
     * jumps.max;    // -> 89.41  (one jump's fuel, empty hold)
     * jumps.laden;  // -> the range with the hold full
     * jumps.totalMax.jumps; // the best jump expressed as a total
     * // Half a tank and 32 t aboard:
     * build.jumpRange({ fuel: build.fuelCapacity.main / 2, cargo: 32 });
     * ```
     */
    jumpRangeSummary(): JumpRangeSummary {
        const maximum = this.#require(this.standardLoadResult('maximum'), 'maximum load');
        const unladen = this.#require(this.standardLoadResult('unladen'), 'unladen load');
        const laden = this.#require(this.standardLoadResult('laden'), 'laden load');
        return {
            max: this.jumpRange(maximum),
            unladen: this.jumpRange(unladen),
            laden: this.jumpRange(laden),
            totalMax: this.totalRange(maximum),
            totalUnladen: this.totalRange(unladen),
            totalLaden: this.totalRange(laden),
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
     * @returns The {@link PowerBudget}. `consumers` includes modules with positive
     * draw; passive and zero-draw fittings are absent.
     * @throws {RangeError} If a power capacity or module draw is negative or not finite.
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
     * plant.
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
            this.#ship,
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
     * @returns Loaded {@link MobilityMetrics}, or `null` when no fully described
     * thrusters are powered with hardpoints retracted. Use
     * {@link mobilityMetricsResult} to distinguish the unavailable conditions.
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
        requireEnginesPips('ShipLoadout.mobilityMetrics', options.enginesPips ?? 4);
        requireLoadOptions('ShipLoadout.mobilityMetrics', options);
        return this.mobilityMetricsResult(options).value;
    }

    /**
     * The build's mobility with a diagnostic when its thrusters or retracted power
     * supply is unavailable.
     *
     * @param options - Fuel defaults to a full main tank, cargo to `0`, and ENG pips to `4`.
     * @returns A complete {@link MobilityMetrics} value, otherwise `null` plus the input
     * or fitted-module state that prevented the calculation.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or
     * `enginesPips` is outside `[0, 4]`.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * const result = build.mobilityMetricsResult({ enginesPips: 2 });
     * if (result.complete) result.value.speed; // metres per second
     * else result.issues[0].reason;            // unavailable-state discriminator
     * ```
     */
    mobilityMetricsResult(options: MobilityOptions = {}): CalculationResult<MobilityMetrics> {
        const enginesPips = requireEnginesPips(
            'ShipLoadout.mobilityMetricsResult',
            options.enginesPips ?? 4,
        );
        requireLoadOptions('ShipLoadout.mobilityMetricsResult', options);
        const input = mobilityInputResultFor(
            this.#ship,
            [...this.#modules.values()],
            () => this.powerBudget(),
            () => {
                const main = options.fuel ?? this.#top.FuelCapacity?.Main ?? this.fuelCapacity.main;
                return this.#requireMass(options.cargo ?? 0) + main;
            },
            enginesPips,
            (module) => this.#statsFor(module),
        );
        if (!input.complete) return input;
        return completeResult(mobilityMetrics(input.value)!);
    }

    /**
     * The build's shields: strength in megajoules, where it comes from, and the
     * effective resistances.
     *
     * Shield strength scales with the **hull's** mass, not the build's, so fitting
     * more modules never weakens it. Boosters, Guardian shield reinforcement and any
     * engineering are all folded in; switched-off or shed boosters and reinforcement
     * are ignored, while a switched-off or shed generator makes the metric unavailable.
     *
     * @param options - {@link DefenceOptions}. `systemsPips` (0–4) folds the SYS
     * capacitor's own resistance into the reported figures; it defaults to `0`, which
     * is what an outfitting screen shows.
     * @returns The {@link ShieldMetrics}, or `null` when the build has no shield
     * generator powered with hardpoints retracted. Use
     * {@link shieldMetricsResult} to distinguish the unavailable conditions.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
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
        requireSystemsPips('ShipLoadout.shieldMetrics', options.systemsPips ?? 0);
        return this.shieldMetricsResult(options).value;
    }

    /**
     * The build's shields with a diagnostic when its hull, generator or retracted
     * power supply is unavailable.
     *
     * @param options - {@link DefenceOptions}. `systemsPips` defaults to `0`.
     * @returns A complete {@link ShieldMetrics} value, otherwise `null` plus the input
     * or fitted-module state that prevented the calculation.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * const result = build.shieldMetricsResult();
     * if (result.complete) result.value.strength; // megajoules
     * else result.issues[0].reason;               // unavailable-state discriminator
     * ```
     */
    shieldMetricsResult(options: DefenceOptions = {}): CalculationResult<ShieldMetrics> {
        const systemsPips = requireSystemsPips(
            'ShipLoadout.shieldMetricsResult',
            options.systemsPips ?? 0,
        );
        const input = shieldInputResultFor(
            this.#ship,
            [...this.#modules.values()],
            () => this.powerBudget(),
            systemsPips,
            (module) => this.#statsFor(module),
        );
        if (!input.complete) return input;
        return completeResult(shieldMetrics(input.value));
    }

    /**
     * Time for this build's shield to rise after collapse and then regenerate to full.
     *
     * @param options - SYS pips in `[0, 4]`, defaulting to `4`.
     * @returns Recovery rates and seconds, or `null` when no shield generator is powered
     * with hardpoints retracted. Use
     * {@link shieldRecoveryResult} to distinguish the unavailable conditions.
     * Insufficient zero-pip recharge produces `Infinity`.
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
        requireSystemsPips('ShipLoadout.shieldRecovery', options.systemsPips ?? 4);
        return this.shieldRecoveryResult(options).value;
    }

    /**
     * The build's shield recovery with a diagnostic when its hull, generator or
     * retracted power supply is unavailable.
     *
     * @param options - SYS pips in `[0, 4]`, defaulting to `4`.
     * @returns A complete {@link ShieldRecovery} value, otherwise `null` plus the input
     * or fitted-module state that prevented the calculation.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * const result = build.shieldRecoveryResult();
     * if (result.complete) result.value.recoveryTime; // seconds
     * else result.issues[0].reason; // unavailable-state discriminator
     * ```
     */
    shieldRecoveryResult(options: DefenceOptions = {}): CalculationResult<ShieldRecovery> {
        const systemsPips = requireSystemsPips(
            'ShipLoadout.shieldRecoveryResult',
            options.systemsPips ?? 4,
        );
        const input = shieldRecoveryInputResultFor(
            this.#ship,
            [...this.#modules.values()],
            () => this.powerBudget(),
            systemsPips,
            (module) => this.#statsFor(module),
        );
        if (!input.complete) return input;
        return completeResult(shieldRecovery(input.value));
    }

    /**
     * Every fitted shield cell bank and the usable rearmed reinforcement pool.
     *
     * Every fitted bank remains in `banks`, where `powered` says whether it is switched
     * on and its priority group is fed with hardpoints deployed. The totals include only
     * those powered banks, so a build whose plant is switched off or outdrawn reports
     * every bank unpowered and zero totals.
     *
     * @returns A frozen {@link CellBankSummary}; no banks is an empty list and zero totals.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * build.cellBanks().totalRestorable; // -> MJ across every powered fitted cell
     * ```
     */
    cellBanks(): CellBankSummary {
        const modules = [...this.#modules.values()];
        const banks = orderBySlotLayout(
            cellBankInputsFor(modules, this.powerBudget(), (module) => this.#statsFor(module)),
            this.#layout(),
            (bank) => bank.slot,
        );
        return cellBankSummary(banks);
    }

    /**
     * Price the whole build from the catalogues: shop credits, Merc Coin and the
     * engineering materials its modifications consume.
     *
     * No modification is charged twice. A Mercenary article arrives at the grade it was sold at,
     * so only the climb above that grade bills materials and further Merc Coin, and an
     * experimental effect the article came with is free while one added on top is not. A
     * fixed reward article — festive, Guardian, community-goal — identifies a recipe it
     * was never rolled from, so it contributes no materials at all.
     *
     * @returns A frozen {@link BuildCost}. `credits.modules`, `credits.total` and
     * `credits.rebuy` are lower bounds while {@link BuildCredits.unpriced} is non-empty;
     * built-in hull fittings are free rather than unpriced.
     * @remarks
     * This is the one place `ShipLoadout` reads the material and Merc Coin cost
     * catalogues, which is why the facade carries them; import
     * {@link ships/blueprint-costs!getBlueprintCost | getBlueprintCost} and
     * {@link ships/experimental-effect-costs!getExperimentalEffectCost | getExperimentalEffectCost}
     * directly to price one recipe without a build.
     * @example
     * ```ts
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const build = ShipLoadout.default('Anaconda');
     * build.buildCost().credits.hull; // -> 142456440
     * build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
     * build.buildCost().materials.find((material) => material.symbol === 'Arsenic')?.count; // -> 5
     * ```
     * @example
     * ```ts
     * import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const variant = getPreEngineeredVariants('Hpt_Railgun_Fixed_Medium')
     *     .find((candidate) => candidate.acquisition === 'mercenary')!;
     * const build = ShipLoadout.default('Python')
     *     .setPreEngineeredVariant('MediumHardpoint1', variant);
     * build.buildCost().mercCoins; // -> 950
     * ```
     */
    buildCost(): BuildCost {
        const hull = this.#ship.hullCost;
        let modules = 0;
        let mercCoins = 0;
        const unpriced: { slot: string; symbol: string }[] = [];
        const materials: (readonly EngineeringMaterial[])[] = [];
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
            const variant = identifyPreEngineeredVariant(module);
            mercCoins += variant?.mercCoinCost ?? 0;
            const engineering = module.Engineering;
            if (!engineering) continue;
            const grade = engineering.Level;
            const bought = variant?.grade ?? 0;
            // A capture states its own grade, so a value outside the catalogued range is
            // priced as no climb rather than thrown at the consumer reading a total.
            if (Number.isInteger(grade) && grade > bought && grade <= 5) {
                const climb = getBlueprintCost(engineering.BlueprintName, grade, bought);
                if (climb) {
                    materials.push(climb.materials);
                    mercCoins += climb.mercCoins;
                }
            }
            const experimental = engineering.ExperimentalEffect;
            if (
                experimental !== undefined &&
                experimental.toLowerCase() !== variant?.experimental?.toLowerCase()
            ) {
                const cost = getExperimentalEffectCost(experimental);
                if (cost) materials.push(cost);
            }
        }
        return deepFreeze({
            credits: {
                total: hull + modules,
                hull,
                modules,
                rebuy: Math.trunc((hull + modules) * 0.05),
                unpriced,
            },
            mercCoins,
            materials: sumMaterials(...materials),
        });
    }

    /**
     * The build's armour: hull hit points, the bulkhead and reinforcement each
     * contribute, and the effective resistances.
     *
     * @returns The {@link ArmourMetrics}, read off the fitted bulkhead.
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
            armourInputFor(this.#ship, [...this.#modules.values()], (module) =>
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
     * guns.weapons[0]?.maximumRange;        // post-engineering metres, when known
     * guns.weapons[0]?.armourPiercing;      // post-engineering rating, when known
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
                ...(stats.maximumRange === undefined ? {} : { maximumRange: stats.maximumRange }),
                ...(stats.falloffRange === undefined ? {} : { falloffRange: stats.falloffRange }),
                ...(stats.projectileRange === undefined
                    ? {}
                    : { projectileRange: { ...stats.projectileRange } }),
                ...(stats.armourPiercing === undefined
                    ? {}
                    : { armourPiercing: stats.armourPiercing }),
            });
        }
        const orderedWeapons = orderBySlotLayout(weapons, this.#layout(), (weapon) => weapon.slot);
        return {
            weapons: orderedWeapons,
            total: sumWeaponMetrics(
                orderedWeapons.filter((weapon) => weapon.enabled).map((weapon) => weapon.metrics),
            ),
        };
    }

    /**
     * WEP-capacitor recharge and endurance while every powered weapon fires.
     *
     * @param options - WEP pips in `[0, 4]`, defaulting to `4`.
     * @returns Actual recharge, sustained draw, net drain and seconds from full to
     * empty. The deployed power budget is applied to the distributor and weapons, so a
     * module the plant sheds contributes nothing. With no powered distributor, capacity
     * and recharge are zero. A load that draws no more than recharge reports
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
     * All three power-distributor capacitors at selected pip allocations.
     *
     * @param options - SYS, ENG and WEP pips in `[0, 4]`, each defaulting
     * independently to `4`. The allocations need not sum to six, which permits
     * independent comparisons of the three maxima.
     * @returns Capacity, rated four-pip recharge and actual pip-scaled recharge for
     * SYS, ENG and WEP, or `null` when the distributor is switched off, its six
     * capacitor stats cannot be resolved, or the retracted power budget sheds it. That
     * retracted state represents the distributor itself; firing endurance in
     * {@link weaponsCapacitorMetrics} separately applies the deployed state.
     * @throws {RangeError} If any pip allocation is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * declare const build: ShipLoadout;
     * const distributor = build.distributorMetrics({
     *   systemsPips: 2,
     *   enginesPips: 2,
     *   weaponsPips: 2,
     * });
     * distributor?.engines.rechargeRate; // MJ/s
     * ```
     */
    distributorMetrics(options: DistributorOptions = {}): DistributorMetrics | null {
        const pips = {
            systemsPips: options.systemsPips ?? 4,
            enginesPips: options.enginesPips ?? 4,
            weaponsPips: options.weaponsPips ?? 4,
        };
        for (const field of ['systemsPips', 'enginesPips', 'weaponsPips'] as const) {
            const value = pips[field];
            if (!Number.isFinite(value) || value < 0 || value > 4) {
                throw new RangeError(
                    `ShipLoadout.distributorMetrics: ${field} must be a finite number from 0 to 4`,
                );
            }
        }
        const input = distributorInputFor(
            this.#modulesForEffectiveStats(),
            pips,
            this.powerBudget(),
            (module) => this.#statsFor(module),
        );
        return input ? distributorMetrics(input) : null;
    }

    /** The hull's mounts, expanded and cached once per build. */
    #layout(): readonly BuildSlot[] {
        if (this.#layoutCache === undefined) {
            this.#layoutCache = Object.freeze(enumerateSlots(this.#ship));
        }
        return this.#layoutCache;
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

    /** Unladen mass plus the given cargo. */
    #requireMass(cargo: number): number {
        return this.unladenMass + cargo;
    }

    /** Resolve fitted modules into the data-free aggregate-calculation shape. */
    #calculationModules(): readonly LoadoutCalculationModule[] {
        return [...this.#modules.values()].map((module) => ({
            mass: this.#moduleMass(module),
            cargoCapacity: this.#moduleCapacity(module, 'CargoCapacity', 'cargoCapacity'),
            fuelCapacity: this.#moduleCapacity(module, 'FuelCapacity', 'fuelCapacity'),
        }));
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

    /** Stock/base snapshot to use when replacing the fitted engineering block. */
    #engineeringBaseStats(module: LoadoutModule): OutfittingModule | null {
        const fitted = this.#statsFor(module);
        if (!module.Engineering || identifyPreEngineeredVariant(module) === null) return fitted;
        const stock = builtInModuleBySymbol(module.Item, FITTED_ITEM);
        if (!stock) return fitted;
        return fitted?.engineeringLocked
            ? cloneModuleStats({ ...stock, engineeringLocked: true })
            : stock;
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
        this.#slotCache.clear();
    }

    /** Adjust SLEF aggregates by the changed module's contribution. */
    #adjustImportedFigures(
        previous: LoadoutModule | null,
        next: LoadoutModule | null,
        nextStats?: OutfittingModule,
    ): void {
        if (this.#top.UnladenMass !== undefined) {
            this.#top.UnladenMass += this.#moduleMass(next, nextStats) - this.#moduleMass(previous);
        }

        if (this.#top.CargoCapacity !== undefined) {
            this.#top.CargoCapacity +=
                this.#moduleCapacity(next, 'CargoCapacity', 'cargoCapacity', nextStats) -
                this.#moduleCapacity(previous, 'CargoCapacity', 'cargoCapacity');
        }

        if (this.#top.FuelCapacity?.Main !== undefined) {
            const reserve = this.#top.FuelCapacity.Reserve;
            this.#top.FuelCapacity = {
                Main:
                    this.#top.FuelCapacity.Main +
                    this.#moduleCapacity(next, 'FuelCapacity', 'fuelCapacity', nextStats) -
                    this.#moduleCapacity(previous, 'FuelCapacity', 'fuelCapacity'),
                ...(reserve === undefined ? {} : { Reserve: reserve }),
            };
        }

        // Re-fitting the same article does not change its purchase price, even when the
        // supplied stats replace or remove its engineering details.
        if (normalizeKey(previous?.Item, FITTED_ITEM) === normalizeKey(next?.Item, FITTED_ITEM)) {
            return;
        }
        // A cargo hatch is part of the hull and has no purchase price. Normalising its
        // captured identity therefore does not change either credit aggregate. Only
        // repairFixedMount can replace this slot; the ordinary editors reject it.
        if (
            (previous !== null && isCargoHatchSlot(previous.Slot)) ||
            (next !== null && isCargoHatchSlot(next.Slot))
        ) {
            return;
        }

        // No catalogue carries post-purchase module value or rebuy changes.
        delete this.#top.ModulesValue;
        delete this.#top.Rebuy;
    }

    /**
     * A module's post-engineering mass, `0` for no module.
     *
     * @remarks
     * The fixed cargo-hatch slot is always massless, and so is the cockpit or approach
     * suite a capture names in a mount no outfitting screen shows. Every other fitted
     * article resolves — {@link setModule} refuses a symbol no catalogue carries and
     * import drops one — so its engineering modifier or record states the mass.
     */
    #moduleMass(module: LoadoutModule | null, statsOverride?: OutfittingModule): number {
        if (module === null) return 0;
        if (isCargoHatchSlot(module.Slot)) return 0;
        const modified = getLoadoutModifier(module, 'Mass');
        if (modified !== null) return modified;
        return (statsOverride ?? this.#statsFor(module))?.mass ?? 0;
    }

    /**
     * A fitted module's post-engineering cargo/fuel capacity, `0` for anything that
     * carries neither — the cargo hatch and every module that is not a rack or a tank.
     */
    #moduleCapacity(
        module: LoadoutModule | null,
        modifierLabel: 'CargoCapacity' | 'FuelCapacity',
        field: 'cargoCapacity' | 'fuelCapacity',
        statsOverride?: OutfittingModule,
    ): number {
        if (module === null) return 0;
        if (isCargoHatchSlot(module.Slot)) return 0;
        const modified = getLoadoutModifier(module, modifierLabel);
        if (modified !== null) return modified;
        return (statsOverride ?? this.#statsFor(module))?.[field] ?? 0;
    }

    /** Find the fitted FSD together with the record that identified it. */
    #frameShiftDrive(): { module: LoadoutModule; stats: OutfittingModule } | undefined {
        for (const m of this.#modules.values()) {
            const stats = this.#statsFor(m);
            if (stats?.slot === 'frameShiftDrive') return { module: m, stats };
        }
        return undefined;
    }

    #resolveDrive(): FrameShiftDriveParams | null {
        const fsd = this.#frameShiftDrive();
        if (!fsd) return null;
        const { module: fsdModule, stats: base } = fsd;
        if (base.fuelMul === undefined || base.fuelPower === undefined) {
            // A drive is fitted, but its supplied stats have no jump constants. Fail
            // with a diagnosable message rather than the "no frame shift drive" one the
            // caller would otherwise get.
            throw new TypeError(
                `ShipLoadout: the fitted record for frame shift drive "${truncate(fsdModule.Item)}" has no jump constants`,
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
                `ShipLoadout: the fitted record for frame shift drive "${truncate(fsdModule.Item)}" has no ${missing.join(' or ')}`,
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
            // A booster is whatever supplies a jump bonus. `engineeringGroup` says only
            // which recipes may touch the article, and it is a field a caller-supplied
            // record is free to leave `null`; reading the bonus itself keeps such a
            // record from contributing its mass while its boost goes uncounted. A `0`
            // bonus is not evidence of one, though — the first match wins below, so
            // believing it would let an unrelated record shadow a real booster.
            if (
                stats?.engineeringGroup !== 'fsdBoosters' &&
                (stats?.jumpBoost === undefined || stats.jumpBoost === 0)
            ) {
                continue;
            }
            if (m.On === false) continue; // an unpowered booster gives no bonus
            if (stats?.jumpBoost === undefined) {
                throw new TypeError(
                    `ShipLoadout: the fitted record for FSD booster "${truncate(m.Item)}" has no jumpBoost`,
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
