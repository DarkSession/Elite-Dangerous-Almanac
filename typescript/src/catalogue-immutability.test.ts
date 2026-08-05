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
import { SLOT_RESTRICTION_LABELS } from './ships/slots.js';
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

test('exported lookup records are frozen too, not only the array catalogues', () => {
    // `setModule` builds its refusal message from this table, so a consumer able to
    // mutate it could silently rewrite the library's own error text.
    assert.equal(Object.isFrozen(SLOT_RESTRICTION_LABELS), true);
    assert.throws(
        () => Object.assign(SLOT_RESTRICTION_LABELS, { mining: 'anything at all' }),
        TypeError,
    );
    assert.equal(SLOT_RESTRICTION_LABELS.mining, 'mining tools');
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
