/**
 * Ship and outfitting data for Elite Dangerous — Frontier's shipyard and outfitting
 * registries.
 *
 * This entry point re-exports the ships feature area. Every symbol is also reachable
 * from its own module, so bundlers can drop anything you do not use.
 *
 * Two registries, each an id/name catalogue rather than a stats sheet:
 *
 * - **Ships** — {@link SHIPS} and the {@link getShipBySymbol} / {@link getShipByName}
 *   lookups. One small catalogue; the lookups carry it.
 * - **Modules** — the {@link OutfittingModule} type and the data-free query
 *   functions ({@link getModuleBySymbol} & co.) over a catalogue you pass in. The
 *   catalogues are split by Frontier's four outfitting categories
 *   ({@link STANDARD_MODULES}, {@link INTERNAL_MODULES}, {@link HARDPOINT_MODULES},
 *   {@link UTILITY_MODULES}, or {@link ALL_MODULES}) so you only bundle the slice
 *   you search.
 *
 * Data from EDCD FDevIDs (`shipyard.csv`, `outfitting.csv`); see
 * `data/ships/SOURCES.md`.
 *
 * @packageDocumentation
 */

// ── Ships (the shipyard registry) ───────────────────────────────────────────
export { SHIPS, getShipBySymbol, getShipByName, type Ship } from './ships.js';

// ── Modules: types + data-free queries ──────────────────────────────────────
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

// ── Stats: ships and modules (the numbers, keyed by the same `symbol`) ───────
export { SHIP_STATS, getShipStats, type ShipStats } from './ship-stats.js';
export { getModuleStats, type ModuleStats } from './module-stats.js';
export { STANDARD_MODULE_STATS } from './module-stats-standard.js';
export { INTERNAL_MODULE_STATS } from './module-stats-internal.js';
export { HARDPOINT_MODULE_STATS } from './module-stats-hardpoint.js';
export { UTILITY_MODULE_STATS } from './module-stats-utility.js';
export { ALL_MODULE_STATS } from './module-stats-all.js';

// ── SLEF loadouts + jump-range / fuel calculations ──────────────────────────
export {
    parseSlef,
    getModifier,
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
    type FuelCapacity,
    type JumpOptions,
    type LoadoutSlot,
    type ApplyBlueprintOptions,
} from './ship-loadout.js';

// ── Build editor: slot model + per-hull slot layouts ────────────────────────
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
export { SHIP_SLOTS, getShipSlots } from './ship-slots.js';

// ── Engineering: blueprint + experimental-effect calculator ─────────────────
export {
    computeModifiers,
    type ModifierMethod,
    type BlueprintFeature,
    type ExperimentalContribution,
    type BlueprintGrades,
} from './engineering.js';
export { BLUEPRINTS, getBlueprint, getBlueprintGrade } from './blueprints.js';
export { EXPERIMENTAL_EFFECTS, getExperimentalEffect } from './experimental-effects.js';
