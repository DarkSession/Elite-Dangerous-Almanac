import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSlotName, enumerateSlots, SLOT_RESTRICTION_LABELS } from './slots.js';
import { getShipSlots, SHIPS } from './ships.js';
import slotsFixture from '../../../fixtures/ships/ship-slots.json' with { type: 'json' };

test('parseSlotName classifies every journal slot-name form', () => {
    assert.deepEqual(parseSlotName('PowerPlant'), { kind: 'core', size: null, core: 'powerPlant' });
    assert.deepEqual(parseSlotName('MainEngines'), { kind: 'core', size: null, core: 'thrusters' });
    assert.deepEqual(parseSlotName('Radar'), { kind: 'core', size: null, core: 'sensors' });
    assert.deepEqual(parseSlotName('FuelTank'), { kind: 'core', size: null, core: 'fuelTank' });
    assert.deepEqual(parseSlotName('SmallHardpoint1'), { kind: 'hardpoint', size: 1 });
    assert.deepEqual(parseSlotName('HugeHardpoint2'), { kind: 'hardpoint', size: 4 });
    assert.deepEqual(parseSlotName('TinyHardpoint3'), { kind: 'utility', size: 0 });
    assert.deepEqual(parseSlotName('Slot03_Size5'), { kind: 'optional', size: 5 });
    assert.deepEqual(parseSlotName('Military01'), {
        kind: 'optional',
        size: null,
        restriction: 'military',
    });
    assert.deepEqual(parseSlotName('PlanetaryApproachSuite'), {
        kind: 'optional',
        size: null,
        restriction: 'planetaryApproachSuite',
    });
    assert.deepEqual(parseSlotName('Armour'), { kind: 'armour', size: 0 });
    assert.deepEqual(parseSlotName('CargoHatch'), { kind: 'cargoHatch', size: 1 });
});

test('parseSlotName reads a restricted mount off its journal name alone', () => {
    // Frontier names a restricted mount differently, so no hull layout is needed.
    assert.deepEqual(parseSlotName('LargeMiningHardpoint1'), {
        kind: 'hardpoint',
        size: 3,
        restriction: 'mining',
    });
    assert.deepEqual(parseSlotName('SmallMiningHardpoint1'), {
        kind: 'hardpoint',
        size: 1,
        restriction: 'mining',
    });
    assert.deepEqual(parseSlotName('Cargo02'), {
        kind: 'optional',
        size: null,
        restriction: 'cargo',
    });
    assert.deepEqual(parseSlotName('LimpetController01'), {
        kind: 'optional',
        size: null,
        restriction: 'limpetController',
    });
    assert.deepEqual(parseSlotName('FighterBay01'), {
        kind: 'optional',
        size: null,
        restriction: 'vesselHangar',
    });
    // The cargo hatch is not a cargo-restricted optional, however it reads.
    assert.deepEqual(parseSlotName('CargoHatch'), { kind: 'cargoHatch', size: 1 });
});

test('parseSlotName returns null for an unrecognised name', () => {
    assert.equal(parseSlotName('Nonsense42'), null);
    assert.equal(parseSlotName(''), null);
    // The core-key lookup is a Map, so a name that happens to be an Object.prototype
    // member is a miss like any other rather than an inherited "classification".
    assert.equal(parseSlotName('constructor'), null);
    assert.equal(parseSlotName('__proto__'), null);
    assert.equal(parseSlotName('toString'), null);
});

test('parseSlotName classifies a key whatever its casing', () => {
    // Inara lower-cases every slot key, as the SLEF specification's own example does,
    // so a producer's casing must not decide whether a mount is recognised. Every form
    // below names the mount above it.
    for (const [journal, produced] of [
        ['PowerPlant', 'powerplant'],
        ['MainEngines', 'mainengines'],
        ['Radar', 'RADAR'],
        ['Armour', 'armour'],
        ['CargoHatch', 'cargohatch'],
        ['PlanetaryApproachSuite', 'planetaryapproachsuite'],
        ['HugeHardpoint2', 'hugehardpoint2'],
        ['LargeMiningHardpoint1', 'largemininghardpoint1'],
        ['TinyHardpoint3', 'tinyhardpoint3'],
        ['Slot03_Size5', 'slot03_size5'],
        ['Military01', 'MILITARY01'],
        ['LimpetController01', 'limpetcontroller01'],
        ['FighterBay01', 'fighterbay01'],
    ] as const) {
        assert.deepEqual(parseSlotName(produced), parseSlotName(journal), produced);
    }
    // The values it hands back keep this library's own spelling, not the input's.
    assert.deepEqual(parseSlotName('powerplant'), { kind: 'core', size: null, core: 'powerPlant' });
    assert.deepEqual(parseSlotName('largemininghardpoint1'), {
        kind: 'hardpoint',
        size: 3,
        restriction: 'mining',
    });
});

test('a cosmetic mount stays unclassified in either casing', () => {
    // `parseSlotName` returns null for exactly the journal's cosmetic slots. Matching
    // keys case-insensitively must not turn one of those into a recognised mount.
    for (const slot of ['ShipCockpit', 'shipcockpit', 'PaintJob', 'paintjob', 'decal1']) {
        assert.equal(parseSlotName(slot), null, slot);
    }
});

