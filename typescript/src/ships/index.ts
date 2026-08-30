/**
 * Ship and outfitting data for Elite Dangerous — Frontier's shipyard and outfitting
 * registries.
 *
 * This entry point re-exports the ships feature area. Every symbol is also reachable
 * from its own module, so bundlers can drop anything you do not use.
 *
 * **Working with a whole build? Start with {@link ShipLoadout}** — it reads a SLEF
 * export ({@link ShipLoadout.fromSlef}) or a journal `Loadout` event
 * ({@link ShipLoadout.fromLoadout}), writes either back out
 * ({@link ShipLoadout.toSlefString}, {@link ShipLoadout.toLoadoutEvent}), fits modules
 * and applies engineering, and carries the figures a capture stated (`unladenMass`,
 * `rebuy`) — keeping what a capture said it *paid* apart from what the build is worth at
 * retail ({@link ShipLoadout.sourcePurchase}). **{@link BuildMetrics} is the other
 * half**: `BuildMetrics.of(build)` answers the questions apps actually ask
 * ({@link BuildMetrics.maxJumpRange}, {@link BuildMetrics.powerBudget},
 * {@link BuildMetrics.shieldMetricsResult}), so an editor need not import the calculations nor
 * a viewer the editors. Together they are the batteries-included facade and pull in
 * every catalogue; everything below is what they are built from, so drop to the pieces
 * when you need one answer rather than a whole ship.
 *
 * The area has five layers:
 *
 * - **Ships** — {@link SHIPS} and the {@link getShipBySymbol} / {@link getShipByName}
 *   lookups; each {@link Ship} carries the hull's identity, stats and slot layout
 *   together. {@link SHIP_GUNSIGHTS} and {@link projectGunsight} place a hull's fixed
 *   mounts at any target range, and the
 *   {@link ships/default-loadouts!DEFAULT_LOADOUTS | default-loadouts} subpath carries
 *   the stock modules {@link ShipLoadout.default} turns into a live build.
 * - **Modules** — the {@link OutfittingModule} type and the lookups
 *   ({@link getModuleBySymbol} & co.), which search all 1194 modules unless you hand
 *   them a narrower set; capability guards such as {@link hasWeaponDamageStats} narrow
 *   the sparse record before stat access. The catalogues live on explicit subpaths split
 *   by Frontier's four outfitting categories —
 *   {@link ships/modules-core!CORE_MODULES | CORE_MODULES},
 *   {@link ships/modules-internal!INTERNAL_MODULES | INTERNAL_MODULES},
 *   {@link ships/modules-hardpoint!HARDPOINT_MODULES | HARDPOINT_MODULES},
 *   {@link ships/modules-utility!UTILITY_MODULES | UTILITY_MODULES} and
 *   {@link ships/modules-all!ALL_MODULES | ALL_MODULES} — so importing one never bundles
 *   the rest.
 * - **Jump range & SLEF** — {@link frameShiftDriveMassFactor},
 *   {@link singleJumpRange}, {@link fuelPerJump} and {@link totalRange} are pure maths
 *   over {@link FrameShiftDriveParams}; {@link parseSlef} reads an Inara SLEF export — or
 *   a bare journal `Loadout` event — and {@link toSlef} / {@link stringifySlef} write one
 *   back out.
 * - **Build metrics** — the rest of what an outfitting screen shows, each its own
 *   data-free module: {@link powerBudget}, {@link shieldMetrics} and
 *   {@link armourMetrics} (with {@link stackShieldResistance} /
 *   {@link stackArmourResistance} behind their resistances), {@link weaponMetrics},
 *   {@link mobilityMetrics}, {@link shieldRecovery}, {@link distributorMetrics},
 *   {@link ammunitionCapacity} and {@link heatMetrics}. A pip allocation is always a
 *   separate call over the bare figure, one entry point per capacitor:
 *   {@link shieldCapacitorMetrics} for SYS, {@link mobilityCapacitorMetrics} for ENG
 *   and {@link weaponsCapacitorMetrics} for WEP.
 * - **Engineering** — {@link computeModifiers} applies the primitive legs of a
 *   {@link BLUEPRINTS} recipe and an {@link EXPERIMENTAL_EFFECTS} entry;
 *   {@link ShipLoadout.applyBlueprint} presents that result under Frontier's journal
 *   labels, while {@link ShipLoadout.setPreEngineeredVariant} fits a fixed article that
 *   arrives engineered. {@link ENGINEERING_OPTION_GROUPS} answers what a module *can*
 *   take, and {@link PRE_ENGINEERED_MODULES} covers the articles you cannot craft.
 *   Material shopping data lives on the
 *   {@link ships/blueprint-costs!BLUEPRINT_COSTS | blueprint-costs} and
 *   {@link ships/experimental-effect-costs!EXPERIMENTAL_EFFECT_COSTS | experimental-effect-costs}
 *   subpaths, so a consumer can price one recipe without the mechanics — and the facade
 *   carries them, since {@link BuildMetrics.buildCost} prices a whole build. A blueprint
 *   cost carries both halves of what a climb takes: the materials and the Merc Coin 25 of
 *   the recipes charge beside them.
 *
 * The registries use two distinct Frontier identity spaces. `symbol` identifies an
 * item — a hull, module, material, micro-resource or commodity — and is what item and
 * journal `Item` lookups accept. Engineering catalogues carry ids of their own:
 * `blueprintSymbol` names a recipe, a fixed variant's identity included, and
 * `experimentalEffectSymbol` names an effect. Those two are what the journal writes in
 * `Engineering.BlueprintName` and `Engineering.ExperimentalEffect` respectively; the few
 * colliding blueprint aliases are resolved for their module by
 * {@link resolveBlueprintForModule}.
 * Pre-engineered variants are found from the base module's `symbol` with
 * {@link getPreEngineeredVariants}.
 *
 * Entity catalogues ({@link SHIPS}, the module catalogues, {@link PRE_ENGINEERED_MODULES})
 * are readonly arrays whose values carry their own identity; engineering catalogues
 * ({@link BLUEPRINTS}, {@link EXPERIMENTAL_EFFECTS}, {@link ENGINEERING_OPTION_GROUPS})
 * are keyed by that identity instead — enumerate them with `Object.values()`. Prefer the
 * case-insensitive lookups ({@link getBlueprint}, {@link getExperimentalEffect},
 * {@link ships/blueprint-costs!getBlueprintCosts | getBlueprintCosts},
 * {@link ships/experimental-effect-costs!getExperimentalEffectCost | getExperimentalEffectCost})
 * to indexing a map with caller- or journal-supplied text.
 *
 * Identity primarily from EDCD FDevIDs (`shipyard.csv`, `outfitting.csv`), with
 * supplemental module identities documented in the source record; stats and slot
 * layouts from EDCD/coriolis-data and EDSY. See [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @example
 * **The whole-build layer.** {@link ShipLoadout} reads a capture and answers the
 * questions an outfitting screen asks. This is the one to start from, and the one that
 * pulls in every catalogue.
 *
 * ```ts
 * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const event: LoadoutEvent;
 *
 * // Figures below are one build's — a Krait Phantom explorer.
 * const metrics = BuildMetrics.of(ShipLoadout.fromLoadout(event));
 * metrics.maxJumpRange(); // -> 60.5478  (ly)
 * metrics.powerBudget().withinBudget; // -> true
 * metrics.shieldMetricsResult().value?.strength; // -> 743.12   (MJ)
 * metrics.weaponMetrics().total.damagePerSecond; // -> 34
 * ```
 *
 * @example
 * **The lookup layer.** One small hull catalogue, and 1194 modules split by Frontier's
 * four outfitting categories. Lookups ignore case and surrounding whitespace.
 *
 * ```ts
 * import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
 *
 * getShipBySymbol('empire_trader')?.name; // -> 'Imperial Clipper'
 *
 * // Pass a category to bound what you bundle; omit it to search all 1194.
 * CORE_MODULES.length; // -> 516
 * getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)?.name;
 * // -> 'Frame Shift Drive'
 * ```
 *
 * @example
 * **The data-free layer.** Each calculation is its own module over plain constants, so
 * it costs nothing but the function — no catalogue, no build. `./power`, `./shields`,
 * `./shield-capacitor`, `./armour`, `./weapons`, `./weapons-capacitor`, `./mobility`,
 * `./mobility-capacitor`, `./ammunition` and `./resistances` are the same shape.
 *
 * ```ts
 * import { singleJumpRange } from '@elite-dangerous-almanac/core/ships/jump-range';
 *
 * singleJumpRange(1237.3, 6.8, {
 *     optMass: 7528.04,
 *     maxFuel: 6.8,
 *     fuelMul: 0.011,
 *     fuelPower: 2.5025,
 *     jumpBoost: 10.5, // Guardian FSD Booster
 * }); // -> 89.4147  (ly)
 * ```
 *
 * @packageDocumentation
 */

