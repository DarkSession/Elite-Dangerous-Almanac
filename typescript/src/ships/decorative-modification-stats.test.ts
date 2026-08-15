import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };
import { DECORATIVE_MODIFICATIONS } from './decorative-modifications.js';
import {
    getDecorativeModifiers,
    unresolvedDecorativeModifiers,
} from './decorative-modification-stats.js';

const decorative = fixture.decorativeModifications;

test('decorative transformations resolve to journal-style modifiers', () => {
    for (const { id } of decorative.ids) {
        assert.deepEqual(getDecorativeModifiers(decorative.module, id), [
            {
                Label: 'DamagePerSecond',
                Value: decorative.resolved.damagePerSecond,
                OriginalValue:
                    decorative.resolved.baseDamage *
                    (decorative.resolved.damagePerSecond / decorative.resolved.damage),
            },
            {
                Label: 'Damage',
                Value: decorative.resolved.damage,
                OriginalValue: decorative.resolved.baseDamage,
            },
        ]);
        assert.deepEqual(unresolvedDecorativeModifiers(decorative.module, id), []);
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
                Label: 'DamagePerSecond',
                Value: decorative.resolved.damagePerSecond,
                OriginalValue:
                    decorative.resolved.baseDamage *
                    (decorative.resolved.damagePerSecond / decorative.resolved.damage),
            },
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
    const modifiers = getDecorativeModifiers(unobserved, id);
    assert.ok(modifiers);
    const damage = modifiers.find((modifier) => modifier.Label === 'Damage');
    assert.equal(damage?.Label, 'Damage');
    assert.ok(Math.abs(damage!.Value! - damage!.OriginalValue! * 0.01) < 1e-9);
    assert.ok(modifiers.some((modifier) => modifier.Label === 'DamagePerSecond'));
});

test('continuous-fire damage is presented under the journal DPS label', () => {
    const beam = 'Hpt_BeamLaser_Fixed_Small';
    const id = decorative.ids[0]!.id;
    const modifiers = getDecorativeModifiers(beam, id)!;
    assert.deepEqual(
        modifiers.map((modifier) => modifier.Label),
        ['DamagePerSecond'],
    );
    assert.ok(Math.abs(modifiers[0]!.Value! - modifiers[0]!.OriginalValue! * 0.01) < 1e-9);
});

test('unknown or absent identities are misses', () => {
    const id = decorative.ids[0]!.id;
    assert.equal(getDecorativeModifiers('not_a_real_module', id), null);
    assert.equal(unresolvedDecorativeModifiers('not_a_real_module', id), null);
    assert.equal(getDecorativeModifiers(decorative.module, 'Decorative_Unknown'), null);
    assert.equal(unresolvedDecorativeModifiers(decorative.module, 'Decorative_Unknown'), null);
    assert.equal(getDecorativeModifiers(null as unknown as string, id), null);
    assert.equal(unresolvedDecorativeModifiers(null as unknown as string, id), null);
    assert.equal(getDecorativeModifiers(decorative.module, null as unknown as string), null);
    assert.equal(unresolvedDecorativeModifiers(decorative.module, null as unknown as string), null);
});

test('a known pairing reports a purely multiplicative label with no base as unresolved', () => {
    const moduleWithoutDamage = 'Int_Hyperdrive_Size5_Class5';
    const id = decorative.ids[0]!.id;
    assert.deepEqual(getDecorativeModifiers(moduleWithoutDamage, id), []);
    assert.deepEqual(unresolvedDecorativeModifiers(moduleWithoutDamage, id), ['Damage']);
});

test('every authored label resolves for every observed module pairing', () => {
    for (const [id, modification] of Object.entries(DECORATIVE_MODIFICATIONS)) {
        const authored = modification.modifiers.map((modifier) => modifier.label).sort();
        for (const symbol of modification.modules) {
            const modifiers = getDecorativeModifiers(symbol, id);
            assert.ok(modifiers);
            const resolved = modifiers.map((modifier) => modifier.Label);
            assert.ok(
                authored.every((label) => resolved.includes(label)),
                `${symbol} / ${id}: ${resolved.join(', ')}`,
            );
            assert.deepEqual(unresolvedDecorativeModifiers(symbol, id), [], `${symbol} / ${id}`);
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
    assert.throws(
        () => unresolvedDecorativeModifiers(42 as unknown as string, decorative.ids[0]!.id),
        {
            name: 'TypeError',
            message: 'unresolvedDecorativeModifiers: symbol must be a string, received number 42',
        },
    );
    assert.throws(() => unresolvedDecorativeModifiers(decorative.module, 42 as unknown as string), {
        name: 'TypeError',
        message: 'unresolvedDecorativeModifiers: fdname must be a string, received number 42',
    });
});
