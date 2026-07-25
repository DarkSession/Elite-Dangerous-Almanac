import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    GALAXY_ORIGIN,
    SECTOR_EDGE_LY,
    sectorCoordsFromGalacticCoords,
    sectorNameFromGalacticCoords,
} from './galaxy-grid.js';
import { sectorCoordsFromName } from './sector-name.js';
import { parseSystemName } from './system-name.js';
import {
    REGION_MAP_X0,
    REGION_MAP_Y0,
    REGION_MAP_Z0,
    findRegionForBoxel,
} from './galactic-region-lookup.js';
import { SECTOR_INTERNAL_SIZE } from './named-regions.js';
import { REAL_NEBULAE } from './nebulae-real.js';
import { PROCGEN_NEBULAE } from './nebulae-procgen.js';
import addresses from '../../../fixtures/astro/system-addresses.json' with { type: 'json' };
import nebulae from '../../../fixtures/astro/nebulae.json' with { type: 'json' };

test('the galaxy origin matches the region map projection', () => {
    // `GALAXY_ORIGIN` is a plain constant so a coordinate conversion never pulls in
    // the region-cell grid; this guards the two copies against drift.
    assert.deepEqual(
        { x: GALAXY_ORIGIN.x, y: GALAXY_ORIGIN.y, z: GALAXY_ORIGIN.z },
        { x: REGION_MAP_X0, y: REGION_MAP_Y0, z: REGION_MAP_Z0 },
    );
});

test('the sector edge is the internal sector size in light-years', () => {
    assert.equal(SECTOR_EDGE_LY, SECTOR_INTERNAL_SIZE / 32);
});

test('resolves the documented example from EDSM coordinates', () => {
    // Synuefe EN-H d11-96 sits at (751, -179, -91).
    assert.deepEqual(sectorCoordsFromGalacticCoords({ x: 751, y: -179, z: -91 }), {
        x: 39,
        y: 31,
        z: 18,
    });
    assert.equal(sectorNameFromGalacticCoords({ x: 751, y: -179, z: -91 }), 'Synuefe');
});

test('agrees with the boxel corner of every fixture address', () => {
    for (const system of addresses.systems) {
        const sectorCoords = sectorCoordsFromName(system.region);
        if (sectorCoords === null) continue; // hand-authored region, not a grid sector

        // `findRegionForBoxel` projects the address to light-years through the
        // region-map data — an independent path to the same galaxy corner.
        const corner = findRegionForBoxel(BigInt(system.id64));
        assert.deepEqual(
            sectorCoordsFromGalacticCoords(corner),
            sectorCoords,
            `${system.name}: boxel corner resolved to the wrong sector`,
        );
        assert.equal(sectorNameFromGalacticCoords(corner), system.region, system.name);
    }
});

test('names the sector of every catalogued procedural system', () => {
    let checked = 0;
    for (const record of [...REAL_NEBULAE, ...PROCGEN_NEBULAE, ...nebulae.records]) {
        // Only systems whose region really is a procedural sector: a system inside a
        // hand-authored region is named after the region, not its grid sector.
        const region = parseSystemName(record.system)?.regionName;
        if (region === undefined || sectorCoordsFromName(region) === null) continue;

        assert.equal(
            sectorNameFromGalacticCoords({ x: record.x, y: record.y, z: record.z }),
            region,
            `${record.system} at (${record.x}, ${record.y}, ${record.z})`,
        );
        checked += 1;
    }
    assert.ok(checked > 10, `expected several procedural systems in the fixture, got ${checked}`);
});

test('rejects a position outside the sector grid', () => {
    assert.throws(() => sectorCoordsFromGalacticCoords({ x: 1e9, y: 0, z: 0 }), {
        name: 'RangeError',
        message: /outside the sector grid/,
    });
    assert.throws(() => sectorCoordsFromGalacticCoords({ x: -60_000, y: 0, z: 0 }), RangeError);
});
