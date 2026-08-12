import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    PRE_ENGINEERED_MODULES,
    getPreEngineeredVariants,
    getPreEngineeredByBlueprint,
    isPreEngineered,
} from './pre-engineered.js';
import { getBlueprintCost } from './blueprint-costs.js';
import { BLUEPRINTS, getBlueprint } from './blueprints.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { getBlueprintsForModule, getExperimentalsForModule } from './engineering-options.js';
import { blueprintAvailableFor } from './internal/loadout-engineering.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import fixture from '../../../fixtures/ships/pre-engineered.jsonc' with { type: 'json' };

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
                v.grade === expected.grade &&
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

test('pre-engineered variants distinguish menu compatibility from final articles', () => {
    // `applyBlueprint` gates experimental effects on the engineering menu alone, with no
    // pre-engineered leg beside the one it has for blueprints — because it needs none:
    // every effect a variant is sold carrying is one the module's own menu lists. This is
    // what says that stays true. The blueprints are the other way round, which is why they
    // do have that leg: 21 Operations keys are sold and never offered.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (!variant.experimental) continue;
        assert.ok(
            getExperimentalsForModule(variant.symbol).includes(variant.experimental),
            `${variant.symbol} is sold with "${variant.experimental}", which its menu does not offer`,
        );
    }
    // The blueprint half of that contrast. A non-final sale may open the remaining grades
    // of its recipe; a final Guardian article is evidence of what was bought, never
    // permission to roll that recipe at an engineer.
    const sold = PRE_ENGINEERED_MODULES.filter(
        (variant) => !getBlueprintsForModule(variant.symbol).includes(variant.blueprint),
    );
    assert.ok(sold.length > 0, 'no variant is sold with a recipe its menu omits');
    for (const variant of sold) {
        assert.equal(
            blueprintAvailableFor(variant.symbol, variant.blueprint),
            !variant.engineeringLocked,
            `${variant.symbol}: ${variant.blueprint}`,
        );
    }
});

test('the pinned pre-engineered Guardian weapons are final', () => {
    const locked = PRE_ENGINEERED_MODULES.filter((variant) => variant.engineeringLocked);
    assert.equal(locked.length, fixture.engineeringLocked.count);
    assert.deepEqual(
        [...new Set(locked.map((variant) => variant.symbol))].sort(),
        fixture.engineeringLocked.symbols,
    );
    for (const variant of locked) {
        assert.deepEqual(getBlueprintsForModule(variant.symbol), ['GuardianModule_Sturdy']);
        assert.deepEqual(getExperimentalsForModule(variant.symbol), []);
        assert.ok(!blueprintAvailableFor(variant.symbol, variant.blueprint));
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
    // Only the Merc rows work this way. Community-goal and tech-broker rewards use
    // ordinary journal blueprints, which do define a grade 1.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'mercenary') continue;
        assert.equal(variant.grade, 1);
        const grades = Object.keys(BLUEPRINTS[variant.blueprint]!.grades);
        assert.ok(!grades.includes('1'), `${variant.blueprint} still defines a grade 1 recipe`);
    }
});

test('a reward variant records a real grade of a real blueprint', () => {
    // Both reward routes name an ordinary journal blueprint, so the grade recorded must
    // be one the blueprint actually defines — including the grade-1 Guardian rows.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition === 'mercenary') continue;
        const grades = Object.keys(BLUEPRINTS[variant.blueprint]!.grades);
        assert.ok(
            grades.includes(String(variant.grade)),
            `${variant.symbol}: ${variant.blueprint} has no grade ${variant.grade}`,
        );
    }
});

