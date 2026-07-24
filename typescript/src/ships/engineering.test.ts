import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeModifiers } from './engineering.js';
import { getBlueprint, getBlueprintGrade, BLUEPRINTS } from './blueprints.js';
import { getExperimentalEffect, EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import {
    blueprintTargets,
    experimentalTarget,
    moduleEngineeringTarget,
} from './engineering-compatibility.js';
import fixture from '../../../fixtures/ships/engineering.json' with { type: 'json' };

const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;
const modFor = (mods: { Label: string; Value?: number }[], label: string) =>
    mods.find((m) => m.Label === label)?.Value;

test('the catalogues hold the expected counts', () => {
    assert.equal(Object.keys(BLUEPRINTS).length, fixture.blueprintCount);
    assert.equal(Object.keys(EXPERIMENTAL_EFFECTS).length, fixture.experimentalCount);
});

test('every engineering id has an explicit compatibility target', () => {
    for (const id of Object.keys(BLUEPRINTS)) {
        assert.notEqual(blueprintTargets(id), null, `blueprint target: ${id}`);
    }
    for (const id of Object.keys(EXPERIMENTAL_EFFECTS)) {
        assert.notEqual(experimentalTarget(id), null, `experimental target: ${id}`);
    }
    assert.equal(moduleEngineeringTarget('Int_Hyperdrive_Size5_Class5'), 'frameShiftDrive');
    assert.equal(moduleEngineeringTarget('Anaconda_Armour_Reactive'), 'armour');
    assert.equal(moduleEngineeringTarget('Hpt_PulseLaser_Fixed_Small'), 'weapon');
    assert.deepEqual(blueprintTargets('Misc_LightWeight'), [
        'miscellaneous',
        'chaff',
        'heatSink',
        'pointDefence',
    ]);
});

test('computeModifiers reproduces the FSD Long Range G5 + Mass Manager anchor', () => {
    const a = fixture.anchor;
    const mods = computeModifiers(
        a.base,
        getBlueprintGrade(a.blueprint, a.grade)!,
        a.quality,
        getExperimentalEffect(a.experimental)!,
    );
    assert.ok(near(modFor(mods, 'FSDOptimalMass')!, a.expected.FSDOptimalMass), 'optmass');
    assert.ok(near(modFor(mods, 'Mass')!, a.expected.Mass), 'mass');
    assert.ok(near(modFor(mods, 'Integrity')!, a.expected.Integrity), 'integrity');
    assert.ok(near(modFor(mods, 'PowerDraw')!, a.expected.PowerDraw), 'power');
});

test('every modifier carries its original base value', () => {
    const a = fixture.anchor;
    const mods = computeModifiers(a.base, getBlueprintGrade(a.blueprint, a.grade)!, 1);
    assert.equal(mods.find((m) => m.Label === 'FSDOptimalMass')?.OriginalValue, 4670);
});

test('quality interpolates a feature between its min and max', () => {
    // FSD_LongRange G5 optmass spans [0.45, 0.55]; base 1000 -> 1450 / 1500 / 1550.
    const base = { FSDOptimalMass: 1000 };
    const g5 = getBlueprintGrade('FSD_LongRange', 5)!;
    assert.ok(near(modFor(computeModifiers(base, g5, 0), 'FSDOptimalMass')!, 1450));
    assert.ok(near(modFor(computeModifiers(base, g5, 0.5), 'FSDOptimalMass')!, 1500));
    assert.ok(near(modFor(computeModifiers(base, g5, 1), 'FSDOptimalMass')!, 1550));
});

test('a contribution to a stat not present in the base is skipped', () => {
    const mods = computeModifiers({ Mass: 100 }, [
        { label: 'Integrity', method: 'multiplicative', min: 0.5, max: 0.5 },
    ]);
    assert.equal(mods.length, 0);
});

test('additive and multiplicative methods differ', () => {
    const mult = computeModifiers({ X: 100 }, [
        { label: 'X', method: 'multiplicative', min: 0.1, max: 0.1 },
    ]);
    const add = computeModifiers({ X: 100 }, [
        { label: 'X', method: 'additive', min: 0.1, max: 0.1 },
    ]);
    assert.equal(modFor(mult, 'X'), 110);
    assert.equal(modFor(add, 'X'), 100.1);
});

test('each contribution keeps its own method on a label collision', () => {
    // A multiplicative blueprint feature and an additive experimental on one label:
    // multiply first (100 * 1.2 = 120), then add (120 + 5 = 125) — not 100*1.2*1.05.
    const mods = computeModifiers(
        { X: 100 },
        [{ label: 'X', method: 'multiplicative', min: 0.2, max: 0.2 }],
        1,
        [{ label: 'X', method: 'additive', value: 5 }],
    );
    assert.equal(modFor(mods, 'X'), 125);
});

test('quality outside [0, 1] is rejected', () => {
    const g5 = getBlueprintGrade('FSD_LongRange', 5)!;
    const base = { FSDOptimalMass: 1000 };
    assert.throws(() => computeModifiers(base, g5, 5), RangeError);
    assert.throws(() => computeModifiers(base, g5, -5), RangeError);
    assert.throws(() => computeModifiers(base, g5, Number.NaN), RangeError);
});

test('lookups are case-insensitive and miss cleanly', () => {
    assert.ok(getBlueprint('fsd_longrange'));
    assert.equal(getBlueprint('nope'), null);
    assert.equal(getBlueprintGrade('FSD_LongRange', 9), null);
    assert.ok(getExperimentalEffect('SPECIAL_FSD_HEAVY'));
    assert.equal(getExperimentalEffect('nope'), null);
});
