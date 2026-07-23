import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    GALACTIC_REGIONS,
    getGalacticRegion,
    getGalacticRegionByName,
} from './galactic-region.js';
import {
    findRegionAt,
    findRegionForBoxel,
    REGION_MAP_LY_PER_CELL,
} from './galactic-region-lookup.js';
import fixture from '../../../fixtures/astro/galactic-region.json' with { type: 'json' };

test('there are exactly 42 galactic regions with contiguous ids 1..42', () => {
    assert.equal(GALACTIC_REGIONS.length, 42);
    GALACTIC_REGIONS.forEach((r, i) => assert.equal(r.id, i + 1));
});

test('getGalacticRegion resolves by id and rejects out-of-range / outside-map ids', () => {
    assert.equal(getGalacticRegion(18)?.name, 'Inner Orion Spur');
    assert.equal(getGalacticRegion(42)?.name, 'The Void');
    assert.equal(getGalacticRegion(0), null);
    assert.equal(getGalacticRegion(43), null);
});

test('getGalacticRegionByName is case-insensitive', () => {
    assert.equal(getGalacticRegionByName('the void')?.id, 42);
    assert.equal(getGalacticRegionByName('GALACTIC CENTRE')?.id, 1);
    assert.equal(getGalacticRegionByName('Nowhere'), null);
});

test('every region carries a plausible footprint', () => {
    for (const r of GALACTIC_REGIONS) {
        assert.ok(r.cellCount > 0, `${r.name} has no cells`);
        assert.ok(r.areaLy2 > 0);
        assert.ok(r.bounds.maxX >= r.bounds.minX);
        assert.ok(r.bounds.maxZ >= r.bounds.minZ);
        assert.ok(r.centroid.x >= r.bounds.minX && r.centroid.x <= r.bounds.maxX);
        assert.ok(r.centroid.z >= r.bounds.minZ && r.centroid.z <= r.bounds.maxZ);
    }
});

test('the grid cell size matches upstream (4096 / 83 ly)', () => {
    assert.ok(Math.abs(REGION_MAP_LY_PER_CELL - 4096 / 83) < 1e-9);
});

for (const c of fixture.coords) {
    test(`findRegionAt(${c.x}, ${c.z}) -> ${c.region ?? 'outside map'} (${c.name})`, () => {
        const hit = findRegionAt({ x: c.x, z: c.z });
        assert.equal(hit?.id ?? 0, c.regionId);
        assert.equal(hit?.name ?? null, c.region);
    });
}

for (const b of fixture.boxels) {
    test(`findRegionForBoxel(${b.id64}) -> ${b.region ?? 'outside map'} (${b.name})`, () => {
        const hit = findRegionForBoxel(BigInt(b.id64));
        assert.equal(hit.x, b.x);
        assert.equal(hit.y, b.y);
        assert.equal(hit.z, b.z);
        assert.equal(hit.region?.id ?? 0, b.regionId);
        assert.equal(hit.region?.name ?? null, b.region);
    });
}
