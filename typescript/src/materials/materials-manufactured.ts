/**
 * The catalogue of **manufactured** materials — the ten standard five-grade lines
 * (Chemical, Thermic, Heat, Conductive, Mechanical Components, Capacitors,
 * Shielding, Composite, Crystals, Alloys) plus the Guardian and Thargoid materials.
 *
 * Search it with the query functions in `./materials`.
 *
 * Data from EDCD FDevIDs, with Thargoid materials absent from that pinned source
 * graded by INARA; see [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Material } from './materials.js';
import { buildMaterialCatalogue, type MaterialRecord } from './material-catalogue.js';
import manufacturedData from '../../../data/materials/materials-manufactured.jsonc' with { type: 'json' };

/**
 * All manufactured materials, sorted by line then grade.
 *
 * @remarks
 * Every record has `category: 'manufactured'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * MANUFACTURED_MATERIALS.find((m) => m.name === 'Imperial Shielding')?.grade;
 * // -> MaterialGrade.VeryRare (5)
 * ```
 */
export const MANUFACTURED_MATERIALS: readonly Material[] = buildMaterialCatalogue(
    manufacturedData as readonly MaterialRecord[],
    'manufactured',
);
