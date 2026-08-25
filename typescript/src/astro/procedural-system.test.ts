import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProceduralSystem } from './procedural-system.js';

test('massCode exposes the system name mass-code letter', () => {
    const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');

    assert.equal(system?.massCode, 'd');
});

test('fromName ignores surrounding whitespace, like the parsers it is built on', () => {
    // A name off a clipboard or a journal line keeps its padding; the strict factory
    // tolerates it exactly as `parseSystemName` and `isProceduralSystemName` do.
    for (const [label, padded] of [
        ['leading', '  Synuefe EN-H d11-96'],
        ['trailing', 'Synuefe EN-H d11-96  '],
        ['both sides', '\t Synuefe EN-H d11-96 \n'],
    ] as const) {
        const system = ProceduralSystem.fromName(padded);

        assert.equal(system?.name, 'Synuefe EN-H d11-96', label);
        assert.equal(
            system?.systemAddress,
            ProceduralSystem.fromName('Synuefe EN-H d11-96')?.systemAddress,
            label,
        );
    }

    // Still the strict factory: an absent name is a caller bug, not a padded one.
    assert.throws(() => ProceduralSystem.fromName(undefined as unknown as string), {
        name: 'TypeError',
        message: 'ProceduralSystem.fromName: name must be a string, received undefined',
    });
});
