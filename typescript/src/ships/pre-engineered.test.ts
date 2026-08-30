import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    PRE_ENGINEERED_MODULES,
    getPreEngineeredVariants,
    isPreEngineered,
} from './pre-engineered.js';
import { getBlueprintCost } from './blueprint-costs.js';
import { BLUEPRINTS, getBlueprint } from './blueprints.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { getBlueprintsForModule, getExperimentalsForModule } from './engineering-options.js';
import {
    availableBlueprintsFor,
    blueprintAvailableFor,
    missingBaseLabels,
} from './internal/loadout-engineering.js';
import { BLUEPRINT_JOURNAL_NAMES } from './internal/blueprint-journal-names.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { baseStats } from './internal/module-stat-labels.js';
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
                v.blueprintSymbol === expected.blueprintSymbol &&
                v.grade === expected.grade &&
                (v.experimentalEffectSymbol ?? null) ===
                    (expected.experimentalEffectSymbol ?? null),
        );
        assert.equal(found.length, 1, `${expected.symbol} / ${expected.blueprintSymbol}`);
        assert.deepEqual({ ...found[0] }, expected);
    }
});

test('every variant joins to a real module and every craftable identity joins to engineering data', () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        assert.ok(
            getModuleBySymbol(variant.symbol, ALL_MODULES),
            `${variant.symbol} is not in the module catalogue`,
        );
        if (variant.acquisition === 'eventReward') {
            assert.equal(getBlueprint(variant.blueprintSymbol), null, variant.blueprintSymbol);
        } else {
            assert.ok(
                getBlueprint(variant.blueprintSymbol),
                `${variant.blueprintSymbol} is not in the blueprint catalogue`,
            );
        }
        if (variant.experimentalEffectSymbol !== undefined) {
            assert.ok(
                EXPERIMENTAL_EFFECTS[variant.experimentalEffectSymbol],
                `${variant.experimentalEffectSymbol} is not in the experimental catalogue`,
            );
        }
    }
});

test('pre-engineered variants distinguish menus, Mercenary upgrades and fixed articles', () => {
    // `applyBlueprint` gates experimental effects on the engineering menu alone, with no
    // pre-engineered leg beside the one it has for blueprints. A fixed reward may arrive
    // carrying an effect outside the stock module's menu, but that identifies the article
    // rather than making the effect applicable, and a Merc-shop row's baked effect says
    // what was bought rather than what a menu offers. The Merc Mining Laser, the two
    // Enhanced AX Multi-Cannons and the long-range Mining Laser are the four such records
    // in this catalogue.
    assert.deepEqual(
        PRE_ENGINEERED_MODULES.filter(
            (variant) =>
                variant.experimentalEffectSymbol !== undefined &&
                !getExperimentalsForModule(variant.symbol).includes(
                    variant.experimentalEffectSymbol,
                ),
        ).map(({ symbol, blueprintSymbol, experimentalEffectSymbol, acquisition }) => ({
            symbol,
            blueprintSymbol,
            experimentalEffectSymbol,
            acquisition,
        })),
        [
            {
                symbol: 'Hpt_MiningLaser_Fixed_Small',
                blueprintSymbol: 'MiningLaser_LongRange',
                experimentalEffectSymbol: 'special_incendiary_rounds',
                acquisition: 'mercenary',
            },
            {
                symbol: 'Hpt_ATMultiCannon_Gimbal_Medium',
                blueprintSymbol: 'Weapon_Overcharged',
                experimentalEffectSymbol: 'special_auto_loader',
                acquisition: 'techBroker',
            },
            {
                symbol: 'Hpt_ATMultiCannon_Gimbal_Large',
                blueprintSymbol: 'Weapon_Overcharged',
                experimentalEffectSymbol: 'special_auto_loader',
                acquisition: 'techBroker',
            },
            {
                symbol: 'Hpt_MiningLaser_Fixed_Small',
                blueprintSymbol: 'Weapon_LongRange',
                experimentalEffectSymbol: 'special_incendiary_rounds',
                acquisition: 'techBroker',
            },
        ],
    );
    // The blueprint half of that contrast. Community-goal and tech-broker records identify
    // what was bought or awarded; they do not make that recipe applicable to a stock
    // module. Every Mercenary record instead arrives at grade 1 and opens grades 2-5 of
    // its own bespoke recipe, even though no ordinary menu lists that recipe.
    const sold = PRE_ENGINEERED_MODULES.filter(
        (variant) =>
            variant.acquisition !== 'eventReward' &&
            !getBlueprintsForModule(variant.symbol).includes(variant.blueprintSymbol),
    );
    assert.ok(sold.length > 0, 'no variant is sold with a recipe its menu omits');
    for (const variant of sold) {
        assert.equal(
            blueprintAvailableFor(variant.symbol, variant.blueprintSymbol),
            variant.acquisition === 'mercenary',
            `${variant.symbol}: ${variant.blueprintSymbol}`,
        );
        assert.equal(
            availableBlueprintsFor(variant.symbol).some(
                (candidate) => candidate.blueprintSymbol === variant.blueprintSymbol,
            ),
            variant.acquisition === 'mercenary',
            `${variant.symbol}: ${variant.blueprintSymbol} menu visibility`,
        );
    }
});

