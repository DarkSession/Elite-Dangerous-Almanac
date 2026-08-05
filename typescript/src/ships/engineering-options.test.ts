import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    ENGINEERING_OPTION_GROUPS,
    getEngineeringGroup,
    getBlueprintsForModule,
    getExperimentalsForModule,
    getExperimentalsForBlueprint,
} from './engineering-options.js';
import { BLUEPRINTS } from './blueprints.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import fixture from '../../../fixtures/ships/engineering-options.json' with { type: 'json' };

test('the catalogue holds the expected groups, modules and exclusions', () => {
    assert.equal(Object.keys(ENGINEERING_OPTION_GROUPS).length, fixture.counts.groups);
    const blueprintEntries = Object.values(ENGINEERING_OPTION_GROUPS).reduce(
        (total, group) => total + Object.keys(group.blueprints).length,
        0,
    );
    assert.equal(blueprintEntries, fixture.counts.blueprintEntries);
    // The reshape multiplied the stored effect ids from 159 to 893; count them, or a
    // dropped or duplicated id inside any of the 20 groups the fixture does not spell
    // out would only have to name a real effect to pass unnoticed.
    const experimentalEntries = Object.values(ENGINEERING_OPTION_GROUPS).reduce(
        (total, group) =>
            total + Object.values(group.blueprints).reduce((n, effects) => n + effects.length, 0),
        0,
    );
    assert.equal(experimentalEntries, fixture.counts.experimentalEntries);
    for (const expected of fixture.groups) {
        const group = ENGINEERING_OPTION_GROUPS[expected.id];
        assert.ok(group, `missing group ${expected.id}`);
        assert.equal(group.name, expected.name);
        assert.deepEqual(
            Object.fromEntries(
                Object.entries(group.blueprints).map(([id, effects]) => [id, effects.length]),
            ),
            expected.blueprints,
        );
    }
});

test('every id in the catalogue joins to a real blueprint or experimental effect', () => {
    for (const [id, group] of Object.entries(ENGINEERING_OPTION_GROUPS)) {
        for (const [blueprint, effects] of Object.entries(group.blueprints)) {
            assert.ok(BLUEPRINTS[blueprint], `${id}: unknown blueprint ${blueprint}`);
            for (const effect of effects) {
                assert.ok(
                    EXPERIMENTAL_EFFECTS[effect],
                    `${id}/${blueprint}: unknown effect ${effect}`,
                );
            }
        }
    }
});

test('every module in the catalogue is a real module in a real group', () => {
    for (const expected of fixture.modules) {
        assert.ok(getModuleBySymbol(expected.symbol, ALL_MODULES), expected.symbol);
        assert.equal(getEngineeringGroup(expected.symbol), expected.group);
    }
});

test('getEngineeringGroup normalises input and misses cleanly', () => {
    assert.equal(getEngineeringGroup('  hpt_beamlaser_fixed_small  '), 'beamLasers');
    assert.equal(getEngineeringGroup('HPT_BEAMLASER_FIXED_SMALL'), 'beamLasers');
    for (const symbol of fixture.notEngineerable) {
        assert.equal(getEngineeringGroup(symbol), null, symbol);
        assert.deepEqual(getBlueprintsForModule(symbol), []);
        assert.deepEqual(getExperimentalsForModule(symbol), []);
    }
});

test('an experimental list is exact for a (module, blueprint) pair', () => {
    for (const { symbol, blueprint, experimentals } of fixture.blueprintExperimentals) {
        assert.deepEqual(
            getExperimentalsForBlueprint(blueprint, symbol),
            experimentals,
            `${symbol} + ${blueprint}`,
        );
    }
});

test('a pair the catalogue does not carry answers with nothing', () => {
    for (const { symbol, blueprint } of fixture.unknownPairs) {
        assert.deepEqual(getExperimentalsForBlueprint(blueprint, symbol), [], symbol);
    }
    // An unknown blueprint on a module that *is* grouped, and an unknown module.
    assert.deepEqual(
        getExperimentalsForBlueprint('NoSuchBlueprint', 'Int_Hyperdrive_Size5_Class5'),
        [],
    );
    assert.deepEqual(getExperimentalsForBlueprint('FSD_LongRange', 'No_Such_Module'), []);
});

