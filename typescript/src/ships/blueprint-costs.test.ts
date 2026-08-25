import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_MATERIALS } from '../materials/materials-all.js';
import { getMaterialBySymbol } from '../materials/materials.js';
import engineeringFixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };
import {
    BLUEPRINT_COSTS,
    BLUEPRINT_MERC_COIN_COSTS,
    getBlueprintCost,
    getBlueprintCosts,
    getBlueprintGradeCost,
} from './blueprint-costs.js';
import { BLUEPRINTS, getBlueprintGrade } from './blueprints.js';

const countFor = (
    cost: { materials: readonly { symbol: string; count: number }[] } | null,
    symbol: string,
) => cost?.materials.find((material) => material.symbol === symbol)?.count;

test('every craft-cost entry matches its mechanics grades', () => {
    const craftable = Object.keys(BLUEPRINTS).filter(
        (fdname) => fdname !== 'CargoRack_IncreasedCapacity',
    );
    assert.deepEqual(
        Object.keys(BLUEPRINTS).filter((fdname) => !(fdname in BLUEPRINT_COSTS)),
        ['CargoRack_IncreasedCapacity'],
    );
    assert.deepEqual(Object.keys(BLUEPRINT_COSTS), craftable);
    for (const [fdname, costs] of Object.entries(BLUEPRINT_COSTS)) {
        assert.deepEqual(Object.keys(costs), Object.keys(BLUEPRINTS[fdname]!.grades), fdname);
    }
});

test('getBlueprintCosts normalises ids and returns frozen catalogue records', () => {
    const exact = getBlueprintCosts('FSD_LongRange');
    assert.equal(getBlueprintCosts('  fsd_longrange  '), exact);
    assert.equal(getBlueprintCosts('nope'), null);
    assert.ok(exact);
    assert.ok(Object.isFrozen(BLUEPRINT_COSTS));
    assert.ok(Object.isFrozen(exact));
    assert.ok(Object.isFrozen(exact['5']));
    assert.ok(exact['5']!.every((material) => Object.isFrozen(material)));
});

test('getBlueprintGradeCost returns one roll and misses unavailable supported grades cleanly', () => {
    assert.deepEqual(getBlueprintGradeCost(' FSD_LONGrange ', 5), {
        materials: [
            { symbol: 'Arsenic', name: 'Arsenic', count: 1 },
            { symbol: 'ChemicalManipulators', name: 'Chemical Manipulators', count: 1 },
            { symbol: 'DataminedWake', name: 'Datamined Wake Exceptions', count: 1 },
        ],
        // An ordinary engineer recipe bills no currency; 0 is the amount, not a gap.
        mercCoins: 0,
    });
    // A charging recipe reports the per-roll amount beside the same per-roll materials.
    assert.equal(getBlueprintGradeCost('RailGun_LongShot', 5)?.mercCoins, 50);
    assert.equal(getBlueprintGradeCost('ModuleReinforcement_HeavyDuty', 1), null);
    assert.equal(getBlueprintGradeCost('nope', 1), null);
});

test('getBlueprintGradeCost rejects grades outside the supported range', () => {
    for (const grade of [0, 6, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => getBlueprintGradeCost('FSD_LongRange', grade), RangeError);
        assert.throws(() => getBlueprintGradeCost('nope', grade), RangeError);
    }
});

test('every material requirement joins to a real material and occurs once per grade', () => {
    for (const [fdname, grades] of Object.entries(BLUEPRINT_COSTS)) {
        for (const [grade, materials] of Object.entries(grades)) {
            const symbols = materials.map((material) => material.symbol.toLowerCase());
            assert.equal(
                new Set(symbols).size,
                symbols.length,
                `${fdname} grade ${grade} duplicate material`,
            );
            for (const requirement of materials) {
                const material = getMaterialBySymbol(requirement.symbol, ALL_MATERIALS);
                assert.ok(material, `unknown material symbol: ${requirement.symbol}`);
                assert.equal(material.name, requirement.name, requirement.symbol);
                assert.ok(
                    requirement.count > 0 && Number.isInteger(requirement.count),
                    `bad count for ${requirement.symbol}`,
                );
            }
        }
    }
});

test('fixed reward identities have no ordinary craft cost', () => {
    assert.equal(getBlueprintGradeCost('CargoRack_IncreasedCapacity', 5), null);
    const empty = Object.entries(BLUEPRINT_COSTS).flatMap(([fdname, grades]) =>
        Object.entries(grades)
            .filter(([, materials]) => materials.length === 0)
            .map(([grade]) => `${fdname}:${grade}`),
    );
    assert.deepEqual(empty, []);
});

