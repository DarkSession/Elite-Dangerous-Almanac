/**
 * Elite Dangerous materials — the ship-side engineering **materials** (raw,
 * manufactured and encoded, each with a grade and in-game line) and the on-foot
 * Odyssey **micro resources** (component, consumable, data and item, each a plain
 * symbol/name registry record).
 *
 * Every lookup searches the whole registry by default — import the function and
 * call it:
 *
 * ```ts
 * import {
 *   getMaterialByName,
 *   materialsByGrade,
 *   materialsInCategory,
 *   getMicroResourceBySymbol,
 *   MaterialGrade,
 * } from '@elite-dangerous-almanac/core/materials';
 *
 * getMaterialByName('iron')?.grade;               // -> MaterialGrade.VeryCommon
 * materialsByGrade(MaterialGrade.Rare).length;    // -> across every category
 * materialsInCategory('raw').length;              // -> 28
 * getMicroResourceBySymbol('graphene')?.name;     // -> 'Graphene'
 * ```
 *
 * The by-key lookups also take an optional trailing argument to **narrow** the search
 * to a subset — one category's catalogue, or an array you have filtered yourself. It
 * must be one of the exported catalogues *by reference*; `ALL_MATERIALS` (or omitting
 * it) is the one that answers from an index rather than a scan:
 *
 * ```ts
 * import { getMaterialByName } from '@elite-dangerous-almanac/core/materials';
 * import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';
 *
 * getMaterialByName('imperial shielding', RAW_MATERIALS); // -> null; it is manufactured
 * ```
 *
 * A lookup that returns an array takes no catalogue — narrow its result, or the subset
 * you already imported, with `.filter()`:
 *
 * ```ts
 * import { MaterialGrade } from '@elite-dangerous-almanac/core/materials';
 * import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';
 *
 * RAW_MATERIALS.filter((m) => m.grade === MaterialGrade.Rare).length; // -> 7, one per raw line
 * ```
 *
 * @packageDocumentation
 */

// ── Types, enums, and the lookups (each defaults to the whole registry) ──────
export {
    getMaterialBySymbol,
    getMaterialByName,
    getMaterialByElementSymbol,
    materialsByGrade,
    materialsInLine,
    materialsInCategory,
    MaterialGrade,
    MaterialLine,
    type Material,
    type MaterialCategory,
} from './materials.js';

// ── Catalogues (one module per category, for narrowing a search by hand) ─────
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