test('getExperimentalsForBlueprint normalises both arguments', () => {
    const expected = getExperimentalsForBlueprint('FSD_LongRange', 'Int_Hyperdrive_Size5_Class5');
    assert.ok(expected.length > 0);
    assert.deepEqual(
        getExperimentalsForBlueprint('  fsd_longrange  ', '  INT_HYPERDRIVE_SIZE5_CLASS5  '),
        expected,
    );
});

test('a module offers each blueprint whole unless it is explicitly excluded', () => {
    for (const { symbol, excluded } of fixture.exclusions) {
        const group = ENGINEERING_OPTION_GROUPS[getEngineeringGroup(symbol)!]!;
        for (const [blueprint, effects] of Object.entries(group.blueprints)) {
            const offered = getExperimentalsForBlueprint(blueprint, symbol);
            for (const effect of excluded) {
                assert.ok(effects.includes(effect), `${symbol}: ${effect} not in ${blueprint}`);
                assert.ok(!offered.includes(effect), `${symbol} still offers ${effect}`);
            }
            assert.equal(offered.length, effects.length - excluded.length);
        }
    }
});

test('the small Multi-cannon is exactly one effect short of the medium one', () => {
    const all = getExperimentalsForBlueprint('Weapon_Efficient', 'Hpt_MultiCannon_Fixed_Medium');
    const small = getExperimentalsForBlueprint('Weapon_Efficient', 'Hpt_MultiCannon_Fixed_Small');
    assert.equal(small.length, all.length - 1);
    assert.ok(all.includes('special_phasing_sequence'));
    assert.ok(!small.includes('special_phasing_sequence'));
});

test('an engineerable module with no experimental slot still has blueprints', () => {
    // The Abrasion Blaster is grouped and takes blueprints but no experimental —
    // distinct from a module the catalogue does not group, which has neither.
    const symbol = 'Hpt_Mining_AbrBlstr_Fixed_Small';
    assert.ok(getEngineeringGroup(symbol));
    const blueprints = getBlueprintsForModule(symbol);
    assert.ok(blueprints.length > 0);
    for (const blueprint of blueprints) {
        assert.deepEqual(getExperimentalsForBlueprint(blueprint, symbol), []);
    }
    assert.deepEqual(getExperimentalsForModule(symbol), []);
});

test('the per-module union is the menu drawn before a blueprint is chosen', () => {
    for (const { symbol, experimentals } of fixture.moduleExperimentals) {
        assert.deepEqual(getExperimentalsForModule(symbol), experimentals, symbol);
    }
});

test('no source yet distinguishes two blueprints of one group', () => {
    // While this holds, every blueprint of a group carries that group's list — see
    // https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/33. The first real
    // per-blueprint difference makes this fail, which is the reminder to flip the
    // fixture flag and to stop describing the lists as an expansion.
    const identical = Object.values(ENGINEERING_OPTION_GROUPS).every((group) => {
        const lists = Object.values(group.blueprints).map((effects) => effects.join(','));
        return lists.every((list) => list === lists[0]);
    });
    assert.equal(identical, fixture.blueprintListsIdenticalWithinGroup);
});

test('every returned array is frozen, whether it is a hit or a miss', () => {
    // A caller that sorts the result must not find that one module throws and another
    // does not, and must never be able to reorder the catalogue for everyone else.
    const frozen = [
        getBlueprintsForModule('Int_Hyperdrive_Size5_Class5'),
        getBlueprintsForModule('Int_CargoRack_Size2_Class1'),
        // With exclusions applied and without — the two code paths.
        getExperimentalsForBlueprint('Weapon_Efficient', 'Hpt_MultiCannon_Fixed_Small'),
        getExperimentalsForBlueprint('FSD_LongRange', 'Int_Hyperdrive_Size5_Class5'),
        getExperimentalsForBlueprint('FSD_LongRange', 'No_Such_Module'),
        getExperimentalsForModule('Hpt_MultiCannon_Fixed_Small'),
        getExperimentalsForModule('Int_CargoRack_Size2_Class1'),
    ];
    for (const result of frozen) assert.ok(Object.isFrozen(result));
    assert.notEqual(
        getExperimentalsForBlueprint('FSD_LongRange', 'Int_Hyperdrive_Size5_Class5'),
        ENGINEERING_OPTION_GROUPS['frameShiftDrives']!.blueprints['FSD_LongRange'],
    );
});
