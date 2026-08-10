import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nearestNebulae, nebulaeWithin, getNebulaByName, type Nebula } from './nebulae.js';
import { REAL_NEBULAE } from './nebulae-real.js';
import { PLANETARY_NEBULAE } from './nebulae-planetary.js';
import { PROCGEN_NEBULAE } from './nebulae-procgen.js';
import { ALL_NEBULAE } from './nebulae-all.js';
import { findCodexRegionAt } from './codex-region-lookup.js';
import { getCodexRegion } from './codex-region.js';
import nebulaeFixture from '../../../fixtures/astro/nebulae.json' with { type: 'json' };

const CATALOGUES: Record<string, readonly Nebula[]> = {
    real: REAL_NEBULAE,
    planetary: PLANETARY_NEBULAE,
    procgen: PROCGEN_NEBULAE,
    all: ALL_NEBULAE,
};

/** Distances are stored rounded to 6 decimals in the fixture. */
const TOLERANCE_LY = 1e-5;

for (const [name, expected] of Object.entries(nebulaeFixture.counts)) {
    test(`the ${name} catalogue holds ${expected} nebulae`, () => {
        assert.equal(CATALOGUES[name]!.length, expected);
    });
}

test('ALL_NEBULAE is exactly the three catalogues concatenated', () => {
    assert.equal(
        ALL_NEBULAE.length,
        REAL_NEBULAE.length + PLANETARY_NEBULAE.length + PROCGEN_NEBULAE.length,
    );
    assert.deepEqual(ALL_NEBULAE[0], REAL_NEBULAE[0]);
    assert.deepEqual(ALL_NEBULAE.at(-1), PROCGEN_NEBULAE.at(-1));
});

for (const record of nebulaeFixture.records) {
    const { catalogue, ...nebula } = record;
    test(`${catalogue} catalogue holds ${nebula.name} verbatim`, () => {
        const hit = CATALOGUES[catalogue]!.find((n) => n.name === nebula.name);
        assert.deepEqual(hit, nebula);
    });
}

for (const [name, catalogue] of Object.entries(CATALOGUES)) {
    if (name === 'all') continue;
    test(`every ${name} record is typed '${name}' and sorted by name`, () => {
        for (const nebula of catalogue) assert.equal(nebula.type, name);
        const names = catalogue.map((n) => n.name);
        assert.deepEqual(names, [...names].sort());
    });
}

test('every nebula record is well-formed', () => {
    for (const nebula of ALL_NEBULAE) {
        assert.ok(nebula.name.length > 0, `empty name near ${nebula.system}`);
        assert.ok(nebula.system.length > 0, `empty system for ${nebula.name}`);
        for (const axis of [nebula.x, nebula.y, nebula.z]) {
            assert.ok(Number.isFinite(axis), `non-finite coordinate for ${nebula.name}`);
        }
        assert.ok(nebula.regionId >= 1 && nebula.regionId <= 42, `bad regionId for ${nebula.name}`);
        assert.ok(getCodexRegion(nebula.regionId), `unknown region ${nebula.regionId}`);
    }
});

test("each nebula's regionId agrees with this library's own region lookup", () => {
    for (const nebula of ALL_NEBULAE) {
        assert.equal(
            findCodexRegionAt({ x: nebula.x, z: nebula.z })?.id ?? 0,
            nebula.regionId,
            `region mismatch for ${nebula.name}`,
        );
    }
});

for (const query of nebulaeFixture.nearest) {
    test(`nearestNebulae(${query.origin}, ${query.catalogue}, ${query.count})`, () => {
        const hits = nearestNebulae(query.from, CATALOGUES[query.catalogue]!, query.count);
        assert.equal(hits.length, query.expect.length);
        hits.forEach((hit, i) => {
            const want = query.expect[i]!;
            assert.equal(hit.name, want.name);
            assert.equal(hit.system, want.system);
            assert.ok(
                Math.abs(hit.distanceLy - want.distanceLy) < TOLERANCE_LY,
                `${hit.name}: ${hit.distanceLy} != ${want.distanceLy}`,
            );
        });
    });
}