test('a colliding journal spelling bills the same materials as the recipe it names', () => {
    for (const [fdname, journalName] of Object.entries(engineeringFixture.journalNames.map)) {
        assert.deepEqual(BLUEPRINT_COSTS[fdname], BLUEPRINT_COSTS[journalName], fdname);
    }
});

test('getBlueprintCost for grade 1 is one roll of its grade-1 recipe', () => {
    assert.deepEqual(
        getBlueprintCost('FSD_LongRange', 1),
        getBlueprintGradeCost('FSD_LongRange', 1),
    );
});

test('getBlueprintCost sums every grade weighted by its roll count', () => {
    const grade2 = getBlueprintCost('FSD_LongRange', 2);
    assert.equal(countFor(grade2, 'DisruptedWakeEchoes'), 3);
    assert.equal(countFor(grade2, 'ChemicalProcessors'), 2);
    assert.equal(countFor(getBlueprintCost('FSD_LongRange', 5), 'DisruptedWakeEchoes'), 3);
    assert.equal(countFor(getBlueprintCost('FSD_LongRange', 5), 'Arsenic'), 5);
    assert.equal(countFor(getBlueprintCost('FSD_LongRange', 5), 'DataminedWake'), 5);
});

test('every grade costs its recipe once per roll, and grade N takes N rolls', () => {
    // The rule the whole climb is built from, pinned grade by grade: pricing grade `g`
    // alone charges `g` copies of that grade's single-roll recipe.
    for (const grade of [1, 2, 3, 4, 5]) {
        const oneRoll = getBlueprintGradeCost('FSD_LongRange', grade)!;
        assert.deepEqual(getBlueprintCost('FSD_LongRange', grade, grade - 1), {
            materials: oneRoll.materials.map((material) => ({
                symbol: material.symbol,
                name: material.name,
                count: material.count * grade,
            })),
            mercCoins: oneRoll.mercCoins * grade,
        });
    }
    // And on a recipe that bills Merc Coin, the currency is weighted the same way.
    const railGunGrade5 = getBlueprintGradeCost('RailGun_LongShot', 5)!;
    assert.equal(
        getBlueprintCost('RailGun_LongShot', 5, 4)?.mercCoins,
        railGunGrade5.mercCoins * 5,
    );
});

test('getBlueprintCost charges only grades above currentGrade and skips absent grades', () => {
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 4), {
        materials: getBlueprintGradeCost('FSD_LongRange', 5)!.materials.map((material) => ({
            symbol: material.symbol,
            name: material.name,
            count: material.count * 5,
        })),
        mercCoins: 0,
    });
    const from3 = getBlueprintCost('FSD_LongRange', 5, 3);
    assert.equal(countFor(from3, 'DisruptedWakeEchoes'), undefined);
    assert.equal(countFor(from3, 'DataminedWake'), 5);
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 0), getBlueprintCost('FSD_LongRange', 5));
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 5), { materials: [], mercCoins: 0 });

    // This bought pre-engineered recipe starts at grade 2; the absent grade 1 is skipped.
    assert.deepEqual(getBlueprintCost('ModuleReinforcement_HeavyDuty', 2), {
        materials: getBlueprintGradeCost('ModuleReinforcement_HeavyDuty', 2)!.materials.map(
            (material) => ({
                symbol: material.symbol,
                name: material.name,
                count: material.count * 2,
            }),
        ),
        mercCoins: 5 * 2,
    });
});

test('getBlueprintCost normalises ids and returns a fresh summed list', () => {
    const first = getBlueprintCost('  fsd_longrange ', 5);
    const second = getBlueprintCost('FSD_LONGRANGE', 5);
    assert.deepEqual(first, second);
    assert.notEqual(first, second);
    assert.notEqual(first?.materials[0], second?.materials[0]);
});

test('getBlueprintCost combines each material once and misses unknown requests', () => {
    for (const fdname of Object.keys(BLUEPRINT_COSTS)) {
        const cost = getBlueprintCost(fdname, 5);
        if (!cost) continue;
        const symbols = cost.materials.map((material) => material.symbol.toLowerCase());
        assert.equal(new Set(symbols).size, symbols.length, `${fdname} lists a material twice`);
    }

    assert.equal(getBlueprintCost('nope', 5), null);
    assert.equal(getBlueprintCost('ModuleReinforcement_HeavyDuty', 1), null);
    assert.equal(getBlueprintCost('CargoRack_IncreasedCapacity', 5), null);
});

test('a wrong-typed id names the function the consumer called', () => {
    // Each public function passes its own name as the lookup label, so the shared private
    // helpers cannot mis-report which function the consumer called.
    for (const [name, call] of [
        ['getBlueprintCosts', () => getBlueprintCosts(5 as unknown as string)],
        ['getBlueprintGradeCost', () => getBlueprintGradeCost(5 as unknown as string, 5)],
        ['getBlueprintCost', () => getBlueprintCost(5 as unknown as string, 5)],
    ] as const) {
        assert.throws(call, (error: unknown) => {
            assert.ok(error instanceof TypeError);
            assert.match(error.message, new RegExp(`^${name}: fdname `));
            return true;
        });
    }
});

