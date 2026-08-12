import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BLUEPRINTS, getBlueprint, getBlueprintGrade } from './blueprints.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';

test('every blueprint carries a display name and grades', () => {
    for (const [fdname, bp] of Object.entries(BLUEPRINTS)) {
        assert.ok(typeof bp.name === 'string' && bp.name.length > 0, `${fdname} has no name`);
        assert.ok(bp.grades && Object.keys(bp.grades).length > 0, `${fdname} has no grades`);
    }
});

test('getBlueprint resolves case-insensitively and misses cleanly', () => {
    assert.equal(getBlueprint('FSD_LongRange')?.name, 'Increased range');
    assert.equal(getBlueprint('fsd_longrange')?.name, 'Increased range');
    assert.equal(getBlueprint('guardianmodule_sturdy')?.name, 'Anti-Guardian Zone Resistance');
    assert.equal(getBlueprint('nope'), null);
});

test('Anti-Guardian Zone Resistance is keyed once, under the id the game writes', () => {
    // The game writes `GuardianModule_Sturdy` on Guardian weapons as well as on Guardian
    // modules, so the recipe has one key. The registry's `recipe_`-prefixed spellings of it
    // are not stored: a second copy of one record is a roll that can drift from the first.
    const bp = getBlueprint('GuardianModule_Sturdy');
    assert.ok(bp, 'GuardianModule_Sturdy is missing');
    assert.equal(bp.name, 'Anti-Guardian Zone Resistance');
    assert.deepEqual(Object.keys(bp.grades), ['1'], 'it is grade 1 only');
    assert.deepEqual(getBlueprintGrade('GuardianModule_Sturdy', 1)?.features, [
        { label: 'GuardianModuleResistance', method: 'additive', min: 1, max: 1 },
    ]);
    assert.deepEqual(
        Object.keys(BLUEPRINTS).filter((key) => BLUEPRINTS[key]!.name === bp.name),
        ['GuardianModule_Sturdy'],
        'the keys holding a record under this name are not the one expected',
    );
});

test('every grade carries its modifier features', () => {
    for (const [fdname, bp] of Object.entries(BLUEPRINTS)) {
        for (const [grade, entry] of Object.entries(bp.grades)) {
            assert.ok(Array.isArray(entry.features), `${fdname} ${grade} features`);
            assert.ok(entry.features.length > 0, `${fdname} ${grade} has no features`);
        }
    }
});

test('getBlueprintGrade returns the complete mechanics record', () => {
    const grade = getBlueprintGrade('FSD_LongRange', 5);
    assert.ok(grade?.features.some((feature) => feature.label === 'FSDOptimalMass'));
    assert.deepEqual(Object.keys(grade ?? {}), ['features']);
});

test('getBlueprintGrade resolves case-insensitively and misses unknown requests cleanly', () => {
    assert.deepEqual(getBlueprintGrade('fsd_longrange', 5), getBlueprintGrade('FSD_LongRange', 5));
    assert.equal(getBlueprintGrade('nope', 5), null);
    assert.deepEqual(
        getBlueprintGrade('beamlaser_thermalplasmaconversion', 5)?.damageDistribution,
        { thermal: 0.845, absolute: 0.155 },
    );
    assert.equal(getBlueprintGrade('FSD_LongRange', 5)?.damageDistribution, undefined);
});

test('getBlueprintGrade rejects grades outside the supported range', () => {
    for (const grade of [0, 6, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => getBlueprintGrade('FSD_LongRange', grade), RangeError);
        assert.throws(() => getBlueprintGrade('nope', grade), RangeError);
    }
});

test('getBlueprint returns the name and complete per-grade mechanics', () => {
    const bp = getBlueprint('FSD_LongRange');
    assert.equal(bp?.name, 'Increased range');
    assert.ok(bp?.grades['5']?.features);
    assert.equal('materials' in bp!.grades['5']!, false);
});

test('a blueprint lookup names itself, and its grade facade names itself too', () => {
    for (const [call, label] of [
        [() => getBlueprint(42 as unknown as string), 'getBlueprint: fdname'],
        [() => getBlueprintGrade(42 as unknown as string, 5), 'getBlueprintGrade: fdname'],
    ] as const) {
        assert.throws(call, {
            name: 'TypeError',
            message: `${label} must be a string, received number 42`,
        });
    }
    // The id is checked before the grade range, so a bad id is not reported as a bad grade.
    assert.throws(() => getBlueprintGrade(42 as unknown as string, 9), /fdname must be a string/);
    assert.equal(getBlueprintGrade(null as unknown as string, 5), null);
});

test('resolving a recipe id is strict about the id, and a miss about the module', () => {
    // It hands an id back rather than reporting whether one is known, so a nullish
    // `blueprint` would be a `string` return that is not one.
    for (const bad of [42, null, undefined]) {
        assert.throws(
            () =>
                resolveBlueprintForModule('Int_Hyperdrive_Size6_Class5', bad as unknown as string),
            {
                name: 'TypeError',
                message: /^resolveBlueprintForModule: blueprint must be a string, received /,
            },
        );
    }
    assert.throws(() => resolveBlueprintForModule(42 as unknown as string, 'FSD_LongRange'), {
        name: 'TypeError',
        message: 'resolveBlueprintForModule: symbol must be a string, received number 42',
    });
    // An unknown module offers no menu, so the id comes back unchanged.
    assert.equal(
        resolveBlueprintForModule(null as unknown as string, 'FSD_LongRange'),
        'FSD_LongRange',
    );
});
