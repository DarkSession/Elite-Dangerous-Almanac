/** Internal construction helpers for the public commodity catalogues. */

import type { Commodity } from '../commodities.js';

/** The on-disk commodity shape before its catalogue-derived `rare` flag is added. */
export type CommodityRecord = Omit<Commodity, 'rare'>;

/** Build and freeze one catalogue of commodity records, stamping the `rare` flag. */
export function buildCommodityCatalogue(
    records: readonly CommodityRecord[],
    rare: boolean,
): readonly Commodity[] {
    // Named field by field rather than spread: the payload arrives as `unknown` JSONC
    // and is cast, so naming the fields keeps a stray key in a data file out of the
    // public `Commodity` shape — which this function cannot otherwise see.
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
