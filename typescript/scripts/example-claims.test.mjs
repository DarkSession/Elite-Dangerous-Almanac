import assert from 'node:assert/strict';
import test from 'node:test';

import {
    compareExampleValue,
    parseExpectedClaim,
    transformExampleClaims,
} from './example-claims.mjs';

function matchingSpec(text) {
    const parsed = parseExpectedClaim(text);
    assert.equal(parsed.status, 'match', `expected ${JSON.stringify(text)} to be machine-readable`);
    return parsed.spec;
}

function manifestRoundTripSpec(text) {
    return JSON.parse(JSON.stringify(matchingSpec(text)));
}

test('instruments same-line and following-line expression claims without reading strings', () => {
    const source = [
        `const marker = '// -> not a claim';`,
        `Math.max(1, 2); // -> 2`,
        `try {`,
        `    throw new TypeError('bad');`,
        `} catch (error) {`,
        `    error instanceof TypeError;`,
        `    // -> true`,
        `}`,
    ].join('\n');

    const result = transformExampleClaims(source, { idPrefix: 'fixture' });

    assert.equal(result.claims.length, 2);
    assert.deepEqual(
        result.claims.map(({ id, line }) => ({ id, line })),
        [
            { id: 'fixture:0', line: 2 },
            { id: 'fixture:1', line: 7 },
        ],
    );
    assert.equal(result.skipped.length, 0);
    assert.match(result.code, /__almanacCapturedExampleClaim\(\(\) => \(Math\.max\(1, 2\)\)/);
    assert.match(
        result.code,
        /__almanacCapturedExampleClaim\(\(\) => \(error instanceof TypeError\)/,
    );
    assert.match(result.code, /const marker = '\/\/ -> not a claim'/);
});

test('keeps descriptive claim ids out of generated JavaScript', () => {
    const idPrefix = `hostile'); throw new Error('injected') //`;
    const result = transformExampleClaims('1; // -> 1', { idPrefix });

    assert.equal(result.claims[0]?.id, `${idPrefix}:0`);
    assert.doesNotMatch(result.code, /hostile|injected/);
    assert.match(result.code, /__almanacCapturedExampleClaim\(\(\) => \(1\), 0\)/);
});

test('keeps ambient and prose claims compile-only with explicit reasons', () => {
    const source = [
        'declare const event: { value: number };',
        'event.value; // -> 3',
        'event.value; // -> the current value',
    ].join('\n');

    const result = transformExampleClaims(source);

    assert.equal(result.ambient, true);
    assert.equal(result.claims.length, 0);
    assert.deepEqual(
        result.skipped.map(({ reason }) => reason),
        ['snippet needs an ambient runtime value', 'prose or unsupported expected value'],
    );
    assert.doesNotMatch(result.code, /__almanacExampleClaim/);
});

test('instruments a variable initializer and rejects a claim without an executable expression', () => {
    const result = transformExampleClaims(['const answer = 42; // -> 42', '// -> true'].join('\n'));

    assert.equal(result.claims.length, 1);
    assert.match(result.code, /const answer = __almanacCapturedExampleClaim/);
    assert.equal(result.skipped[0]?.reason, 'not attached to an executable expression');
});

test('keeps await and yield claims in their original context instead of emitting invalid arrows', () => {
    const awaited = transformExampleClaims('await Promise.resolve(3); // -> 3');
    const yielded = transformExampleClaims(
        ['function* values() {', '    yield 3; // -> 3', '}'].join('\n'),
    );

    assert.equal(awaited.claims.length, 0);
    assert.equal(awaited.skipped[0]?.reason, 'await expression needs its original context');
    assert.equal(awaited.code, 'await Promise.resolve(3); // -> 3');
    assert.equal(yielded.claims.length, 0);
    assert.equal(yielded.skipped[0]?.reason, 'yield expression needs its original context');
    assert.doesNotMatch(yielded.code, /__almanacExampleClaim/);
});

test('parses exact primitive and structured values', () => {
    for (const [text, actual] of [
        [`'Pleiades'`, 'Pleiades'],
        ['true', true],
        ['null — absent is an ordinary answer', null],
        ['undefined', undefined],
        ['3309179996515n', 3309179996515n],
        ['[1, 2, 3] (ascending)', [1, 2, 3]],
        [
            `{ name: 'Sol', position: { x: 0, y: 0, z: 0 } }`,
            { name: 'Sol', position: { x: 0, y: 0, z: 0 } },
        ],
    ]) {
        assert.deepEqual(compareExampleValue(actual, matchingSpec(text)), { pass: true }, text);
    }
});

test('preserves exact negative zero through the JSON runtime manifest', () => {
    const scalar = manifestRoundTripSpec('-0');

    assert.deepEqual(scalar, { kind: 'number-special', value: '-0' });
    assert.deepEqual(compareExampleValue(-0, scalar), { pass: true });
    assert.equal(compareExampleValue(0, scalar).pass, false);

    const structured = manifestRoundTripSpec('[-0, { nested: -0 }]');

    assert.deepEqual(structured, {
        kind: 'array',
        items: [
            { kind: 'number-special', value: '-0' },
            {
                kind: 'object',
                entries: [['nested', { kind: 'number-special', value: '-0' }]],
            },
        ],
    });
    assert.deepEqual(compareExampleValue([-0, { nested: -0 }], structured), { pass: true });
    assert.equal(compareExampleValue([0, { nested: -0 }], structured).pass, false);
    assert.equal(compareExampleValue([-0, { nested: 0 }], structured).pass, false);
});

test('parses parenthesized numbers and rejects recovered malformed literals', () => {
    assert.deepEqual(matchingSpec('(1)'), { kind: 'number-exact', value: 1 });
    assert.deepEqual(matchingSpec('(-0)'), { kind: 'number-special', value: '-0' });
    assert.deepEqual(matchingSpec('(1.25)'), {
        kind: 'number-rounded',
        value: 1.25,
        text: '1.25',
        decimalPlaces: 2,
    });
    assert.deepEqual(matchingSpec('-0.2 (lightweight alloy is kinetically weak)'), {
        kind: 'number-rounded',
        value: -0.2,
        text: '-0.2',
        decimalPlaces: 1,
    });

    for (const text of ['([1, 2)', '({ value: 1)', '([1, 2]']) {
        assert.equal(parseExpectedClaim(text).status, 'skip', text);
    }
});

test('rounds finite decimals to documented precision and preserves exact integers', () => {
    assert.deepEqual(compareExampleValue(89.41467782385232, matchingSpec('89.414678')), {
        pass: true,
    });
    assert.deepEqual(compareExampleValue(-0.19999999999999996, matchingSpec('-0.2')), {
        pass: true,
    });
    assert.equal(compareExampleValue(89.4144, matchingSpec('89.4147')).pass, false);
    assert.equal(compareExampleValue(7.1, matchingSpec('7')).pass, false);
    assert.deepEqual(compareExampleValue(383.314, matchingSpec('≈383.31')), { pass: true });
    assert.deepEqual(compareExampleValue(49.34939, matchingSpec('approximately 49.3494')), {
        pass: true,
    });
});

test('applies decimal rounding recursively while keeping nested integers exact', () => {
    const spec = matchingSpec(`[{ ratio: 0.2, nested: { value: -1.25, count: 3 } }]`);

    assert.deepEqual(
        compareExampleValue(
            [{ ratio: 0.19999999999999996, nested: { value: -1.249, count: 3 } }],
            spec,
        ),
        { pass: true },
    );
    assert.match(
        compareExampleValue(
            [{ ratio: 0.19999999999999996, nested: { value: -1.249, count: 3.1 } }],
            spec,
        ).message,
        /value\[0\]\.nested\.count: expected 3, received 3\.1/,
    );
});

test('treats an ellipsis after a decimal as a prefix assertion', () => {
    const spec = matchingSpec('0.667…, not a summed percentage');

    assert.deepEqual(compareExampleValue(0.6671199999999999, spec), { pass: true });
    assert.equal(compareExampleValue(0.6669999999999999, spec).pass, false);
});

test('rejects ambiguous, abbreviated and prose expectations', () => {
    for (const text of [
        'across every category',
        'MaterialGrade.VeryCommon (1)',
        `'FrameShiftDrive', 'Slot01_Size6', …`,
        `'FrameShiftDrive'  'Slot01_Size6'`,
        `'[{"header":{...}}]'`,
        `['Pleiades', ...]`,
        '7…',
        'MJ',
    ]) {
        assert.equal(parseExpectedClaim(text).status, 'skip', text);
    }
});

test('reports useful mismatches for nested structured values', () => {
    const comparison = compareExampleValue(
        { name: 'Sol', position: { x: 1, y: 0, z: 0 } },
        matchingSpec(`{ name: 'Sol', position: { x: 0, y: 0, z: 0 } }`),
    );

    assert.equal(comparison.pass, false);
    assert.match(comparison.message, /value\.position\.x: expected 0, received 1/);
});