test('every Mercenary module arrives at grade 1 and can climb through grades 2-5', () => {
    const mercenary = PRE_ENGINEERED_MODULES.filter(
        (variant) => variant.acquisition === 'mercenary',
    );
    assert.equal(mercenary.length, fixture.counts.mercenary);
    for (const variant of mercenary) {
        assert.equal(variant.grade, 1, `${variant.symbol}: purchased grade`);
        assert.equal(variant.engineeringLocked, undefined, `${variant.symbol}: locked purchase`);
        assert.ok(
            !getBlueprintsForModule(variant.symbol).includes(variant.blueprintSymbol),
            `${variant.symbol}: bespoke recipe leaked into the ordinary menu`,
        );
        assert.ok(
            blueprintAvailableFor(variant.symbol, variant.blueprintSymbol),
            `${variant.symbol}: ${variant.blueprintSymbol} is not upgradeable`,
        );
        // The docs send a consumer from a `mercenary` row straight to getBlueprintCost
        // for the Merc Coin as well. A recipe with no currency entry would answer 0, so
        // the cross-catalogue join is asserted rather than assumed.
        assert.ok(
            (getBlueprintCost(variant.blueprintSymbol, 5, variant.grade)?.mercCoins ?? 0) > 0,
            `${variant.symbol}: ${variant.blueprintSymbol} prices no Merc Coin above grade ${variant.grade}`,
        );
        assert.deepEqual(
            availableBlueprintsFor(variant.symbol).find(
                (candidate) => candidate.blueprintSymbol === variant.blueprintSymbol,
            ),
            { blueprintSymbol: variant.blueprintSymbol, grades: [2, 3, 4, 5], route: 'mercenary' },
            `${variant.symbol}: ${variant.blueprintSymbol} is missing from available blueprints`,
        );
        const blueprint = BLUEPRINTS[variant.blueprintSymbol]!;
        assert.deepEqual(
            Object.keys(blueprint.grades).map(Number),
            [2, 3, 4, 5],
            `${variant.blueprintSymbol}: upgrade grades`,
        );
        const module = getModuleBySymbol(variant.symbol, ALL_MODULES)!;
        for (const [grade, recipe] of Object.entries(blueprint.grades)) {
            assert.deepEqual(
                missingBaseLabels(module, baseStats(module), recipe.features),
                [],
                `${variant.symbol}: ${variant.blueprintSymbol} grade ${grade}`,
            );
        }
    }
});

test('every Mercenary blueprint is exclusive to its purchased article', () => {
    for (const variant of PRE_ENGINEERED_MODULES.filter(
        (candidate) => candidate.acquisition === 'mercenary',
    )) {
        const collisions = PRE_ENGINEERED_MODULES.filter(
            (candidate) =>
                candidate.symbol === variant.symbol &&
                candidate.blueprintSymbol === variant.blueprintSymbol &&
                candidate.acquisition !== 'mercenary',
        );
        assert.deepEqual(
            collisions,
            [],
            `${variant.symbol}: ${variant.blueprintSymbol} is not purchase-exclusive`,
        );
    }
});

test('the pinned final pre-engineered weapons are locked', () => {
    const guardian = PRE_ENGINEERED_MODULES.filter((variant) =>
        variant.symbol.toLowerCase().includes('guardian'),
    );
    const locked = PRE_ENGINEERED_MODULES.filter((variant) => variant.engineeringLocked);
    assert.equal(guardian.length, 7);
    assert.ok(guardian.every((variant) => variant.engineeringLocked));
    assert.equal(locked.length, fixture.engineeringLocked.count);
    assert.deepEqual(
        [...new Set(locked.map((variant) => variant.symbol))].sort(),
        fixture.engineeringLocked.symbols,
    );
    for (const variant of locked) {
        assert.deepEqual(getExperimentalsForModule(variant.symbol), []);
        assert.ok(!blueprintAvailableFor(variant.symbol, variant.blueprintSymbol));
    }
});