test('every variant names the recipe its own module rolls, not a colliding spelling', () => {
    // `blueprint` joins to `BLUEPRINTS`, so it must name the recipe rather than the id a
    // journal writes — and on the three colliding ids those differ. A row recorded under
    // the journal spelling would be accepted by `blueprintAvailableFor` through the sale
    // route while `applyBlueprint` folded the *other* recipe, which
    // `loadout-engineering.ts` calls out as reachable and otherwise uncatchable. Asserted
    // over the whole catalogue rather than only the rows that meet it, because the
    // hazard arrives with the next row somebody transcribes from a journal.
    for (const variant of PRE_ENGINEERED_MODULES) {
        assert.equal(
            resolveBlueprintForModule(variant.symbol, variant.blueprint),
            variant.blueprint,
            `${variant.symbol}: ${variant.blueprint} resolves to another recipe on its own module`,
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

test('the same blueprint on one module is several variants when the effect differs', () => {
    // A reward is identified by its experimental too: the medium seeker rack has three
    // High Capacity variants that differ only in the effect applied.
    const { symbol, blueprint, experimentals } = fixture.sameBlueprintTwice;
    const found = getPreEngineeredVariants(symbol).filter((v) => v.blueprint === blueprint);
    assert.deepEqual(
        found.map((v) => v.experimental ?? null),
        experimentals,
    );
});

test('even (symbol, blueprint, experimental) repeats — the grade separates them', () => {
    // The medium Guardian Shard Cannon is sold pre-engineered with Long Range and no
    // experimental twice: grade 5 as a community-goal reward, grade 1 from a tech
    // broker. This is why the identity key has to include the grade.
    const { symbol, blueprint, grades, acquisitions } = fixture.sameTripleDifferentGrade;
    const found = getPreEngineeredVariants(symbol).filter((v) => v.blueprint === blueprint);
    assert.deepEqual(
        found.map((v) => v.grade),
        grades,
    );
    assert.deepEqual(
        found.map((v) => v.acquisition),
        acquisitions,
    );
    assert.equal(new Set(found.map((v) => v.experimental ?? null)).size, 1);
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
        getPreEngineeredByBlueprint('  railgun_LONGSHOT  ').map((v) => v.symbol),
        ['Hpt_Railgun_Fixed_Medium'],
    );
    assert.deepEqual(getPreEngineeredByBlueprint('NoSuchBlueprint'), []);
});

test('an ordinary journal blueprint can also arrive pre-engineered', () => {
    // The "V1" drives are Long Range, so a plain journal blueprint resolves here too —
    // not just the Merc-shop Operations keys — and by two different routes.
    const drives = getPreEngineeredByBlueprint('FSD_LongRange');
    assert.ok(drives.length > 0);
    assert.ok(drives.every((v) => v.grade === 5));
    assert.deepEqual([...new Set(drives.map((v) => v.acquisition))].sort(), [
        'communityGoal',
        'techBroker',
    ]);
});

test('isPreEngineered separates bought-engineered modules from stock ones', () => {
    assert.equal(isPreEngineered('Hpt_Railgun_Fixed_Medium'), true);
    for (const symbol of fixture.notPreEngineered) {
        assert.equal(isPreEngineered(symbol), false, symbol);
    }
});

test('a (symbol, blueprint, grade, experimental) quadruple appears at most once', () => {
    // No narrower key holds: one module carries several variants, one blueprint appears
    // on several modules, (symbol, blueprint) repeats when only the effect differs, and
    // (symbol, blueprint, experimental) repeats when only the grade differs.
    const keys = PRE_ENGINEERED_MODULES.map((v) =>
        `${v.symbol}|${v.blueprint}|${v.grade}|${v.experimental ?? ''}`.toLowerCase(),
    );
    assert.equal(new Set(keys).size, keys.length);
});

test('one blueprint can be sold on more than one base module', () => {
    assert.deepEqual(
        getPreEngineeredByBlueprint('SeekerMissileRack_Drag').map((v) => v.symbol),
        ['Hpt_BasicMissileRack_Fixed_Medium', 'Hpt_BasicMissileRack_Fixed_Large'],
    );
});

test('the remaining upgrade is priced from the grade already applied', () => {
    const variant = getPreEngineeredByBlueprint('RailGun_LongShot')[0]!;
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

test('a Merc Coin price is carried by exactly the rows that are bought with one', () => {
    const priced = PRE_ENGINEERED_MODULES.filter((v) => v.mercCoinCost !== undefined);
    assert.equal(priced.length, fixture.modifierCounts.withMercCoinCost);
    // Merc Coin is a currency of its own: only the shop rows have a price in it, and
    // the reward routes are not bought at all.
    assert.ok(priced.every((v) => v.acquisition === 'mercenary'));
    assert.equal(
        priced.length,
        PRE_ENGINEERED_MODULES.filter((v) => v.acquisition === 'mercenary').length,
    );
    for (const v of priced) {
        assert.ok(Number.isInteger(v.mercCoinCost) && v.mercCoinCost! > 0, v.symbol);
    }
    assert.equal(
        priced.reduce((sum, v) => sum + v.mercCoinCost!, 0),
        fixture.mercCoin.total,
    );
    assert.equal(Math.min(...priced.map((v) => v.mercCoinCost!)), fixture.mercCoin.cheapest);
    assert.equal(Math.max(...priced.map((v) => v.mercCoinCost!)), fixture.mercCoin.dearest);
});

test('a stat block is carried by exactly the reward rows', () => {
    // The reward routes publish the hand-set stats each variant arrives with. The Merc
    // shop rows do not, and the catalogue omits rather than guesses — so the two sets
    // are complements, and `mercCoinCost` and `modifiers` never appear together.
    const withMods = PRE_ENGINEERED_MODULES.filter((v) => v.modifiers !== undefined);
    assert.equal(withMods.length, fixture.modifierCounts.withModifiers);
    assert.ok(withMods.every((v) => v.acquisition !== 'mercenary'));
    assert.equal(
        PRE_ENGINEERED_MODULES.filter((v) => v.modifiers === undefined).length,
        fixture.modifierCounts.withoutModifiers,
    );
    assert.ok(PRE_ENGINEERED_MODULES.every((v) => !(v.modifiers && v.mercCoinCost !== undefined)));
});

test('every modifier is well formed and sorted by label', () => {
    const methods = new Set(['multiplicative', 'additive', 'overwrite']);
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (!variant.modifiers) continue;
        assert.ok(variant.modifiers.length > 0, variant.symbol);
        for (const m of variant.modifiers) {
            assert.ok(methods.has(m.method), `${variant.symbol}: bad method ${m.method}`);
            assert.ok(Number.isFinite(m.value), `${variant.symbol}: ${m.label} is not finite`);
        }
        const labels = variant.modifiers.map((m) => m.label);
        assert.deepEqual(labels, [...labels].sort(), `${variant.symbol}: modifiers unsorted`);
        assert.equal(new Set(labels).size, labels.length, `${variant.symbol}: duplicate label`);
    }
});

test('modifier values are the authored decimals, not raw decoding noise', () => {
    // The source encodes modifiers in a 20-bit float, so decoding +20% yields 0.199997.
    // Each stored value is the shortest decimal that re-encodes to the identical bits,
    // which recovers the authored figure without inventing precision. Capping the
    // decimal places guards that step: raw noise runs to six or more.
    for (const variant of PRE_ENGINEERED_MODULES) {
        for (const m of variant.modifiers ?? []) {
            const places = (String(m.value).split('.')[1] ?? '').length;
            assert.ok(
                places <= fixture.maxModifierDecimalPlaces,
                `${variant.symbol}: ${m.label} = ${m.value} looks like undecoded float noise`,
            );
            assert.ok(
                !String(m.value).includes('e'),
                `${variant.symbol}: ${m.label} in exponent form`,
            );
        }
    }
});

test('the modifier labels are the pinned set', () => {
    const labels = [
        ...new Set(PRE_ENGINEERED_MODULES.flatMap((v) => (v.modifiers ?? []).map((m) => m.label))),
    ].sort();
    assert.deepEqual(labels, fixture.modifierLabels);
});

test('the pre-engineered lookups name a wrong-typed symbol', () => {
    for (const [call, label] of [
        [
            () => getPreEngineeredVariants(42 as unknown as string),
            'getPreEngineeredVariants: symbol',
        ],
        [
            () => getPreEngineeredByBlueprint(42 as unknown as string),
            'getPreEngineeredByBlueprint: fdname',
        ],
        // A facade over the variants lookup, naming its own parameter.
        [() => isPreEngineered(42 as unknown as string), 'isPreEngineered: symbol'],
    ] as const) {
        assert.throws(call, {
            name: 'TypeError',
            message: `${label} must be a string, received number 42`,
        });
    }
    assert.equal(isPreEngineered(null as unknown as string), false);
});
