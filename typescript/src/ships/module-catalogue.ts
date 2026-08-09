/** Internal construction helpers for the public outfitting-module catalogues. */

import type { ModuleCategory, OutfittingModule } from './modules.js';
import { deepFreeze } from '../deep-freeze.js';

/**
 * The on-disk module shape: an {@link OutfittingModule} minus the one field the data
 * files do not carry.
 *
 * @remarks
 * A record's outfitting category is which `data/ships/modules-*.jsonc` file it was
 * read from, so the payload states it nowhere and {@link buildModuleCatalogue} adds
 * it back. Every other field is on the record.
 */
export type ModuleRecord = Omit<OutfittingModule, 'category' | 'kind'> & {
    readonly kind?: OutfittingModule['kind'];
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
    // see. (`materials/material-catalogue.ts` reaches the same guarantee by naming
    // every field explicitly; a module record has some sixty, so it spreads instead.)
    return deepFreeze(
        records.map((record) => ({ ...record, kind: record.kind ?? null, category })),
    );
}
