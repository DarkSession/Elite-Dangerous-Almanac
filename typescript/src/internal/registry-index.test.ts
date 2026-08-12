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

/** A stand-in for the public parameter a real caller would name. */
const LABEL = 'getShipBySymbol: symbol';

test('normalizeKey ignores case and surrounding whitespace', () => {
    assert.equal(normalizeKey('  Int_Hyperdrive_Size6  ', LABEL), 'int_hyperdrive_size6');
    assert.equal(normalizeKey(undefined, LABEL), undefined);
    // A field an import did not carry reaches a comparison as either nullish spelling.
    assert.equal(normalizeKey(null as unknown as undefined, LABEL), undefined);
});

test('a wrong-typed key names the parameter rather than failing inside the lookup', () => {
    const catalogue = [{ symbol: 'Gold' }];
    const index = createKeyIndex(catalogue, 'symbol');
    const expected = {
        name: 'TypeError',
        message: 'getShipBySymbol: symbol must be a string, received number 42',
    };
    assert.throws(() => normalizeKey(42 as unknown as string, LABEL), expected);
    assert.throws(() => findInKeyIndex(index, 42 as unknown as string, LABEL), expected);
    assert.throws(() => findByKey(catalogue, 'symbol', 42 as unknown as string, LABEL), expected);
    assert.throws(() => filterByKey(catalogue, 'symbol', 42 as unknown as string, LABEL), expected);
    assert.throws(() => findByRawKey({ Gold: 1 }, 42 as unknown as string, LABEL), expected);
});

test('a missing key stays a miss rather than becoming a caller bug', () => {
    // The strict factories are where a missing argument is loud; a search answers it the
    // way it answers a symbol no record carries.
    const catalogue = [{ symbol: 'Gold' }];
    const index = createKeyIndex(catalogue, 'symbol');
    assert.equal(findInKeyIndex(index, undefined as unknown as string, LABEL), null);
    assert.equal(findInKeyIndex(index, null as unknown as string, LABEL), null);
    assert.equal(findByKey(catalogue, 'symbol', undefined as unknown as string, LABEL), null);
    assert.deepEqual(filterByKey(catalogue, 'symbol', null as unknown as string, LABEL), []);
    assert.equal(findByRawKey({ Gold: 1 }, undefined as unknown as string, LABEL), null);
});

test('scan lookups normalize both sides and retain catalogue order', () => {
    const catalogue: Record_[] = [
        { symbol: 'Dupe', ship: 'First' },
        { symbol: 'dupe', ship: 'Second' },
        { symbol: 'other' },
    ];
    assert.equal(findByKey(catalogue, 'symbol', ' DUPE ', LABEL)?.ship, 'First');
    assert.deepEqual(
        filterByKey(catalogue, 'symbol', 'dupe', LABEL).map((record) => record.ship),
        ['First', 'Second'],
    );
    assert.equal(findByKey(catalogue, 'ship', '', LABEL), null);
    assert.deepEqual(filterByKey(catalogue, 'ship', '', LABEL), []);
});

test('scan lookups read caller-owned catalogues at the time of each call', () => {
    const record = { symbol: 'Gold' };
    const catalogue = [record];
    assert.equal(findByKey(catalogue, 'symbol', 'gold', LABEL), record);
    record.symbol = 'Platinum';
    assert.equal(findByKey(catalogue, 'symbol', 'gold', LABEL), null);
    assert.equal(findByKey(catalogue, 'symbol', 'platinum', LABEL), record);
});

test('filterByKey always returns a fresh array', () => {
    const catalogue = [{ symbol: 'a' }, { symbol: 'a' }];
    const first = filterByKey(catalogue, 'symbol', 'a', LABEL);
    first.length = 0;
    assert.equal(filterByKey(catalogue, 'symbol', 'a', LABEL).length, 2);
});

test('a raw-keyed lookup answers the exact key before folding case', () => {
    const catalogue = { FSD_LongRange: 'exact', fsd_longrange: 'folded' };
    assert.equal(findByRawKey(catalogue, 'FSD_LongRange', LABEL), 'exact');
    assert.equal(findByRawKey(catalogue, 'fsd_longrange', LABEL), 'folded');
    assert.equal(findByRawKey(catalogue, ' FSD_LONGRANGE ', LABEL), 'exact');
    assert.equal(findByRawKey(catalogue, 'NoSuchBlueprint', LABEL), null);
});

test('a raw-keyed lookup ignores inherited properties', () => {
    assert.equal(findByRawKey<unknown>({}, 'toString', LABEL), null);
    assert.equal(findByRawKey<unknown>({}, 'constructor', LABEL), null);
});

test('a fixed index is immutable and keeps the first duplicate', () => {
    const first = { symbol: 'Dupe', ship: 'First' };
    const index = createKeyIndex([first, { symbol: 'dupe', ship: 'Second' }], 'symbol');
    assert.equal(findInKeyIndex(index, ' DUPE ', LABEL), first);
    assert.equal(findInKeyIndex(index, 'missing', LABEL), null);
    assert.ok(Object.isFrozen(index));
    assert.throws(() => Object.assign(index, { extra: first }), TypeError);
});

test('a fixed index skips nullable keys', () => {
    const index = createKeyIndex<Record_>(
        [{ symbol: 'a', ship: null }, { symbol: 'b' }, { symbol: 'c', ship: 'Anaconda' }],
        'ship',
    );
    assert.equal(findInKeyIndex(index, '', LABEL), null);
    assert.equal(findInKeyIndex(index, 'anaconda', LABEL)?.symbol, 'c');
});
