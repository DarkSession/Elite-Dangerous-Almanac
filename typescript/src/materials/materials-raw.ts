/**
 * The catalogue of **raw** materials — the chemical elements, in seven lines of four
 * grades (grade 1–4; raw materials have no grade 5).
 *
 * Each line is named after its grade-1 element: Carbon, Phosphorus, Sulphur, Iron,
 * Nickel, Rhenium, Lead. Search it with the query functions in `./materials`.
 *
 * Data from EDCD FDevIDs; see [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Material } from './materials.js';
import { buildMaterialCatalogue, type MaterialRecord } from './internal/material-catalogue.js';
import rawData from '../../../data/materials/materials-raw.jsonc' with { type: 'json' };

/**
 * Every raw material, sorted by line then grade.
 *
 * @remarks
 * Every record has `category: 'raw'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';
 *
 * RAW_MATERIALS.find((m) => m.name === 'Iron')?.elementSymbol; // -> 'Fe'
 * ```
 */
export const RAW_MATERIALS: readonly Material[] = buildMaterialCatalogue(
    rawData as readonly MaterialRecord[],
    'raw',
);