test('a community-goal variant carries the same display name as the module it fits as', () => {
    // `name` is denormalised so a shop list can render without pulling in ALL_MODULES.
    // That is a drift risk, so it is pinned: the two catalogues must always agree.
    // Only the community-goal rewards are plain base modules. The Merc shop sells its
    // rows under its own names, the festive launchers are named for the event, and a
    // tech-broker unlock is covered by the next test.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'communityGoal') continue;
        const module = getModuleBySymbol(variant.symbol, ALL_MODULES)!;
        assert.equal(
            variant.name,
            module.name,
            `${variant.symbol}: pre-engineered name "${variant.name}" != catalogue "${module.name}"`,
        );
    }
});

test('a tech-broker variant names its base module, with or without an unlock marker', () => {
    // Some tech-broker unlocks are sold plain, and the rest add a manufacturer prefix
    // (Sirius, Azimuth), the word Modified, or a version suffix (V1). Either way the
    // base module's name is carried whole, which is what keeps the two catalogues from
    // drifting apart while still allowing the marker.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'techBroker') continue;
        const module = getModuleBySymbol(variant.symbol, ALL_MODULES)!;
        assert.ok(
            variant.name.includes(module.name),
            `${variant.symbol}: pre-engineered name "${variant.name}" does not carry catalogue "${module.name}"`,
        );
    }
});

test("each Merc-shop variant is sold under its own name, not the base module's", () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'mercenary') continue;
        const module = getModuleBySymbol(variant.symbol, ALL_MODULES)!;
        assert.notEqual(variant.name, module.name, variant.blueprintSymbol);
    }
});

test('a Merc-shop blueprint starts at grade 2 — grade 1 is what you bought', () => {
    // Only the Merc rows work this way. Community-goal and tech-broker rewards use
    // ordinary journal blueprints, which do define a grade 1.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'mercenary') continue;
        assert.equal(variant.grade, 1);
        const grades = Object.keys(BLUEPRINTS[variant.blueprintSymbol]!.grades);
        assert.ok(
            !grades.includes('1'),
            `${variant.blueprintSymbol} still defines a grade 1 recipe`,
        );
    }
});

test('a community-goal or tech-broker reward records a real blueprint grade', () => {
    // Both routes name an ordinary journal blueprint, so the grade recorded must be one
    // the blueprint actually defines — including the grade-1 Guardian rows.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition === 'mercenary' || variant.acquisition === 'eventReward') continue;
        const grades = Object.keys(BLUEPRINTS[variant.blueprintSymbol]!.grades);
        assert.ok(
            grades.includes(String(variant.grade)),
            `${variant.symbol}: ${variant.blueprintSymbol} has no grade ${variant.grade}`,
        );
    }
});

test('every Mercenary variant names the recipe its own module rolls', () => {
    // A Mercenary row is an upgrade route, so a colliding journal spelling here would be
    // accepted by the sale route while `applyBlueprint` folded a different recipe.
    // Fixed rewards instead retain the journal identity that identifies the article.
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition !== 'mercenary') continue;
        assert.equal(
            resolveBlueprintForModule(variant.symbol, variant.blueprintSymbol),
            variant.blueprintSymbol,
            `${variant.symbol}: ${variant.blueprintSymbol} resolves to another recipe on its own module`,
        );
    }
});

test('every fixed variant retains its journal blueprint identity', () => {
    for (const variant of PRE_ENGINEERED_MODULES) {
        if (variant.acquisition === 'mercenary') continue;
        assert.equal(
            Object.hasOwn(BLUEPRINT_JOURNAL_NAMES, variant.blueprintSymbol),
            false,
            `${variant.symbol}: ${variant.blueprintSymbol} is a recipe id, not its journal identity`,
        );
    }
});

test('one base module can carry several pre-engineered variants', () => {
    const { symbol, blueprints } = fixture.multiVariant;
    assert.deepEqual(
        getPreEngineeredVariants(symbol).map((v) => v.blueprintSymbol),
        blueprints,
    );
});

test('the same blueprint on one module is several variants when the effect differs', () => {
    // A reward is identified by its experimental too: the medium seeker rack has three
    // High Capacity variants that differ only in the effect applied.
    const { symbol, blueprintSymbol, experimentals } = fixture.sameBlueprintTwice;
    const found = getPreEngineeredVariants(symbol).filter(
        (v) => v.blueprintSymbol === blueprintSymbol,
    );
    assert.deepEqual(
        found.map((v) => v.experimentalEffectSymbol ?? null),
        experimentals,
    );
});

test('even (symbol, blueprint, experimental) repeats — the grade separates them', () => {
    // The medium Guardian Shard Cannon is sold pre-engineered with Long Range and no
    // experimental twice: grade 5 as a community-goal reward, grade 1 from a tech
    // broker. This is why the identity key has to include the grade.
    const { symbol, blueprintSymbol, grades, acquisitions } = fixture.sameTripleDifferentGrade;
    const found = getPreEngineeredVariants(symbol).filter(
        (v) => v.blueprintSymbol === blueprintSymbol,
    );
    assert.deepEqual(
        found.map((v) => v.grade),
        grades,
    );
    assert.deepEqual(
        found.map((v) => v.acquisition),
        acquisitions,
    );
    assert.equal(new Set(found.map((v) => v.experimentalEffectSymbol ?? null)).size, 1);
});

