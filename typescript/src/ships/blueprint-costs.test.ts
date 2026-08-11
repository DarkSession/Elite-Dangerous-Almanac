import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_MATERIALS } from '../materials/materials-all.js';
import { getMaterialBySymbol } from '../materials/materials.js';
import engineeringFixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };
import {
    BLUEPRINT_COSTS,
    getBlueprintCost,
    getBlueprintCosts,
    getBlueprintGradeCost,
} from './blueprint-costs.js';
import { BLUEPRINTS } from './blueprints.js';

const countFor = (materials: readonly { symbol: string; count: number }[] | null, symbol: string) =>
    materials?.find((material) => material.symbol === symbol)?.count;

test('cost and mechanics catalogues have identical blueprint ids and grade sets', () => {
    assert.deepEqual(Object.keys(BLUEPRINT_COSTS), Object.keys(BLUEPRINTS));
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

test('getBlueprintGradeCost returns one roll and misses unknown grades cleanly', () => {
    assert.deepEqual(getBlueprintGradeCost(' FSD_LONGrange ', 5), [
        { symbol: 'Arsenic', name: 'Arsenic', count: 1 },
        { symbol: 'ChemicalManipulators', name: 'Chemical Manipulators', count: 1 },
        { symbol: 'DataminedWake', name: 'Datamined Wake Exceptions', count: 1 },
    ]);
    assert.equal(getBlueprintGradeCost('FSD_LongRange', 9), null);
    assert.equal(getBlueprintGradeCost('FSD_LongRange', 1.5), null);
    assert.equal(getBlueprintGradeCost('nope', 1), null);
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

test('the one empty per-roll recipe is preserved as [] rather than null', () => {
    assert.deepEqual(getBlueprintGradeCost('CargoRack_IncreasedCapacity', 5), []);
    const empty = Object.entries(BLUEPRINT_COSTS).flatMap(([fdname, grades]) =>
        Object.entries(grades)
            .filter(([, materials]) => materials.length === 0)
            .map(([grade]) => `${fdname}:${grade}`),
    );
    assert.deepEqual(empty, ['CargoRack_IncreasedCapacity:5']);
});

test('duplicate recipe spellings retain identical material costs', () => {
    for (const [fdname, journalName] of Object.entries(engineeringFixture.journalNames.map)) {
        assert.deepEqual(BLUEPRINT_COSTS[fdname], BLUEPRINT_COSTS[journalName], fdname);
    }
    const guardian = BLUEPRINT_COSTS['GuardianModule_Sturdy'];
    assert.deepEqual(BLUEPRINT_COSTS['recipe_guardianmodule_sturdy'], guardian);
    assert.deepEqual(BLUEPRINT_COSTS['recipe_guardianweapon_sturdy'], guardian);
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

test('getBlueprintCost charges only grades above currentGrade and skips absent grades', () => {
    assert.deepEqual(
        getBlueprintCost('FSD_LongRange', 5, 4),
        getBlueprintGradeCost('FSD_LongRange', 5)!.map((material) => ({
            symbol: material.symbol,
            name: material.name,
            count: material.count * 5,
        })),
    );
    const from3 = getBlueprintCost('FSD_LongRange', 5, 3);
    assert.equal(countFor(from3, 'DisruptedWakeEchoes'), undefined);
    assert.equal(countFor(from3, 'DataminedWake'), 5);
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 0), getBlueprintCost('FSD_LongRange', 5));
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 5), []);
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 9), []);

    // This bought pre-engineered recipe starts at grade 2; the absent grade 1 is skipped.
    assert.deepEqual(
        getBlueprintCost('ModuleReinforcement_HeavyDuty', 2),
        getBlueprintGradeCost('ModuleReinforcement_HeavyDuty', 2)!.map((material) => ({
            symbol: material.symbol,
            name: material.name,
            count: material.count * 2,
        })),
    );
});

test('getBlueprintCost normalises ids and returns a fresh summed list', () => {
    const first = getBlueprintCost('  fsd_longrange ', 5);
    const second = getBlueprintCost('FSD_LONGRANGE', 5);
    assert.deepEqual(first, second);
    assert.notEqual(first, second);
    assert.notEqual(first?.[0], second?.[0]);
});

test('getBlueprintCost combines each material once and rejects invalid requests', () => {
    for (const fdname of Object.keys(BLUEPRINT_COSTS)) {
        const cost = getBlueprintCost(fdname, 5);
        if (!cost) continue;
        const symbols = cost.map((material) => material.symbol.toLowerCase());
        assert.equal(new Set(symbols).size, symbols.length, `${fdname} lists a material twice`);
    }

    assert.equal(getBlueprintCost('nope', 5), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 9), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 0), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 1.5), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 5, -1), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 5, 2.5), null);
    assert.deepEqual(getBlueprintCost('CargoRack_IncreasedCapacity', 5), []);
});
