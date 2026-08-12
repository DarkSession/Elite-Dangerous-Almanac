import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ProceduralSystem } from './procedural-system.js';
import {
    absoluteBoxelToBoxelCode,
    boxelCodeToAbsoluteBoxel,
    decodeModSystemAddress,
    encodeModSystemAddress,
    encodeSystemAddress,
} from './system-address.js';
import { resolveNamingRegionOrigin } from './naming-region-origins.js';
import { parseSystemName } from './system-name.js';
import { sectorGridPositionFromName } from './sector-name.js';
import { massCodeToSizeClass } from './mass-code.js';
import fixture from '../../../fixtures/astro/system-addresses.jsonc' with { type: 'json' };

const letter = (c: string) => c.charCodeAt(0) - 'A'.charCodeAt(0);

for (const s of fixture.systems) {
    const id64 = BigInt(s.id64);
    const proceduralRegion = sectorGridPositionFromName(s.region) !== null;

    test(`encodes ${s.name} to its system address`, () => {
        const sys = ProceduralSystem.fromName(s.name);
        assert.ok(sys, `parse failed for ${s.name}`);
        assert.equal(sys.systemAddress, id64);
    });

    test(`round-trips ${s.name} through the modulated address`, () => {
        const sys = ProceduralSystem.fromName(s.name);
        assert.ok(sys);
        assert.ok(sys.modSystemAddress !== null);
        const back = ProceduralSystem.fromModSystemAddress(sys.modSystemAddress);
        // Only the boxel geometry survives the mod form; compare the fields it
        // carries via a re-encode of the procedural name.
        assert.equal(back.systemAddress, id64);
    });

    if (proceduralRegion) {
        test(`decodes ${s.name} from its system address`, () => {
            const sys = ProceduralSystem.fromSystemAddress(id64);
            assert.equal(sys.name, s.name);
            assert.equal(sys.namingRegionName, s.region);
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
    const sys = ProceduralSystem.fromName('Blae Eock KC-C d0-40000');
    assert.ok(sys);
    assert.equal(sys.modSystemAddress, null);
    assert.equal(ProceduralSystem.fromSystemAddress(sys.systemAddress).sequence, 40000);
});

test('accepts a safe-number modulated address', () => {
    const address = 962_072_674_304;
    assert.deepEqual(decodeModSystemAddress(address), decodeModSystemAddress(BigInt(address)));
    assert.equal(ProceduralSystem.fromModSystemAddress(address).name, 'Thob AA-A h0');
});

test('rejects a modulated sequence that has no normal-address representation', () => {
    // A valid modulated a-class address has 15 sequence bits, while the normal
    // a-class layout has 11. ProceduralSystem guarantees both layouts, so it rejects.
    assert.throws(
        () => ProceduralSystem.fromModSystemAddress(2048n),
        /Sequence 2048 does not fit in 11 bits/,
    );
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
    assert.throws(() => ProceduralSystem.fromSystemAddress(-1n), RangeError);
    assert.throws(() => ProceduralSystem.fromSystemAddress(1n << 64n), RangeError);
    assert.throws(() => ProceduralSystem.fromModSystemAddress(-5n), RangeError);
});

test('a negative origin coordinate is refused as out of range, naming the coordinate', () => {
    // A caller-built origin is the only way here: every catalogued and synthesised
    // origin is non-negative. The message must name the coordinate rather than call
    // the region unknown, or a caller who mistyped one goes looking for a missing
    // region instead of at the origin they wrote.
    const negativeOrigin = {
        name: 'Test Region',
        x0: -1,
        y0: 0,
        z0: 0,
        sizeX: 320,
        sizeY: 320,
        sizeZ: 320,
    };
    assert.throws(() => boxelCodeToAbsoluteBoxel(0, 0, negativeOrigin), {
        name: 'RangeError',
        message: /negative coordinate/,
    });
});

test('factories reject encoding immediately instead of creating a partially usable system', () => {
    // Out of range, not malformed: the name parses, but nothing maps its region to an
    // origin. README.md pins the class, so assert it alongside the message.
    assert.throws(() => ProceduralSystem.fromName('Totally Made Up XY-Z d1-2'), {
        name: 'RangeError',
        message: /Unknown sector/,
    });

    // h-class sector holds a single boxel; only AA-A is valid.
    assert.throws(() => ProceduralSystem.fromName('Blae Eock KC-C h0-0'), RangeError);

    // Sequence too large for the modulated 15-bit field.
    assert.equal(ProceduralSystem.fromName('Blae Eock KC-C d0-70000')?.modSystemAddress, null);

    // Fragment-valid sector that resolves outside the galaxy's 6-bit y range.
    assert.throws(() => ProceduralSystem.fromName('Pyruetchoo AA-A d0'), /does not fit/);
});

test('encoding refuses hand-built parts whose letters are outside 0-25', () => {
    // Parsed parts are always in range, so only a caller assembling parts itself can
    // get here. Encoding a letter of 26 silently addressed a different system before.
    const parts = parseSystemName('Blae Eock KC-C d0-0');
    assert.ok(parts);
    const origin = resolveNamingRegionOrigin(parts.regionName);
    assert.ok(origin);

    for (const encode of [encodeSystemAddress, encodeModSystemAddress]) {
        assert.throws(() => encode({ ...parts, l1: 26 }, origin), {
            name: 'RangeError',
            message: /Boxel letters out of range/,
        });
        assert.throws(() => encode({ ...parts, n1: -1 }, origin), {
            name: 'RangeError',
            message: /Boxel number N1 out of range/,
        });
    }
});
