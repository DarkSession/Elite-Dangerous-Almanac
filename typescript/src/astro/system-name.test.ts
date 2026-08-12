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
    // The parsers tolerate an absent name where `ProceduralSystem.fromName` rejects it.
    assert.equal(canonicalizeSystemName(null as unknown as string), null);
    assert.equal(canonicalizeSystemName(undefined as unknown as string), null);
});

test('recognises procedural system names', () => {
    assert.equal(isProceduralSystemName('Blae Eock KC-C d0'), true);
    assert.equal(isProceduralSystemName('Sol'), false);
    assert.equal(isProceduralSystemName('Pleiades Sector HR-W d1-79', { strict: true }), false); // named region
    assert.equal(isProceduralSystemName('Blae Eock KC-C d0', { strict: true }), true);
    // Nullish is `false` on both paths that could answer it: the `trim` here, and the
    // parser's own tolerance behind it.
    assert.equal(isProceduralSystemName(null as unknown as string), false);
    assert.equal(isProceduralSystemName(undefined as unknown as string, { strict: true }), false);
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

test('rejects a letter that is not an index 0-25', () => {
    // Each of these would carry into the next base-26 digit and pack as a different
    // boxel, so the message names all three letters rather than just the class.
    for (const [l1, l2, l3] of [
        [-1, 0, 0],
        [26, 0, 0],
        [1.5, 0, 0],
        [0, -1, 0],
        [0, 26, 0],
        [0, 0, -1],
        [0, 0, 26],
        [Number.NaN, 0, 0],
    ]) {
        assert.throws(() => lettersToBoxelCode(l1!, l2!, l3!, 0), {
            name: 'RangeError',
            message: /Boxel letters out of range/,
        });
    }
});

// The largest N1 that packs exactly whatever the letters are. Pinned as a literal
// rather than recomputed: re-deriving it with the implementation's own formula would
// let a wrong formula agree with itself and pass.
const MAX_N1 = 512_471_509_713;

test('rejects an N1 that is negative, fractional, or too large to pack exactly', () => {
    // The bound is a floating-point limit, not an in-game one: a real N1 is ≤ ~119,
    // so only a caller inventing values reaches it.
    for (const n1 of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_N1 + 1, 2 ** 53]) {
        assert.throws(() => lettersToBoxelCode(0, 0, 0, n1), {
            name: 'RangeError',
            message: /Boxel number N1 out of range/,
        });
    }
});

test('the largest accepted N1 packs exactly under the worst-case letters', () => {
    // Letters carry up to 26³-1 on top of N1, so the bound has to hold at ZZ-Z, not
    // just at AA-A where nothing is added.
    const code = lettersToBoxelCode(25, 25, 25, MAX_N1);
    assert.ok(Number.isSafeInteger(code));
    assert.deepEqual(boxelCodeToLetters(code), { l1: 25, l2: 25, l3: 25, n1: MAX_N1 });

    // And that code is the largest one unpacking accepts, so the two stay inverses.
    assert.throws(() => boxelCodeToLetters(code + 1), {
        name: 'RangeError',
        message: /Boxel code out of range/,
    });
});

test('rejects a boxel code no packing could produce', () => {
    for (const code of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
        assert.throws(() => boxelCodeToLetters(code), {
            name: 'RangeError',
            message: /Boxel code out of range/,
        });
    }
});

test('the name parsers name a wrong-typed name while still tolerating an absent one', () => {
    // Tolerating an absent name is not tolerating any value at all: the three answer
    // `null`/`false` for nullish (asserted above) and name anything else.
    for (const [call, label] of [
        [() => parseSystemName(42 as unknown as string), 'parseSystemName: name'],
        [() => canonicalizeSystemName(42 as unknown as string), 'canonicalizeSystemName: name'],
        [() => isProceduralSystemName(42 as unknown as string), 'isProceduralSystemName: name'],
    ] as const) {
        assert.throws(call, {
            name: 'TypeError',
            message: `${label} must be a string, received number 42`,
        });
    }
    // A parsed journal field handed straight in is the case this exists for.
    assert.throws(() => parseSystemName({ StarSystem: 'Sol' } as unknown as string), {
        name: 'TypeError',
        message: 'parseSystemName: name must be a string, received object {"StarSystem":"Sol"}',
    });
});
