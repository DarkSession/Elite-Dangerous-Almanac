import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    EXPERIMENTAL_EFFECTS,
    getExperimentalEffect,
    getExperimentalEffectDamageDistribution,
    getExperimentalEffectName,
    getExperimentalEffectMaterials,
} from './experimental-effects.js';
import { getMaterialBySymbol } from '../materials/materials.js';
import { ALL_MATERIALS } from '../materials/materials-all.js';
import engineeringFixture from '../../../fixtures/ships/engineering.json' with { type: 'json' };

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
    for (const [fdname, name] of Object.entries(engineeringFixture.experimentalNames.map)) {
        assert.equal(getExperimentalEffectName(fdname), name);
    }
    assert.equal(getExperimentalEffectName('nope'), null);
});

test('damage-converting effects expose their fixed resulting splits', () => {
    for (const [fdname, expected] of Object.entries(
        engineeringFixture.experimentalDamageDistributions.map,
    )) {
        assert.deepEqual(getExperimentalEffectDamageDistribution(fdname), expected);
        assert.deepEqual(getExperimentalEffectDamageDistribution(fdname.toUpperCase()), expected);
        const conventional = Object.values(expected).reduce((sum, share) => sum + share, 0);
        assert.equal(conventional, 1, `${fdname} does not partition conventional damage`);
    }
    assert.equal(getExperimentalEffectDamageDistribution('special_fsd_heavy'), null);
    assert.equal(getExperimentalEffectDamageDistribution('nope'), null);
});

test('the pre-engineered cooled Feedback Cascade exposes both modifiers', () => {
    assert.deepEqual(getExperimentalEffect('special_feedback_cascade_cooled'), [
        { label: 'Damage', method: 'multiplicative', value: -0.2 },
        { label: 'ThermalLoad', method: 'multiplicative', value: -0.4 },
    ]);
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

test('an effect named for a stat actually moves that stat', () => {
    // The cost leg alone is easy to record and leaves the effect looking complete while
    // doing nothing: Oversized read as "+5% power draw" with no damage, and Multi-servos
    // as "+5% power draw" with no change to the firing cycle.
    const named: [string, string, number][] = [
        ['special_weapon_damage', 'Damage', 0.03],
        ['special_weapon_rateoffire', 'BurstInterval', -0.029126],
        ['special_weapon_efficient', 'PowerDraw', -0.1],
        ['special_weapon_toughened', 'Integrity', 0.15],
        ['special_weapon_lightweight', 'Mass', -0.1],
        ['special_powerplant_highcharge', 'PowerCapacity', 0.05],
        ['special_shieldcell_oversized', 'ShieldBankReinforcement', 0.05],
    ];
    for (const [fdname, label, value] of named) {
        const modifier = getExperimentalEffect(fdname)?.find((m) => m.label === label);
        assert.ok(modifier, `${fdname} does not move ${label}`);
        assert.equal(modifier.value, value, fdname);
    }
});

test('percentage contributions are stored as percentages, not flat amounts', () => {
    // `method` decides whether a value scales the module's own stat or is bolted on, and
    // a wrong one is invisible until the label gains a base to apply to: these eight read
    // as a flat 0.05 hull points / shield reinforcement rather than ±5%. Both references
    // type all of them as percentages (EDSY `hullrnf`/`shieldrnfps` carry neither
    // `modadd` nor `modmod`; coriolis's `modifierActions` values are fractions).
    const percentages: [string, string][] = [
        ['special_hullreinforcement_kinetic', 'DefenceModifierHealthAddition'],
        ['special_hullreinforcement_chunky', 'DefenceModifierHealthAddition'],
        ['special_hullreinforcement_explosive', 'DefenceModifierHealthAddition'],
        ['special_hullreinforcement_thermic', 'DefenceModifierHealthAddition'],
        ['special_shieldcell_oversized', 'ShieldBankReinforcement'],
        ['special_shieldcell_gradual', 'ShieldBankReinforcement'],
        ['special_shield_kinetic', 'ShieldGenStrength'],
        ['special_engine_haulage', 'EngineOptimalMass'],
    ];
    for (const [fdname, label] of percentages) {
        const modifier = getExperimentalEffect(fdname)?.find((m) => m.label === label);
        assert.ok(modifier, `${fdname} does not carry ${label}`);
        assert.equal(modifier.method, 'multiplicative', `${fdname} ${label}`);
        assert.ok(Math.abs(modifier.value) < 1, `${fdname} ${label} is not a fraction`);
    }
});

test('the canister effects stay qualitative, with no single-sourced magnitude', () => {
    // coriolis-data gives Radiant Canister an ammunition cost and Shift-lock Canister a
    // damage cost that no other source carries a magnitude for. Their in-game
    // descriptions do say a cost exists, but a number one source asserts alone is worse
    // than the honest empty list plus a description this file uses for every other
    // qualitative effect.
    for (const fdname of ['special_radiant_canister', 'special_shiftlock_canister']) {
        assert.deepEqual(getExperimentalEffect(fdname), [], fdname);
        assert.ok(EXPERIMENTAL_EFFECTS[fdname]?.description, `${fdname} needs a description`);
    }
});

test('the power-distributor effects move all three banks, capacity and recharge alike', () => {
    // Cluster Capacitors and Super Conduits each trade one against the other across
    // systems, engines and weapons; a missing bank silently favours that bank.
    for (const [fdname, capacity, recharge] of [
        ['special_powerdistributor_capacity', 0.08, -0.02],
        ['special_powerdistributor_fast', -0.04, 0.04],
    ] as const) {
        const modifiers = getExperimentalEffect(fdname)!;
        for (const bank of ['Systems', 'Engines', 'Weapons']) {
            assert.deepEqual(
                modifiers.find((m) => m.label === `${bank}Capacity`),
                { label: `${bank}Capacity`, method: 'multiplicative', value: capacity },
            );
            assert.deepEqual(
                modifiers.find((m) => m.label === `${bank}Recharge`),
                { label: `${bank}Recharge`, method: 'multiplicative', value: recharge },
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
