import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSlotName, enumerateSlots } from './slots.js';
import { getShipSlots } from './ship-slots.js';

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

test('parseSlotName returns null for an unrecognised name', () => {
    assert.equal(parseSlotName('Nonsense42'), null);
    assert.equal(parseSlotName(''), null);
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
