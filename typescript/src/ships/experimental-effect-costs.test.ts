import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_MATERIALS } from '../materials/materials-all.js';
import { getMaterialBySymbol } from '../materials/materials.js';
import {
    EXPERIMENTAL_EFFECT_COSTS,
    getExperimentalEffectCost,
} from './experimental-effect-costs.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';

test('cost and mechanics catalogues have identical experimental-effect ids', () => {
    assert.deepEqual(Object.keys(EXPERIMENTAL_EFFECT_COSTS), Object.keys(EXPERIMENTAL_EFFECTS));
});

test('getExperimentalEffectCost normalises ids and misses cleanly', () => {
    const exact = getExperimentalEffectCost('special_fsd_heavy');
    assert.equal(getExperimentalEffectCost('  SPECIAL_FSD_HEAVY  '), exact);
    assert.equal(getExperimentalEffectCost('nope'), null);
    assert.deepEqual(exact, [
        { symbol: 'DisruptedWakeEchoes', name: 'Atypical Disrupted Wake Echoes', count: 5 },
        { symbol: 'GalvanisingAlloys', name: 'Galvanising Alloys', count: 3 },
        { symbol: 'HyperspaceTrajectories', name: 'Eccentric Hyperspace Trajectories', count: 1 },
    ]);
});

test('experimental-effect costs and every nested value are frozen', () => {
    assert.ok(Object.isFrozen(EXPERIMENTAL_EFFECT_COSTS));
    for (const materials of Object.values(EXPERIMENTAL_EFFECT_COSTS)) {
        assert.ok(Object.isFrozen(materials));
        assert.ok(materials.every((material) => Object.isFrozen(material)));
    }
});

test('every effect has a non-empty, valid material recipe with no duplicate symbol', () => {
    for (const [experimentalEffectSymbol, materials] of Object.entries(EXPERIMENTAL_EFFECT_COSTS)) {
        assert.ok(materials.length > 0, `${experimentalEffectSymbol} has no materials`);
        const symbols = materials.map((material) => material.symbol.toLowerCase());
        assert.equal(
            new Set(symbols).size,
            symbols.length,
            `${experimentalEffectSymbol} duplicate material`,
        );
        for (const requirement of materials) {
            const material = getMaterialBySymbol(requirement.symbol, ALL_MATERIALS);
            assert.ok(material, `unknown material symbol: ${requirement.symbol}`);
            assert.equal(material.name, requirement.name, requirement.symbol);
            assert.ok(
                requirement.count > 0 && Number.isInteger(requirement.count),
                `bad count for ${requirement.symbol}`,
            );
        }
    }
});
