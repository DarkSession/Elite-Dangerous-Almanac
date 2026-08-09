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
 * `rebuy`) — and keeps what a capture said it *paid* apart from what the build is worth
 * at retail ({@link ShipLoadout.sourcePurchase}, a {@link SourcePurchaseRecord}). It is
 * the batteries-included facade and pulls in every catalogue;
 * everything below is what it is built from, so drop to the pieces when you
 * need one answer rather than a whole ship.
 *
 * The area has five layers:
 *
 * - **Ships** — {@link SHIPS} and the {@link getShipBySymbol} / {@link getShipByName}
 *   lookups. One small catalogue; each {@link Ship} carries the
 *   hull's identity, stats and slot layout together.
 * - **Modules** — the {@link OutfittingModule} type and the lookups
 *   ({@link getModuleBySymbol} & co.), which search all 1199 modules unless you hand
 *   them a narrower set. The catalogues are also exported split by Frontier's four
 *   outfitting categories ({@link CORE_MODULES}, {@link INTERNAL_MODULES},
 *   {@link HARDPOINT_MODULES}, {@link UTILITY_MODULES}, and {@link ALL_MODULES}); each
 *   record carries the module's identity and its stats.
 * - **Jump range & SLEF** — {@link singleJumpRange}, {@link fuelPerJump} and
 *   {@link totalRange} are pure maths over {@link FrameShiftDriveParams} and cost
 *   nothing but the function; {@link parseSlef} reads an Inara SLEF export — or a bare
 *   journal `Loadout` event — on its own, and {@link toSlef} / {@link stringifySlef}
 *   write one back out.
 * - **Build metrics** — the rest of what an outfitting screen shows, each its own
 *   data-free module: {@link powerBudget} (what the plant makes against what the build
 *   draws, by priority group), {@link shieldMetrics} and {@link armourMetrics} (strength,
 *   hit points and the resistances behind them, stacked by {@link stackShieldResistance}
 *   / {@link stackArmourResistance}), {@link weaponMetrics} (DPS, sustained DPS,
 *   capacitor draw and heat) and {@link ammunitionCapacity} (the magazine and the reserve
 *   behind it, for anything that carries rounds).
 * - **Engineering** — {@link computeModifiers} applies a {@link BLUEPRINTS} recipe and
 *   an {@link EXPERIMENTAL_EFFECTS} entry; {@link ENGINEERING_OPTION_GROUPS} answers
 *   what a module *can* be engineered with, and {@link PRE_ENGINEERED_MODULES} covers
 *   the fixed-roll modules you cannot craft. {@link DECORATIVE_MODIFICATIONS} is the
 *   odd one out and the one to reach for when an id resolves to no recipe: the game
 *   writes a handful of festive transformations in the same field, and no engineer
 *   applies one.
 *
 * Note that a hull's derived figures split by cost: cheap stored values are properties
 * ({@link ShipLoadout.unladenMass}), while anything that recomputes or takes options is
 * a method ({@link ShipLoadout.maxJumpRange}).
 *
 * Identity primarily from EDCD FDevIDs (`shipyard.csv`, `outfitting.csv`), with
 * supplemental module identities documented in the source record; stats and slot
 * layouts from EDCD/coriolis-data and EDSY. See [`data/ships/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/ships/SOURCES.md).
 *
 * @packageDocumentation
 */

// ── Ships (identity + stats + slot layout, one record per hull) ─────────────
export { SHIPS, getShipBySymbol, getShipByName, getShipSlots, type Ship } from './ships.js';

// ── Modules: types + lookups (each record carries identity + stats) ──────────
// The lookups search every module unless you pass a narrower catalogue.
export {
    getModuleBySymbol,
    getModulesByName,
    getModulesForShip,
    type OutfittingModule,
    type ModuleCategory,
    type ModuleKind,
    type ModuleMount,
    type ModuleGuidance,
    type ModuleRating,
    type DamageDistribution,
    type DamageComponents,
    type ProjectileRangeBoundaries,
} from './modules.js';

// ── Module catalogues (one per outfitting category) ─────────────────────────
export { CORE_MODULES } from './modules-core.js';
export { INTERNAL_MODULES } from './modules-internal.js';
export { HARDPOINT_MODULES } from './modules-hardpoint.js';
export { UTILITY_MODULES } from './modules-utility.js';
export { ALL_MODULES } from './modules-all.js';

// ── SLEF loadouts + jump-range / fuel calculations ──────────────────────────
export {
    parseSlef,
    inspectSlef,
    toSlef,
    stringifySlef,
    getLoadoutModifier,
    LIBRARY_SLEF_HEADER,
    type Slef,
    type SlefEntry,
    type SlefHeader,
    type SlefStringifyOptions,
    type SlefDiagnostic,
    type SlefDiagnosticCode,
    type SlefInspection,
    type LoadoutEvent,
    type LoadoutModule,
    type ModuleEngineering,
    type EngineeringModifier,
} from './slef.js';
export {
    singleJumpRange,
    fuelPerJump,
    totalRange,
    type FrameShiftDriveParams,
} from './jump-range.js';
export {
    ShipLoadout,
    LoadoutSlot,
    FittedModule,
    calculateCargoCapacity,
    calculateFuelCapacity,
    calculateUnladenMass,
    validateLoadout,
    type FuelCapacity,
    type JumpOptions,
    type JumpRangeSummary,
    type DefenceOptions,
    type FittedWeaponMetrics,
    type BuildWeaponMetrics,
    type AvailableBlueprint,
    type ApplyBlueprintOptions,
    type LoadoutExportOptions,
    type SlefExportOptions,
    type CalculationIssue,
    type CalculationResult,
    type CalculatedFuelCapacity,
    type LoadoutCalculationModule,
    type LoadoutIssue,
    type LoadoutIssueCode,
    type LoadoutValidation,
    type LoadoutValidationInput,
    type ValidationModule,
} from './ship-loadout.js';
export { SourcePurchaseRecord, type SourceModuleValue } from './source-purchase.js';

// ── Build metrics: power, shields, armour and weapons (all data-free) ────────
export { powerBudget, type PowerConsumer, type PowerBand, type PowerBudget } from './power.js';
export {
    stackShieldResistance,
    stackShieldMultiplier,
    stackArmourResistance,
    stackArmourMultiplier,
    systemsResistance,
    type DamageResistances,
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
    type DamageSplit,
} from './weapons.js';
export { ammunitionCapacity, type AmmunitionStats, type AmmunitionCapacity } from './ammunition.js';

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
export {
    BLUEPRINTS,
    getBlueprint,
    getBlueprintName,
    getBlueprintGrade,
    getBlueprintGradeDamageDistribution,
    getBlueprintGradeMaterials,
    getBlueprintCost,
} from './blueprints.js';
export {
    EXPERIMENTAL_EFFECTS,
    getExperimentalEffect,
    getExperimentalEffectDamageDistribution,
    getExperimentalEffectName,
    getExperimentalEffectMaterials,
} from './experimental-effects.js';
export {
    ENGINEERING_OPTION_GROUPS,
    getEngineeringGroup,
    getBlueprintsForModule,
    getExperimentalsForModule,
    getExperimentalsForBlueprint,
    type EngineeringOptionGroup,
} from './engineering-options.js';
export { resolveBlueprintForModule } from './blueprint-journal.js';
export {
    DECORATIVE_MODIFICATIONS,
    getDecorativeModification,
    getDecorativeModificationsForModule,
    isDecorativeModification,
    type DecorativeModification,
    type DecorativeModifier,
} from './decorative-modifications.js';
export {
    PRE_ENGINEERED_MODULES,
    getPreEngineeredVariants,
    getPreEngineeredByBlueprint,
    isPreEngineered,
    type PreEngineeredVariant,
    type PreEngineeredAcquisition,
    type PreEngineeredModifier,
} from './pre-engineered.js';
export {
    getPreEngineeredStats,
    getPreEngineeredModifiers,
    unresolvedModifiers,
} from './pre-engineered-stats.js';