test('getPreEngineeredVariants normalises input and misses cleanly', () => {
    // The medium rail gun is both a Merc shop row and a community-goal reward.
    assert.equal(getPreEngineeredVariants('  hpt_railgun_fixed_medium  ').length, 2);
    assert.equal(getPreEngineeredVariants('HPT_RAILGUN_FIXED_MEDIUM').length, 2);
    // A miss is an empty array, never null — always safe to iterate.
    assert.deepEqual(getPreEngineeredVariants('NoSuchModule'), []);
});

test('an ordinary journal blueprint can also arrive pre-engineered', () => {
    // The "V1" drives are Long Range, so a plain journal blueprint resolves here too —
    // not just the Merc-shop Operations keys — and by two different routes.
    const drives = PRE_ENGINEERED_MODULES.filter(
        (variant) => variant.blueprintSymbol === 'FSD_LongRange',
    );
    assert.ok(drives.length > 0);
    assert.ok(drives.every((v) => v.grade === 5));
    assert.deepEqual([...new Set(drives.map((v) => v.acquisition))].sort(), [
        'communityGoal',
        'techBroker',
    ]);
});

test('grade-5 festive identities are fixed variants of the observed launcher', () => {
    const expected = fixture.festive;
    const variants = getPreEngineeredVariants(expected.symbol).filter((variant) =>
        expected.blueprints.includes(variant.blueprintSymbol),
    );
    assert.equal(variants.length, expected.blueprints.length);
    assert.deepEqual(
        variants.map((variant) => variant.blueprintSymbol),
        expected.blueprints,
    );
    for (const variant of variants) {
        assert.equal(variant.symbol, expected.symbol);
        assert.equal(variant.grade, expected.grade);
        assert.equal(variant.experimentalEffectSymbol, undefined);
        assert.equal(variant.acquisition, 'eventReward');
        assert.deepEqual(variant.modifiers, [expected.modifier]);
        assert.equal(getBlueprint(variant.blueprintSymbol), null);
    }
});

test('isPreEngineered separates bought-engineered modules from stock ones', () => {
    assert.equal(isPreEngineered('Hpt_Railgun_Fixed_Medium'), true);
    assert.equal(isPreEngineered(fixture.festive.symbol), true);
    for (const symbol of fixture.notPreEngineered) {
        assert.equal(isPreEngineered(symbol), false, symbol);
    }
});

test('a (symbol, blueprint, grade, experimental) tuple appears at most once', () => {
    // No narrower key holds: one module carries several variants, one blueprint appears
    // on several modules, (symbol, blueprint) repeats when only the effect differs, and
    // (symbol, blueprint, experimental) repeats when only the grade differs.
    const keys = PRE_ENGINEERED_MODULES.map((v) =>
        `${v.symbol}|${v.blueprintSymbol}|${v.grade}|${v.experimentalEffectSymbol ?? ''}`.toLowerCase(),
    );
    assert.equal(new Set(keys).size, keys.length);
});

test('one blueprint can be sold on more than one base module', () => {
    assert.deepEqual(
        PRE_ENGINEERED_MODULES.filter(
            (variant) => variant.blueprintSymbol === 'SeekerMissileRack_Drag',
        ).map((variant) => variant.symbol),
        ['Hpt_BasicMissileRack_Fixed_Medium', 'Hpt_BasicMissileRack_Fixed_Large'],
    );
});

test('the remaining upgrade is priced from the grade already applied', () => {
    const variant = getPreEngineeredVariants('Hpt_Railgun_Fixed_Medium').find(
        (candidate) => candidate.blueprintSymbol === 'RailGun_LongShot',
    )!;
    const total = (cost: { materials: readonly { count: number }[] } | null) => {
        assert.ok(cost, 'the blueprint must price');
        return cost.materials.reduce((sum, m) => sum + m.count, 0);
    };
    const fromPurchase = getBlueprintCost(variant.blueprintSymbol, 5, variant.grade);
    assert.ok(total(fromPurchase) > 0, 'grades 2-5 still cost materials');
    // Grade 1 arrived with the module and has no recipe of its own, so pricing from
    // the purchased grade and from scratch agree — there is no grade-1 cost to skip.
    assert.deepEqual(fromPurchase, getBlueprintCost(variant.blueprintSymbol, 5, 0));
    // Pricing from a later grade does drop the grades already paid for.
    assert.ok(total(getBlueprintCost(variant.blueprintSymbol, 5, 4)) < total(fromPurchase));
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
