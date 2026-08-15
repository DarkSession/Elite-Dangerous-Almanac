import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };
import { DECORATIVE_MODIFICATIONS } from './decorative-modifications.js';
import { getDecorativeModifiers } from './decorative-modification-stats.js';

const decorative = fixture.decorativeModifications;

test('decorative transformations resolve to journal-style modifiers', () => {
    for (const { id } of decorative.ids) {
        assert.deepEqual(getDecorativeModifiers(decorative.module, id), [
            {
                Label: 'Damage',
                Value: decorative.resolved.damage,
                OriginalValue: decorative.resolved.baseDamage,
            },
        ]);
    }
});

test('resolution normalizes both journal identities', () => {
    assert.deepEqual(
        getDecorativeModifiers(
            `  ${decorative.module.toLowerCase()}  `,
            `  ${decorative.ids[0]!.id.toUpperCase()}  `,
        ),
        [
            {
                Label: 'Damage',
                Value: decorative.resolved.damage,
                OriginalValue: decorative.resolved.baseDamage,
            },
        ],
    );
});

test('the observational module list is not an allowlist', () => {
    const unobserved = 'Hpt_PulseLaser_Fixed_Small';
    const id = decorative.ids[0]!.id;
    assert.ok(!DECORATIVE_MODIFICATIONS[id]!.modules.includes(unobserved));
    const [damage] = getDecorativeModifiers(unobserved, id);
    assert.equal(damage?.Label, 'Damage');
    assert.ok(Math.abs(damage!.Value! - damage!.OriginalValue! * 0.01) < 1e-9);
});

test('unknown or absent identities are misses', () => {
    assert.deepEqual(getDecorativeModifiers('not_a_real_module', decorative.ids[0]!.id), []);
    assert.deepEqual(getDecorativeModifiers(decorative.module, 'Decorative_Unknown'), []);
    assert.deepEqual(getDecorativeModifiers(null as unknown as string, decorative.ids[0]!.id), []);
    assert.deepEqual(getDecorativeModifiers(decorative.module, null as unknown as string), []);
});

test('every authored label resolves for every observed module pairing', () => {
    for (const [id, modification] of Object.entries(DECORATIVE_MODIFICATIONS)) {
        const authored = modification.modifiers.map((modifier) => modifier.label).sort();
        for (const symbol of modification.modules) {
            const resolved = getDecorativeModifiers(symbol, id)
                .map((modifier) => modifier.Label)
                .sort();
            assert.deepEqual(resolved, authored, `${symbol} / ${id}`);
        }
    }
});

test('wrong-typed identities name the public resolver arguments', () => {
    assert.throws(() => getDecorativeModifiers(42 as unknown as string, decorative.ids[0]!.id), {
        name: 'TypeError',
        message: 'getDecorativeModifiers: symbol must be a string, received number 42',
    });
    assert.throws(() => getDecorativeModifiers(decorative.module, 42 as unknown as string), {
        name: 'TypeError',
        message: 'getDecorativeModifiers: fdname must be a string, received number 42',
    });
});
