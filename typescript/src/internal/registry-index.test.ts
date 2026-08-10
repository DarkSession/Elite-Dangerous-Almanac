import { test } from 'node:test';
import assert from 'node:assert/strict';

import { filterByKey, findByKey, normalizeKey } from './registry-index.js';

interface Record_ {
    readonly symbol: string;
    readonly ship?: string | null;
}

/** A catalogue the helpers will index: array and records all frozen. */
const indexed = <T extends object>(records: T[]): readonly T[] =>
    Object.freeze(records.map((record) => Object.freeze(record)));

/** A catalogue the helpers must scan: nothing frozen. */
const scanned = <T extends object>(records: T[]): readonly T[] => records;

test('normalizeKey ignores case and surrounding whitespace', () => {
    assert.equal(normalizeKey('  Int_Hyperdrive_Size6  '), 'int_hyperdrive_size6');
});

// The index and the linear fallback are two implementations of one matching rule, so
// every rule below is asserted against both. Running these over only one path is how a
// mutation in the other survives a suite that still reports full coverage.
for (const [path, build] of [
    ['indexed', indexed],
    ['scanned', scanned],
] as const) {
    test(`${path}: a key matches whatever the casing and padding on either side`, () => {
        const catalogue = build([{ symbol: 'Int_Hyperdrive_Size6_Class5' }]);
        for (const wanted of ['int_hyperdrive_size6_class5', '  INT_HYPERDRIVE_SIZE6_CLASS5 \t']) {
            assert.equal(findByKey(catalogue, 'symbol', wanted)?.symbol, catalogue[0]!.symbol);
        }
    });

    test(`${path}: findByKey answers with the first match, as the scan it replaces did`, () => {
        // A catalogue is not supposed to carry one key twice, but if one ever does the
        // answer must not silently move to the other record.
        const catalogue = build([
            { symbol: 'dupe', ship: 'first' },
            { symbol: 'dupe', ship: 'second' },
        ]);
        assert.equal(findByKey(catalogue, 'symbol', 'dupe')?.ship, 'first');
        assert.deepEqual(
            filterByKey(catalogue, 'symbol', 'dupe').map((r) => r.ship),
            ['first', 'second'],
        );
    });

    test(`${path}: a record with no key is in no bucket rather than in an empty-string one`, () => {
        const catalogue = build([
            { symbol: 'a', ship: null },
            { symbol: 'b' },
            { symbol: 'c', ship: 'Anaconda' },
        ]);
        assert.deepEqual(
            filterByKey(catalogue, 'ship', 'Anaconda').map((r) => r.symbol),
            ['c'],
        );
        assert.equal(findByKey(catalogue, 'ship', ''), null);
        assert.deepEqual(filterByKey(catalogue, 'ship', ''), []);
    });

    test(`${path}: two fields of one catalogue are answered separately`, () => {
        const catalogue = build([{ symbol: 'Anaconda', ship: 'Python' }]);
        assert.equal(findByKey(catalogue, 'symbol', 'Anaconda')?.symbol, 'Anaconda');
        assert.equal(findByKey(catalogue, 'ship', 'Anaconda'), null);
        assert.equal(findByKey(catalogue, 'ship', 'Python')?.symbol, 'Anaconda');
    });

    test(`${path}: filterByKey hands back a fresh array, so one caller cannot edit the next answer`, () => {
        const catalogue = build([{ symbol: 'a' }, { symbol: 'a' }]);
        const first = filterByKey(catalogue, 'symbol', 'a');
        first.length = 0;
        assert.equal(filterByKey(catalogue, 'symbol', 'a').length, 2);
    });

    test(`${path}: an empty catalogue answers nothing rather than throwing`, () => {
        const empty = build([] as Record_[]);
        assert.equal(findByKey(empty, 'symbol', 'a'), null);
        assert.deepEqual(filterByKey(empty, 'symbol', 'a'), []);
    });
}

