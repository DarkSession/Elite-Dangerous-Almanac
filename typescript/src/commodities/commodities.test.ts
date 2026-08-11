import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getCommodityBySymbol,
    getCommodityByName,
    commoditiesInCategory,
    type Commodity,
    type CommodityCategory,
} from './commodities.js';
import { COMMODITIES } from './commodities-standard.js';
import { RARE_COMMODITIES } from './commodities-rare.js';
import { ALL_COMMODITIES } from './commodities-all.js';
import commoditiesFixture from '../../../fixtures/commodities/commodities.jsonc' with { type: 'json' };

const CATALOGUES: Record<string, readonly Commodity[]> = {
    standard: COMMODITIES,
    rare: RARE_COMMODITIES,
    all: ALL_COMMODITIES,
};

for (const [name, expected] of Object.entries(commoditiesFixture.counts)) {
    test(`the ${name} catalogue holds ${expected} commodities`, () => {
        assert.equal(CATALOGUES[name]!.length, expected);
    });
}

test('ALL_COMMODITIES is exactly the standard then rare catalogues concatenated', () => {
    assert.deepEqual(ALL_COMMODITIES, [...COMMODITIES, ...RARE_COMMODITIES]);
});

test('fixture records resolve by symbol and name with the expected fields', () => {
    for (const expected of commoditiesFixture.records) {
        const bySymbol = getCommodityBySymbol(expected.symbol, ALL_COMMODITIES);
        assert.ok(bySymbol, `missing ${expected.symbol}`);
        assert.deepEqual(bySymbol, expected);
        // The same record is reachable by its display name.
        assert.deepEqual(getCommodityByName(expected.name, ALL_COMMODITIES), expected);
    }
});

test('the rare flag is derived from the catalogue, not stored per record', () => {
    assert.ok(COMMODITIES.every((c) => c.rare === false));
    assert.ok(RARE_COMMODITIES.every((c) => c.rare === true));
    // A rare good resolves as rare through ALL_COMMODITIES too.
    assert.equal(getCommodityBySymbol('LavianBrandy', ALL_COMMODITIES)?.rare, true);
    assert.equal(getCommodityBySymbol('Platinum', ALL_COMMODITIES)?.rare, false);
});

test('getCommodityBySymbol matches the Frontier symbol / journal id, case-insensitively', () => {
    // The market/journal reports the lower-cased symbol; it must still resolve.
    assert.equal(getCommodityBySymbol('platinum', COMMODITIES)?.name, 'Platinum');
    assert.equal(getCommodityBySymbol('Platinum', COMMODITIES)?.name, 'Platinum');
    assert.equal(getCommodityByName('lavian brandy', RARE_COMMODITIES)?.symbol, 'LavianBrandy');
});

test('symbol and name lookups ignore surrounding whitespace', () => {
    assert.equal(getCommodityBySymbol('  gold  ', COMMODITIES)?.name, 'Gold');
    assert.equal(getCommodityByName('  Gold\n', COMMODITIES)?.symbol, 'Gold');
});

test('missing commodities resolve to null on every lookup', () => {
    assert.equal(getCommodityBySymbol('NoSuchGood', ALL_COMMODITIES), null);
    assert.equal(getCommodityByName('No Such Good', ALL_COMMODITIES), null);
    // An empty key never coincidentally matches a record.
    assert.equal(getCommodityBySymbol('', ALL_COMMODITIES), null);
    assert.equal(getCommodityByName('', ALL_COMMODITIES), null);
});

test('symbols are unique across the combined catalogue; standard and rare do not overlap', () => {
    const symbols = new Set(ALL_COMMODITIES.map((c) => c.symbol.toLowerCase()));
    assert.equal(symbols.size, ALL_COMMODITIES.length);
});

test('every category value is one the fixture lists, and every listed category is present', () => {
    const known = new Set<string>(commoditiesFixture.categories);
    for (const commodity of ALL_COMMODITIES) {
        assert.ok(known.has(commodity.category), `unknown category ${commodity.category}`);
    }
    // Every listed category actually appears somewhere in the combined catalogue.
    const present = new Set(ALL_COMMODITIES.map((c) => c.category));
    for (const category of commoditiesFixture.categories) {
        assert.ok(present.has(category as CommodityCategory), `missing category ${category}`);
    }
});

test('commoditiesInCategory selects exactly the requested market group', () => {
    for (const [category, count] of Object.entries(commoditiesFixture.categoryCounts)) {
        const found = commoditiesInCategory(category as CommodityCategory, ALL_COMMODITIES);
        assert.equal(found.length, count);
        assert.ok(found.every((c) => c.category === category));
    }
    // A category with no members in a given catalogue yields an empty array
    // (Minerals is a standard-only group, absent from the rares).
    assert.deepEqual(commoditiesInCategory('Minerals', RARE_COMMODITIES), []);
});

test('commoditiesInCategory ignores case and whitespace, like every other lookup', () => {
    const metals = commoditiesInCategory('Metals', COMMODITIES);
    assert.ok(metals.length > 0);
    for (const spelling of ['metals', 'METALS', ' Metals ']) {
        assert.deepEqual(
            commoditiesInCategory(spelling, COMMODITIES),
            metals,
            `${spelling} should resolve like 'Metals'`,
        );
    }
    // Multi-word groups too, where a caller is most likely to re-case.
    assert.deepEqual(
        commoditiesInCategory('consumer items', COMMODITIES),
        commoditiesInCategory('Consumer Items', COMMODITIES),
    );
});

test('every lookup searches both registries when no catalogue is given', () => {
    // The caller does not have to know whether a good is standard or rare first.
    assert.equal(getCommodityBySymbol('platinum')?.rare, false);
    assert.equal(getCommodityBySymbol('lavianbrandy')?.rare, true);
    assert.equal(getCommodityByName('lavian brandy')?.symbol, 'LavianBrandy');
    assert.equal(
        commoditiesInCategory('Metals').length,
        commoditiesInCategory('Metals', COMMODITIES).length +
            commoditiesInCategory('Metals', RARE_COMMODITIES).length,
    );
});

test('an explicit catalogue still narrows the search', () => {
    // Lavian Brandy is rare, so a standard-only search must not find it.
    assert.equal(getCommodityBySymbol('lavianbrandy', COMMODITIES), null);
    assert.equal(getCommodityByName('platinum', RARE_COMMODITIES), null);
    assert.deepEqual(commoditiesInCategory('Minerals', RARE_COMMODITIES), []);
});

test('catalogues and their records are frozen', () => {
    const platinum = getCommodityByName('Platinum', COMMODITIES);
    assert.ok(platinum);
    assert.equal(Object.isFrozen(COMMODITIES), true);
    assert.equal(Object.isFrozen(ALL_COMMODITIES), true);
    assert.equal(Object.isFrozen(platinum), true);
    assert.throws(() => Object.assign(platinum, { name: 'Changed' }), TypeError);
    assert.throws(() => Array.prototype.push.call(COMMODITIES, platinum as unknown), TypeError);
});
