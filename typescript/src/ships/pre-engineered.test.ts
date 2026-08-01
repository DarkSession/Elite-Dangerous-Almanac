import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    PRE_ENGINEERED_MODULES,
    getPreEngineeredVariants,
    getPreEngineeredByBlueprint,
    isPreEngineered,
} from './pre-engineered.js';
import { BLUEPRINTS, getBlueprint, getBlueprintCost } from './blueprints.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import fixture from '../../../fixtures/ships/pre-engineered.json' with { type: 'json' };

test(`the catalogue holds ${fixture.count} pre-engineered variants`, () => {
    assert.equal(PRE_ENGINEERED_MODULES.length, fixture.count);
});

test('the catalogue splits by acquisition as expected', () => {
    for (const [acquisition, expected] of Object.entries(fixture.counts)) {
        assert.equal(
            PRE_ENGINEERED_MODULES.filter((v) => v.acquisition === acquisition).length,
            expected,
            acquisition,
        );
    }
});

test('pinned pairings carry the expected base module, blueprint, grade and effect', () => {
    for (const expected of fixture.records) {
        const found = PRE_ENGINEERED_MODULES.filter(
            (v) =>
                v.symbol === expected.symbol &&
                v.blueprint === expected.blueprint &&
                (v.experimental ?? null) === (expected.experimental ?? null),
        );
        assert.equal(found.length, 1, `${expected.symbol} / ${expected.blueprint}`);
        assert.deepEqual({ ...found[0] }, expected);
    }
});

test('every variant joins to a real module, blueprint and experimental effect', () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        assert.ok(
            getModuleBySymbol(variant.symbol, ALL_MODULES),
            `${variant.symbol} is not in the module catalogue`,
        );
        assert.ok(
            getBlueprint(variant.blueprint),
            `${variant.blueprint} is not in the blueprint catalogue`,
        );
        if (variant.experimental !== undefined) {
            assert.ok(
                EXPERIMENTAL_EFFECTS[variant.experimental],
                `${variant.experimental} is not in the experimental catalogue`,
            );
        }
    }
});

test('each variant carries the same display name as the module it fits as', () => {
    // `name` is denormalised so a shop list can render without pulling in ALL_MODULES.
    // That is a drift risk, so it is pinned: the two catalogues must always agree.
    for (const variant of PRE_ENGINEERED_MODULES) {
        const module = getModuleBySymbol(variant.symbol, ALL_MODULES)!;
        assert.equal(
            variant.name,
            module.name,
            `${variant.symbol}: pre-engineered name "${variant.name}" != catalogue "${module.name}"`,
        );
    }
});

test('a Merc-shop blueprint starts at grade 2 — grade 1 is what you bought', () => {
    // Only the Merc rows work this way. Community-goal rewards use ordinary journal
    // blueprints, which do define a grade 1, and mostly arrive at grade 5 already.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'mercenary') continue;
        assert.equal(variant.grade, 1);
        const grades = Object.keys(BLUEPRINTS[variant.blueprint]!.grades);
        assert.ok(!grades.includes('1'), `${variant.blueprint} still defines a grade 1 recipe`);
    }
});

test('a community-goal reward records a real grade of a real blueprint', () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'communityGoal') continue;
        const grades = Object.keys(BLUEPRINTS[variant.blueprint]!.grades);
        assert.ok(
            grades.includes(String(variant.grade)),
            `${variant.symbol}: ${variant.blueprint} has no grade ${variant.grade}`,
        );
    }
});

test('one base module can carry several pre-engineered variants', () => {
    const { symbol, blueprints } = fixture.multiVariant;
    assert.deepEqual(
        getPreEngineeredVariants(symbol).map((v) => v.blueprint),
        blueprints,
    );
});

test('the same blueprint on one module is two variants when the effect differs', () => {
    // A community-goal reward is identified by its experimental too: the medium seeker
    // rack has two High Capacity rewards that differ only in the effect applied.
    const { symbol, blueprint, experimentals } = fixture.sameBlueprintTwice;
    const found = getPreEngineeredVariants(symbol).filter((v) => v.blueprint === blueprint);
    assert.deepEqual(
        found.map((v) => v.experimental),
        experimentals,
    );
});

test('getPreEngineeredVariants normalises input and misses cleanly', () => {
    // The medium rail gun is both a Merc shop row and a community-goal reward.
    assert.equal(getPreEngineeredVariants('  hpt_railgun_fixed_medium  ').length, 2);
    assert.equal(getPreEngineeredVariants('HPT_RAILGUN_FIXED_MEDIUM').length, 2);
    // A miss is an empty array, never null — always safe to iterate.
    assert.deepEqual(getPreEngineeredVariants('NoSuchModule'), []);
});

test('getPreEngineeredByBlueprint resolves case-insensitively and misses cleanly', () => {
    assert.deepEqual(
        getPreEngineeredByBlueprint('  RECIPE_RAILGUN_LONGSHOT  ').map((v) => v.symbol),
        ['Hpt_Railgun_Fixed_Medium'],
    );
    assert.deepEqual(getPreEngineeredByBlueprint('NoSuchBlueprint'), []);
});

test('an ordinary journal blueprint can also arrive pre-engineered', () => {
    // The community-goal "FSD V1" rewards are Long Range drives, so a plain journal
    // blueprint now resolves here too — not just the Merc-shop recipe_* keys.
    const drives = getPreEngineeredByBlueprint('FSD_LongRange');
    assert.ok(drives.length > 0);
    assert.ok(drives.every((v) => v.acquisition === 'communityGoal' && v.grade === 5));
});

test('isPreEngineered separates bought-engineered modules from stock ones', () => {
    assert.equal(isPreEngineered('Hpt_Railgun_Fixed_Medium'), true);
    for (const symbol of fixture.notPreEngineered) {
        assert.equal(isPreEngineered(symbol), false, symbol);
    }
});

test('a (symbol, blueprint, experimental) triple appears at most once', () => {
    // No narrower key holds: one module carries several variants, one blueprint appears
    // on several modules, and even (symbol, blueprint) repeats when only the effect
    // differs. The triple is the identity of a variant.
    const triples = PRE_ENGINEERED_MODULES.map((v) =>
        `${v.symbol}|${v.blueprint}|${v.experimental ?? ''}`.toLowerCase(),
    );
    assert.equal(new Set(triples).size, triples.length);
});

test('one blueprint can be sold on more than one base module', () => {
    assert.deepEqual(
        getPreEngineeredByBlueprint('recipe_seekermissilerack_drag').map((v) => v.symbol),
        ['Hpt_BasicMissileRack_Fixed_Medium', 'Hpt_BasicMissileRack_Fixed_Large'],
    );
});

test('the remaining upgrade is priced from the grade already applied', () => {
    const variant = getPreEngineeredByBlueprint('recipe_railgun_longshot')[0]!;
    const total = (mats: readonly { count: number }[] | null) => {
        assert.ok(mats, 'the blueprint must price');
        return mats.reduce((sum, m) => sum + m.count, 0);
    };
    const fromPurchase = getBlueprintCost(variant.blueprint, 5, variant.grade);
    assert.ok(total(fromPurchase) > 0, 'grades 2-5 still cost materials');
    // Grade 1 arrived with the module and has no recipe of its own, so pricing from
    // the purchased grade and from scratch agree — there is no grade-1 cost to skip.
    assert.deepEqual(fromPurchase, getBlueprintCost(variant.blueprint, 5, 0));
    // Pricing from a later grade does drop the grades already paid for.
    assert.ok(total(getBlueprintCost(variant.blueprint, 5, 4)) < total(fromPurchase));
});
