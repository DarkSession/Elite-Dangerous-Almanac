import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    getHandAuthoredRegionOrigin,
    resolveNamingRegionOrigin,
    SECTOR_INTERNAL_SIZE,
} from './naming-region-origins.js';

test('resolves hand-authored naming-region origins case-insensitively', () => {
    assert.equal(getHandAuthoredRegionOrigin('  PLEIADES SECTOR\n')?.name, 'Pleiades Sector');
    assert.equal(getHandAuthoredRegionOrigin('Synuefe'), null);
});

test('resolves procedural naming-region origins to a canonical record', () => {
    const canonical = resolveNamingRegionOrigin('Synuefe');
    assert.deepEqual(resolveNamingRegionOrigin('  SYNUEFE  '), canonical);
    assert.equal(canonical?.name, 'Synuefe');
    assert.equal(canonical?.sizeX, SECTOR_INTERNAL_SIZE);
    assert.equal(canonical?.sizeY, SECTOR_INTERNAL_SIZE);
    assert.equal(canonical?.sizeZ, SECTOR_INTERNAL_SIZE);
});

test('returns null when a naming region cannot be resolved', () => {
    assert.equal(resolveNamingRegionOrigin('not a region'), null);
});

test('an origin lookup names itself for a wrong-typed name', () => {
    for (const [call, label] of [
        [() => getHandAuthoredRegionOrigin(42 as unknown as string), 'getHandAuthoredRegionOrigin'],
        // Delegates to the catalogue lookup and the sector round-trip, and still names
        // the function the caller reached for.
        [() => resolveNamingRegionOrigin(42 as unknown as string), 'resolveNamingRegionOrigin'],
    ] as const) {
        assert.throws(call, {
            name: 'TypeError',
            message: `${label}: name must be a string, received number 42`,
        });
    }
    assert.equal(resolveNamingRegionOrigin(null as unknown as string), null);
});
