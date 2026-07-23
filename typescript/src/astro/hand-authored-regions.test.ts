import { test } from 'node:test';
import assert from 'node:assert/strict';

import { StarSystem } from './star-system.js';
import { handAuthoredRegionForCoords, HAND_AUTHORED_REGIONS } from './hand-authored-regions.js';
import { getNamedRegionOrigin } from './named-regions.js';
import { isPermitLockedRegionName } from './permit-locked-regions.js';
import handAuthoredFixture from '../../../fixtures/astro/hand-authored-regions.json' with { type: 'json' };

for (const s of handAuthoredFixture.systems) {
    const id64 = BigInt(s.id64);

    test(`reproduces the hand-authored name for ${s.name}`, () => {
        const sys = StarSystem.fromSystemAddress(id64, s.coords);
        assert.equal(sys.isHandAuthoredSector, true);
        assert.equal(sys.name, s.name);
        assert.equal(sys.needsPermit, s.needsPermit);
    });

    if ('proceduralName' in s && s.proceduralName) {
        test(`falls back to the procedural name for ${s.name} without coords`, () => {
            const sys = StarSystem.fromSystemAddress(id64);
            assert.equal(sys.isHandAuthoredSector, false);
            assert.equal(sys.name, s.proceduralName);
        });
    }
}

for (const c of handAuthoredFixture.regionForCoords) {
    test(`handAuthoredRegionForCoords(${c.coords.x}, ${c.coords.y}, ${c.coords.z}) -> ${c.region}`, () => {
        const hit = handAuthoredRegionForCoords(c.coords);
        assert.equal(hit?.name ?? null, c.region);
    });
}

test('every hand-authored region has an origin for address/name conversion', () => {
    for (const region of HAND_AUTHORED_REGIONS) {
        assert.ok(getNamedRegionOrigin(region.name), `missing origin for ${region.name}`);
    }
});

test('canonicalises known hand-authored region names', () => {
    const sys = StarSystem.fromName('pleiades sector hr-w d1-79');
    assert.ok(sys);
    assert.equal(sys.name, 'Pleiades Sector HR-W d1-79');
    assert.equal(sys.isHandAuthoredSector, true);
});

test('copies coordinates to keep StarSystem instances immutable', () => {
    const coords = { x: -80.625, y: -146.65625, z: -343.25 };
    const sys = StarSystem.fromSystemAddress(2724879894859n, coords);
    coords.x = 999;
    assert.equal(sys.coords?.x, -80.625);

    const exposed = sys.coords;
    assert.ok(exposed);
    exposed.x = 500;
    assert.equal(sys.coords?.x, -80.625);
});

test('the HA override applies on the modulated-address path too', () => {
    const src = StarSystem.fromName('Pleiades Sector HR-W d1-79')!;
    const sys = StarSystem.fromModSystemAddress(src.modSystemAddress, {
        x: -80.625,
        y: -146.65625,
        z: -343.25,
    });
    assert.equal(sys.isHandAuthoredSector, true);
    assert.equal(sys.name, 'Pleiades Sector HR-W d1-79');
});

test('HAND_AUTHORED_REGIONS is sorted smallest-radius-first (overlap priority)', () => {
    for (let i = 1; i < HAND_AUTHORED_REGIONS.length; i++) {
        const prev = Math.min(...HAND_AUTHORED_REGIONS[i - 1]!.spheres.map((s) => s.r));
        const cur = Math.min(...HAND_AUTHORED_REGIONS[i]!.spheres.map((s) => s.r));
        assert.ok(cur >= prev, `not sorted at index ${i}`);
    }
});

test('resolves a permit-locked region from coordinates', () => {
    const cone = HAND_AUTHORED_REGIONS.find((r) => r.name === 'Cone Sector');
    assert.ok(cone);
    const s = cone.spheres[0]!;
    const hit = handAuthoredRegionForCoords({ x: s.cx, y: s.cy, z: s.cz });
    assert.equal(hit?.name, 'Cone Sector');
    // The region record itself holds no permit flag — permit-locks.ts owns that.
    assert.equal(isPermitLockedRegionName(hit!.name), true);
    assert.equal(isPermitLockedRegionName('Pleiades Sector'), false);
});
