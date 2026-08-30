/** Internal construction helpers for the public outfitting-module catalogues. */

import type { ModuleCategory, OutfittingModule } from '../modules.js';
import type { OutfittingFamilyId } from '../module-families.js';
import type { CoreSlotType } from '../slots.js';
import { deepFreeze } from '../../internal/deep-freeze.js';

/**
 * The on-disk module shape. Data files call the engineering group `kind`, omit the
 * category, and omit a core module's family; public records expose the clearer
 * `engineeringGroup` name and carry a family on every record.
 *
 * @remarks
 * A record's outfitting category is which `data/ships/modules-*.jsonc` file it was
 * read from, so the payload states it nowhere and {@link buildModuleCatalogue} adds
 * it back. A core record's family is likewise already determined by the mount its
 * `slot` names, so the core payload states that nowhere either rather than repeating
 * one of eight ids 516 times. {@link buildModuleCatalogue} also renames `kind` at this
 * internal boundary, keeping the shared JSONC compact without leaking its ambiguous
 * source name into the consumer API.
 */
export type ModuleRecord = Omit<OutfittingModule, 'category' | 'engineeringGroup' | 'familyId'> & {
    readonly kind?: OutfittingModule['engineeringGroup'];
    readonly familyId?: OutfittingFamilyId;
};

/** The family each core mount's modules are listed under. */
const CORE_SLOT_FAMILY: Readonly<Record<CoreSlotType | 'armour', OutfittingFamilyId>> = {
    armour: 'armour',
    powerPlant: 'powerPlants',
    thrusters: 'engines',
    frameShiftDrive: 'fsd',
    lifeSupport: 'lifeSupport',
    powerDistributor: 'powerDistributors',
    sensors: 'sensors',
    fuelTank: 'fuelTanks',
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
            // A `slot` on a non-core record belongs to a Guardian Hybrid, which has its
            // own family and states it; only the core file leaves the family to its mount.
            familyId: record.familyId ?? CORE_SLOT_FAMILY[record.slot!],
            engineeringGroup: kind ?? null,
            category,
        })),
    );
}
