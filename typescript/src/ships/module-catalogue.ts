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
export type ModuleRecord = Omit<OutfittingModule, 'category'>;

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
    // Spread first, category last: the file the record came from is what decides the
    // category, so it wins even if a payload were ever to grow one of its own.
    return deepFreeze(records.map((record) => ({ ...record, category })));
}
