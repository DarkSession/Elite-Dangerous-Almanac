import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    BLUEPRINTS,
    getBlueprint,
    getBlueprintName,
    getBlueprintGrade,
    getBlueprintGradeMaterials,
    getBlueprintCost,
} from './blueprints.js';
import { getMaterialBySymbol } from '../materials/materials.js';
import { ALL_MATERIALS } from '../materials/materials-all.js';

test('every blueprint carries a display name and grades', () => {
    for (const [fdname, bp] of Object.entries(BLUEPRINTS)) {
        assert.ok(typeof bp.name === 'string' && bp.name.length > 0, `${fdname} has no name`);
        assert.ok(bp.grades && Object.keys(bp.grades).length > 0, `${fdname} has no grades`);
    }
});

test('getBlueprintName resolves case-insensitively and misses cleanly', () => {
    assert.equal(getBlueprintName('FSD_LongRange'), 'Increased range');
    assert.equal(getBlueprintName('fsd_longrange'), 'Increased range');
    assert.equal(getBlueprintName('recipe_guardianmodule_sturdy'), 'Anti-Guardian Zone Resistance');
    assert.equal(getBlueprintName('nope'), null);
});

test('Anti-Guardian Zone Resistance resolves under both of its keys', () => {
    // The one blueprint is keyed once for modules and once for weapons.
    for (const key of ['recipe_guardianmodule_sturdy', 'recipe_guardianweapon_sturdy']) {
        const bp = getBlueprint(key);
        assert.ok(bp, `${key} is missing`);
        assert.equal(bp.name, 'Anti-Guardian Zone Resistance');
        assert.deepEqual(Object.keys(bp.grades), ['1'], `${key} is grade 1 only`);
        assert.deepEqual(getBlueprintGrade(key, 1), [
            { label: 'GuardianModuleResistance', method: 'additive', min: 1, max: 1 },
        ]);
        assert.deepEqual(getBlueprintGradeMaterials(key, 1), [
            { symbol: 'tg_abrasion03', name: 'Hardened Surface Fragments', count: 2 },
            { symbol: 'tg_causticcrystal', name: 'Caustic Crystal', count: 1 },
        ]);
    }
});

test('every grade carries both its features and its materials', () => {
    for (const [fdname, bp] of Object.entries(BLUEPRINTS)) {
        for (const [grade, entry] of Object.entries(bp.grades)) {
            assert.ok(Array.isArray(entry.features), `${fdname} ${grade} features`);
            assert.ok(entry.features.length > 0, `${fdname} ${grade} has no features`);
            assert.ok(Array.isArray(entry.materials), `${fdname} ${grade} materials`);
        }
    }
});

test('getBlueprintGrade returns the grade features; getBlueprintGradeMaterials the recipe', () => {
    const features = getBlueprintGrade('FSD_LongRange', 5);
    assert.ok(features && features.some((f) => f.label === 'FSDOptimalMass'));
    const materials = getBlueprintGradeMaterials('FSD_LongRange', 5);
    assert.deepEqual(materials, [
        { symbol: 'Arsenic', name: 'Arsenic', count: 1 },
        { symbol: 'ChemicalManipulators', name: 'Chemical Manipulators', count: 1 },
        { symbol: 'DataminedWake', name: 'Datamined Wake Exceptions', count: 1 },
    ]);
});

test('getBlueprintGradeMaterials resolves case-insensitively and misses cleanly', () => {
    assert.deepEqual(
        getBlueprintGradeMaterials('fsd_longrange', 5),
        getBlueprintGradeMaterials('FSD_LongRange', 5),
    );
    assert.equal(getBlueprintGradeMaterials('nope', 5), null);
    assert.equal(getBlueprintGradeMaterials('FSD_LongRange', 9), null);
});

test('every material requirement joins to a real material in the materials domain', () => {
    for (const { grades } of Object.values(BLUEPRINTS)) {
        for (const { materials } of Object.values(grades)) {
            for (const req of materials) {
                const material = getMaterialBySymbol(req.symbol, ALL_MATERIALS);
                assert.ok(material, `unknown material symbol: ${req.symbol}`);
                assert.equal(material.name, req.name, `name mismatch for ${req.symbol}`);
                assert.ok(
                    req.count > 0 && Number.isInteger(req.count),
                    `bad count for ${req.symbol}`,
                );
            }
        }
    }
});