// ── Ships (identity + stats + slot layout, one record per hull) ─────────────
export { SHIPS, getShipBySymbol, getShipByName, getShipSlots, type Ship } from './ships.js';
export {
    SHIP_GUNSIGHTS,
    getShipGunsight,
    projectGunsight,
    type GunsightOffset,
    type ShipGunsight,
    type GunsightPoint,
    type ShipGunsightCatalogue,
} from './gunsights.js';

// ── Modules: types + lookups (each record carries identity + stats) ──────────
// The lookups search every module unless you pass a narrower catalogue.
export {
    getModuleBySymbol,
    getModulesByName,
    getBulkheadsForShip,
    type OutfittingModule,
    type OutfittingModuleIdentity,
    type OutfittingModuleStats,
    type ModuleCategory,
    type ModuleMount,
    type ModuleGuidance,
    type ModuleRating,
    type ModuleExclusionGroup,
    type ModuleLimitGroup,
    type ModuleLimitIncrease,
    type DamageDistribution,
    type DamageComponents,
    type ProjectileRangeBoundaries,
} from './modules.js';

export {
    SHIP_MODULE_LIMITS,
    calculateModuleLimits,
    type ModuleLimitEntry,
    type ModuleLimitUsage,
} from './module-limits.js';

export {
    hasFrameShiftDriveJumpStats,
    hasPowerGenerationStats,
    hasPowerDistributorStats,
    hasMassCurveStats,
    hasShieldRegenerationStats,
    hasWeaponDamageStats,
    type FrameShiftDriveJumpStats,
    type PowerGenerationStats,
    type PowerDistributorStats,
    type MassCurveStats,
    type ShieldRegenerationStats,
    type WeaponDamageStats,
} from './module-capabilities.js';
export { OUTFITTING_FAMILIES, type OutfittingFamilyId } from './module-families.js';
// ── SLEF loadouts + jump-range / fuel calculations ──────────────────────────
export {
    parseSlef,
    inspectSlef,
    toSlef,
    stringifySlef,
    getLoadoutModifier,
    type Slef,
    type SlefEntry,
    type SlefHeader,
    type SlefStringifyOptions,
    type SlefDiagnostic,
    type SlefDiagnosticCode,
    type SlefConstraint,
    type SlefInspection,
    type LoadoutEvent,
    type LoadoutModule,
    type ModuleEngineering,
    type BlueprintModuleEngineering,
    type EngineeringModifier,
} from './slef.js';
export {
    frameShiftDriveMassFactor,
    singleJumpRange,
    fuelPerJump,
    totalRange,
    type FrameShiftDriveParams,
    type TotalRangeDetails,
} from './jump-range.js';

