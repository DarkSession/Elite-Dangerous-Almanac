/**
 * Elite Dangerous engineering materials — raw, manufactured and encoded — with
 * their grade (1–5), rarity label and in-game line.
 *
 * The query functions hold no data; each catalogue is its own module, so import
 * only the categories you use:
 *
 * ```ts
 * import { getMaterialByName, materialsByGrade, MaterialGrade } from '@elite-dangerous-almanac/core/materials';
 * import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';
 *
 * getMaterialByName('iron', RAW_MATERIALS)?.grade;         // -> MaterialGrade.VeryCommon
 * materialsByGrade(MaterialGrade.Rare, RAW_MATERIALS).length; // -> 7
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
