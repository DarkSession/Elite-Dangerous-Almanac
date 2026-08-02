/**
 * The catalogue of **encoded** materials (data) — the six standard five-grade
 * lines (Emission Data, Wake Scans, Shield Data, Encryption Files, Data Archives,
 * Encoded Firmware) plus the Guardian and Thargoid data materials.
 *
 * Search it with the query functions in `./materials`.
 *
 * Data from EDCD FDevIDs, with newer Thargoid materials from INARA (graded there,
 * not yet in FDevIDs); see [`data/materials/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/materials/SOURCES.md).
 *
 * @packageDocumentation
 */

import type { Material } from './materials.js';
import { buildMaterialCatalogue, type MaterialRecord } from './material-catalogue.js';
import encodedData from '../../../data/materials/materials-encoded.jsonc' with { type: 'json' };

/**
 * All encoded materials, sorted by line then grade.
 *
 * @remarks
 * Every record has `category: 'encoded'`. The array and its records are frozen.
 *
 * @example
 * ```ts
 * ENCODED_MATERIALS.find((m) => m.name === 'Datamined Wake Exceptions')?.grade; // -> 5
 * ```
 */
export const ENCODED_MATERIALS: readonly Material[] = buildMaterialCatalogue(
    encodedData as readonly MaterialRecord[],
    'encoded',
);
