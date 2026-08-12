/** Internal construction helpers for the public micro-resource catalogues. */

import { deepFreeze } from '../../internal/deep-freeze.js';
import type { MicroResource, MicroResourceCategory } from '../micro-resources.js';

/** The on-disk micro-resource shape before its file-derived category is added. */
export type MicroResourceRecord = Omit<MicroResource, 'category'>;

/** Build and freeze one category of micro-resource records. */
export function buildMicroResourceCatalogue(
    records: readonly MicroResourceRecord[],
    category: MicroResourceCategory,
): readonly MicroResource[] {
    return deepFreeze(
        records.map((record) => ({
            symbol: record.symbol,
            category,
            name: record.name,
        })),
    );
}
