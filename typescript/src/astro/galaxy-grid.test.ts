import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    GALAXY_ORIGIN,
    SECTOR_EDGE_LY,
    sectorGridPositionFromGalacticPosition,
    sectorNameFromGalacticPosition,
} from './galaxy-grid.js';
import { sectorGridPositionFromName } from './sector-name.js';
import type { sectorNameFromGridPosition } from './sector-name.js';
import type { GalacticPosition } from './galactic-position.js';
import { parseSystemName } from './system-name.js';
import {
    CODEX_REGION_MAP_X0,
    CODEX_REGION_MAP_Y0,
    CODEX_REGION_MAP_Z0,
    findCodexRegionForBoxel,
} from './codex-region-lookup.js';
import { SECTOR_INTERNAL_SIZE } from './naming-region-origins.js';
import { REAL_NEBULAE } from './nebulae-real.js';
import { PROCGEN_NEBULAE } from './nebulae-procgen.js';
import addresses from '../../../fixtures/astro/system-addresses.json' with { type: 'json' };
import nebulae from '../../../fixtures/astro/nebulae.json' with { type: 'json' };

test('the galaxy origin matches the region map projection', () => {
    // `GALAXY_ORIGIN` is a plain constant so a coordinate conversion never pulls in
    // the region-cell grid; this guards the two copies against drift.
    assert.deepEqual(
        { x: GALAXY_ORIGIN.x, y: GALAXY_ORIGIN.y, z: GALAXY_ORIGIN.z },
        { x: CODEX_REGION_MAP_X0, y: CODEX_REGION_MAP_Y0, z: CODEX_REGION_MAP_Z0 },
    );
});

test('the sector edge is the internal sector size in light-years', () => {
    assert.equal(SECTOR_EDGE_LY, SECTOR_INTERNAL_SIZE / 32);
});

test('galactic and sector-grid positions cannot be mixed accidentally', () => {
    const position: GalacticPosition = { x: 751, y: -179, z: -91 };
    const sector = sectorGridPositionFromGalacticPosition(position);
    assert.deepEqual(Object.keys(sector), ['sectorX', 'sectorY', 'sectorZ']);
    // @ts-expect-error Sector axes are deliberately distinct from galactic axes.
    const invalidSector: Parameters<typeof sectorNameFromGridPosition>[0] = position;
    assert.equal(invalidSector, position);
});

test('resolves the documented example from EDSM coordinates', () => {
    // Synuefe EN-H d11-96 sits at (751, -179, -91).
    assert.deepEqual(sectorGridPositionFromGalacticPosition({ x: 751, y: -179, z: -91 }), {
        sectorX: 39,
        sectorY: 31,
        sectorZ: 18,
    });
    assert.equal(sectorNameFromGalacticPosition({ x: 751, y: -179, z: -91 }), 'Synuefe');
});

test('agrees with the boxel corner of every fixture address', () => {
    for (const system of addresses.systems) {
        const sectorPosition = sectorGridPositionFromName(system.region);
        if (sectorPosition === null) continue; // hand-authored region, not a grid sector

        // `findCodexRegionForBoxel` projects the address to light-years through the
        // region-map data — an independent path to the same galaxy corner.
        const corner = findCodexRegionForBoxel(BigInt(system.id64));
        assert.deepEqual(
            sectorGridPositionFromGalacticPosition(corner),
            sectorPosition,
            `${system.name}: boxel corner resolved to the wrong sector`,
        );
        assert.equal(sectorNameFromGalacticPosition(corner), system.region, system.name);
    }
});

test('names the sector of every catalogued procedural system', () => {
    let checked = 0;
    for (const record of [...REAL_NEBULAE, ...PROCGEN_NEBULAE, ...nebulae.records]) {
        // Only systems whose region really is a procedural sector: a system inside a
        // hand-authored region is named after the region, not its grid sector.
        const region = parseSystemName(record.system)?.regionName;
        if (region === undefined || sectorGridPositionFromName(region) === null) continue;

        assert.equal(
            sectorNameFromGalacticPosition({ x: record.x, y: record.y, z: record.z }),
            region,
            `${record.system} at (${record.x}, ${record.y}, ${record.z})`,
        );
        checked += 1;
    }
    assert.ok(checked > 10, `expected several procedural systems in the fixture, got ${checked}`);
});

test('rejects a position outside the sector grid', () => {
    assert.throws(() => sectorGridPositionFromGalacticPosition({ x: 1e9, y: 0, z: 0 }), {
        name: 'RangeError',
        message: /outside the sector grid/,
    });
    assert.throws(
        () => sectorGridPositionFromGalacticPosition({ x: -60_000, y: 0, z: 0 }),
        RangeError,
    );
});
