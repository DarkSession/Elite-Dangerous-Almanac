import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getMicroResource,
    getMicroResourceBySymbol,
    getMicroResourceByName,
    microResourcesInCategory,
    type MicroResource,
    type MicroResourceCategory,
} from './micro-resources.js';
import { COMPONENT_MICRO_RESOURCES } from './micro-resources-component.js';
import { CONSUMABLE_MICRO_RESOURCES } from './micro-resources-consumable.js';
import { DATA_MICRO_RESOURCES } from './micro-resources-data.js';
import { ITEM_MICRO_RESOURCES } from './micro-resources-item.js';
import { ALL_MICRO_RESOURCES } from './micro-resources-all.js';
import microResourcesFixture from '../../../fixtures/materials/micro-resources.json' with { type: 'json' };

const CATALOGUES: Record<string, readonly MicroResource[]> = {
    component: COMPONENT_MICRO_RESOURCES,
    consumable: CONSUMABLE_MICRO_RESOURCES,
    data: DATA_MICRO_RESOURCES,
    item: ITEM_MICRO_RESOURCES,
    all: ALL_MICRO_RESOURCES,
};

const CATEGORIES: readonly MicroResourceCategory[] = ['component', 'consumable', 'data', 'item'];

for (const [name, expected] of Object.entries(microResourcesFixture.counts)) {
    test(`the ${name} micro-resource catalogue holds ${expected} entries`, () => {
        assert.equal(CATALOGUES[name]!.length, expected);
    });
}

test('ALL_MICRO_RESOURCES is exactly the four catalogues concatenated', () => {
    assert.deepEqual(ALL_MICRO_RESOURCES, [
        ...COMPONENT_MICRO_RESOURCES,
        ...CONSUMABLE_MICRO_RESOURCES,
        ...DATA_MICRO_RESOURCES,
        ...ITEM_MICRO_RESOURCES,
    ]);
});

test('fixture records resolve by symbol and name with the expected fields', () => {
    for (const expected of microResourcesFixture.records) {
        const bySymbol = getMicroResourceBySymbol(expected.symbol, ALL_MICRO_RESOURCES);
        assert.ok(bySymbol, `missing ${expected.symbol}`);
        assert.deepEqual(bySymbol, expected);
        // The same record is reachable by its display name.
        assert.deepEqual(getMicroResourceByName(expected.name, ALL_MICRO_RESOURCES), expected);
    }
});

test('getMicroResourceBySymbol matches the Frontier symbol / journal id, case-insensitively', () => {
    // The journal reports the lower-cased symbol; a mixed-case or padded query still resolves.
    assert.equal(
        getMicroResourceBySymbol('CircuitBoard', COMPONENT_MICRO_RESOURCES)?.name,
        'Circuit Board',
    );
    assert.equal(
        getMicroResourceBySymbol('  circuitboard  ', COMPONENT_MICRO_RESOURCES)?.name,
        'Circuit Board',
    );
    assert.equal(
        getMicroResourceByName('  circuit board  ', COMPONENT_MICRO_RESOURCES)?.symbol,
        'circuitboard',
    );
    assert.equal(getMicroResourceBySymbol('nonexistent', ALL_MICRO_RESOURCES), null);
    assert.equal(getMicroResourceByName('nonexistent', ALL_MICRO_RESOURCES), null);
});

test('an empty key never coincidentally matches a record', () => {
    assert.equal(getMicroResourceBySymbol('', ALL_MICRO_RESOURCES), null);
    assert.equal(getMicroResourceByName('', ALL_MICRO_RESOURCES), null);
});

test('symbols and names are unique across the whole catalogue', () => {
    const symbols = new Set(ALL_MICRO_RESOURCES.map((r) => r.symbol.toLowerCase()));
    const names = new Set(ALL_MICRO_RESOURCES.map((r) => r.name.toLowerCase()));
    assert.equal(symbols.size, ALL_MICRO_RESOURCES.length);
    assert.equal(names.size, ALL_MICRO_RESOURCES.length);
});

test('microResourcesInCategory returns exactly the requested category', () => {
    for (const category of CATEGORIES) {
        const found = microResourcesInCategory(category, ALL_MICRO_RESOURCES);
        assert.ok(found.length > 0);
        assert.ok(found.every((r) => r.category === category));
        // Every category catalogue is homogeneous and matches the ALL slice.
        assert.deepEqual(found, [...CATALOGUES[category]!]);
    }
});

test('microResourcesInCategory ignores case and whitespace', () => {
    const consumables = microResourcesInCategory('consumable', ALL_MICRO_RESOURCES);
    assert.ok(consumables.length > 0);
    for (const spelling of ['Consumable', 'CONSUMABLE', ' consumable ']) {
        assert.deepEqual(
            microResourcesInCategory(spelling, ALL_MICRO_RESOURCES),
            consumables,
            `${spelling} should resolve like 'consumable'`,
        );
    }
});

test('every micro-resource category value is a known category', () => {
    const known = new Set<string>(CATEGORIES);
    for (const resource of ALL_MICRO_RESOURCES) {
        assert.ok(known.has(resource.category), `unknown category ${resource.category}`);
    }
});

test('every lookup searches all micro resources when no catalogue is given', () => {
    assert.equal(getMicroResourceBySymbol('circuitboard')?.name, 'Circuit Board');
    assert.equal(getMicroResourceByName('circuit board')?.symbol, 'circuitboard');
    assert.equal(microResourcesInCategory('consumable').length, CONSUMABLE_MICRO_RESOURCES.length);
    // A record from every category is reachable without naming its catalogue.
    for (const category of CATEGORIES) {
        const first = CATALOGUES[category]![0]!;
        assert.deepEqual(getMicroResourceBySymbol(first.symbol), first);
    }
});

test('an explicit catalogue still narrows the search', () => {
    // Graphene is a component, so a consumable-only search must not find it.
    assert.equal(getMicroResourceBySymbol('graphene', CONSUMABLE_MICRO_RESOURCES), null);
    assert.equal(getMicroResourceBySymbol('graphene', COMPONENT_MICRO_RESOURCES)?.name, 'Graphene');
    assert.deepEqual(microResourcesInCategory('item', COMPONENT_MICRO_RESOURCES), []);
});

test('getMicroResource resolves a symbol or a display name', () => {
    const board = getMicroResourceBySymbol('circuitboard', COMPONENT_MICRO_RESOURCES);
    assert.ok(board);
    // Both keys reach the same record — the caller need not know which it holds.
    assert.deepEqual(getMicroResource('circuitboard'), board);
    assert.deepEqual(getMicroResource(' Circuit Board '), board);
    assert.equal(getMicroResource('nonexistent'), null);
    assert.equal(getMicroResource(''), null);
    // The catalogue argument narrows it like every other lookup.
    assert.equal(getMicroResource('circuit board', CONSUMABLE_MICRO_RESOURCES), null);
});

test('catalogues and their records are frozen', () => {
    const graphene = getMicroResourceBySymbol('graphene', COMPONENT_MICRO_RESOURCES);
    assert.ok(graphene);
    assert.equal(Object.isFrozen(COMPONENT_MICRO_RESOURCES), true);
    assert.equal(Object.isFrozen(ALL_MICRO_RESOURCES), true);
    assert.equal(Object.isFrozen(graphene), true);
    assert.throws(() => Object.assign(graphene, { name: 'Changed' }), TypeError);
    assert.throws(
        () => Array.prototype.push.call(COMPONENT_MICRO_RESOURCES, graphene as unknown),
        TypeError,
    );
});
