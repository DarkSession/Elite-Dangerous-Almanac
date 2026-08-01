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
    for (const expected of fixture.groups) {
        const group = ENGINEERING_OPTION_GROUPS[expected.id];
        assert.ok(group, `missing group ${expected.id}`);
        assert.equal(group.name, expected.name);
        assert.equal(group.blueprints.length, expected.blueprintCount);
        assert.equal(group.experimentals.length, expected.experimentalCount);
    }
});

test('every id in the catalogue joins to a real blueprint or experimental effect', () => {
    for (const [id, group] of Object.entries(ENGINEERING_OPTION_GROUPS)) {
        for (const blueprint of group.blueprints) {
            assert.ok(BLUEPRINTS[blueprint], `${id}: unknown blueprint ${blueprint}`);
        }
        for (const effect of group.experimentals) {
            assert.ok(EXPERIMENTAL_EFFECTS[effect], `${id}: unknown effect ${effect}`);
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

test('a module offers its whole group unless it is explicitly excluded', () => {
    for (const { symbol, excluded } of fixture.exclusions) {
        const group = ENGINEERING_OPTION_GROUPS[getEngineeringGroup(symbol)!]!;
        const offered = getExperimentalsForModule(symbol);
        for (const effect of excluded) {
            assert.ok(group.experimentals.includes(effect), `${symbol}: ${effect} not in group`);
            assert.ok(!offered.includes(effect), `${symbol} still offers ${effect}`);
        }
        assert.equal(offered.length, group.experimentals.length - excluded.length);
    }
});

test('the small Multi-cannon is exactly one effect short of its group', () => {
    const all = getExperimentalsForModule('Hpt_MultiCannon_Fixed_Medium');
    const small = getExperimentalsForModule('Hpt_MultiCannon_Fixed_Small');
    assert.equal(small.length, all.length - 1);
    assert.ok(all.includes('special_phasing_sequence'));
    assert.ok(!small.includes('special_phasing_sequence'));
});

test('an engineerable module with no experimental slot still has blueprints', () => {
    // Mining tools are engineerable but take no experimental — distinct from a module
    // that cannot be engineered at all, which has neither.
    const symbol = 'Hpt_Mining_AbrBlstr_Fixed_Small';
    assert.ok(getEngineeringGroup(symbol));
    assert.ok(getBlueprintsForModule(symbol).length > 0);
    assert.deepEqual(getExperimentalsForModule(symbol), []);
});

test('a blueprint query returns the union across every group offering it', () => {
    const { blueprint, experimentals } = fixture.blueprintUnion;
    assert.deepEqual(getExperimentalsForBlueprint(blueprint), experimentals);
});

test('the blueprint union is a superset of each of its modules', () => {
    // The union is deliberately looser than the per-module answer; it must never be
    // narrower, or a caller would miss a legitimate pairing.
    for (const [symbol, group] of Object.entries(
        Object.fromEntries(fixture.modules.map((m) => [m.symbol, m.group] as const)) as Record<
            string,
            string
        >,
    )) {
        for (const blueprint of ENGINEERING_OPTION_GROUPS[group]!.blueprints) {
            const union = getExperimentalsForBlueprint(blueprint);
            for (const effect of getExperimentalsForModule(symbol)) {
                assert.ok(union.includes(effect), `${blueprint}: union misses ${effect}`);
            }
        }
    }
});

test('getExperimentalsForBlueprint normalises input and misses cleanly', () => {
    assert.deepEqual(
        getExperimentalsForBlueprint('  fsd_longrange  '),
        fixture.blueprintUnion.experimentals,
    );
    assert.deepEqual(getExperimentalsForBlueprint('NoSuchBlueprint'), []);
});
