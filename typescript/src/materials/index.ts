/**
 * Elite Dangerous materials — the ship-side engineering **materials** (raw,
 * manufactured and encoded, each with a grade and in-game line) and the on-foot
 * Odyssey **micro resources** (component, consumable, data and item, each a plain
 * symbol/name registry record).
 *
 * The query functions hold no data; each catalogue is its own module, so import
 * only the categories you use:
 *
 * ```ts
 * import { getMaterialByName, materialsByGrade, MaterialGrade } from '@elite-dangerous-almanac/core/materials';
 * import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';
 * import { getMicroResourceBySymbol } from '@elite-dangerous-almanac/core/materials';
 * import { COMPONENT_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-component';
 *
 * getMaterialByName('iron', RAW_MATERIALS)?.grade;         // -> MaterialGrade.VeryCommon
 * materialsByGrade(MaterialGrade.Rare, RAW_MATERIALS).length; // -> 7
 * getMicroResourceBySymbol('graphene', COMPONENT_MICRO_RESOURCES)?.name; // -> 'Graphene'
 * ```
 *
 * @packageDocumentation
 */

// ── Types, enums, and the data-free query functions ──────────────────────────
export {
    getMaterialBySymbol,
    getMaterialByName,
    getMaterialByElementSymbol,
    materialsByGrade,
    materialsInLine,
    MaterialGrade,
    MaterialLine,
    type Material,
    type MaterialCategory,
} from './materials.js';

// ── Catalogues (one module per category so bundlers can drop the rest) ───────
export { RAW_MATERIALS } from './materials-raw.js';
export { MANUFACTURED_MATERIALS } from './materials-manufactured.js';
export { ENCODED_MATERIALS } from './materials-encoded.js';
export { ALL_MATERIALS } from './materials-all.js';

// ── Odyssey micro resources — on-foot components, data, consumables, items ────
export {
    getMicroResourceBySymbol,
    getMicroResourceByName,
    microResourcesInCategory,
    type MicroResource,
    type MicroResourceCategory,
} from './micro-resources.js';

export { COMPONENT_MICRO_RESOURCES } from './micro-resources-component.js';
export { CONSUMABLE_MICRO_RESOURCES } from './micro-resources-consumable.js';
export { DATA_MICRO_RESOURCES } from './micro-resources-data.js';
export { ITEM_MICRO_RESOURCES } from './micro-resources-item.js';
export { ALL_MICRO_RESOURCES } from './micro-resources-all.js';
