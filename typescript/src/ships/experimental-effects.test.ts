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

test('Feedback Cascade ships as both the plain and the pre-engineered cooled effect', () => {
    assert.deepEqual(getExperimentalEffect('special_feedback_cascade'), [
        { label: 'Damage', method: 'multiplicative', value: -0.2 },
    ]);
    // The cooled rail-gun variant keeps that damage penalty and adds its thermal cut.
    assert.deepEqual(getExperimentalEffect('special_feedback_cascade_cooled'), [
        { label: 'Damage', method: 'multiplicative', value: -0.2 },
        { label: 'ThermalLoad', method: 'multiplicative', value: -0.4 },
    ]);
    // Both are one application of the same recipe.
    assert.deepEqual(
        getExperimentalEffectMaterials('special_feedback_cascade'),
        getExperimentalEffectMaterials('special_feedback_cascade_cooled'),
    );
});

test('pre-engineered cooled effects keep every modifier of their base effect', () => {
    // Each `_cooled` variant is its base effect plus a -40% thermal load.
    for (const base of ['special_plasma_slug', 'special_super_penetrator']) {
        const plain = getExperimentalEffect(base)!;
        const cooled = getExperimentalEffect(`${base}_cooled`)!;
        for (const modifier of plain) {
            assert.ok(
                cooled.some((c) => c.label === modifier.label && c.value === modifier.value),
                `${base}_cooled drops ${modifier.label}`,
            );
        }
        assert.ok(cooled.some((c) => c.label === 'ThermalLoad' && c.value === -0.4));
    }
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
