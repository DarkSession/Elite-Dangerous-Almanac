import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CODEX_REGIONS, getCodexRegion, getCodexRegionByName } from './codex-region.js';
import {
    findCodexRegionAt,
    findCodexRegionForBoxel,
    CODEX_REGION_MAP_LY_PER_CELL,
} from './codex-region-lookup.js';
import type { GalacticPosition } from './galactic-position.js';
import fixture from '../../../fixtures/astro/galactic-region.json' with { type: 'json' };

test('there are exactly 42 galactic regions with contiguous ids 1..42', () => {
    assert.equal(CODEX_REGIONS.length, 42);
    CODEX_REGIONS.forEach((r, i) => assert.equal(r.id, i + 1));
});

test('getCodexRegion resolves by id and rejects out-of-range / outside-map ids', () => {
    assert.equal(getCodexRegion(18)?.name, 'Inner Orion Spur');
    assert.equal(getCodexRegion(42)?.name, 'The Void');
    assert.equal(getCodexRegion(0), null);
    assert.equal(getCodexRegion(43), null);
});

test('getCodexRegionByName ignores case and surrounding whitespace', () => {
    assert.equal(getCodexRegionByName('the void')?.id, 42);
    assert.equal(getCodexRegionByName('  GALACTIC CENTRE\n')?.id, 1);
    assert.equal(getCodexRegionByName('Nowhere'), null);
});

test('every region carries a plausible footprint', () => {
    for (const r of CODEX_REGIONS) {
        assert.ok(r.cellCount > 0, `${r.name} has no cells`);
        assert.ok(r.areaLy2 > 0);
        assert.ok(r.bounds.maxX >= r.bounds.minX);
        assert.ok(r.bounds.maxZ >= r.bounds.minZ);
        assert.ok(r.centroid.x >= r.bounds.minX && r.centroid.x <= r.bounds.maxX);
        assert.ok(r.centroid.z >= r.bounds.minZ && r.centroid.z <= r.bounds.maxZ);
    }
});

test('the grid cell size matches upstream (4096 / 83 ly)', () => {
    assert.ok(Math.abs(CODEX_REGION_MAP_LY_PER_CELL - 4096 / 83) < 1e-9);
});

for (const c of fixture.coords) {
    test(`findCodexRegionAt(${c.x}, ${c.z}) -> ${c.region ?? 'outside map'} (${c.name})`, () => {
        const hit = findCodexRegionAt({ x: c.x, z: c.z });
        assert.equal(hit?.id ?? 0, c.regionId);
        assert.equal(hit?.name ?? null, c.region);
    });
}

test('findCodexRegionAt takes a full galactic position, inline or held, and ignores y', () => {
    const flat = findCodexRegionAt({ x: 0, z: 0 });
    assert.equal(flat?.name, 'Inner Orion Spur');

    // The reason `CodexRegionPoint` exists: an inline `{ x, y, z }` is what a consumer
    // writes, and excess-property checking would reject a plain `{ x, z }` parameter.
    assert.equal(findCodexRegionAt({ x: 0, y: 0, z: 0 })?.id, flat?.id);
    assert.equal(findCodexRegionAt({ x: 0, y: 40_000, z: 0 })?.id, flat?.id);

    // A position from elsewhere in the library passes straight through.
    const held: GalacticPosition = { x: 0, y: -1234.5, z: 25_900 };
    assert.equal(findCodexRegionAt(held)?.name, 'Galactic Centre');
});

for (const b of fixture.boxels) {
    test(`findCodexRegionForBoxel(${b.id64}) -> ${b.region ?? 'outside map'} (${b.name})`, () => {
        const hit = findCodexRegionForBoxel(BigInt(b.id64));
        assert.equal(hit.x, b.x);
        assert.equal(hit.y, b.y);
        assert.equal(hit.z, b.z);
        assert.equal(hit.region?.id ?? 0, b.regionId);
        assert.equal(hit.region?.name ?? null, b.region);
    });
}
