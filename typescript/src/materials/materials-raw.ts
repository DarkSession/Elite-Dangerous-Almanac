/**
 * The catalogue of **raw** materials — the 28 chemical elements, in seven lines of
 * four grades (grade 1–4; raw materials have no grade 5).
 *
 * Each line is named after its grade-1 element: Carbon, Phosphorus, Sulphur, Iron,
 * Nickel, Rhenium, Lead. Search it with the query functions in `./materials`.
 *
 * Data from EDCD FDevIDs; see [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Material } from './materials.js';
import { buildMaterialCatalogue, type MaterialRecord } from './material-catalogue.js';
import rawData from '../../../data/materials/materials-raw.jsonc' with { type: 'json' };

/**
 * All 28 raw materials, sorted by line then grade.
 *
 * @remarks
 * Every record has `category: 'raw'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * RAW_MATERIALS.length; // -> 28
 * RAW_MATERIALS.find((m) => m.name === 'Iron')?.elementSymbol; // -> 'Fe'
 * ```
 */
export const RAW_MATERIALS: readonly Material[] = buildMaterialCatalogue(
    rawData as readonly MaterialRecord[],
    'raw',
);
