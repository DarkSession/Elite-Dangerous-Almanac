/** Internal construction helpers for the public material catalogues. */

import type { Material, MaterialCategory } from '../materials.js';

/** The on-disk material shape before its catalogue-derived category is added. */
export type MaterialRecord = Omit<Material, 'category'>;

/** Build and freeze one category of material records. */
export function buildMaterialCatalogue(
    records: readonly MaterialRecord[],
    category: MaterialCategory,
): readonly Material[] {
    // Named field by field rather than spread: the payload arrives as `unknown` JSONC
    // and is cast, so naming the fields keeps a stray key in a data file out of the
    // public `Material` shape — which this function cannot otherwise see.
    return Object.freeze(
        records.map((record) =>
            Object.freeze({
                category,
                symbol: record.symbol,
                name: record.name,
                elementSymbol: record.elementSymbol,
                grade: record.grade,
                line: record.line,
            }),
        ),
    );
}