test('the blueprint id is checked before the grade, in every function that takes both', () => {
    // With both arguments bad, which error a consumer catches must not depend on which
    // of the sibling lookups they called: all three check their arguments in declaration
    // order, so the id wins. `getBlueprintGrade` pins the same order in `blueprints.test.ts`.
    for (const call of [
        () => getBlueprintGradeCost(42 as unknown as string, 9),
        () => getBlueprintCost(42 as unknown as string, 9),
        () => getBlueprintCost(42 as unknown as string, 5, 9),
        () => getBlueprintGrade(42 as unknown as string, 9),
    ]) {
        assert.throws(call, {
            name: 'TypeError',
            message:
                /^getBlueprint(Grade|GradeCost|Cost): fdname must be a string, received number 42$/,
        });
    }
    // A nullish id stays a miss, so the grade range is still what a bad grade reports.
    assert.throws(() => getBlueprintGradeCost(null as unknown as string, 9), RangeError);
    assert.throws(() => getBlueprintCost(null as unknown as string, 9), RangeError);
    assert.throws(() => getBlueprintGrade(null as unknown as string, 9), RangeError);
});

test('getBlueprintCost rejects target and current grades outside their supported ranges', () => {
    for (const grade of [0, 6, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => getBlueprintCost('FSD_LongRange', grade), RangeError);
        assert.throws(() => getBlueprintCost('nope', grade), RangeError);
    }
    for (const currentGrade of [-1, 6, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => getBlueprintCost('FSD_LongRange', 5, currentGrade), RangeError);
        assert.throws(() => getBlueprintCost('nope', 5, currentGrade), RangeError);
    }
});

test('the Merc-Coin catalogue is the fixture, keyed and graded like the material one', () => {
    assert.deepEqual(BLUEPRINT_MERC_COIN_COSTS, engineeringFixture.mercCoinCosts.perRoll);
    for (const [fdname, grades] of Object.entries(BLUEPRINT_MERC_COIN_COSTS)) {
        // A currency cost only ever accompanies a material recipe, grade for grade.
        assert.deepEqual(Object.keys(grades), Object.keys(BLUEPRINT_COSTS[fdname] ?? {}), fdname);
        for (const [grade, amount] of Object.entries(grades)) {
            assert.ok(
                Number.isInteger(amount) && amount > 0,
                `${fdname} grade ${grade} charges ${amount}`,
            );
        }
    }
});

test('getBlueprintCost weights every charged grade by its roll count', () => {
    // Totals are fixture literals, not recomputed here: a test that re-derived them from
    // the same roll-weighting rule could not fail if that rule itself were wrong.
    for (const climb of engineeringFixture.mercCoinCosts.climbs) {
        assert.equal(
            getBlueprintCost(climb.blueprint, climb.grade, climb.currentGrade)?.mercCoins,
            climb.mercCoin,
            `${climb.blueprint} ${climb.currentGrade}->${climb.grade}`,
        );
    }
    // Every catalogued recipe reaches grade 5, so none of them is left unpinned above.
    const pinned = new Set(
        engineeringFixture.mercCoinCosts.climbs
            .filter((climb) => climb.grade === 5 && climb.currentGrade === 0)
            .map((climb) => climb.blueprint),
    );
    assert.deepEqual([...pinned].sort(), Object.keys(BLUEPRINT_MERC_COIN_COSTS).sort());
});

test('getBlueprintCost reports 0 Merc Coin rather than hiding a recipe that charges none', () => {
    const railGun = getBlueprintCost('RailGun_LongShot', 5, 1);
    assert.equal(getBlueprintCost('  railgun_longshot ', 5, 1)?.mercCoins, railGun?.mercCoins);
    assert.equal(getBlueprintCost('RailGun_LongShot', 5, 5)?.mercCoins, 0);
    assert.equal(getBlueprintCost('RailGun_LongShot', 3, 4)?.mercCoins, 0);
    // Absent from the currency catalogue: 0, alongside a real material bill.
    const ordinary = getBlueprintCost('FSD_LongRange', 5);
    assert.equal(ordinary?.mercCoins, 0);
    assert.ok(ordinary!.materials.length > 0);
    // Only "not catalogued" answers null, and it answers null for both halves at once.
    assert.equal(getBlueprintCost('nope', 5), null);
    assert.equal(getBlueprintCost('RailGun_LongShot', 1), null);
});
