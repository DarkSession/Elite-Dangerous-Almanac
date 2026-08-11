import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BLUEPRINTS, getBlueprint, getBlueprintGrade } from './blueprints.js';

test('every blueprint carries a display name and grades', () => {
    for (const [fdname, bp] of Object.entries(BLUEPRINTS)) {
        assert.ok(typeof bp.name === 'string' && bp.name.length > 0, `${fdname} has no name`);
        assert.ok(bp.grades && Object.keys(bp.grades).length > 0, `${fdname} has no grades`);
    }
});

test('getBlueprint resolves case-insensitively and misses cleanly', () => {
    assert.equal(getBlueprint('FSD_LongRange')?.name, 'Increased range');
    assert.equal(getBlueprint('fsd_longrange')?.name, 'Increased range');
    assert.equal(
        getBlueprint('recipe_guardianmodule_sturdy')?.name,
        'Anti-Guardian Zone Resistance',
    );
    assert.equal(getBlueprint('nope'), null);
});

test('Anti-Guardian Zone Resistance resolves identically under all three of its keys', () => {
    // One recipe, three spellings: the id the game writes, and the two the registries
    // publish. They must not drift apart — a build resolving to a different roll depending
    // on which spelling it happened to carry is the bug the duplication exists to avoid.
    const keys = [
        'GuardianModule_Sturdy',
        'recipe_guardianmodule_sturdy',
        'recipe_guardianweapon_sturdy',
    ];
    for (const key of keys) {
        const bp = getBlueprint(key);
        assert.ok(bp, `${key} is missing`);
        assert.equal(bp.name, 'Anti-Guardian Zone Resistance');
        assert.deepEqual(Object.keys(bp.grades), ['1'], `${key} is grade 1 only`);
        assert.deepEqual(getBlueprintGrade(key, 1)?.features, [
            { label: 'GuardianModuleResistance', method: 'additive', min: 1, max: 1 },
        ]);
    }
    // Assert equality between the records too, not just each against a literal, so a stat
    // added to one and not the others fails here rather than silently diverging.
    const [first, ...rest] = keys.map((k) => getBlueprint(k));
    for (const other of rest) assert.deepEqual(other, first);
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

test('getBlueprintGrade resolves case-insensitively and misses cleanly', () => {
    assert.deepEqual(getBlueprintGrade('fsd_longrange', 5), getBlueprintGrade('FSD_LongRange', 5));
    assert.equal(getBlueprintGrade('nope', 5), null);
    assert.equal(getBlueprintGrade('FSD_LongRange', 9), null);
    assert.deepEqual(
        getBlueprintGrade('beamlaser_thermalplasmaconversion', 5)?.damageDistribution,
        { thermal: 0.845, absolute: 0.155 },
    );
    assert.equal(getBlueprintGrade('FSD_LongRange', 5)?.damageDistribution, undefined);
});

test('getBlueprint returns the name and complete per-grade mechanics', () => {
    const bp = getBlueprint('FSD_LongRange');
    assert.equal(bp?.name, 'Increased range');
    assert.ok(bp?.grades['5']?.features);
    assert.equal('materials' in bp!.grades['5']!, false);
});