test('enumerateSlots expands the Anaconda layout into keyed mounts', () => {
    const slots = enumerateSlots(getShipSlots('Anaconda')!);

    const hardpoints = slots.filter((s) => s.kind === 'hardpoint');
    assert.deepEqual(
        hardpoints.map((s) => s.key),
        [
            'HugeHardpoint1',
            'LargeHardpoint1',
            'LargeHardpoint2',
            'LargeHardpoint3',
            'MediumHardpoint1',
            'MediumHardpoint2',
            'SmallHardpoint1',
            'SmallHardpoint2',
        ],
    );

    assert.equal(slots.filter((s) => s.kind === 'utility').length, 8);
    assert.equal(slots.filter((s) => s.kind === 'core').length, 7);
    assert.equal(slots.filter((s) => s.kind === 'armour').length, 1);
    assert.equal(slots.filter((s) => s.kind === 'cargoHatch').length, 1);

    const fsd = slots.find((s) => s.key === 'FrameShiftDrive');
    assert.deepEqual(fsd, {
        key: 'FrameShiftDrive',
        kind: 'core',
        size: 6,
        core: 'frameShiftDrive',
    });

    const military = slots.find((s) => s.restriction === 'military');
    assert.deepEqual(military, {
        key: 'Military01',
        kind: 'optional',
        size: 5,
        restriction: 'military',
    });
    const pas = slots.find((s) => s.restriction === 'planetaryApproachSuite');
    assert.equal(pas?.key, 'PlanetaryApproachSuite');
});

test('the restricted hulls enumerate the journal keys the fixture pins', () => {
    for (const [symbol, expected] of Object.entries(slotsFixture.keys)) {
        assert.deepEqual(
            enumerateSlots(getShipSlots(symbol)!).map((s) => s.key),
            expected,
            symbol,
        );
    }
});

test("the Type-11's mining mounts share the per-class numbering", () => {
    const hardpoints = enumerateSlots(getShipSlots('LakonMiner')!).filter(
        (s) => s.kind === 'hardpoint',
    );
    // Three of the four mediums; the unrestricted one keeps the number it would
    // have had, so it is MediumHardpoint3 rather than MediumHardpoint1.
    assert.deepEqual(
        hardpoints.filter((s) => s.restriction === 'mining').map((s) => s.key),
        [
            'LargeMiningHardpoint1',
            'MediumMiningHardpoint1',
            'MediumMiningHardpoint2',
            'SmallMiningHardpoint1',
        ],
    );
    assert.deepEqual(
        hardpoints.filter((s) => !s.restriction).map((s) => s.key),
        ['MediumHardpoint3', 'SmallHardpoint2', 'SmallHardpoint3', 'SmallHardpoint4'],
    );
    assert.deepEqual(
        hardpoints.find((s) => s.key === 'LargeMiningHardpoint1'),
        { key: 'LargeMiningHardpoint1', kind: 'hardpoint', size: 3, restriction: 'mining' },
    );
});

test('a restricted optional takes a name of its own and no Slot number', () => {
    const optionals = enumerateSlots(getShipSlots('PantherMkII')!).filter(
        (s) => s.kind === 'optional',
    );
    assert.deepEqual(optionals[0], {
        key: 'Cargo01',
        kind: 'optional',
        size: 8,
        restriction: 'cargo',
    });
    // The cargo mounts sit at layout positions 0 and 2, and the Slot numbering runs
    // over the unrestricted mounts only — so the size-8 next to Cargo01 is Slot01.
    assert.equal(optionals[1]?.key, 'Slot01_Size8');
    assert.equal(optionals[2]?.key, 'Cargo02');
    assert.equal(optionals[3]?.key, 'Slot02_Size7');
});

test('enumerated optional keys are journal-compatible and size-tagged', () => {
    const optionals = enumerateSlots(getShipSlots('Anaconda')!).filter(
        (s) => s.kind === 'optional' && !s.restriction,
    );
    assert.equal(optionals[0]?.key, 'Slot01_Size7');
    assert.equal(optionals[0]?.size, 7);
    // Slot numbers run only over the unrestricted optionals.
    assert.ok(optionals.every((s) => /^Slot\d\d_Size\d$/.test(s.key)));
});

test('every SLEF slot name in a real export classifies', async () => {
    const { default: slef } = await import('../../../fixtures/ships/slef-the-deep-black.json', {
        with: { type: 'json' },
    });
    for (const m of slef[0]!.data.Modules) {
        assert.ok(parseSlotName(m.Slot) !== null, `unclassified slot: ${m.Slot}`);
    }
});

test('every restriction a hull can carry has a label to show for it', () => {
    // A UI reads `slot.restriction`; without a label per value it would hardcode one.
    const carried = new Set<string>();
    for (const ship of SHIPS) {
        const layout = getShipSlots(ship.symbol);
        if (!layout) continue;
        for (const slot of enumerateSlots(layout)) {
            if (slot.restriction) carried.add(slot.restriction);
        }
    }
    assert.ok(carried.size > 0);
    for (const restriction of carried) {
        assert.ok(
            SLOT_RESTRICTION_LABELS[restriction as keyof typeof SLOT_RESTRICTION_LABELS],
            `no label for ${restriction}`,
        );
    }
    // The labels cover the whole union, not merely what the hulls happen to use.
    assert.deepEqual(Object.keys(SLOT_RESTRICTION_LABELS).sort(), [
        'cargo',
        'limpetController',
        'military',
        'mining',
        'planetaryApproachSuite',
        'vesselHangar',
    ]);
});
