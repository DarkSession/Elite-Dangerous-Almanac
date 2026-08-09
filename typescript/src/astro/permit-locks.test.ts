import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    permitLockForSystemName,
    isPermitLockedSystemName,
    isPermitLockedRegionName,
    PERMIT_LOCKED_SYSTEMS,
    PERMIT_LOCKED_REGIONS,
} from './permit-locks.js';
import { findHandAuthoredRegionAt, HAND_AUTHORED_REGIONS } from './hand-authored-regions.js';
import { ProceduralSystem } from './procedural-system.js';
import permitFixture from '../../../fixtures/astro/permit-locks.json' with { type: 'json' };

for (const c of permitFixture.cases) {
    const expected = c.lock ? `${c.lock.kind}:${c.lock.name}` : 'null';
    test(`permitLockForSystemName(${JSON.stringify(c.name)}) -> ${expected}`, () => {
        const lock = permitLockForSystemName(c.name);
        if (!c.lock) {
            assert.equal(lock, null);
            assert.equal(isPermitLockedSystemName(c.name), false);
        } else {
            assert.ok(lock, `expected a ${c.lock.kind} lock`);
            assert.equal(lock.kind, c.lock.kind);
            assert.equal(lock.name, c.lock.name);
            assert.equal(isPermitLockedSystemName(c.name), true);
            if ('id64' in c.lock && c.lock.id64) {
                assert.equal(lock.kind, 'system');
                assert.ok(lock.kind === 'system');
                assert.equal(lock.id64, BigInt(c.lock.id64));
            }
        }

        // Where the fixture carries real coordinates, the geometric route must reach
        // the same verdict as the name route — both describe the same 28 regions, so
        // they may never disagree about a real system.
        if (!('coords' in c) || !c.coords) return;
        const region = findHandAuthoredRegionAt(c.coords);
        const byCoords = region && isPermitLockedRegionName(region.name) ? region.name : null;
        const byName = c.lock?.kind === 'region' ? c.lock.name : null;
        assert.equal(byCoords, byName, `coords and name disagree for ${c.name}`);
    });
}

test('every permit-locked system carries a distinct 64-bit address', () => {
    const seen = new Set<bigint>();
    for (const system of PERMIT_LOCKED_SYSTEMS) {
        assert.equal(typeof system.id64, 'bigint', `${system.name} has no id64`);
        assert.ok(system.id64 > 0n && system.id64 < 1n << 64n, `${system.name}: ${system.id64}`);
        assert.equal(seen.has(system.id64), false, `duplicate id64 on ${system.name}`);
        seen.add(system.id64);
    }
});

// Three of the 54 are procedurally named, so this library can derive their address
// itself. Two were independently confirmed against Spansh; the third
// (Plaa Ain HA-Z d46) is absent from Spansh and EDSM and was encoded here, so this
// pins the recorded value to the encoder that produced it.
test('recorded addresses agree with the encoder for procedural permit systems', () => {
    for (const name of [
        'Dryio Flyuae IC-B c1-377',
        'Scheau Bli NB-O d6-1409',
        'Plaa Ain HA-Z d46',
    ]) {
        const recorded = PERMIT_LOCKED_SYSTEMS.find((s) => s.name === name);
        assert.ok(recorded, `${name} missing from the list`);
        assert.equal(ProceduralSystem.fromName(name)?.systemAddress, recorded.id64);
    }
});

test('the shipped lists have the sizes the fixture pins', () => {
    assert.equal(PERMIT_LOCKED_SYSTEMS.length, permitFixture.counts.systems);
    assert.equal(PERMIT_LOCKED_REGIONS.length, permitFixture.counts.regions);
});

test('system names are unique, canonically cased and sorted', () => {
    const keys = PERMIT_LOCKED_SYSTEMS.map((s) => s.name.toLowerCase());
    assert.equal(new Set(keys).size, keys.length, 'duplicate system name');
    assert.deepEqual(keys, [...keys].sort(), 'systems are not sorted by name');
    for (const { name } of PERMIT_LOCKED_SYSTEMS) {
        assert.equal(name, name.trim(), `untrimmed name: ${name}`);
    }
});

// Permit state lives only here, but each region name must still resolve to real
// geometry — otherwise a typo would silently stop matching anything by coordinates.
test('every permit region names a hand-authored region with spheres', () => {
    const byName = new Map(HAND_AUTHORED_REGIONS.map((r) => [r.name, r]));
    for (const name of PERMIT_LOCKED_REGIONS) {
        const region = byName.get(name);
        assert.ok(region, `no hand-authored region named ${name}`);
        assert.ok(region.spheres.length > 0, `${name} has no spheres`);
    }
});

test('every permit region name resolves to itself as a region lock', () => {
    for (const name of PERMIT_LOCKED_REGIONS) {
        assert.deepEqual(permitLockForSystemName(name), { kind: 'region', name });
        assert.deepEqual(permitLockForSystemName(`${name} AA-A h0`), { kind: 'region', name });
        assert.equal(isPermitLockedRegionName(name), true);
        assert.equal(isPermitLockedRegionName(name.toUpperCase()), true);
        // Exact only: a system name is not a region name.
        assert.equal(isPermitLockedRegionName(`${name} AA-A h0`), false);
    }
});

test('no permit region name shadows another, and no open region is caught', () => {
    for (const name of PERMIT_LOCKED_REGIONS) {
        const others = PERMIT_LOCKED_REGIONS.filter((o) => o !== name);
        for (const other of others) {
            assert.equal(
                other.toLowerCase().startsWith(`${name.toLowerCase()} `),
                false,
                `${name} shadows ${other}`,
            );
        }
    }
    for (const region of HAND_AUTHORED_REGIONS) {
        if (isPermitLockedRegionName(region.name)) continue;
        assert.equal(
            permitLockForSystemName(`${region.name} AA-A h0`),
            null,
            `open region ${region.name} is reported as permit-locked`,
        );
    }
});

test('no permit-locked system is shadowed by a region name', () => {
    for (const { name } of PERMIT_LOCKED_SYSTEMS) {
        assert.equal(permitLockForSystemName(name)?.kind, 'system', `${name} hit a region lock`);
    }
});
