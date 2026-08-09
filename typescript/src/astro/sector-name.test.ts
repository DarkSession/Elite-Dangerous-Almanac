import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    sectorNameFromCoords,
    sectorCoordsFromName,
    canonicalizeSectorName,
} from './sector-name.js';

test('round-trips grid positions through name and back', () => {
    let tested = 0;
    for (let z = 0; z < 24; z++)
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 24; x++) {
                const name = sectorNameFromCoords({ x, y, z });
                const back = sectorCoordsFromName(name);
                assert.deepEqual(back, { x, y, z }, `${name} at (${x},${y},${z})`);
                tested++;
            }
    assert.equal(tested, 24 * 16 * 24);
});

test('round-trips ambiguous and four-fragment generated names', () => {
    for (const [coords, expectedName] of [
        [{ x: 68, y: 10, z: 80 }, 'Aoe Thoe'],
        [{ x: 126, y: 44, z: 94 }, 'Thodgoa'],
    ] as const) {
        const name = sectorNameFromCoords(coords);
        assert.equal(name, expectedName);
        assert.deepEqual(sectorCoordsFromName(name), coords);
    }
});

test('rejects in-range grid slots that have no assigned procedural name', () => {
    assert.throws(() => sectorNameFromCoords({ x: 1, y: 0, z: 84 }), /has no procedural name/);
});

test('produces both C1 (one word) and C2 (two word) names', () => {
    const names = new Set<string>();
    for (let i = 0; i < 400; i++)
        names.add(sectorNameFromCoords({ x: i % 79, y: (i * 7) % 64, z: (i * 13) % 71 }));
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
    assert.deepEqual(sectorCoordsFromName('Blae Eock'), { x: 39, y: 30, z: 20 });
});

test('rejects out-of-range grid coordinates', () => {
    for (const c of [
        { x: -1, y: 0, z: 0 },
        { x: 128, y: 0, z: 0 },
        { x: 0, y: 0, z: 9999 },
        { x: 1.5, y: 0, z: 0 },
    ]) {
        assert.throws(() => sectorNameFromCoords(c), RangeError, JSON.stringify(c));
    }
});

test('rejects non-procedural sector names', () => {
    // Hand-authored region names and names that break the vowel/consonant
    // alternation of the fragment grammar are not procedural sectors.
    assert.equal(sectorCoordsFromName('Pleiades Sector'), null);
    assert.equal(canonicalizeSectorName('Pleiades Sector'), null);
    assert.equal(sectorCoordsFromName('Zzzz'), null);
    assert.equal(sectorCoordsFromName('Sol'), null);
    assert.equal(canonicalizeSectorName('Sol'), null);
});