// ── The build facade and the modules it composes, each named at its source ──
export {
    LoadoutEditError,
    ShipLoadout,
    type LoadoutEditErrorCode,
    type FixedMountRepairResult,
    type AvailableBlueprint,
    type ApplyBlueprintOptions,
    type EngineeringNormalizationCode,
    type EngineeringNormalizationResult,
    type EngineeringNormalizationUnchanged,
    type EngineeringNormalizationUnsupported,
    type EngineeringNormalized,
    type ExperimentalEffectMutationCode,
    type ExperimentalEffectMutationResult,
    type ExperimentalEffectUnchanged,
    type ExperimentalEffectUnsupported,
    type ExperimentalEffectUpdated,
    type LoadoutExportOptions,
    type LoadoutImportOutcome,
    type SlefExportOptions,
} from './ship-loadout.js';
export {
    BuildMetrics,
    type JumpOptions,
    type JumpRangeSummary,
    type ShieldCapacitorOptions,
    type ShieldRecoveryOptions,
    type MobilityCapacitorOptions,
    type StandardLoad,
    type StandardLoadInputs,
    type DistributorOptions,
    type WeaponsOptions,
    type BuildCost,
    type BuildCredits,
    type BuildMass,
    type FittedWeaponMetrics,
    type BuildWeaponMetrics,
} from './build-metrics.js';
export type { FittedModule } from './fitted-module.js';
export type { LoadoutSlot, ImmovableReason } from './loadout-slot.js';
export {
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
    type CalculationIssue,
    type CalculationIssueReason,
    type CalculationResult,
    type FuelCapacity,
    type LoadoutCalculationModule,
} from './loadout-calculations.js';
export {
    validateLoadout,
    type LoadoutIssue,
    type LoadoutIssueCode,
    type LoadoutIssueParam,
    type LoadoutIssueParams,
    type LoadoutMass,
    type LoadoutValidation,
    type LoadoutValidationInput,
    type ThrusterLoad,
    type ValidationModule,
    type ModuleFitConstraint,
} from './loadout-validation.js';
export {
    getSourceModuleValue,
    sourcePurchaseFromLoadout,
    sumSourceModuleValues,
    type SourceModuleValue,
    type SourcePurchaseRecord,
} from './source-purchase.js';

