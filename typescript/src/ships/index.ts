/**
 * Ship and outfitting data for Elite Dangerous — Frontier's shipyard and outfitting
 * registries.
 *
 * This entry point re-exports the ships feature area. Every symbol is also reachable
 * from its own module, so bundlers can drop anything you do not use.
 *
 * Two catalogues, each now carrying **identity and stats in one record**:
 *
 * - **Ships** — {@link SHIPS} and the {@link getShipBySymbol} / {@link getShipByName}
 *   lookups. One small catalogue; each {@link Ship} carries the hull's identity,
 *   stats and slot layout together.
 * - **Modules** — the {@link OutfittingModule} type and the data-free query
 *   functions ({@link getModuleBySymbol} & co.) over a catalogue you pass in. The
 *   catalogues are split by Frontier's four outfitting categories
 *   ({@link STANDARD_MODULES}, {@link INTERNAL_MODULES}, {@link HARDPOINT_MODULES},
 *   {@link UTILITY_MODULES}, or {@link ALL_MODULES}) so you only bundle the slice
 *   you search; each record carries the module's identity and its stats.
 *
 * Identity from EDCD FDevIDs (`shipyard.csv`, `outfitting.csv`); stats and slot
 * layouts from EDCD/coriolis-data; see `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

// ── Ships (identity + stats + slot layout, one record per hull) ─────────────
export { SHIPS, getShipBySymbol, getShipByName, getShipSlots, type Ship } from './ships.js';

// ── Modules: types + data-free queries (each record carries identity + stats) ─
// The query functions hold no data; each catalogue is its own module, so import
// only the category you need and pass it in.
export {
    getModuleBySymbol,
    getModulesByName,
    getModulesForShip,
    type OutfittingModule,
    type ModuleCategory,
    type ModuleMount,
    type ModuleGuidance,
    type ModuleRating,
} from './modules.js';

// ── Module catalogues (one per outfitting category) ─────────────────────────
export { STANDARD_MODULES } from './modules-standard.js';
export { INTERNAL_MODULES } from './modules-internal.js';
export { HARDPOINT_MODULES } from './modules-hardpoint.js';
export { UTILITY_MODULES } from './modules-utility.js';
export { ALL_MODULES } from './modules-all.js';

// ── SLEF loadouts + jump-range / fuel calculations ──────────────────────────
export {
    parseSlef,
    getLoadoutModifier,
    type Slef,
    type SlefEntry,
    type SlefHeader,
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
    type FuelCapacity,
    type JumpOptions,
    type AvailableBlueprint,
    type ApplyBlueprintOptions,
} from './ship-loadout.js';

// ── Build editor: slot model (per-hull slot layouts live on each `Ship`) ─────
export {
    parseSlotName,
    enumerateSlots,
    type SlotKind,
    type SlotRestriction,
    type CoreSlotType,
    type BuildSlot,
    type CoreSlots,
    type OptionalSlotSpec,
    type BulkheadOption,
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
    getBlueprintGradeMaterials,
    getBlueprintCost,
} from './blueprints.js';
export {
    EXPERIMENTAL_EFFECTS,
    getExperimentalEffect,
    getExperimentalEffectName,
    getExperimentalEffectMaterials,
} from './experimental-effects.js';
export {
    PRE_ENGINEERED_MODULES,
    getPreEngineeredVariants,
    getPreEngineeredByBlueprint,
    isPreEngineered,
    type PreEngineeredVariant,
    type PreEngineeredAcquisition,
} from './pre-engineered.js';
