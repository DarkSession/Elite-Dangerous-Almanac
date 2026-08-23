/** Internal construction helpers for the public outfitting-module catalogues. */

import type { ModuleCategory, OutfittingModule } from '../modules.js';
import { deepFreeze } from '../../internal/deep-freeze.js';

/**
 * The on-disk module shape. Data files call the engineering group `kind`, omit the
 * category, and omit `family` only for core modules; public records expose the clearer
 * `engineeringGroup` name and normalize an absent family to `null`.
 *
 * @remarks
 * A record's outfitting category is which `data/ships/modules-*.jsonc` file it was
 * read from, so the payload states it nowhere and {@link buildModuleCatalogue} adds
 * it back. {@link buildModuleCatalogue} also renames `kind` at this internal boundary,
 * keeping the shared JSONC compact without leaking its ambiguous source name into the
 * consumer API.
 */
export type ModuleRecord = Omit<OutfittingModule, 'category' | 'engineeringGroup' | 'family'> & {
    readonly kind?: OutfittingModule['engineeringGroup'];
    readonly family?: string;
};

/**
 * Build and freeze one outfitting category's catalogue.
 *
 * @param records - The category's records, as parsed from its data file.
 * @param category - The category that file holds, which every record here gets.
 * @returns The frozen catalogue, records in file order.
 */
export function buildModuleCatalogue(
    records: readonly ModuleRecord[],
    category: ModuleCategory,
): readonly OutfittingModule[] {
    // Spread first, category last. The file a record came from is what decides its
    // category, so writing it after the spread makes the file win outright, even if a
    // payload were ever to grow a `category` of its own — which the schema, the type
    // above and `data-files.test.ts` all forbid, but none of which this function can
    // see. (`materials/internal/material-catalogue.ts` reaches the same guarantee by
    // naming every field explicitly; a module record has some sixty, so it spreads
    // instead.)
    return deepFreeze(
        records.map(({ kind, ...record }) => ({
            ...record,
            family: record.family ?? null,
            engineeringGroup: kind ?? null,
            category,
        })),
    );
}
