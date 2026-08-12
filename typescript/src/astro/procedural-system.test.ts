import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProceduralSystem } from './procedural-system.js';

test('massCode exposes the system name mass-code letter', () => {
    const system = ProceduralSystem.fromName('Synuefe EN-H d11-96');

    assert.equal(system?.massCode, 'd');
});
