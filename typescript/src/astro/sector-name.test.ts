import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    sectorNameFromGridPosition,
    sectorGridPositionFromName,
    canonicalizeSectorName,
} from './sector-name.js';

test('round-trips grid positions through name and back', () => {
    let tested = 0;
    for (let z = 0; z < 24; z++)
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 24; x++) {
                const position = { sectorX: x, sectorY: y, sectorZ: z };
                const name = sectorNameFromGridPosition(position);
                const back = sectorGridPositionFromName(name);
                assert.deepEqual(back, position, `${name} at (${x},${y},${z})`);
                tested++;
            }
    assert.equal(tested, 24 * 16 * 24);
});

test('round-trips ambiguous and four-fragment generated names', () => {
    for (const [coords, expectedName] of [
        [{ sectorX: 68, sectorY: 10, sectorZ: 80 }, 'Aoe Thoe'],
        [{ sectorX: 126, sectorY: 44, sectorZ: 94 }, 'Thodgoa'],
    ] as const) {
        const name = sectorNameFromGridPosition(coords);
        assert.equal(name, expectedName);
        assert.deepEqual(sectorGridPositionFromName(name), coords);
    }
});

test('rejects in-range grid slots that have no assigned procedural name', () => {
    assert.throws(
        () => sectorNameFromGridPosition({ sectorX: 1, sectorY: 0, sectorZ: 84 }),
        /has no procedural name/,
    );
});

test('produces both C1 (one word) and C2 (two word) names', () => {
    const names = new Set<string>();
    for (let i = 0; i < 400; i++)
        names.add(
            sectorNameFromGridPosition({
                sectorX: i % 79,
                sectorY: (i * 7) % 64,
                sectorZ: (i * 13) % 71,
            }),
        );
    assert.ok(
        [...names].some((n) => n.includes(' ')),
        'expected some C2 (two-word) names',
    );
    assert.ok(
        [...names].some((n) => !n.includes(' ')),
        'expected some C1 (single-word) names',
    );
});

test('canonicalises casing via the grid round-trip', () => {
    assert.equal(canonicalizeSectorName('blae eock'), 'Blae Eock');
    assert.equal(canonicalizeSectorName('SYNUEFE'), 'Synuefe');
    assert.deepEqual(sectorGridPositionFromName('Blae Eock'), {
        sectorX: 39,
        sectorY: 30,
        sectorZ: 20,
    });
});

test('rejects out-of-range grid coordinates', () => {
    for (const c of [
        { sectorX: -1, sectorY: 0, sectorZ: 0 },
        { sectorX: 128, sectorY: 0, sectorZ: 0 },
        { sectorX: 0, sectorY: 0, sectorZ: 9999 },
        { sectorX: 1.5, sectorY: 0, sectorZ: 0 },
    ]) {
        assert.throws(() => sectorNameFromGridPosition(c), RangeError, JSON.stringify(c));
    }
});

test('rejects non-procedural sector names', () => {
    // Hand-authored region names and names that break the vowel/consonant
    // alternation of the fragment grammar are not procedural sectors.
    assert.equal(sectorGridPositionFromName('Pleiades Sector'), null);
    assert.equal(canonicalizeSectorName('Pleiades Sector'), null);
    assert.equal(sectorGridPositionFromName('Zzzz'), null);
    assert.equal(sectorGridPositionFromName('Sol'), null);
    assert.equal(canonicalizeSectorName('Sol'), null);
});
