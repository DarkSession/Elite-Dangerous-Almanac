import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GALACTIC_REGIONS } from './astro/galactic-region.js';
import { HAND_AUTHORED_REGIONS } from './astro/hand-authored-regions.js';
import { getNamedRegionOrigin } from './astro/named-regions.js';
import { ALL_NEBULAE } from './astro/nebulae-all.js';
import { ALL_MATERIALS } from './materials/materials-all.js';
import { ALL_MICRO_RESOURCES } from './materials/micro-resources-all.js';
import { ALL_MODULES } from './ships/modules-all.js';
import { SHIPS } from './ships/ships.js';
import { ALL_COMMODITIES } from './commodities/commodities-all.js';

test('every exported object catalogue and all of its records are frozen', () => {
    const catalogues: readonly (readonly object[])[] = [
        GALACTIC_REGIONS,
        HAND_AUTHORED_REGIONS,
        ALL_NEBULAE,
        ALL_MATERIALS,
        ALL_MICRO_RESOURCES,
        ALL_MODULES,
        SHIPS,
        ALL_COMMODITIES,
    ];

    for (const catalogue of catalogues) {
        assert.equal(Object.isFrozen(catalogue), true);
        assert.ok(catalogue.every((record) => Object.isFrozen(record)));
    }
});

test('nested records and named origins are frozen', () => {
    const region = GALACTIC_REGIONS[0]!;
    assert.equal(Object.isFrozen(region.bounds), true);
    assert.equal(Object.isFrozen(region.centroid), true);

    const handAuthored = HAND_AUTHORED_REGIONS[0]!;
    assert.equal(Object.isFrozen(handAuthored.spheres), true);
    assert.ok(handAuthored.spheres.every((sphere) => Object.isFrozen(sphere)));

    const origin = getNamedRegionOrigin('Pleiades Sector');
    assert.ok(origin);
    assert.equal(Object.isFrozen(origin), true);
});

test('consumer mutation attempts fail instead of changing later lookups', () => {
    const ship = SHIPS[0]!;
    const originalName = ship.name;

    assert.throws(() => Object.assign(ship, { name: 'Changed' }), TypeError);
    assert.throws(() => Array.prototype.push.call(SHIPS, ship), TypeError);
    assert.equal(SHIPS[0]!.name, originalName);
});
