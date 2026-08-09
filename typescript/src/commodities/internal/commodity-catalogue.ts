/** Internal construction helpers for the public commodity catalogues. */

import type { Commodity, CommodityCategory } from '../commodities.js';

/** The on-disk commodity shape before its catalogue-derived `rare` flag is added. */
export interface CommodityRecord {
    readonly symbol: string;
    readonly name: string;
    readonly category: CommodityCategory;
}

/** Build and freeze one catalogue of commodity records, stamping the `rare` flag. */
export function buildCommodityCatalogue(
    records: readonly CommodityRecord[],
    rare: boolean,
): readonly Commodity[] {
    return Object.freeze(
        records.map((record) =>
            Object.freeze({
                symbol: record.symbol,
                name: record.name,
                category: record.category,
                rare,
            }),
        ),
    );
}