// ── Build metrics: power, shields, armour and weapons (all data-free) ────────
export {
    powerBudget,
    type PowerConsumer,
    type PowerConsumerResult,
    type PowerBand,
    type PowerBudget,
} from './power.js';
export {
    stackShieldResistance,
    stackArmourResistance,
    systemsResistance,
    effectiveHitPoints,
    mapDamageTypes,
    type DamageResistanceParams,
    type DamageResistances,
    type DamageType,
    type DamageTypeValues,
} from './resistances.js';
export {
    shieldMetrics,
    shieldStrength,
    shieldMassCurveMultiplier,
    type ShieldGeneratorParams,
    type ShieldBoosterParams,
    type ShieldInput,
    type ShieldMetrics,
} from './shields.js';
export {
    shieldCapacitorMetrics,
    type ShieldCapacitorInput,
    type ShieldCapacitorMetrics,
} from './shield-capacitor.js';
export {
    mobilityMetrics,
    thrusterMassCurveMultiplier,
    type MobilityInput,
    type MobilityMetrics,
    type ThrusterParams,
    type ThrusterCurveParams,
} from './mobility.js';
export {
    mobilityCapacitorMetrics,
    type MobilityCapacitorInput,
    type MobilityCapacitorMetrics,
} from './mobility-capacitor.js';
export {
    shieldRecovery,
    cellBankSummary,
    type ShieldRecoveryInput,
    type ShieldRecovery,
    type CellBankInput,
    type CellBankMetrics,
    type CellBankSummary,
} from './shield-recovery.js';
export {
    armourMetrics,
    type BulkheadParams,
    type HullReinforcementParams,
    type ModuleReinforcementParams,
    type ArmourInput,
    type ArmourMetrics,
} from './armour.js';
export {
    weaponMetrics,
    sumWeaponMetrics,
    combinedRateOfFire,
    damagePerSecond,
    sustainedDamagePerSecond,
    sustainedFireFactor,
    energyPerSecond,
    heatPerSecond,
    damageFalloff,
    armourPiercingFactor,
    splitDamage,
    type WeaponStats,
    type WeaponMetrics,
    type WeaponTotals,
    type DamageSplit,
} from './weapons.js';
export {
    distributorMetrics,
    type DistributorInput,
    type DistributorCapacitorMetrics,
    type DistributorPips,
    type DistributorMetrics,
} from './distributor.js';
export {
    weaponsCapacitorMetrics,
    type WeaponsCapacitorInput,
    type WeaponsCapacitorMetrics,
} from './weapons-capacitor.js';
export { ammunitionCapacity, type AmmunitionStats, type AmmunitionCapacity } from './ammunition.js';
export {
    heatMetrics,
    equilibriumHeatLevel,
    effectiveWeaponThermalLoad,
    heatLevelAtTime,
    secondsToHeatLevel,
    OVERHEAT_HEAT_LEVEL,
    type HeatInput,
    type HeatWeapon,
    type HeatState,
    type HeatMetrics,
} from './heat.js';

// ── Build editor: slot model (per-hull slot layouts live on each `Ship`) ─────
export {
    parseSlotName,
    enumerateSlots,
    SLOT_RESTRICTION_LABELS,
    type SlotKind,
    type SlotRestriction,
    type HardpointRestriction,
    type OptionalRestriction,
    type CoreSlotType,
    type ModuleSlot,
    type BuildSlotBase,
    type CoreBuildSlot,
    type HardpointBuildSlot,
    type OptionalBuildSlot,
    type SimpleBuildSlot,
    type BuildSlot,
    type CoreSlots,
    type HardpointSlotSpec,
    type OptionalSlotSpec,
    type ShipSlots,
    type ParsedSlot,
} from './slots.js';

// ── Engineering: blueprint + experimental-effect calculator ─────────────────
export {
    computeModifiers,
    sumMaterials,
    type ModifierMethod,
    type BlueprintFeature,
    type EngineeringMaterial,
    type BlueprintGrade,
    type ExperimentalContribution,
    type ExperimentalEffect,
    type BlueprintGrades,
    type Blueprint,
} from './engineering.js';
export { BLUEPRINTS, getBlueprint, getBlueprintGrade } from './blueprints.js';
export { EXPERIMENTAL_EFFECTS, getExperimentalEffect } from './experimental-effects.js';
export {
    ENGINEERING_OPTION_GROUPS,
    getEngineeringGroup,
    getBlueprintsForModule,
    getExperimentalsForModule,
    getExperimentalsForBlueprint,
    type EngineeringOptionGroup,
    type EngineeringGroupId,
} from './engineering-options.js';
export { resolveBlueprintForModule } from './blueprint-journal.js';
export {
    PRE_ENGINEERED_MODULES,
    getPreEngineeredVariants,
    isPreEngineered,
    type PreEngineeredVariant,
    type PreEngineeredAcquisition,
    type PreEngineeredModifier,
} from './pre-engineered.js';
export {
    getPreEngineeredStats,
    getPreEngineeredModifiers,
    getPreEngineeredJournalModifiers,
    identifyPreEngineeredVariant,
    unresolvedModifiers,
} from './pre-engineered-stats.js';
