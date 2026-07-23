import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    PERMIT_LOCKED_SYSTEMS,
    permitLockedSystemForAddress,
    permitLockedSystemForName,
} from './permit-locked-systems.js';
import { PERMIT_LOCKED_REGIONS } from './permit-locked-regions.js';

test('looks up normal parsed-journal, bigint and persisted-string addresses', () => {
    const journal = JSON.parse('{"SystemAddress":10477373803}') as {
        SystemAddress: number;
    };

    assert.equal(permitLockedSystemForAddress(journal.SystemAddress)?.name, 'Sol');
    assert.equal(permitLockedSystemForAddress(10_477_373_803n)?.name, 'Sol');
    assert.equal(permitLockedSystemForAddress(' 10477373803 ')?.name, 'Sol');
    assert.equal(permitLockedSystemForName(' SOL ')?.id64, 10_477_373_803n);
});

test('rejects address inputs that cannot be compared exactly', () => {
    for (const address of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1]) {
        assert.equal(permitLockedSystemForAddress(address), null);
    }
    assert.equal(permitLockedSystemForAddress(Number.MAX_SAFE_INTEGER + 1), null);
    assert.equal(permitLockedSystemForAddress(''), null);
    assert.equal(permitLockedSystemForAddress('-1'), null);
    assert.equal(permitLockedSystemForAddress('10.5'), null);
});

test('exported permit catalogues cannot be mutated or desynchronise their indexes', () => {
    const sol = permitLockedSystemForName('Sol');
    assert.ok(sol);
    assert.equal(Object.isFrozen(PERMIT_LOCKED_SYSTEMS), true);
    assert.equal(Object.isFrozen(PERMIT_LOCKED_REGIONS), true);
    assert.equal(Object.isFrozen(sol), true);

    assert.throws(() => Object.assign(sol, { name: 'Changed' }), TypeError);
    assert.throws(() => Array.prototype.push.call(PERMIT_LOCKED_REGIONS, 'Changed'), TypeError);
    assert.equal(permitLockedSystemForName('Sol')?.name, 'Sol');
});
