/**
 * Every engineering material — the raw, manufactured and encoded catalogues
 * concatenated.
 *
 * Importing this pulls all three data modules; when you only need one category,
 * import `RAW_MATERIALS`, `MANUFACTURED_MATERIALS` or `ENCODED_MATERIALS` from their
 * own module so a bundler can drop the rest.
 *
 * @packageDocumentation
 */

import type { Material } from './materials.js';
import { RAW_MATERIALS } from './materials-raw.js';
import { MANUFACTURED_MATERIALS } from './materials-manufactured.js';
import { ENCODED_MATERIALS } from './materials-encoded.js';

/**
 * All 146 materials across every category, raw then manufactured then encoded.
 *
 * @example
 * ```ts
 * ALL_MATERIALS.length; // -> 146
 * ```
 */
export const ALL_MATERIALS: readonly Material[] = Object.freeze([
    ...RAW_MATERIALS,
    ...MANUFACTURED_MATERIALS,
    ...ENCODED_MATERIALS,
]);