test('no grade lists a material twice', () => {
    for (const [fdname, { grades }] of Object.entries(BLUEPRINTS)) {
        for (const [grade, { materials }] of Object.entries(grades)) {
            const symbols = materials.map((r) => r.symbol.toLowerCase());
            assert.equal(
                new Set(symbols).size,
                symbols.length,
                `${fdname} grade ${grade} duplicate material`,
            );
        }
    }
});

test('the one empty recipe (CargoRack_IncreasedCapacity G5) is preserved as [] not null', () => {
    assert.deepEqual(getBlueprintGradeMaterials('CargoRack_IncreasedCapacity', 5), []);
    // It is the only empty recipe across the whole catalogue.
    const empties = Object.entries(BLUEPRINTS).flatMap(([fd, { grades }]) =>
        Object.entries(grades)
            .filter(([, entry]) => entry.materials.length === 0)
            .map(([grade]) => `${fd}:${grade}`),
    );
    assert.deepEqual(empties, ['CargoRack_IncreasedCapacity:5']);
});

test('getBlueprint returns the name and full per-grade structure', () => {
    const bp = getBlueprint('FSD_LongRange');
    assert.equal(bp?.name, 'Increased range');
    assert.ok(bp?.grades['5']?.features && bp.grades['5'].materials);
});

const countFor = (mats: readonly { symbol: string; count: number }[] | null, symbol: string) =>
    mats?.find((m) => m.symbol === symbol)?.count;

test('getBlueprintCost for grade 1 is just one roll of the grade-1 recipe', () => {
    assert.deepEqual(
        getBlueprintCost('FSD_LongRange', 1),
        getBlueprintGradeMaterials('FSD_LongRange', 1),
    );
});

test('getBlueprintCost sums every grade weighted by its roll count (g rolls for grade g)', () => {
    // FSD_LongRange: Disrupted Wake Echoes is in the G1 recipe (1 roll) and the G2 recipe
    // (2 rolls) -> 1 + 2 = 3 up to G2; Chemical Processors only G2 -> 2.
    const g2 = getBlueprintCost('FSD_LongRange', 2);
    assert.equal(countFor(g2, 'DisruptedWakeEchoes'), 3);
    assert.equal(countFor(g2, 'ChemicalProcessors'), 2);
    // Not present in grades 3–5, so the running total to G5 stays 3.
    assert.equal(countFor(getBlueprintCost('FSD_LongRange', 5), 'DisruptedWakeEchoes'), 3);
    // Materials only in the G5 recipe are each consumed once per roll across G5's 5 rolls.
    assert.equal(countFor(getBlueprintCost('FSD_LongRange', 5), 'Arsenic'), 5);
    assert.equal(countFor(getBlueprintCost('FSD_LongRange', 5), 'DataminedWake'), 5);
});

test('getBlueprintCost charges only the grades above currentGrade', () => {
    // Already at G4: only G5 remains (5 rolls of the grade-5 recipe).
    assert.deepEqual(
        getBlueprintCost('FSD_LongRange', 5, 4),
        getBlueprintGradeMaterials('FSD_LongRange', 5)!.map((m) => ({
            symbol: m.symbol,
            name: m.name,
            count: m.count * 5,
        })),
    );
    // From G3 to G5 = grades 4 and 5 only — the grade-1/2 materials drop out entirely.
    const from3 = getBlueprintCost('FSD_LongRange', 5, 3);
    assert.equal(countFor(from3, 'DisruptedWakeEchoes'), undefined);
    assert.equal(countFor(from3, 'DataminedWake'), 5);
    // Cost from scratch = cost with currentGrade 0 (the default).
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 0), getBlueprintCost('FSD_LongRange', 5));
    // Already at (or past) the target grade costs nothing.
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 5), []);
    assert.deepEqual(getBlueprintCost('FSD_LongRange', 5, 9), []);
});

test('getBlueprintCost combines a material by symbol, never listing it twice', () => {
    for (const fdname of Object.keys(BLUEPRINTS)) {
        const cost = getBlueprintCost(fdname, 5);
        if (!cost) continue;
        const symbols = cost.map((m) => m.symbol.toLowerCase());
        assert.equal(new Set(symbols).size, symbols.length, `${fdname} lists a material twice`);
    }
});

test('getBlueprintCost is null for an unknown blueprint or a grade it does not define', () => {
    assert.equal(getBlueprintCost('nope', 5), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 9), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 0), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 1.5), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 5, -1), null);
    assert.equal(getBlueprintCost('FSD_LongRange', 5, 2.5), null);
    // The only empty recipe: its sole (grade-5) recipe costs nothing, so the total is [].
    assert.deepEqual(getBlueprintCost('CargoRack_IncreasedCapacity', 5), []);
});
