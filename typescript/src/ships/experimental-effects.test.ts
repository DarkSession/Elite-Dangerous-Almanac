import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXPERIMENTAL_EFFECTS, getExperimentalEffect } from './experimental-effects.js';
import engineeringFixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };

test('every effect carries a display name and modifier array', () => {
    for (const [experimentalEffectSymbol, effect] of Object.entries(EXPERIMENTAL_EFFECTS)) {
        assert.ok(
            typeof effect.name === 'string' && effect.name.length > 0,
            `${experimentalEffectSymbol} name`,
        );
        assert.ok(Array.isArray(effect.modifiers), `${experimentalEffectSymbol} modifiers`);
    }
});

test('getExperimentalEffect resolves case-insensitively and misses cleanly', () => {
    assert.equal(getExperimentalEffect('special_fsd_heavy')?.name, 'Mass Manager');
    assert.equal(getExperimentalEffect('SPECIAL_FSD_HEAVY')?.name, 'Mass Manager');
    assert.equal(getExperimentalEffect('special_auto_loader')?.name, 'Auto Loader');
    for (const [experimentalEffectSymbol, name] of Object.entries(
        engineeringFixture.experimentalNames.map,
    )) {
        assert.equal(getExperimentalEffect(experimentalEffectSymbol)?.name, name);
    }
    assert.equal(getExperimentalEffect('nope'), null);
});

test('damage-converting effects expose their fixed resulting splits', () => {
    for (const [experimentalEffectSymbol, expected] of Object.entries(
        engineeringFixture.experimentalDamageDistributions.map,
    )) {
        assert.deepEqual(
            getExperimentalEffect(experimentalEffectSymbol)?.damageDistribution,
            expected,
        );
        assert.deepEqual(
            getExperimentalEffect(experimentalEffectSymbol.toUpperCase())?.damageDistribution,
            expected,
        );
        const conventional = Object.values(expected).reduce((sum, share) => sum + share, 0);
        assert.equal(
            conventional,
            1,
            `${experimentalEffectSymbol} does not partition conventional damage`,
        );
    }
    assert.equal(getExperimentalEffect('special_fsd_heavy')?.damageDistribution, undefined);
    assert.equal(getExperimentalEffect('nope'), null);
});

test('the pre-engineered cooled Feedback Cascade exposes both modifiers', () => {
    assert.deepEqual(getExperimentalEffect('special_feedback_cascade_cooled')?.modifiers, [
        { label: 'Damage', method: 'multiplicative', value: -0.2 },
        { label: 'ThermalLoad', method: 'multiplicative', value: -0.4 },
    ]);
});

test('pre-engineered cooled effects keep every modifier of their base effect', () => {
    // Each `_cooled` variant is its base effect plus a -40% thermal load.
    for (const base of ['special_plasma_slug', 'special_super_penetrator']) {
        const plain = getExperimentalEffect(base)!;
        const cooled = getExperimentalEffect(`${base}_cooled`)!;
        for (const modifier of plain.modifiers) {
            assert.ok(
                cooled.modifiers.some(
                    (candidate) =>
                        candidate.label === modifier.label && candidate.value === modifier.value,
                ),
                `${base}_cooled drops ${modifier.label}`,
            );
        }
        assert.ok(cooled.modifiers.some((c) => c.label === 'ThermalLoad' && c.value === -0.4));
    }
});

test('an effect either has numeric modifiers or a description (never neither)', () => {
    // The qualitative weapon-combat effects (e.g. Auto Loader) expose a gameplay flag
    // with no numeric magnitude, so they carry an empty `modifiers` list and a
    // human-readable `description` instead. No record may be both empty and undescribed.
    for (const [experimentalEffectSymbol, effect] of Object.entries(EXPERIMENTAL_EFFECTS)) {
        if (effect.modifiers.length === 0) {
            assert.ok(
                typeof effect.description === 'string' && effect.description.length > 0,
                `${experimentalEffectSymbol} has no modifiers and no description`,
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
    for (const [experimentalEffectSymbol, label, value] of named) {
        const modifier = getExperimentalEffect(experimentalEffectSymbol)?.modifiers.find(
            (m) => m.label === label,
        );
        assert.ok(modifier, `${experimentalEffectSymbol} does not move ${label}`);
        assert.equal(modifier.value, value, experimentalEffectSymbol);
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
    for (const [experimentalEffectSymbol, label] of percentages) {
        const modifier = getExperimentalEffect(experimentalEffectSymbol)?.modifiers.find(
            (m) => m.label === label,
        );
        assert.ok(modifier, `${experimentalEffectSymbol} does not carry ${label}`);
        assert.equal(modifier.method, 'multiplicative', `${experimentalEffectSymbol} ${label}`);
        assert.ok(
            Math.abs(modifier.value) < 1,
            `${experimentalEffectSymbol} ${label} is not a fraction`,
        );
    }
});

test('the canister effects stay qualitative, with no single-sourced magnitude', () => {
    // coriolis-data gives Radiant Canister an ammunition cost and Shift-lock Canister a
    // damage cost that no other source carries a magnitude for. Their in-game
    // descriptions do say a cost exists, but a number one source asserts alone is worse
    // than the honest empty list plus a description this file uses for every other
    // qualitative effect.
    for (const experimentalEffectSymbol of [
        'special_radiant_canister',
        'special_shiftlock_canister',
    ]) {
        assert.deepEqual(
            getExperimentalEffect(experimentalEffectSymbol)?.modifiers,
            [],
            experimentalEffectSymbol,
        );
        assert.ok(
            EXPERIMENTAL_EFFECTS[experimentalEffectSymbol]?.description,
            `${experimentalEffectSymbol} needs a description`,
        );
    }
});

test('the power-distributor effects move all three banks, capacity and recharge alike', () => {
    // Cluster Capacitors and Super Conduits each trade one against the other across
    // systems, engines and weapons; a missing bank silently favours that bank.
    for (const [experimentalEffectSymbol, capacity, recharge] of [
        ['special_powerdistributor_capacity', 0.08, -0.02],
        ['special_powerdistributor_fast', -0.04, 0.04],
    ] as const) {
        const modifiers = getExperimentalEffect(experimentalEffectSymbol)!.modifiers;
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

test('getExperimentalEffect returns the complete mechanics record', () => {
    const effect = getExperimentalEffect('special_fsd_heavy');
    assert.ok(effect?.modifiers.some((modifier) => modifier.label === 'FSDOptimalMass'));
    assert.equal('materials' in effect!, false);
});

test('the mechanics record resolves case-insensitively and misses cleanly', () => {
    assert.deepEqual(
        getExperimentalEffect('SPECIAL_FSD_HEAVY'),
        getExperimentalEffect('special_fsd_heavy'),
    );
    assert.equal(getExperimentalEffect('nope'), null);
});
