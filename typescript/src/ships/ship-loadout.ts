/**
 * {@link ShipLoadout} — a mutable fitted-ship model that **holds and edits** a build.
 *
 * Load one from a SLEF export or a journal `Loadout` event, or start from a
 * {@link ShipLoadout.default | default} or {@link ShipLoadout.empty | empty} hull, then
 * enumerate its {@link ShipLoadout.slots | slots} and fit modules. Edits change the
 * build in place and return `this`; everything a query returns is a deeply frozen
 * snapshot, so query again after an edit rather than re-reading an earlier value.
 *
 * **What a build *calculates* lives next door.** Jump range, mass, cost, power, heat,
 * mobility, shields, armour and firepower are on
 * {@link ships!BuildMetrics | BuildMetrics}, over the same build:
 * `BuildMetrics.of(build).maxJumpRange()`.
 *
 * **Slot keys are matched case-insensitively, with surrounding whitespace ignored.**
 * Frontier writes `FrameShiftDrive`, a SLEF producer may write `frameshiftdrive`, and
 * both name the same mount. A build's own spelling is never rewritten, so re-exporting
 * an import returns it untouched.
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
 * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * // Read a build:
 * const build = ShipLoadout.fromSlef(slefJsonString);
 * BuildMetrics.of(build).maxJumpRange(); // -> 89.41  (best single jump, one jump's fuel, no cargo)
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
import { singleJumpRange, type FrameShiftDriveParams } from './jump-range.js';
import { getShipBySymbol, type Ship } from './ships.js';
import { getDefaultLoadout } from './default-loadouts.js';
import { enumerateSlots, parseSlotName, type BuildSlot, type SlotKind } from './slots.js';
import { computeModifiers } from './engineering.js';
import { getBlueprintGrade } from './blueprints.js';
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
    isCargoHatchSlot,
    isNonOutfittingSlot,
    matchingKeyIn,
    ownKeyIn,
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
    rolledOverFixedArticle,
    statesInertModifiers,
} from './internal/loadout-engineering.js';
import { builtInModuleBySymbol } from './internal/module-symbol-index.js';
import { effectiveModule } from './internal/loadout-metrics.js';
import { ammunitionCapacity } from './ammunition.js';
import { publishLoadoutInternals } from './internal/loadout-internals.js';
import {
    getPreEngineeredJournalModifiers,
    getPreEngineeredModifiers,
    getPreEngineeredStats,
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
import { fixedSlotReason, stockedMountKind } from './internal/loadout-slot-rules.js';
import { moduleFitError, moduleFitProblem } from './internal/loadout-fitting.js';
import { exportLoadoutEvent } from './internal/loadout-export.js';
import {
    normalizeLoadoutEvent,
    preEngineeredVariantFor,
    type ImportedLoadoutState,
    type ImportedTopFigures as TopFigures,
} from './internal/loadout-import.js';
import type { SourcePurchaseRecord } from './source-purchase.js';
import { deepFreeze } from '../internal/deep-freeze.js';
import { CATALOGUE_KEY, normalizeKey } from '../internal/registry-index.js';
import {
    describeValue,
    requireString,
    requireStringIfPresent,
    truncate,
} from '../internal/argument-guards.js';
import {
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
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

/**
 * How a build's *own* slot key is named when it is not a string.
 *
 * @remarks
 * Every consumer key and every stored key is compared through
 * {@link normalizeKey}, which trims and folds case, so the documented "identifiers are
 * matched case-insensitively, with surrounding whitespace ignored" rule holds on both
 * sides of the comparison. A stored key can only reach it as a string — import checks
 * it — so this label names a failure the build's own state would have to cause.
 */
const FITTED_SLOT = 'ShipLoadout: fitted module Slot';

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
    /** The experimental (special) effect's Frontier symbol, if any. */
    readonly experimentalEffectSymbol?: string;
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
    /** Effect symbol before the edit, or `null` when none was present. */
    readonly previousExperimentalEffectSymbol: string | null;
    /** Effect symbol after the edit, or `null` when it was removed. */
    readonly experimentalEffectSymbol: string | null;
}