test('an indexed catalogue is read once; a scanned one on every call', () => {
    // The point of the module is that a repeated lookup stops re-reading the
    // catalogue. Without this, an implementation that quietly indexed nothing would
    // still answer correctly and pass every other test here.
    // Counts property reads through a proxy rather than timing anything, so it cannot
    // flake.
    const probe = (freeze: boolean): number => {
        let calls = 0;
        const records = ['a', 'b'].map(
            (symbol) =>
                new Proxy<Record_>(
                    { symbol },
                    {
                        get(target, property, receiver) {
                            if (property === 'symbol') calls++;
                            return Reflect.get(target, property, receiver) as unknown;
                        },
                    },
                ),
        );
        const catalogue = freeze ? indexed(records) : scanned(records);
        findByKey(catalogue, 'symbol', 'a');
        calls = 0;
        findByKey(catalogue, 'symbol', 'a');
        return calls;
    };
    assert.equal(probe(true), 0, 'a second lookup re-reads nothing');
    assert.ok(probe(false) > 0, 'an unindexable catalogue is re-read');
});

test('an unfrozen array of frozen records is never cached', () => {
    // `[...ALL_MODULES]` is exactly this shape. Membership can still change, so an
    // index built from it would answer from the records it held when first searched.
    const growing: Record_[] = [Object.freeze({ symbol: 'a' })];
    assert.equal(Object.isFrozen(growing), false);
    assert.equal(findByKey(growing, 'symbol', 'b'), null);
    growing.push(Object.freeze({ symbol: 'b' }));
    assert.equal(findByKey(growing, 'symbol', 'b')?.symbol, 'b');
    assert.equal(filterByKey(growing, 'symbol', 'b').length, 1);
});

test('a frozen array of mutable records is never cached', () => {
    // Freezing the array fixes which records are in it and says nothing about the keys
    // on them. Indexing on that alone would answer from a key the record no longer
    // carries, and answer its new key with nothing.
    const records: { symbol: string }[] = [{ symbol: 'Gold' }, { symbol: 'Silver' }];
    const catalogue = Object.freeze(records);
    assert.equal(findByKey(catalogue, 'symbol', 'Gold')?.symbol, 'Gold');

    records[0]!.symbol = 'Platinum';
    assert.equal(findByKey(catalogue, 'symbol', 'Platinum')?.symbol, 'Platinum');
    assert.equal(findByKey(catalogue, 'symbol', 'Gold'), null);

    // Back again: a catalogue remembered as unindexable must keep being read, not
    // answered from whichever state happened to be current when a cache was filled.
    records[0]!.symbol = 'Gold';
    assert.equal(findByKey(catalogue, 'symbol', 'Gold')?.symbol, 'Gold');
    assert.equal(findByKey(catalogue, 'symbol', 'Platinum'), null);
});

test('a frozen accessor field is scanned because freezing does not pin its answer', () => {
    let ship = 'Anaconda';
    const record = Object.freeze({
        symbol: 'armour',
        get ship(): string {
            return ship;
        },
    });
    const catalogue = Object.freeze([record]);

    assert.equal(findByKey(catalogue, 'ship', 'Anaconda'), record);
    ship = 'Python';
    assert.equal(findByKey(catalogue, 'ship', 'Anaconda'), null);
    assert.equal(findByKey(catalogue, 'ship', 'Python'), record);
});

test('a frozen inherited field is scanned because freezing does not pin its prototype', () => {
    const prototype = { ship: 'Anaconda' };
    const record = Object.freeze(
        Object.assign(Object.create(prototype) as Record_, { symbol: 'armour' }),
    );
    const catalogue = Object.freeze([record]);

    assert.equal(findByKey(catalogue, 'ship', 'Anaconda'), record);
    prototype.ship = 'Python';
    assert.equal(findByKey(catalogue, 'ship', 'Anaconda'), null);
    assert.equal(findByKey(catalogue, 'ship', 'Python'), record);
});

test('an absent own field is scanned because a mutable prototype can gain it later', () => {
    const prototype: { ship?: string } = {};
    const record = Object.freeze(
        Object.assign(Object.create(prototype) as Record_, { symbol: 'armour' }),
    );
    const catalogue = Object.freeze([record]);

    assert.equal(findByKey(catalogue, 'ship', 'Python'), null);
    prototype.ship = 'Python';
    assert.equal(findByKey(catalogue, 'ship', 'Python'), record);
});
