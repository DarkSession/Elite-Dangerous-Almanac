import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseSystemName,
    formatSystemName,
    canonicalizeSystemName,
    isProceduralSystemName,
    lettersToBoxelCode,
    boxelCodeToLetters,
} from './system-name.js';

test('parses the region, letters, mass code and number pair', () => {
    const cases = [
        { name: 'Blae Eock kc-c d0-0', region: 'Blae Eock', n1: 0, n2: 0 },
        { name: 'Synuefe EN-H d11-96', region: 'Synuefe', n1: 11, n2: 96 },
        // The region name itself contains digits, so the suffix must parse from the end.
        { name: 'Col 285 Sector IY-W b16-8', region: 'Col 285 Sector', n1: 16, n2: 8 },
    ];
    for (const c of cases) {
        const p = parseSystemName(c.name);
        assert.ok(p, c.name);
        assert.equal(p.regionName, c.region);
        assert.equal(p.n1, c.n1);
        assert.equal(p.n2, c.n2);
    }
});

test('rejects malformed names', () => {
    for (const bad of ['', 'Sol', 'Too Short A', 'Blae Eock KC-C dx']) {
        assert.equal(parseSystemName(bad), null, bad);
    }
    assert.equal(parseSystemName(null as unknown as string), null);
});

test('formats parts, omitting N1 when zero', () => {
    assert.equal(
        formatSystemName({
            regionName: 'Synuefe',
            l1: 4,
            l2: 13,
            l3: 7,
            massCode: 3,
            n1: 11,
            n2: 96,
        }),
        'Synuefe EN-H d11-96',
    );
    assert.equal(
        formatSystemName({ regionName: 'Synuefe', l1: 0, l2: 1, l3: 2, massCode: 3, n1: 0, n2: 5 }),
        'Synuefe AB-C d5',
    );
});

test('canonicalises a full system name', () => {
    assert.equal(canonicalizeSystemName('blae eock kc-c d0'), 'Blae Eock KC-C d0');
    assert.equal(
        canonicalizeSystemName('pleiades sector hr-w d1-79'),
        'Pleiades Sector HR-W d1-79',
    );
    assert.equal(canonicalizeSystemName('Sol'), null);
});

test('recognises procedural system names', () => {
    assert.equal(isProceduralSystemName('Blae Eock KC-C d0'), true);
    assert.equal(isProceduralSystemName('Sol'), false);
    assert.equal(isProceduralSystemName('Pleiades Sector HR-W d1-79', { strict: true }), false); // named region
    assert.equal(isProceduralSystemName('Blae Eock KC-C d0', { strict: true }), true);
});

test('boxel code <-> letters is a bijection', () => {
    for (const [l1, l2, l3, n1] of [
        [0, 0, 0, 0],
        [10, 2, 2, 0],
        [25, 25, 25, 40],
        [7, 23, 20, 60],
    ]) {
        const boxelCode = lettersToBoxelCode(l1!, l2!, l3!, n1!);
        assert.deepEqual(boxelCodeToLetters(boxelCode), { l1, l2, l3, n1 });
    }

    // The 'EN-H …11' boxel both modules use as their worked example, pinned so the
    // documented code and the documented letters cannot drift apart.
    assert.equal(lettersToBoxelCode(4, 13, 7, 11), 198_410);
    assert.deepEqual(boxelCodeToLetters(198_410), { l1: 4, l2: 13, l3: 7, n1: 11 });
});