/** Effect-only edit that requested the fitted module's current effect. */
export interface ExperimentalEffectUnchanged {
    /** Discriminator for a no-op edit. */
    readonly kind: 'unchanged';
    /** Current effect symbol, or `null` when none is present. */
    readonly experimentalEffectSymbol: string | null;
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
    /**
     * Quality reported by the fitted module before normalization, in `[0, 1]`. A block
     * that stated no modifiers still reports the quality it stated, so this reads `1` for
     * a completed roll whose figures this call was the first to spell out.
     */
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

/**
 * Keep a mass only where it can be weighed.
 *
 * @remarks
 * A capture states its own `UnladenMass`, and an engineering modifier its own value;
 * {@link ShipLoadout.fromLoadout} copies both without judging them, so either can reach
 * a report as a negative, a `NaN` or an `Infinity`. {@link validateLoadout} refuses a
 * figure it cannot weigh, and a refusal is the wrong answer from the one method whose
 * job is to *describe* what is wrong with a build. Drop the figure instead and check
 * the structure alone; a mass nobody can weigh is still reported, as a thrown figure,
 * by whichever metric goes on to read it.
 *
 * @param tonnes - The stated figure, or `undefined` where none was stated.
 * @returns The figure when it is a finite number of zero or more, otherwise `undefined`.
 */
function weighable(tonnes: number | undefined): number | undefined {
    return tonnes !== undefined && Number.isFinite(tonnes) && tonnes >= 0 ? tonnes : undefined;
}

/** A blueprint candidate for a module symbol, with its grades and availability route. */
export interface AvailableBlueprint {
    /** The blueprint's Frontier symbol, e.g. `"FSD_LongRange"`. */
    readonly blueprintSymbol: string;
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
 * ## Member index
 *
 * - **Construct** — {@link fromSlef}, {@link fromLoadout}, {@link empty},
 *   {@link default}. The constructor is private; every build starts at one of these four.
 * - **Inspect** — {@link shipSymbol}, {@link shipName}, {@link shipIdent},
 *   {@link unladenMass}, {@link cargoCapacity}, {@link fuelCapacity}, {@link hullValue},
 *   {@link modulesValue}, {@link rebuy}, {@link sourcePurchase}, {@link importOutcomes},
 *   {@link slots}, {@link fittedModuleAt}, {@link fittedModules},
 *   {@link modulesForSlot}, {@link availableBlueprints},
 *   {@link availableExperimentalEffects}, {@link validation | validation()}.
 * - **Edit** — {@link setModule}, {@link removeModule}, {@link repairFixedMount},
 *   {@link applyBlueprint}, {@link setExperimentalEffect},
 *   {@link completeEngineeringGrade}, {@link setPreEngineeredVariant},
 *   {@link clearEngineering}, {@link setModuleEnabled}, {@link setModulePriority}. Each
 *   returns `this` unless it reports a result of its own.
 * - **Analyse** — not here. Jump range, mass, cost, power, heat, mobility, shields,
 *   armour and firepower live on
 *   {@link ships!BuildMetrics | BuildMetrics}, which reads this build:
 *   `BuildMetrics.of(build).maxJumpRange()`. The split lets an outfitting editor import
 *   the editors without the calculations, and a viewer the calculations without the
 *   editors.
 * - **Export** — {@link toLoadoutEvent}, {@link toSlef}, {@link toSlefString}.
 *
 * ## Properties against methods
 *
 * **A property is a fact this build already carries; a method does something.** Every
 * getter above is an identity, an aggregate figure, or what a capture stated — it
 * computes nothing, takes no options, and never throws. Everything that does work is a
 * call: reading the catalogues, enumerating mounts, editing the fit, exporting it, and
 * every figure on {@link ships!BuildMetrics | BuildMetrics}.
 *
 * The rule makes the split predictable, not harmless. Two of those calls take no
 * argument and read like facts — {@link validation | validation()}, which revalidates
 * the whole fit, and {@link fittedModules | fittedModules()}, which allocates and
 * deeply freezes a fresh snapshot on every call — so they are methods by the rule above
 * even though a reader may reach for them as properties. **A forgotten `()` still hands
 * you the function rather than the value**, and in plain JavaScript nothing complains:
 * `build.fittedModules` is a function reference, `build.fittedModules()` is the list.
 * TypeScript catches it; a `.js` consumer will not.
 *
 * @example
 * Read a build a player already flies, and ask it what an outfitting screen shows.
 * Every figure below is one build's — a Krait Phantom explorer. Figures the capture
 * already stated — `unladenMass` here — are trusted verbatim while the fit they
 * describe survives import; the rest are computed from the fit.
 *
 * ```ts
 * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
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
 * const metrics = BuildMetrics.of(build);
 * metrics.maxJumpRange(); // -> 60.5478   (ly, best single jump)
 * metrics.powerBudget().withinBudget; // -> true
 * metrics.shieldMetricsResult().value?.strength; // -> 743.12  (MJ)
 * metrics.armourMetrics().hitPoints; // -> 307.8
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
        // The one channel the build metrics read this state through — see
        // `./internal/loadout-internals`. Nothing public is added by publishing it.
        publishLoadoutInternals(this, {
            ship,
            modules: () => [...this.#modules.values()],
            effectiveModules: () => this.#modulesForEffectiveStats(),
            effectiveModule: (module) => this.#moduleForEffectiveStats(module),
            statsFor: (module) => this.#statsFor(module),
            layout: () => this.#layout(),
            resolveDrive: () => this.#resolveDrive(),
            frameShiftDriveModule: () => this.#frameShiftDrive()?.module,
            calculationModules: () => this.#calculationModules(),
            statedMainFuel: () => this.#top.FuelCapacity?.Main,
        });
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
     * {@link importOutcomes} for modules that were emptied or defaulted, and for stated
     * engineering it could not resolve.
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
     * **A recipe stated without `Modifiers` is rolled.** A journal writes the modifier
     * block beside the recipe, but SLEF permits stating the recipe alone and Inara does,
     * so such a block is materialised here at the grade and quality it states — otherwise
     * the module would report that it is engineered while publishing the figures of one
     * that is not. Where the module's own engineering menu offers the recipe, the block
     * is read as an ordinary roll of it, even if a fixed article of that module carries
     * the same blueprint at the same grade — a reading {@link importOutcomes} reports as
     * `ambiguousEngineering`, carrying the article passed over so
     * {@link setPreEngineeredVariant} can take the other one. A Mercenary article is read
     * as its own article at the grade it was bought at, and as that purchase climbed by
     * its bespoke recipe above it. Where the menu does not offer the recipe, no ordinary
     * roll could have written the block, so a single catalogued article answering to it
     * is fitted. Where neither answers, the module keeps unengineered figures and
     * {@link importOutcomes} reports the slot as `unresolvedEngineering`.
     *
     * **A stated modifier block that moves nothing is replaced by the roll.** A block
     * naming only stats the module has no value for describes some other module, and
     * preserving it would publish unengineered figures under an engineered block, so the
     * recipe stated beside it is rolled instead and the slot is reported as
     * `rerolledEngineering`. Every block that moves at least one stat this module carries
     * stays exactly as the source wrote it: a capture's own figures are what the game
     * reported, and outrank anything recomputed here.
     *
     * Modules are imported as one complete snapshot, so their order does not affect
     * per-ship count allowances. An entry stands as the event stated it when the mount
     * can hold the article the catalogue resolves, when its slot is a known cosmetic or
     * hull-geometry key (`PaintJob`, `ShipCockpit`, a numbered decal, …), or when it is
     * the built-in cargo hatch. Everything else is normalized, and every change is
     * recorded by {@link importOutcomes}: an unresolved module in a removable mount is
     * discarded, while armour, the seven core internals, the cargo hatch and the
     * planetary approach suite are filled from the hull defaults whenever the event left
     * no article that mount can hold — an unresolved symbol, a resolved one the mount
     * refuses, and no entry at all are corrected alike, each keeping the source's `On`,
     * `Priority` and `Health`. Every other removable mount may stand empty, so an article
     * *it* refuses stays where the event put it and is reported by
     * {@link validation | validation()} instead.
     *
     * **The approach suite is stocked because silence about it is not a decision.** Every
     * hull is supplied with the advanced suite, which is weightless and draws no power, so
     * no build gains by shedding one — while an exporter that carries no such mount, as
     * Inara does not, writes no entry for it either. The suite therefore joins the mounts
     * an absent entry fills rather than empties. It stays removable afterwards, so a build
     * that really does fly without one is one {@link removeModule} away.
     *
     * Normalization makes the captured aggregates untrustworthy, so they are dropped:
     * {@link unladenMass}, {@link cargoCapacity} and {@link fuelCapacity} are recomputed
     * from the fit that remains, {@link modulesValue} and {@link rebuy} read `null`, and
     * {@link sourcePurchase} still reports what the capture stated. A mount stocked from
     * *absence* is the exception and every figure stands: the bulkhead and the cargo hatch
     * are free and weightless, and the approach suite is weightless and costs 500 Cr — the
     * cheapest price in the catalogue, and no reason to drop a commander's whole purchase
     * record, so the credit figures may understate the fit by that much and no more.
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
        const outcomes = [...imported.outcomes];
        const loadout = new ShipLoadout(
            ship,
            imported.shipSymbol,
            imported.modules,
            imported.top,
            imported.sourcePurchase,
            imported.moduleStats,
            imported.primitiveModifiers,
            outcomes,
        );
        const { UnladenMass, CargoCapacity, FuelCapacity } = imported.top;
        // `outcomes` is still the array the constructor stored, so a recipe that cannot
        // be rolled joins the import's own report before anything can read it.
        for (const module of [...imported.modules.values()]) {
            const unresolved = loadout.#rollStatedRecipe(module);
            if (unresolved !== null) outcomes.push(unresolved);
        }
        // A roll spells out figures the capture already counted, so the aggregates it
        // stated stand. The editor path the roll goes through carries the mass and
        // capacity bookkeeping an edit needs, which here would subtract the engineering
        // delta a second time from a figure the game weighed with it in place.
        if (UnladenMass !== undefined) loadout.#top.UnladenMass = UnladenMass;
        if (CargoCapacity !== undefined) loadout.#top.CargoCapacity = CargoCapacity;
        if (FuelCapacity !== undefined) loadout.#top.FuelCapacity = FuelCapacity;
        deepFreeze(outcomes);
        return loadout;
    }

    /**
     * Roll a stated recipe whose source wrote no `Modifiers`, over the imported module.
     *
     * A journal writes the modifier block beside the recipe; SLEF permits stating the
     * recipe alone, and Inara does. Left as stated, every figure the module publishes
     * would be the unengineered one while the module reports that it is engineered, so
     * the recipe is rolled here at the stated grade and quality.
     *
     * A slot the import already resolved to a catalogued article keeps that article's
     * stats: a fixed identity is not a recipe, and rolling one over it would fold the
     * same figures in twice. A Mercenary article is the exception once the block states a
     * grade above the one it was bought at, because its bespoke recipe is exactly how it
     * climbs — at its purchase grade there is nothing to roll and its stats stand.
     *
     * A block that *does* state modifiers describes the module itself and is left alone,
     * with one exception: one whose every label names a stat this module has not, and
     * which identified no catalogued article, moves nothing at all. Preserving it would
     * publish unengineered figures under an engineered block, so the recipe beside it is
     * rolled and the import reports `rerolledEngineering`.
     *
     * @returns The outcome to report about this slot, or `null`.
     */
    #rollStatedRecipe(module: LoadoutModule): LoadoutImportOutcome | null {
        const engineering = module.Engineering;
        if (!engineering || typeof engineering.BlueprintName !== 'string') return null;
        const stated = engineering.Modifiers;
        const stats = this.#statsFor(module);
        if (
            stated !== undefined &&
            (this.#moduleStats.has(module.Slot) ||
                stats === null ||
                !statesInertModifiers(stats, stated))
        ) {
            return null;
        }
        if (stated === undefined && this.#moduleStats.has(module.Slot)) {
            const variant = preEngineeredVariantFor(module);
            if (variant?.acquisition !== 'mercenary' || engineering.Level <= variant.grade) {
                return null;
            }
        }
        try {
            this.applyBlueprint(module.Slot, engineering.BlueprintName, {
                grade: engineering.Level,
                quality: engineering.Quality ?? 1,
                ...(typeof engineering.ExperimentalEffect === 'string'
                    ? { experimentalEffectSymbol: engineering.ExperimentalEffect }
                    : {}),
            });
            if (stated !== undefined) {
                return {
                    action: 'rerolledEngineering',
                    slot: module.Slot,
                    sourceSymbol: module.Item,
                    blueprintSymbol: engineering.BlueprintName,
                };
            }
            // Both readings of a bare identity are legitimate wherever the menu offers the
            // recipe a fixed article also carries. The roll is what nearly every such
            // block is, so it stands — but the choice is reported rather than made in
            // silence, and the article it passed over comes with it.
            const passedOver = rolledOverFixedArticle(module.Item, engineering);
            return passedOver === null
                ? null
                : {
                      action: 'ambiguousEngineering',
                      slot: module.Slot,
                      sourceSymbol: module.Item,
                      blueprintSymbol: engineering.BlueprintName,
                      preEngineeredVariant: passedOver,
                  };
        } catch (error) {
            // Every refusal here is a recipe this module cannot roll: an unknown or
            // unoffered blueprint or experimental effect, a grade or quality outside the
            // recipe, or a base stat the catalogue does not carry. The block stands as
            // the source stated it, and the figures stay stock — which is what the
            // outcome says. Anything else thrown out of the calculator is a defect, and
            // is not laundered into one.
            if (!(error instanceof TypeError) && !(error instanceof RangeError)) throw error;
            return {
                action: 'unresolvedEngineering',
                slot: module.Slot,
                sourceSymbol: module.Item,
                blueprintSymbol: engineering.BlueprintName,
            };
        }
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
        // The mounts a build cannot fly without, from the same hull defaults import
        // stocks them from. Import stocks the approach suite too; this factory leaves it
        // open along with every other optional mount.
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
     * stock.validation().complete; // -> true
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
     * keeps the captured figure and {@link ships!BuildMetrics.buildCost | BuildMetrics.buildCost} prices the current fit.
     */
    get modulesValue(): number | null {
        return this.#top.ModulesValue ?? null;
    }

    /**
     * Insurance rebuy cost in credits represented by the build, or `null` if
     * unknown. Discarded by an edit or by import normalization for the same reason as
     * {@link modulesValue}, and likewise kept by {@link sourcePurchase};
     * {@link ships!BuildMetrics.buildCost | BuildMetrics.buildCost} rebuys the current fit at catalogue prices instead.
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
     * What the import made of this build: the changes it applied, in source order,
     * followed by the mounts stocked from the hull defaults because the source named
     * none, in the defaults' own order, followed by what it made of each module's
     * stated engineering.
     *
     * @returns A deeply frozen list. It is empty for builds created with
     * {@link ShipLoadout.empty} or {@link ShipLoadout.default}, and for imports that
     * needed no normalization and read every stated recipe unambiguously.
     * @remarks
     * Each entry names the exact slot, and the source identity where the source gave one.
     * `emptied` means an unknown module was removed from a removable mount; `defaulted`
     * names the stock article fitted to armour, a core internal, the cargo hatch or the
     * planetary approach suite, with a `null` `sourceSymbol` when the source named
     * nothing there at all.
     * `rerolledEngineering` names a module whose stated `Modifiers` moved no stat it
     * carries, so the recipe beside them was rolled in their place.
     *
     * Two entries report no change to the fit at all. `unresolvedEngineering` means the
     * source stated a recipe and no `Modifiers`, nothing the catalogues carry answers to
     * it, and that module alone keeps the figures of an unengineered one.
     * `ambiguousEngineering` means such a block had *two* answers — an ordinary roll and
     * a catalogued fixed article — and carries the article that was passed over, ready
     * for {@link setPreEngineeredVariant} (see {@link ShipLoadout.fromLoadout}).
     */
    get importOutcomes(): readonly LoadoutImportOutcome[] {
        return this.#importOutcomes;
    }

    /**
     * Structural validity and operational completeness of this build.
     *
     * @remarks
     * `valid` asks whether the fit is legal: a module in a nonexistent or incompatible
     * slot, a duplicated exclusive family, a module count past the build's allowance, or
     * a ship heavier than its own thrusters can move makes it `false`. `complete` asks
     * that *and* whether armour and the seven core mounts are filled — every build fills
     * those, so on a build the two answers agree. Neither question reports import
     * normalization, so read {@link importOutcomes} beside them.
     *
     * The thruster rule weighs the fitted thrusters' post-engineering `maxMass` against
     * what the ship comes to at each load it can reach without being re-fitted:
     * {@link unladenMass} alone, then with a full {@link fuelCapacity | main tank}, then
     * with a full {@link cargoCapacity | hold} as well. The lightest of those that is
     * already too heavy is what gets reported. A ship that cannot move on a full tank is
     * an error — it never leaves the pad, where the tank always is one — while a ship
     * that only fails with the hold full is a warning, and leaves the build valid and
     * complete: how much cargo to take is the pilot's call. Either way
     * {@link ships!BuildMetrics.mobilityMetricsResult | BuildMetrics.mobilityMetricsResult} reports
     * a speed of zero at the load in question.
     *
     * A capture may state a mass nobody can weigh — a negative `UnladenMass`, or an
     * engineering modifier that drives a rating below zero. Neither is refused here:
     * this method reports a build rather than rejecting one, so an unweighable figure is
     * left out and the rule it feeds simply does not run. The figure itself is still
     * reported, as a thrown one, by whichever {@link ships!BuildMetrics | BuildMetrics}
     * calculation reads it.
     *
     * @returns The validation report, recomputed from the current fit on every call.
     */
    validation(): LoadoutValidation {
        const slots = this.#layout();
        const byKey = new Map(slots.map((slot) => [normalizeKey(slot.key, CATALOGUE_KEY), slot]));
        const modules: ValidationModule[] = [...this.#modules.values()].map((module) => {
            const stats = this.#statsFor(module);
            const slot = byKey.get(normalizeKey(module.Slot, FITTED_SLOT));
            const builtIn =
                (stats === null && isNonOutfittingSlot(module.Slot)) || isBuiltInHullModule(module);
            const fitProblem =
                stats && slot && !builtIn ? moduleFitProblem(this.#shipSymbol, slot, stats) : null;
            // A shield generator carries a `maxMass` of its own, so the rating is read
            // only off the article the mount says is the thrusters.
            const thrusterMaxMass = weighable(
                stats?.slot === 'thrusters'
                    ? effectiveModule(this.#moduleForEffectiveStats(module), stats)?.maxMass
                    : undefined,
            );
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
                ...(thrusterMaxMass === undefined ? {} : { thrusterMaxMass }),
            };
        });
        const dry = weighable(this.unladenMass);
        const fuel = weighable(this.fuelCapacity.main);
        const cargo = weighable(this.cargoCapacity);
        const mass =
            dry === undefined
                ? undefined
                : {
                      dry,
                      ...(fuel === undefined ? {} : { fuel }),
                      ...(fuel === undefined || cargo === undefined ? {} : { cargo }),
                  };
        return validateLoadout({
            shipSymbol: this.#shipSymbol,
            slots,
            modules,
            ...(mass === undefined ? {} : { mass }),
        });
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
            preEngineeredVariant: preEngineeredVariantFor(raw),
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
     * build.availableBlueprints('FrameShiftDrive').map(({ blueprintSymbol }) => blueprintSymbol);
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
     * @remarks
     * This is the outfitting *offer*, so the fifteen {@link ships!OutfittingModule.grantOnly | grantOnly}
     * articles are never in it: each is a second identity for a module the game already
     * sells — `Int_Engine_Size2_Class1_free` is the 2E Thrusters — and listing both puts
     * the same article on the screen twice, once with no price. A build that already
     * carries one keeps it; only the choices are filtered.
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
                if (
                    normalizeKey(fitted.Slot, FITTED_SLOT) === normalizeKey(slot.key, CATALOGUE_KEY)
                )
                    return [];
                const group = this.#statsFor(fitted)?.exclusionGroup;
                return group === undefined ? [] : [group];
            }),
        );
        const currentLimits = this.#moduleLimits();
        const currentStats = this.#moduleStatsAt(slot.key);
        return ALL_MODULES.filter(
            (module) =>
                module.grantOnly === undefined &&
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
        const wanted = normalizeKey(requested, SLOT_KEY);
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
            (module) => normalizeKey(module.slot, CATALOGUE_KEY) === wanted,
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
                    normalizeKey(fitted.Slot, FITTED_SLOT) !==
                        normalizeKey(slot.key, CATALOGUE_KEY) &&
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
        const wanted = normalizeKey(slotKey, SLOT_KEY);
        if (wanted === 'cargohatch') {
            throw new LoadoutEditError(
                'ShipLoadout.removeModule: the cargoHatch slot cannot be changed',
                'immutableSlot',
                { slot: 'CargoHatch' },
            );
        }
        const parsed = parseSlotName(slotKey);
        const slot = this.#layout().find(
            (candidate) => normalizeKey(candidate.key, CATALOGUE_KEY) === wanted,
        );
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
     * @param blueprintSymbol - The blueprint recipe's Frontier symbol, e.g. `"FSD_LongRange"`.
     * @param options - {@link ApplyBlueprintOptions}: `grade` (1–5), optional `quality`
     * (0–1, default 1), and optional `experimental` effect symbol. A nullish
     * `experimental` means no effect, the same as leaving it out. Each is read once,
     * before anything is checked, so an accessor cannot answer the check and the use
     * differently.
     * @returns `this`, for chaining.
     * @throws {RangeError} If the slot is empty, or the blueprint/grade/experimental is
     * unknown, or `quality` is outside `[0, 1]`.
     * @throws {TypeError} If `slotKey` or `blueprintSymbol` is not a string, `options` is not an
     * object, or `options.experimentalEffectSymbol` carries a value that is not a string — a nullish
     * one is no effect, not a wrong type. Also if the fitted module has no stats to
     * engineer, is final and accepts no further engineering, is not offered the blueprint
     * by its own menu, is not offered the experimental effect by it, or the id names a
     * fixed event-reward identity rather than a craftable recipe — use
     * {@link setPreEngineeredVariant} for those. Finally, if the catalogue does not carry
     * every base stat the recipe modifies: incomplete engineering is rejected rather than
     * stored as a partial journal modifier block.
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
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
     *          experimentalEffectSymbol: 'special_fsd_heavy',
     *      });
     * BuildMetrics.of(build).maxJumpRange(); // uses the engineered optimal mass
     * ```
     */
    applyBlueprint(slotKey: string, blueprintSymbol: string, options: ApplyBlueprintOptions): this {
        // Both ids are checked before the build's state, so a wrong-typed one is named
        // rather than reported as whatever the slot happened to hold — and named here
        // rather than by whichever catalogue lookup reaches it first.
        requireString(blueprintSymbol, 'ShipLoadout.applyBlueprint: blueprintSymbol');
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
        const wantedExperimental = options.experimentalEffectSymbol ?? undefined;
        requireStringIfPresent(
            wantedExperimental,
            'ShipLoadout.applyBlueprint: options.experimentalEffectSymbol',
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
        const recipe = resolveBlueprintForModule(module.Item, blueprintSymbol);
        // Name both spellings once they differ, so an error about the recipe this module
        // rolls cannot read as an error about the id the caller passed.
        const named =
            recipe === blueprintSymbol
                ? `"${truncate(blueprintSymbol)}"`
                : `"${truncate(blueprintSymbol)}" (${truncate(recipe)} on this module)`;
        // A festive fixed variant reaches this method as a real journal identity that
        // names no craftable recipe. It is fitted as a pre-engineered variant, not applied
        // to an arbitrary stock module.
        const written = blueprintSymbol.trim().toLowerCase();
        const resolved = recipe.trim().toLowerCase();
        if (
            getPreEngineeredVariants(module.Item).some(
                (variant) =>
                    variant.acquisition === 'eventReward' &&
                    (variant.blueprintSymbol.toLowerCase() === written ||
                        variant.blueprintSymbol.toLowerCase() === resolved),
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
        if (!blueprintAvailableFor(module.Item, blueprintSymbol)) {
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
            BlueprintName: blueprintSymbol,
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
     * A Mercenary article is recomputed rather than composed, and that limits what can be
     * done to the effect ten of those rows are sold carrying. At its purchase grade there
     * is no recipe to recompute from — the bespoke recipe starts at grade 2 — so every
     * edit is refused with `unsupportedEngineering`. Once engineered to grade 2 or above
     * an edit recomputes normally, but only to an effect the module's own menu offers:
     * the Merc Mining Laser's Incendiary Rounds is not one, so re-stating it is refused
     * with `unsupportedExperimentalEffect`. Both refusals are lossless like any other, and
     * the baked effect stays where it is.
     *
     * @param slotKey - The engineered slot, matched case-insensitively.
     * @param experimental - Experimental-effect symbol, or `null` to remove the effect.
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
            return deepFreeze({ kind: 'unchanged', experimentalEffectSymbol: previous });
        }

        const variant = preEngineeredVariantFor(module);
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
            // Only where the fixed-article branch below will handle it. A Mercenary
            // article is recomputed by `applyBlueprint` instead, which re-checks the menu
            // and throws — so letting an out-of-menu baked effect past this gate would
            // turn a lossless refusal into an exception on ordinary captured data.
            const restoresBakedEffect =
                variant?.experimentalEffectSymbol !== undefined &&
                variant.acquisition !== 'mercenary' &&
                variant.experimentalEffectSymbol.trim().toLowerCase() ===
                    wanted.trim().toLowerCase();
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

            const { experimentalEffectSymbol: originalEffect, ...withoutEffect } = variant;
            void originalEffect;
            const adjusted: PreEngineeredVariant =
                wanted === null
                    ? withoutEffect
                    : { ...withoutEffect, experimentalEffectSymbol: wanted };
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
                ...(wanted === null ? {} : { experimentalEffectSymbol: wanted }),
            });
        }

        return deepFreeze({
            kind: 'updated',
            previousExperimentalEffectSymbol: previous,
            experimentalEffectSymbol: wanted,
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
     * A block that names a blueprint and grade but states no `Modifiers` at all is rolled
     * here too, even at quality `1`, so a completed roll cannot stay stock. On an imported
     * build such a block is one {@link ShipLoadout.fromLoadout} did not roll: a catalogued
     * article it fitted instead, whose fixed modifiers this spells out unless the article
     * is final; a Mercenary article that moves nothing it can state — the purchase
     * pre-engineering no registry publishes, with no baked effect over it — which this
     * refuses; or a recipe nothing answered to, which this refuses for the reason the
     * import could not roll it. A stated modifier array, empty or partial, is left alone
     * at quality `1`, so a Mercenary article whose baked effect does move a stat answers
     * `unchanged`: it arrives at quality `1` already stating everything it moves.
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
        // A completed roll that states its modifiers is already whole. One that states
        // none has nothing to keep, so it is rolled from the recipe rather than left
        // stock.
        if (engineering.Quality === 1 && engineering.Modifiers !== undefined) {
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
        const variant = preEngineeredVariantFor(module);
        // Mercenary excluded for the reason given in `setExperimentalEffect`: its recompute
        // runs through `applyBlueprint`, which refuses an out-of-menu effect by throwing.
        const restoresBakedEffect =
            variant?.experimentalEffectSymbol !== undefined &&
            variant.acquisition !== 'mercenary' &&
            variant.experimentalEffectSymbol.trim().toLowerCase() ===
                experimental?.trim().toLowerCase();
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

            const { experimentalEffectSymbol: originalEffect, ...withoutEffect } = variant;
            void originalEffect;
            const adjusted: PreEngineeredVariant =
                experimental === null
                    ? withoutEffect
                    : { ...withoutEffect, experimentalEffectSymbol: experimental };
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
                ...(experimental === null ? {} : { experimentalEffectSymbol: experimental }),
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
     * The block states exactly what the article moves, so it always agrees with
     * {@link getPreEngineeredJournalModifiers} for the same variant, and the module's
     * {@link FittedModule.effectiveStats | effectiveStats} resolve to the figures it
     * states — including a rate of fire, which no recipe names and both the block and the
     * stats derive from the article's firing cycle. A Mercenary variant
     * publishes no fixed stat block of its own, so it keeps the stock catalogue stats
     * apart from its baked experimental effect, and states that effect's modifiers and
     * no others. An article that moves no stat at all carries no `Modifiers` key, rather
     * than an empty array claiming it changes none.
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
     *     .find((variant) => variant.blueprintSymbol === 'Decorative_Red')!;
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
        requireString(
            variant.blueprintSymbol,
            'ShipLoadout.setPreEngineeredVariant: variant.blueprintSymbol',
        );
        requireString(
            variant.acquisition,
            'ShipLoadout.setPreEngineeredVariant: variant.acquisition',
        );
        requireStringIfPresent(
            variant.experimentalEffectSymbol,
            'ShipLoadout.setPreEngineeredVariant: variant.experimentalEffectSymbol',
        );
        const known = getPreEngineeredVariants(variant.symbol).find(
            (candidate) =>
                candidate.blueprintSymbol.toLowerCase() === variant.blueprintSymbol.toLowerCase() &&
                candidate.grade === variant.grade &&
                (candidate.experimentalEffectSymbol?.toLowerCase() ?? '') ===
                    (variant.experimentalEffectSymbol?.toLowerCase() ?? '') &&
                candidate.acquisition === variant.acquisition,
        );
        if (!known) {
            throw new RangeError(
                `ShipLoadout.setPreEngineeredVariant: no catalogued variant "${truncate(variant.blueprintSymbol)}" for module "${truncate(variant.symbol)}"`,
            );
        }
        const stats = getPreEngineeredStats(known)!;
        const unresolved = unresolvedModifiers(known);
        if (unresolved.length > 0) {
            throw new TypeError(
                `ShipLoadout.setPreEngineeredVariant: cannot resolve "${truncate(variant.blueprintSymbol)}" for module "${truncate(variant.symbol)}"; missing base stats for ${unresolved.join(', ')}`,
            );
        }
        this.setModule(slotKey, stats);
        const module = this.#fittedModuleFor(slotKey)!;
        // Whatever the article moves is what it publishes. A Mercenary row carries no
        // stat block of its own, but its baked experimental effect still moves stats, and
        // those belong in the block — a fitted article that states an effect and no
        // `Modifiers` would disagree with `getPreEngineeredJournalModifiers` about the
        // same purchase.
        const journalModifiers = getPreEngineeredJournalModifiers(known);
        const engineering: ModuleEngineering = {
            BlueprintName: known.blueprintSymbol,
            Level: known.grade,
            Quality: 1,
            ...(known.experimentalEffectSymbol === undefined
                ? {}
                : { ExperimentalEffect: known.experimentalEffectSymbol }),
            ...(journalModifiers.length > 0 ? { Modifiers: journalModifiers } : {}),
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
     * outfitting panel — and {@link ships!BuildMetrics.powerBudget | BuildMetrics.powerBudget}'s `bands[].priority` — number the same
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
                // nothing, and a stocked approach suite 500 Cr — too little to be worth
                // voiding a purchase record over — so none of the three moves the totals.
                sourceTotalsVoided: this.#importOutcomes.some((outcome) => {
                    if (outcome.sourceSymbol !== null) return false;
                    const parsed = parseSlotName(outcome.slot);
                    // Asked through the same classifier import stocks by, so the two
                    // cannot drift apart over which mounts it fills.
                    return parsed !== null && stockedMountKind(parsed) === 'core';
                }),
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

    /** The hull's mounts, expanded and cached once per build. */
    #layout(): readonly BuildSlot[] {
        if (this.#layoutCache === undefined) {
            this.#layoutCache = Object.freeze(enumerateSlots(this.#ship));
        }
        return this.#layoutCache;
    }

    #requireSlot(slotKey: string): BuildSlot {
        const wanted = normalizeKey(slotKey, SLOT_KEY);
        const slot = this.#layout().find((s) => normalizeKey(s.key, CATALOGUE_KEY) === wanted);
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
        return matchingKeyIn(this.#modules, normalizeKey(slotKey, SLOT_KEY));
    }

    /** The module fitted in `slotKey`, or `undefined` when the slot is empty. */
    #fittedModuleFor(slotKey: string): LoadoutModule | undefined {
        const key = this.#fittedKey(slotKey);
        return key === null ? undefined : this.#modules.get(key);
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
        if (!module.Engineering || preEngineeredVariantFor(module) === null) return fitted;
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
