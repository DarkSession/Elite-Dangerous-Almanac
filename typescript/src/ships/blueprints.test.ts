import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    BLUEPRINTS,
    getBlueprint,
    getBlueprintGrade,
    getBlueprintGradeMaterials,
} from './blueprints.js';
import { getMaterialBySymbol } from '../materials/materials.js';
import { ALL_MATERIALS } from '../materials/materials-all.js';

test('every grade carries both its features and its materials', () => {
    for (const [fdname, grades] of Object.entries(BLUEPRINTS)) {
        for (const [grade, entry] of Object.entries(grades)) {
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
    for (const grades of Object.values(BLUEPRINTS)) {
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
    for (const [fdname, grades] of Object.entries(BLUEPRINTS)) {
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
    const empties = Object.entries(BLUEPRINTS).flatMap(([fd, grades]) =>
        Object.entries(grades)
            .filter(([, entry]) => entry.materials.length === 0)
            .map(([grade]) => `${fd}:${grade}`),
    );
    assert.deepEqual(empties, ['CargoRack_IncreasedCapacity:5']);
});

test('getBlueprint returns the full per-grade structure', () => {
    const bp = getBlueprint('FSD_LongRange');
    assert.ok(bp?.['5']?.features && bp['5'].materials);
});
