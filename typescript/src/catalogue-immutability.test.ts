import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CODEX_REGIONS } from './astro/codex-region.js';
import { HAND_AUTHORED_REGIONS } from './astro/hand-authored-regions.js';
import { getHandAuthoredRegionOrigin } from './astro/naming-region-origins.js';
import { ALL_NEBULAE } from './astro/nebulae-all.js';
import { ALL_MATERIALS } from './materials/materials-all.js';
import { RAW_MATERIALS } from './materials/materials-raw.js';
import { MANUFACTURED_MATERIALS } from './materials/materials-manufactured.js';
import { ENCODED_MATERIALS } from './materials/materials-encoded.js';
import { ALL_MICRO_RESOURCES } from './materials/micro-resources-all.js';
import { COMPONENT_MICRO_RESOURCES } from './materials/micro-resources-component.js';
import { CONSUMABLE_MICRO_RESOURCES } from './materials/micro-resources-consumable.js';
import { DATA_MICRO_RESOURCES } from './materials/micro-resources-data.js';
import { ITEM_MICRO_RESOURCES } from './materials/micro-resources-item.js';
import { ALL_MODULES } from './ships/modules-all.js';
import { CORE_MODULES } from './ships/modules-core.js';
import { INTERNAL_MODULES } from './ships/modules-internal.js';
import { HARDPOINT_MODULES } from './ships/modules-hardpoint.js';
import { UTILITY_MODULES } from './ships/modules-utility.js';
import { SHIPS } from './ships/ships.js';
import { SLOT_RESTRICTION_LABELS } from './ships/slots.js';
import { ALL_COMMODITIES } from './commodities/commodities-all.js';
import { COMMODITIES } from './commodities/commodities-standard.js';
import { RARE_COMMODITIES } from './commodities/commodities-rare.js';

test('every exported object catalogue and all of its records are frozen', () => {
    // Every published catalogue, not only the combined ones: a lookup indexes a
    // catalogue exactly when the array and all of its records are frozen, so a subset
    // that stopped being frozen would quietly drop to a linear scan, and one that was
    // frozen only shallowly would be indexed on keys its records could still change.
    const catalogues: readonly (readonly object[])[] = [
        CODEX_REGIONS,
        HAND_AUTHORED_REGIONS,
        ALL_NEBULAE,
        ALL_MATERIALS,
        RAW_MATERIALS,
        MANUFACTURED_MATERIALS,
        ENCODED_MATERIALS,
        ALL_MICRO_RESOURCES,
        COMPONENT_MICRO_RESOURCES,
        CONSUMABLE_MICRO_RESOURCES,
        DATA_MICRO_RESOURCES,
        ITEM_MICRO_RESOURCES,
        ALL_MODULES,
        CORE_MODULES,
        INTERNAL_MODULES,
        HARDPOINT_MODULES,
        UTILITY_MODULES,
        SHIPS,
        ALL_COMMODITIES,
        COMMODITIES,
        RARE_COMMODITIES,
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
    const region = CODEX_REGIONS[0]!;
    assert.equal(Object.isFrozen(region.bounds), true);
    assert.equal(Object.isFrozen(region.centroid), true);

    const handAuthored = HAND_AUTHORED_REGIONS[0]!;
    assert.equal(Object.isFrozen(handAuthored.spheres), true);
    assert.ok(handAuthored.spheres.every((sphere) => Object.isFrozen(sphere)));

    const origin = getHandAuthoredRegionOrigin('Pleiades Sector');
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
