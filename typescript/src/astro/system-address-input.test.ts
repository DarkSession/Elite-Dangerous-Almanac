import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toSystemAddress, tryToSystemAddress } from './system-address-input.js';
import { decodeSystemAddress, decodeModSystemAddress } from './system-address.js';
import { ProceduralSystem } from './procedural-system.js';
import { findCodexRegionForBoxel } from './codex-region-lookup.js';
import { permitLockedSystemForAddress } from './permit-locked-systems.js';

const SYNUEFE = 3309179996515n;

test('accepts the three representations a caller may hold', () => {
    assert.equal(toSystemAddress(SYNUEFE), SYNUEFE);
    assert.equal(toSystemAddress(3309179996515), SYNUEFE);
    assert.equal(toSystemAddress(' 3309179996515 '), SYNUEFE);
    assert.equal(tryToSystemAddress(0), 0n);
});

test('passes a bigint through so the decoder owns the range check', () => {
    // Out-of-range is a RangeError from the decoder, not a conversion TypeError.
    assert.equal(tryToSystemAddress(-1n), -1n);
    assert.throws(() => ProceduralSystem.fromSystemAddress(-1n), RangeError);
    assert.throws(() => ProceduralSystem.fromSystemAddress(1n << 64n), RangeError);
});

test('refuses values that cannot be a trustworthy address', () => {
    for (const bad of [1.5, -1, Number.MAX_SAFE_INTEGER + 2, NaN, Infinity, '', 'abc', '12a']) {
        assert.equal(tryToSystemAddress(bad as never), null, `${String(bad)} should not convert`);
        assert.throws(() => toSystemAddress(bad as never), {
            name: 'TypeError',
            message: /Not a usable system address/,
        });
    }
});

test('names the offending value so the failure is diagnosable', () => {
    assert.throws(() => toSystemAddress(1.5), /1\.5/);
    assert.throws(() => toSystemAddress('nope'), /"nope"/);
});

test('every address entry point takes a journal number', () => {
    // A journal event parsed with JSON.parse yields a plain number.
    const journalAddress = 3309179996515;

    assert.equal(ProceduralSystem.fromSystemAddress(journalAddress).name, 'Synuefe EN-H d11-96');
    assert.equal(ProceduralSystem.fromSystemAddress('3309179996515').name, 'Synuefe EN-H d11-96');
    assert.deepEqual(
        decodeSystemAddress(journalAddress),
        decodeSystemAddress(SYNUEFE),
        'number and bigint must decode identically',
    );
    assert.deepEqual(findCodexRegionForBoxel(journalAddress), findCodexRegionForBoxel(SYNUEFE));
    assert.equal(permitLockedSystemForAddress(10_477_373_803)?.name, 'Sol');

    // A modulated address packs the sector into the high bits, so it routinely
    // exceeds 2^53 — a `number` cannot carry one, but a decimal string can.
    const mod = ProceduralSystem.fromName('Synuefe EN-H d11-96')!.modSystemAddress;
    assert.ok(mod !== null);
    assert.ok(mod > BigInt(Number.MAX_SAFE_INTEGER));
    assert.deepEqual(decodeModSystemAddress(mod.toString()), decodeModSystemAddress(mod));
    assert.equal(ProceduralSystem.fromModSystemAddress(mod.toString()).name, 'Synuefe EN-H d11-96');
    assert.throws(() => ProceduralSystem.fromModSystemAddress(Number(mod)), TypeError);
});

test('rejects a rounded address instead of resolving the wrong system', () => {
    assert.throws(() => ProceduralSystem.fromSystemAddress(2 ** 53 + 2), TypeError);
    assert.equal(permitLockedSystemForAddress(2 ** 53 + 2), null);
});

test('position is null, not undefined, when unknown', () => {
    assert.equal(ProceduralSystem.fromName('Synuefe EN-H d11-96')?.position, null);
    assert.deepEqual(
        ProceduralSystem.fromSystemAddress(SYNUEFE, { x: 751, y: -179, z: -91 }).position,
        {
            x: 751,
            y: -179,
            z: -91,
        },
    );
});
