import { test } from 'node:test';
import assert from 'node:assert/strict';

import { StarSystem } from './star-system.js';
import { absoluteBoxelToBoxelCode } from './system-address.js';
import { parseSystemName } from './system-name.js';
import { sectorCoordsFromName } from './sector-name.js';
import { massCodeToSizeClass } from './mass-code.js';
import fixture from '../../../fixtures/astro/system-addresses.json' with { type: 'json' };

const letter = (c: string) => c.charCodeAt(0) - 'A'.charCodeAt(0);

for (const s of fixture.systems) {
    const id64 = BigInt(s.id64);
    const proceduralRegion = sectorCoordsFromName(s.region) !== null;

    test(`encodes ${s.name} to its system address`, () => {
        const sys = StarSystem.fromName(s.name);
        assert.ok(sys, `parse failed for ${s.name}`);
        assert.equal(sys.systemAddress, id64);
    });

    test(`round-trips ${s.name} through the modulated address`, () => {
        const sys = StarSystem.fromName(s.name);
        assert.ok(sys);
        const back = StarSystem.fromModSystemAddress(sys.modSystemAddress);
        // Only the boxel geometry survives the mod form; compare the fields it
        // carries via a re-encode of the procedural name.
        assert.equal(back.systemAddress, id64);
    });

    if (proceduralRegion) {
        test(`decodes ${s.name} from its system address`, () => {
            const sys = StarSystem.fromSystemAddress(id64);
            assert.equal(sys.name, s.name);
            assert.equal(sys.sectorName, s.region);
            const p = sys.parts;
            assert.equal(p.l1, letter(s.l1));
            assert.equal(p.l2, letter(s.l2));
            assert.equal(p.l3, letter(s.l3));
            assert.equal(p.massCode, massCodeToSizeClass(s.massCode));
            assert.equal(p.n1, s.n1);
            assert.equal(p.n2, s.n2);
        });
    }
}

test('round-trips a sequence wider than 15 bits', () => {
    // Mass code d has a 20-bit sequence field, so 40000 must survive re-encode.
    const parts = parseSystemName('Blae Eock KC-C d0-0');
    assert.ok(parts);
    parts.n2 = 40000;
    const sys = StarSystem.fromName('Blae Eock KC-C d0-40000');
    assert.ok(sys);
    assert.equal(StarSystem.fromSystemAddress(sys.systemAddress).sequence, 40000);
});

test('absoluteBoxelToBoxelCode rejects boxels outside the region extent', () => {
    const oneBoxelRegion = {
        name: 'Test Region',
        x0: 0,
        y0: 0,
        z0: 0,
        sizeX: 320,
        sizeY: 320,
        sizeZ: 320,
    };
    assert.equal(absoluteBoxelToBoxelCode(0, { x: 0, y: 0, z: 0 }, oneBoxelRegion), 0);
    assert.equal(absoluteBoxelToBoxelCode(0, { x: 20, y: 0, z: 0 }, oneBoxelRegion), null);
});

test('rejects decoding an out-of-range system address', () => {
    assert.throws(() => StarSystem.fromSystemAddress(-1n), RangeError);
    assert.throws(() => StarSystem.fromSystemAddress(1n << 64n), RangeError);
    assert.throws(() => StarSystem.fromModSystemAddress(-5n), RangeError);
});

test('rejects encoding instead of emitting a wrong address', () => {
    const unknown = StarSystem.fromName('Totally Made Up XY-Z d1-2')!;
    assert.equal(unknown.isHandAuthoredSector, false);
    assert.throws(() => unknown.systemAddress, /Unknown sector/);
    assert.throws(() => unknown.modSystemAddress, /Unknown sector/);

    // h-class sector holds a single boxel; only AA-A is valid.
    const outOfRange = StarSystem.fromName('Blae Eock KC-C h0-0')!;
    assert.throws(() => outOfRange.systemAddress, RangeError);

    // Sequence too large for the modulated 15-bit field.
    const seqTooBig = StarSystem.fromName('Blae Eock KC-C d0-70000')!;
    assert.throws(() => seqTooBig.modSystemAddress, RangeError);

    // Fragment-valid sector that resolves outside the galaxy's 6-bit y range.
    const outOfGalaxy = StarSystem.fromName('Pyruetchoo AA-A d0')!;
    assert.throws(() => outOfGalaxy.systemAddress, /does not fit/);
});
