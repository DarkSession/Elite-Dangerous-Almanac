/**
 * Ship and outfitting data for Elite Dangerous — Frontier's shipyard and outfitting
 * registries.
 *
 * This entry point re-exports the ships feature area. Every symbol is also reachable
 * from its own module, so bundlers can drop anything you do not use.
 *
 * **Working with a whole build? Start with {@link ShipLoadout}** — it reads a SLEF
 * export ({@link ShipLoadout.fromSlef}) or a journal `Loadout` event straight out of a
 * player journal ({@link ShipLoadout.fromLoadout}), writes either back out
 * ({@link ShipLoadout.toSlefString}, {@link ShipLoadout.toLoadoutEvent}), lets you fit
 * modules and apply engineering, and
 * answers the questions apps actually ask ({@link ShipLoadout.maxJumpRange},
 * {@link ShipLoadout.powerBudget}, {@link ShipLoadout.shieldMetrics}, `unladenMass`,
 * `rebuy`, {@link ShipLoadout.mercCoinCost}) — and keeps what a capture said it *paid*
 * apart from what the build is worth at retail ({@link ShipLoadout.sourcePurchase}, a
 * {@link SourcePurchaseRecord}). It is
 * the batteries-included facade and pulls in every catalogue;
 * everything below is what it is built from, so drop to the pieces when you
 * need one answer rather than a whole ship.
 *
 * The area has five layers:
 *
 * - **Ships** — {@link SHIPS} and the {@link getShipBySymbol} / {@link getShipByName}
 *   lookups. One small catalogue; each {@link Ship} carries the
 *   hull's identity, stats and slot layout together. {@link SHIP_GUNSIGHTS},
 *   {@link getShipGunsight} and {@link projectGunsight} place a hull's fixed weapon
 *   mounts at any target range. The split
 *   {@link ships/default-loadouts!DEFAULT_LOADOUTS | default-loadouts} subpath separately
 *   carries the stock modules, and {@link ShipLoadout.default} turns one into a live build.
 * - **Modules** — the {@link OutfittingModule} type and the lookups
 *   ({@link getModuleBySymbol} & co.), which search all 1199 modules unless you hand
 *   them a narrower set. Capability guards such as {@link hasFrameShiftDriveJumpStats}
 *   and {@link hasWeaponDamageStats} narrow the sparse record before stat access. The
 *   catalogues live on explicit subpaths split by Frontier's
 *   four outfitting categories — {@link ships/modules-core!CORE_MODULES | CORE_MODULES},
 *   {@link ships/modules-internal!INTERNAL_MODULES | INTERNAL_MODULES},
 *   {@link ships/modules-hardpoint!HARDPOINT_MODULES | HARDPOINT_MODULES},
 *   {@link ships/modules-utility!UTILITY_MODULES | UTILITY_MODULES} and
 *   {@link ships/modules-all!ALL_MODULES | ALL_MODULES}; each record carries the
 *   module's identity and its stats. They are reachable only by their own subpath, so
 *   importing one never bundles the rest.
 * - **Jump range & SLEF** — {@link frameShiftDriveMassFactor},
 *   {@link singleJumpRange}, {@link fuelPerJump} and {@link totalRange} are pure maths
 *   over {@link FrameShiftDriveParams} and cost nothing but the function;
 *   {@link parseSlef} reads an Inara SLEF export — or a bare
 *   journal `Loadout` event — on its own, and {@link toSlef} / {@link stringifySlef}
 *   write one back out.
 * - **Build metrics** — the rest of what an outfitting screen shows, each its own
 *   data-free module: {@link powerBudget} (what the plant makes against what the build
 *   draws, by priority group), {@link shieldMetrics} and {@link armourMetrics} (strength,
 *   hit points and the resistances behind them, stacked by {@link stackShieldResistance}
 *   / {@link stackArmourResistance}), {@link weaponMetrics} (DPS, sustained DPS,
 *   capacitor draw and heat), {@link distributorMetrics} (SYS, ENG and WEP capacity
 *   and pip-scaled recharge), {@link weaponsCapacitorMetrics} (WEP-pip recharge and
 *   firing endurance), {@link ammunitionCapacity} (the magazine and the reserve
 *   behind it, for anything that carries rounds) and {@link heatMetrics} (what the build
 *   runs at idle and firing, and whether it cooks itself).
 * - **Engineering** — {@link computeModifiers} applies the primitive legs of a
 *   {@link BLUEPRINTS} recipe and an {@link EXPERIMENTAL_EFFECTS} entry;
 *   {@link ShipLoadout.applyBlueprint} presents that result under Frontier's journal
 *   labels, while {@link ShipLoadout.setPreEngineeredVariant} fits a fixed article that
 *   arrives with engineering already present. {@link ENGINEERING_OPTION_GROUPS} answers
 *   what a module *can* be engineered with, and {@link PRE_ENGINEERED_MODULES} covers
 *   the fixed articles you cannot craft — including grade-5 festive launchers whose
 *   `Decorative_*` journal identity names no recipe. Material shopping data stays on the explicit
 *   {@link ships/blueprint-costs!BLUEPRINT_COSTS | blueprint-costs} and
 *   {@link ships/experimental-effect-costs!EXPERIMENTAL_EFFECT_COSTS | experimental-effect-costs}
 *   subpaths, so build calculations do not pull it in.
 *
 * The registries use two distinct Frontier identity spaces. `symbol` identifies an
 * item — a hull, module, material, micro-resource or commodity — and is what item and
 * journal `Item` lookups accept. Engineering catalogue entries instead use `fdname` to
 * identify a recipe, effect or fixed variant. The journal normally writes that id in
 * `Engineering.BlueprintName` or `Engineering.ExperimentalEffect`; the few colliding
 * blueprint aliases are resolved for their module by {@link resolveBlueprintForModule}.
 * Recipe and effect lookups take an `fdname`. Pre-engineered variants are found from the
 * base module's `symbol` with {@link getPreEngineeredVariants}, after which their
 * `blueprint` identities can be inspected.
 *
 * Catalogue containers follow those jobs rather than one universal shape. The
 * identity-bearing entity catalogues — {@link SHIPS} and the module catalogues — are
 * readonly arrays because every value carries its own `symbol` and consumers commonly
 * enumerate or filter them. {@link PRE_ENGINEERED_MODULES} is also an array, but it is
 * an enumerable relation: each row joins a base module to engineering and acquisition
 * data rather than identifying a new module with a symbol of its own.
 *
 * Engineering entities and groups are keyed catalogues: {@link BLUEPRINTS},
 * {@link EXPERIMENTAL_EFFECTS} and {@link ENGINEERING_OPTION_GROUPS} carry the recipe,
 * effect or group identity in the key rather than repeating it in each value. The separate
 * {@link ships/blueprint-costs!BLUEPRINT_COSTS | BLUEPRINT_COSTS} and
 * {@link ships/experimental-effect-costs!EXPERIMENTAL_EFFECT_COSTS | EXPERIMENTAL_EFFECT_COSTS}
 * records map those ids to costs; {@link SLOT_RESTRICTION_LABELS} maps typed restriction
 * codes to display labels. Use `Object.values()` or `Object.entries()` to enumerate any
 * of these keyed structures.
 *
 * Four `fdname` maps have public case-insensitive, whitespace-trimming lookups for a
 * caller- or journal-supplied id: {@link getBlueprint}, {@link getExperimentalEffect},
 * {@link ships/blueprint-costs!getBlueprintCosts | getBlueprintCosts} and
 * {@link ships/experimental-effect-costs!getExperimentalEffectCost | getExperimentalEffectCost}.
 * Prefer those helpers to direct indexing for external text. Engineering group ids and
 * slot restriction codes are typed keys, so index their maps directly.
 *
 * Note that a hull's derived figures split by cost: cheap stored values are properties
 * ({@link ShipLoadout.unladenMass}), while anything that recomputes or takes options is
 * a method ({@link ShipLoadout.maxJumpRange}).
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
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const event: LoadoutEvent;
 *
 * // Figures below are one build's — a Krait Phantom explorer.
 * const build = ShipLoadout.fromLoadout(event);
 * build.maxJumpRange(); // -> 60.5478  (ly)
 * build.powerBudget().withinBudget; // -> true
 * build.shieldMetrics()?.strength; // -> 743.12   (MJ)
 * build.weaponMetrics().total.damagePerSecond; // -> 34
 * ```
 *
 * @example
 * **The lookup layer.** One small hull catalogue, and 1199 modules split by Frontier's
 * four outfitting categories. Lookups ignore case and surrounding whitespace.
 *
 * ```ts
 * import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { CORE_MODULES } from '@elite-dangerous-almanac/core/ships/modules-core';
 *
 * getShipBySymbol('empire_trader')?.name; // -> 'Imperial Clipper'
 *
 * // Pass a category to bound what you bundle; omit it to search all 1199.
 * CORE_MODULES.length; // -> 521
 * getModuleBySymbol('Int_Hyperdrive_Size6_Class5', CORE_MODULES)?.name;
 * // -> 'Frame Shift Drive'
 * ```
 *
 * The catalogues live on their own subpaths (`./modules-core`, `./modules-internal`,
 * `./modules-hardpoint`, `./modules-utility`, `./modules-all`) precisely so importing
 * one does not bundle the rest — `./modules-all` is 310.8 KiB.
 *
 * @example
 * **The data-free layer.** Each calculation is its own module over plain constants, so
 * it costs nothing but the function — no catalogue, no build.
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
 * `./power`, `./shields`, `./armour`, `./weapons`, `./ammunition` and `./resistances`
 * are the same shape: pass the constants, get the number.
 *
 * @example
 * **The slot layer.** Slot keys come from the game and are not derivable from position,
 * so read them rather than composing them — and let {@link ShipLoadout.modulesForSlot}
 * tell you what actually fits.
 *
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * const build = ShipLoadout.empty('Anaconda');
 *
 * build.slots('optional').length; // -> 14
 * build.slots()[0]?.key; // -> the key setModule takes
 *
 * // Only the modules this mount will accept, by size and restriction.
 * build.modulesForSlot('FrameShiftDrive');
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
    type JumpOptions,
    type JumpRangeSummary,
    type DefenceOptions,
    type MobilityOptions,
    type DistributorOptions,
    type WeaponsOptions,
    type RetailCredits,
    type FittedWeaponMetrics,
    type BuildWeaponMetrics,
    type AvailableBlueprint,
    type ApplyBlueprintOptions,
    type ExperimentalEffectMutationCode,
    type ExperimentalEffectMutationResult,
    type ExperimentalEffectUnchanged,
    type ExperimentalEffectUnsupported,
    type ExperimentalEffectUpdated,
    type LoadoutExportOptions,
    type SlefExportOptions,
} from './ship-loadout.js';
export type { FittedModule } from './fitted-module.js';
export type { LoadoutSlot, ImmovableReason } from './loadout-slot.js';
export {
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
    type CalculationIssue,
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
    type LoadoutValidation,
    type LoadoutValidationInput,
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
    mobilityMetrics,
    thrusterMassCurveMultiplier,
    type MobilityInput,
    type MobilityMetrics,
    type ThrusterParams,
    type ThrusterCurveParams,
} from './mobility.js';
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
    rollsForGrade,
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
