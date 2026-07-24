/** Internal construction helpers for the public material catalogues. */

import type { Material, MaterialCategory, MaterialGrade, MaterialLine } from './materials.js';

/** The on-disk material shape before its catalogue-derived category is added. */
export interface MaterialRecord {
    readonly symbol: string;
    readonly name: string;
    readonly elementSymbol: string | null;
    readonly grade: MaterialGrade;
    readonly line: MaterialLine;
}

/** Build and freeze one category of material records. */
export function buildMaterialCatalogue(
    records: readonly MaterialRecord[],
    category: MaterialCategory,
): readonly Material[] {
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
