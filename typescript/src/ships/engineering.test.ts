import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeModifiers, rollsForGrade, sumMaterials } from './engineering.js';
import { getBlueprint, getBlueprintGrade, BLUEPRINTS } from './blueprints.js';
import { getExperimentalEffect, EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import {
    blueprintTargets,
    experimentalTarget,
    moduleEngineeringTarget,
} from './engineering-compatibility.js';
import fixture from '../../../fixtures/ships/engineering.json' with { type: 'json' };
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { baseStats } from './module-stat-labels.js';
import { combinedRateOfFire } from './weapons.js';

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

test('rollsForGrade returns grades 1–5 and rejects values outside that range', () => {
    assert.equal(rollsForGrade(1), 1);
    assert.equal(rollsForGrade(5), 5);
    assert.throws(() => rollsForGrade(0), RangeError);
    assert.throws(() => rollsForGrade(6), RangeError);
    assert.throws(() => rollsForGrade(-1), RangeError);
    assert.throws(() => rollsForGrade(2.5), RangeError);
});

test('sumMaterials folds lists together, combining by symbol case-insensitively', () => {
    const a = [
        { symbol: 'Iron', name: 'Iron', count: 2 },
        { symbol: 'Carbon', name: 'Carbon', count: 1 },
    ];
    const b = [{ symbol: 'iron', name: 'Iron', count: 3 }];
    assert.deepEqual(sumMaterials(a, b), [
        { symbol: 'Iron', name: 'Iron', count: 5 },
        { symbol: 'Carbon', name: 'Carbon', count: 1 },
    ]);
    assert.deepEqual(sumMaterials(), []);
    assert.deepEqual(sumMaterials([], a), a);
});

test('lookups are case-insensitive and miss cleanly', () => {
    assert.ok(getBlueprint('fsd_longrange'));
    assert.equal(getBlueprint('nope'), null);
    assert.equal(getBlueprintGrade('FSD_LongRange', 9), null);
    assert.ok(getExperimentalEffect('SPECIAL_FSD_HEAVY'));
    assert.equal(getExperimentalEffect('nope'), null);
});

test('Rapid Fire shortens the fire interval, and the rate of fire follows', () => {
    // Frontier's recipe modifies the *interval* — -44% of the wait between shots —
    // so that is the label it carries. The rate of fire is derived from it.
    const multiCannon = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', ALL_MODULES)!;
    const rapid = computeModifiers(
        baseStats(multiCannon),
        getBlueprintGrade('Weapon_RapidFire', 5)!,
        1,
    );
    assert.equal(
        rapid.find((m) => m.Label === 'RateOfFire'),
        undefined,
        'the recipe names the interval, not the rate',
    );
    const interval = rapid.find((m) => m.Label === 'BurstInterval')!;
    assert.equal(interval.OriginalValue, multiCannon.burstInterval);
    assert.ok(Math.abs(interval.Value! - multiCannon.burstInterval! * 0.56) < 1e-9);

    // A single-shot weapon's rate is the interval's reciprocal...
    assert.ok(
        Math.abs(
            combinedRateOfFire({ ...multiCannon, burstInterval: interval.Value! })! -
                multiCannon.rateOfFire! / 0.56,
        ) < 1e-5,
    );
    // ...while a burst weapon keeps the (3 - 1) / 15 s its own burst takes.
    const burstLaser = getModuleBySymbol('Hpt_PulseLaserBurst_Fixed_Small', ALL_MODULES)!;
    const burstInterval = computeModifiers(
        baseStats(burstLaser),
        getBlueprintGrade('Weapon_RapidFire', 5)!,
        1,
    ).find((m) => m.Label === 'BurstInterval')!;
    assert.ok(
        Math.abs(
            combinedRateOfFire({ ...burstLaser, burstInterval: burstInterval.Value! })! -
                3 / (2 / 15 + 0.5 * 0.56),
        ) < 1e-9,
    );
});

test('a tech-broker recipe raises the rate of fire directly, as its registry publishes it', () => {
    // The Inara-sourced `recipe_*` totals are the displayed stat change, so a
    // rate-of-fire total is exactly that — including on a charged weapon, whose spin-up
    // is part of the published cycle.
    const railgun = getModuleBySymbol('Hpt_Railgun_Fixed_Medium', ALL_MODULES)!;
    const rate = computeModifiers(
        baseStats(railgun),
        getBlueprintGrade('recipe_railgun_longshot', 5)!,
        1,
    ).find((m) => m.Label === 'RateOfFire')!;
    assert.ok(Math.abs(rate.Value! - railgun.rateOfFire! * 1.667) < 1e-5, `${rate.Value}`);
});

test('a long-range recipe pushes the damage falloff out to the new maximum range', () => {
    // Upstream encodes "damage falls off from maximum range" as an overwrite in [0, 1]
    // — a flag, not a distance. Read literally it would put the falloff a metre out.
    const multiCannon = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', ALL_MODULES)!;
    const modifiers = computeModifiers(
        baseStats(multiCannon),
        getBlueprintGrade('Weapon_LongRange', 5)!,
        1,
    );
    const range = modifiers.find((m) => m.Label === 'Range')!;
    const falloff = modifiers.find((m) => m.Label === 'FalloffRange')!;
    assert.equal(range.Value, 8000); // 4000 doubled at a full grade-5 roll
    assert.equal(falloff.Value, range.Value);
});

test('an overwrite recipe applies to a stat the module does not carry', () => {
    // Double Shot gives a two-round burst to a multi-cannon that fires one at a time.
    const multiCannon = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', ALL_MODULES)!;
    assert.equal(multiCannon.burstRounds, undefined);
    const modifiers = computeModifiers(
        baseStats(multiCannon),
        getBlueprintGrade('Weapon_DoubleShot', 5)!,
        1,
    );
    const size = modifiers.find((m) => m.Label === 'BurstSize')!;
    assert.equal(size.Value, 2);
    assert.equal(size.OriginalValue, 1); // the value the game assumes when absent
    assert.equal(modifiers.find((m) => m.Label === 'BurstRateOfFire')?.Value, 14);
});
