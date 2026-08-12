/** Internal construction helpers for the public nebula catalogues. */

import { deepFreeze } from '../../internal/deep-freeze.js';
import type { Nebula, NebulaType } from '../nebulae.js';

/** A real or procedurally generated nebula before its file-derived type is added. */
export type NamedNebulaRecord = Omit<Nebula, 'type'>;

/**
 * A planetary nebula before its file-derived type and usually redundant system are added.
 *
 * `system` is present only when it differs from `name`, such as when a community name is
 * appended to the nebula name.
 */
export type PlanetaryNebulaRecord = Omit<Nebula, 'system' | 'type'> & {
    readonly system?: string;
};

/** Build and freeze the planetary catalogue, restoring its derived public fields. */
export function buildNebulaCatalogue(
    records: readonly PlanetaryNebulaRecord[],
    type: 'planetary',
): readonly Nebula[];

/** Build and freeze a named nebula catalogue, restoring its file-derived public type. */
export function buildNebulaCatalogue(
    records: readonly NamedNebulaRecord[],
    type: Exclude<NebulaType, 'planetary'>,
): readonly Nebula[];

export function buildNebulaCatalogue(
    records: readonly PlanetaryNebulaRecord[],
    type: NebulaType,
): readonly Nebula[] {
    return deepFreeze(
        records.map((record) => ({
            name: record.name,
            system: record.system ?? record.name,
            x: record.x,
            y: record.y,
            z: record.z,
            type,
            regionId: record.regionId,
        })),
    );
}