for (const query of nebulaeFixture.within) {
    test(`nebulaeWithin(${query.origin}, ${query.radiusLy} ly, ${query.catalogue})`, () => {
        const hits = nebulaeWithin(query.from, CATALOGUES[query.catalogue]!, query.radiusLy);
        assert.deepEqual(
            hits.map((h) => h.name),
            query.expect.map((e) => e.name),
        );
        hits.forEach((hit, i) => {
            assert.ok(Math.abs(hit.distanceLy - query.expect[i]!.distanceLy) < TOLERANCE_LY);
            assert.ok(hit.distanceLy <= query.radiusLy);
        });
    });
}

test('nearestNebulae defaults to three results and never exceeds the catalogue', () => {
    assert.equal(nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE).length, 3);
    assert.equal(
        nearestNebulae({ x: 0, y: 0, z: 0 }, PROCGEN_NEBULAE, PROCGEN_NEBULAE.length + 10).length,
        PROCGEN_NEBULAE.length,
    );
});

test('nearestNebulae returns nothing for a non-positive count', () => {
    assert.deepEqual(nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 0), []);
    assert.deepEqual(nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, -1), []);
});

test('nearestNebulae retains catalogue order when distances tie', () => {
    const tied: readonly Nebula[] = [
        { name: 'first', system: 'first', x: -1, y: 0, z: 0, type: 'real', regionId: 1 },
        { name: 'far', system: 'far', x: 2, y: 0, z: 0, type: 'real', regionId: 1 },
        { name: 'second', system: 'second', x: 1, y: 0, z: 0, type: 'real', regionId: 1 },
    ];
    assert.deepEqual(
        nearestNebulae({ x: 0, y: 0, z: 0 }, tied, 2).map(({ name }) => name),
        ['first', 'second'],
    );
});

test('nearestNebulae treats count like Array.slice', () => {
    const origin = { x: 0, y: 0, z: 0 };
    assert.equal(nearestNebulae(origin, REAL_NEBULAE, 2.9).length, 2);
    assert.deepEqual(nearestNebulae(origin, REAL_NEBULAE, Number.NaN), []);
    assert.equal(nearestNebulae(origin, REAL_NEBULAE, Number.POSITIVE_INFINITY).length, 180);
});

test('nebulaeWithin includes the boundary and rejects a negative radius', () => {
    const target = REAL_NEBULAE[0]!;
    const from = { x: target.x, y: target.y, z: target.z };
    const exact = nebulaeWithin(from, REAL_NEBULAE, 0);
    assert.deepEqual(
        exact.map((n) => n.name),
        [target.name],
    );
    assert.equal(exact[0]!.distanceLy, 0);
    assert.deepEqual(nebulaeWithin(from, REAL_NEBULAE, -1), []);
});

test('queries copy their records and leave the catalogue untouched', () => {
    const before = REAL_NEBULAE[0]!;
    const [hit] = nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 1);
    assert.notEqual(
        hit,
        REAL_NEBULAE.find((n) => n.name === hit!.name),
    );
    assert.equal(REAL_NEBULAE[0], before);
    assert.ok(!('distanceLy' in REAL_NEBULAE[0]!));
});

for (const record of nebulaeFixture.records) {
    test(`getNebulaByName finds ${record.name} case-insensitively`, () => {
        const hit = getNebulaByName(
            `  ${record.name.toUpperCase()}\n`,
            CATALOGUES[record.catalogue]!,
        );
        assert.equal(hit?.system, record.system);
    });
}

test('getNebulaByName returns null for an unknown name or the wrong catalogue', () => {
    assert.equal(getNebulaByName('Nebula of the Thargoid Menace', ALL_NEBULAE), null);
    assert.equal(getNebulaByName('Witch Head Nebula', PLANETARY_NEBULAE), null);
});
