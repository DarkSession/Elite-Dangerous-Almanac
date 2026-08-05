import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSlotName, enumerateSlots, SLOT_RESTRICTION_LABELS, type ShipSlots } from './slots.js';
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

test('parseSlotName reads the Lynx Highliner cabin mounts as plain optionals', () => {
    // The game reserves them for passenger cabins; that restriction is not modelled yet
    // (issue #11), so they classify as the optional mounts they are and nothing more.
    assert.deepEqual(parseSlotName('Passenger01'), { kind: 'optional', size: null });
    assert.deepEqual(parseSlotName('Passenger03'), { kind: 'optional', size: null });
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

test('the hulls with names of their own enumerate the journal keys the fixture pins', () => {
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

test('the slot keys real captures use are mounts the hull actually has', async () => {
    // These are the game's own keys, so every one of them must name a mount
    // `enumerateSlots` produces — case-insensitively, since a SLEF producer may
    // lower-case them. Note what this does and does not prove: the corpus has captures
    // for two of the 13 named hulls, and neither exercises an overridden name. The
    // Caspian one is still load-bearing — its optionals read Slot01…Slot10, Slot13,
    // Slot14, which is what the plain rules give, so it is the evidence for *not*
    // overriding that hull's optionals. The other 11 hulls' names rest on EDSY alone.
    const captures: [string, { Ship: string; Modules: { Slot: string }[] }][] = [
        [
            'the-deep-black',
            (
                await import('../../../fixtures/ships/slef-the-deep-black.json', {
                    with: { type: 'json' },
                })
            ).default[0]!.data,
        ],
        [
            'inara-type-11',
            (
                await import('../../../fixtures/ships/slef-inara-type-11.json', {
                    with: { type: 'json' },
                })
            ).default[0]!.data,
        ],
    ];
    for (const [name, data] of captures) {
        const keys = new Set(
            enumerateSlots(getShipSlots(data.Ship)!).map((s) => s.key.toLowerCase()),
        );
        for (const m of data.Modules) {
            assert.ok(keys.has(m.Slot.toLowerCase()), `${name}: hull has no slot "${m.Slot}"`);
        }
    }
});

test("a hull's own slot names win over the numbering rules", () => {
    const keyAt = (symbol: string, key: string) =>
        enumerateSlots(getShipSlots(symbol)!).find((s) => s.key === key);

    // The Anaconda's last two optionals skip 11 and 12 outright.
    const anaconda = enumerateSlots(getShipSlots('Anaconda')!).filter((s) => s.kind === 'optional');
    assert.deepEqual(
        anaconda.slice(-3).map((s) => s.key),
        ['Slot13_Size2', 'Slot14_Size1', 'PlanetaryApproachSuite'],
    );
    assert.equal(keyAt('Anaconda', 'Slot11_Size2'), undefined);
    assert.equal(keyAt('Anaconda', 'Slot12_Size1'), undefined);

    // The Type-9 Heavy is the only hull that starts at zero, and it jumps 08 → 11.
    const type9 = enumerateSlots(getShipSlots('Type9')!).filter(
        (s) => s.kind === 'optional' && !s.restriction,
    );
    assert.equal(type9[0]?.key, 'Slot00_Size8');
    assert.deepEqual(
        type9.slice(-2).map((s) => s.key),
        ['Slot11_Size2', 'Slot12_Size1'],
    );

    // The Type-7 Transporter uses the number 09 twice — distinct keys, same number.
    const type7 = enumerateSlots(getShipSlots('Type7')!).filter((s) => s.kind === 'optional');
    assert.deepEqual(
        type7.slice(-3).map((s) => s.key),
        ['Slot09_Size2', 'Slot09_Size1', 'PlanetaryApproachSuite'],
    );

    // The Type-8 Transporter has no SmallHardpoint3 at all.
    assert.deepEqual(
        enumerateSlots(getShipSlots('Type8')!)
            .filter((s) => s.kind === 'hardpoint')
            .map((s) => s.key),
        [
            'MediumHardpoint1',
            'SmallHardpoint1',
            'SmallHardpoint2',
            'SmallHardpoint4',
            'SmallHardpoint5',
            'SmallHardpoint6',
        ],
    );

    // The Caspian Explorer's mediums are out of order, not merely gapped — so a key
    // maps to a different physical mount than layout order would suggest.
    assert.deepEqual(
        enumerateSlots(getShipSlots('Explorer_NX')!)
            .filter((s) => s.kind === 'hardpoint')
            .map((s) => s.key),
        [
            'LargeHardpoint1',
            'MediumHardpoint6',
            'MediumHardpoint5',
            'MediumHardpoint1',
            'MediumHardpoint2',
            'MediumHardpoint3',
            'MediumHardpoint4',
        ],
    );

    // The Lynx Highliner names its three cabin mounts, and resumes at Slot02 after them.
    assert.deepEqual(
        enumerateSlots(getShipSlots('MediumTransport01')!)
            .filter((s) => s.kind === 'optional')
            .slice(0, 5)
            .map((s) => s.key),
        ['Slot01_Size6', 'Passenger01', 'Passenger02', 'Passenger03', 'Slot02_Size5'],
    );
});

test("a slot key's _SizeN suffix is the game's, and the mount keeps its real size", () => {
    // Frontier's own names misreport the class on three hulls. `size` is the mount's.
    const keelback = enumerateSlots(getShipSlots('Independant_Trader')!).find(
        (s) => s.key === 'Slot03_Size3',
    );
    assert.equal(keelback?.size, 4);

    const aspScout = enumerateSlots(getShipSlots('Asp_Scout')!).find(
        (s) => s.key === 'Slot01_Size4',
    );
    assert.equal(aspScout?.size, 5);

    const type7 = enumerateSlots(getShipSlots('Type7')!);
    assert.equal(type7.find((s) => s.key === 'Slot05_Size4')?.size, 5);
    assert.equal(type7.find((s) => s.key === 'Slot07_Size2')?.size, 3);
});

test('the numbering rules still derive the two hulls whose names they already fit', () => {
    // The Panther Clipper Mk II and Type-11 Prospector carry `slotNames` so the table
    // matches EDSY's one for one — but the rules produce the same keys unaided, and
    // dropping the override must not change a thing.
    for (const symbol of ['PantherMkII', 'LakonMiner']) {
        const layout = getShipSlots(symbol)!;
        assert.ok(layout.slotNames, `${symbol} carries slotNames`);
        const unnamed: ShipSlots = {
            symbol: layout.symbol,
            core: layout.core,
            hardpoints: layout.hardpoints,
            utility: layout.utility,
            optional: layout.optional,
        };
        assert.deepEqual(
            enumerateSlots(unnamed).map((s) => s.key),
            enumerateSlots(layout).map((s) => s.key),
            symbol,
        );
    }
});

test('every hull enumerates keys that are unique, classifiable and agree with the mount', () => {
    for (const ship of SHIPS) {
        const layout = getShipSlots(ship.symbol);
        if (!layout) continue;
        const slots = enumerateSlots(layout);
        assert.equal(
            new Set(slots.map((s) => s.key)).size,
            slots.length,
            `${ship.symbol} has a duplicate slot key`,
        );
        for (const slot of slots) {
            const parsed = parseSlotName(slot.key);
            assert.ok(parsed, `${ship.symbol}: unclassifiable key ${slot.key}`);
            assert.equal(parsed.kind, slot.kind, `${ship.symbol} ${slot.key} kind`);
            assert.equal(
                parsed.restriction,
                slot.restriction,
                `${ship.symbol} ${slot.key} restriction`,
            );
        }
    }
});

test('a hull naming its mounts names all of them, in layout order', () => {
    for (const ship of SHIPS) {
        const layout = getShipSlots(ship.symbol);
        if (!layout?.slotNames) continue;
        const { hardpoints, optional } = layout.slotNames;
        if (hardpoints) {
            assert.equal(hardpoints.length, layout.hardpoints.length, `${ship.symbol} hardpoints`);
        }
        if (optional) {
            assert.equal(optional.length, layout.optional.length, `${ship.symbol} optional`);
        }
        assert.ok(hardpoints ?? optional, `${ship.symbol} slotNames is empty`);
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
