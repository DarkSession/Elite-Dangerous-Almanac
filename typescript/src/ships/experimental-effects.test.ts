import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    EXPERIMENTAL_EFFECTS,
    getExperimentalEffect,
    getExperimentalEffectName,
    getExperimentalEffectMaterials,
} from './experimental-effects.js';
import { getMaterialBySymbol } from '../materials/materials.js';
import { ALL_MATERIALS } from '../materials/materials-all.js';

test('every effect carries a display name, a recipe, and modifiers/materials arrays', () => {
    for (const [fdname, effect] of Object.entries(EXPERIMENTAL_EFFECTS)) {
        assert.ok(typeof effect.name === 'string' && effect.name.length > 0, `${fdname} name`);
        assert.ok(Array.isArray(effect.modifiers), `${fdname} modifiers`);
        assert.ok(Array.isArray(effect.materials), `${fdname} materials`);
        // Every effect ships with a real recipe (its one-application cost).
        assert.ok(effect.materials.length > 0, `${fdname} has no materials`);
    }
});

test('getExperimentalEffectName resolves case-insensitively and misses cleanly', () => {
    assert.equal(getExperimentalEffectName('special_fsd_heavy'), 'Mass Manager');
    assert.equal(getExperimentalEffectName('SPECIAL_FSD_HEAVY'), 'Mass Manager');
    assert.equal(getExperimentalEffectName('special_auto_loader'), 'Auto Loader');
    assert.equal(getExperimentalEffectName('nope'), null);
});

test('an effect either has numeric modifiers or a description (never neither)', () => {
    // The qualitative weapon-combat effects (e.g. Auto Loader) expose a gameplay flag
    // with no numeric magnitude, so they carry an empty `modifiers` list and a
    // human-readable `description` instead. No record may be both empty and undescribed.
    for (const [fdname, effect] of Object.entries(EXPERIMENTAL_EFFECTS)) {
        if (effect.modifiers.length === 0) {
            assert.ok(
                typeof effect.description === 'string' && effect.description.length > 0,
                `${fdname} has no modifiers and no description`,
            );
        }
    }
});

test('getExperimentalEffect returns the modifiers; getExperimentalEffectMaterials the recipe', () => {
    const modifiers = getExperimentalEffect('special_fsd_heavy');
    assert.ok(modifiers && modifiers.some((m) => m.label === 'FSDOptimalMass'));
    assert.deepEqual(getExperimentalEffectMaterials('special_fsd_heavy'), [
        { symbol: 'DisruptedWakeEchoes', name: 'Atypical Disrupted Wake Echoes', count: 5 },
        { symbol: 'GalvanisingAlloys', name: 'Galvanising Alloys', count: 3 },
        { symbol: 'HyperspaceTrajectories', name: 'Eccentric Hyperspace Trajectories', count: 1 },
    ]);
});

test('both lookups resolve case-insensitively and miss cleanly', () => {
    assert.deepEqual(
        getExperimentalEffectMaterials('SPECIAL_FSD_HEAVY'),
        getExperimentalEffectMaterials('special_fsd_heavy'),
    );
    assert.ok(getExperimentalEffect('SPECIAL_FSD_HEAVY'));
    assert.equal(getExperimentalEffect('nope'), null);
    assert.equal(getExperimentalEffectMaterials('nope'), null);
});

test('every material requirement joins to a real material in the materials domain', () => {
    for (const { materials } of Object.values(EXPERIMENTAL_EFFECTS)) {
        for (const req of materials) {
            const material = getMaterialBySymbol(req.symbol, ALL_MATERIALS);
            assert.ok(material, `unknown material symbol: ${req.symbol}`);
            assert.equal(material.name, req.name, `name mismatch for ${req.symbol}`);
            assert.ok(req.count > 0 && Number.isInteger(req.count), `bad count for ${req.symbol}`);
        }
    }
});

test('no effect lists a material twice', () => {
    for (const [fdname, { materials }] of Object.entries(EXPERIMENTAL_EFFECTS)) {
        const symbols = materials.map((r) => r.symbol.toLowerCase());
        assert.equal(new Set(symbols).size, symbols.length, `${fdname} duplicate material`);
    }
});
