import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createKeyIndex,
    filterByKey,
    findByKey,
    findByRawKey,
    findInKeyIndex,
    normalizeKey,
} from './registry-index.js';

interface Record_ {
    readonly symbol: string;
    readonly ship?: string | null;
}

test('normalizeKey ignores case and surrounding whitespace', () => {
    assert.equal(normalizeKey('  Int_Hyperdrive_Size6  '), 'int_hyperdrive_size6');
    assert.equal(normalizeKey(undefined), undefined);
});

test('scan lookups normalize both sides and retain catalogue order', () => {
    const catalogue: Record_[] = [
        { symbol: 'Dupe', ship: 'First' },
        { symbol: 'dupe', ship: 'Second' },
        { symbol: 'other' },
    ];
    assert.equal(findByKey(catalogue, 'symbol', ' DUPE ')?.ship, 'First');
    assert.deepEqual(
        filterByKey(catalogue, 'symbol', 'dupe').map((record) => record.ship),
        ['First', 'Second'],
    );
    assert.equal(findByKey(catalogue, 'ship', ''), null);
    assert.deepEqual(filterByKey(catalogue, 'ship', ''), []);
});

test('scan lookups read caller-owned catalogues at the time of each call', () => {
    const record = { symbol: 'Gold' };
    const catalogue = [record];
    assert.equal(findByKey(catalogue, 'symbol', 'gold'), record);
    record.symbol = 'Platinum';
    assert.equal(findByKey(catalogue, 'symbol', 'gold'), null);
    assert.equal(findByKey(catalogue, 'symbol', 'platinum'), record);
});

test('filterByKey always returns a fresh array', () => {
    const catalogue = [{ symbol: 'a' }, { symbol: 'a' }];
    const first = filterByKey(catalogue, 'symbol', 'a');
    first.length = 0;
    assert.equal(filterByKey(catalogue, 'symbol', 'a').length, 2);
});

test('a raw-keyed lookup answers the exact key before folding case', () => {
    const catalogue = { FSD_LongRange: 'exact', fsd_longrange: 'folded' };
    assert.equal(findByRawKey(catalogue, 'FSD_LongRange'), 'exact');
    assert.equal(findByRawKey(catalogue, 'fsd_longrange'), 'folded');
    assert.equal(findByRawKey(catalogue, ' FSD_LONGRANGE '), 'exact');
    assert.equal(findByRawKey(catalogue, 'NoSuchBlueprint'), null);
});

test('a raw-keyed lookup ignores inherited properties', () => {
    assert.equal(findByRawKey<unknown>({}, 'toString'), null);
    assert.equal(findByRawKey<unknown>({}, 'constructor'), null);
});

test('a fixed index is immutable and keeps the first duplicate', () => {
    const first = { symbol: 'Dupe', ship: 'First' };
    const index = createKeyIndex([first, { symbol: 'dupe', ship: 'Second' }], 'symbol');
    assert.equal(findInKeyIndex(index, ' DUPE '), first);
    assert.equal(findInKeyIndex(index, 'missing'), null);
    assert.ok(Object.isFrozen(index));
    assert.throws(() => Object.assign(index, { extra: first }), TypeError);
});

test('a fixed index skips nullable keys', () => {
    const index = createKeyIndex<Record_>(
        [{ symbol: 'a', ship: null }, { symbol: 'b' }, { symbol: 'c', ship: 'Anaconda' }],
        'ship',
    );
    assert.equal(findInKeyIndex(index, ''), null);
    assert.equal(findInKeyIndex(index, 'anaconda')?.symbol, 'c');
});
