import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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

test('generates a pinned corpus of names from the ported fragment tables', () => {
    // The run-length and offset tables are derived from the EDTS fragment tables once,
    // at module load. This pins what that derivation generates across 16 384 grid slots
    // so restructuring it cannot quietly shift a name; a slot with no assigned name
    // records `-`.
    const lines: string[] = [];
    for (let sectorX = 0; sectorX < 128; sectorX++)
        for (let sectorY = 0; sectorY < 64; sectorY += 8)
            for (let sectorZ = 0; sectorZ < 128; sectorZ += 8) {
                let name = '-';
                try {
                    name = sectorNameFromGridPosition({ sectorX, sectorY, sectorZ });
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                }
                lines.push(`${sectorX},${sectorY},${sectorZ}=${name}`);
            }
    assert.equal(lines.length, 16384);

    // Spot values first, so a table change reports a readable name rather than only a
    // changed digest. The last two are the ones the digest alone would not localise.
    assert.deepEqual(
        [lines[0], lines[3000], lines[12345], lines.at(-1)],
        ['0,0,0=Thob', '23,24,64=Glaiyao', '96,24,72=Mynua Scho', '127,56,120=-'],
    );
    assert.equal(
        createHash('sha256')
            .update(lines.join('\n') + '\n', 'utf8')
            .digest('hex'),
        'c66e8c56d020094f0f1c8afe4dac10a087ac13dff588a40c5c22a9e830482c74',
    );
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

test('the sector-name parsers name a wrong-typed name and answer a missing one', () => {
    // A nullish name is the one the callers above may not have: `canonicalizeSystemName`
    // hands this its parsed region, and a journal field may simply be absent.
    assert.equal(sectorGridPositionFromName(null as unknown as string), null);
    assert.equal(sectorGridPositionFromName(undefined as unknown as string), null);
    assert.equal(canonicalizeSectorName(null as unknown as string), null);
    assert.equal(canonicalizeSectorName(undefined as unknown as string), null);

    for (const [call, label] of [
        [() => sectorGridPositionFromName(42 as unknown as string), 'sectorGridPositionFromName'],
        // The facade names itself rather than the round-trip it delegates to.
        [() => canonicalizeSectorName(42 as unknown as string), 'canonicalizeSectorName'],
    ] as const) {
        assert.throws(call, {
            name: 'TypeError',
            message: `${label}: name must be a string, received number 42`,
        });
    }
});
