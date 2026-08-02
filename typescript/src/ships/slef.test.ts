import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseSlef,
    getLoadoutModifier,
    toSlef,
    stringifySlef,
    LIBRARY_SLEF_HEADER,
    type LoadoutEvent,
    type LoadoutModule,
    type SlefHeader,
} from './slef.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.json' with { type: 'json' };

const slefString = JSON.stringify(slefFixture);

test('parseSlef accepts the SLEF JSON string', () => {
    const entries = parseSlef(slefString);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.header.appName, 'EDSY');
    assert.equal(entries[0]!.data.Ship, 'explorer_nx');
    assert.ok(entries[0]!.data.Modules.length > 0);
});

test('parseSlef accepts an already-parsed SLEF array', () => {
    const entries = parseSlef(slefFixture);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.data.ShipName, 'The Deep Black');
});

test('parseSlef accepts a single { header, data } entry', () => {
    const entries = parseSlef(slefFixture[0]!);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.data.Ship, 'explorer_nx');
});

test('parseSlef accepts a bare Loadout event and synthesises a header', () => {
    const entries = parseSlef(slefFixture[0]!.data);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.header.appName, '');
    assert.equal(entries[0]!.data.Ship, 'explorer_nx');
});

test('the synthetic header cannot leak mutations between parses', () => {
    const bare = slefFixture[0]!.data;
    const first = parseSlef(bare);
    assert.ok(Object.isFrozen(first[0]!.header));
    assert.throws(() => {
        (first[0]!.header as { appName: string }).appName = 'mutated';
    }, TypeError);
    assert.equal(parseSlef(bare)[0]!.header.appName, '');
});

test('parseSlef throws SyntaxError on invalid JSON', () => {
    assert.throws(() => parseSlef('{not json'), SyntaxError);
});

test('parseSlef throws TypeError when nothing is a loadout', () => {
    assert.throws(() => parseSlef({ foo: 'bar' }), TypeError);
    assert.throws(() => parseSlef([]), TypeError);
});

test('parseSlef rejects envelopes and modules that violate its returned types', () => {
    assert.throws(
        () =>
            parseSlef({
                header: 7,
                data: { Ship: 'sidewinder', Modules: [] },
            }),
        TypeError,
    );
    assert.throws(
        () =>
            parseSlef({
                header: { appName: 'test', appVersion: '1' },
                data: { Ship: 'sidewinder', Modules: [42] },
            }),
        TypeError,
    );
    assert.throws(
        () =>
            parseSlef({
                Ship: 'sidewinder',
                Modules: [{ Slot: 'FrameShiftDrive', Item: 42 }],
            }),
        TypeError,
    );
});

test('parseSlef rejects numeric values outside the documented journal ranges', () => {
    const invalidLoadouts = [
        { Ship: 'sidewinder', FuelCapacity: { Main: -1, Reserve: 0 }, Modules: [] },
        { Ship: 'sidewinder', Modules: [{ Slot: 'MainEngines', Item: 'x', Priority: 5 }] },
        { Ship: 'sidewinder', Modules: [{ Slot: 'MainEngines', Item: 'x', Health: -0.1 }] },
        {
            Ship: 'sidewinder',
            Modules: [
                {
                    Slot: 'MainEngines',
                    Item: 'x',
                    Engineering: {
                        BlueprintName: 'Engine_Dirty',
                        Level: 6,
                        Quality: 1,
                        Modifiers: [],
                    },
                },
            ],
        },
        {
            Ship: 'sidewinder',
            Modules: [
                {
                    Slot: 'MainEngines',
                    Item: 'x',
                    Engineering: {
                        BlueprintName: 'Engine_Dirty',
                        Level: 5,
                        Quality: -0.1,
                        Modifiers: [],
                    },
                },
            ],
        },
    ];

    for (const loadout of invalidLoadouts) {
        assert.throws(() => parseSlef(loadout), TypeError);
    }
});

test('parseSlef rejects a non-Loadout journal event discriminator', () => {
    assert.throws(
        () => parseSlef({ event: 'FSDJump', Ship: 'sidewinder', Modules: [] }),
        TypeError,
    );
});

// ── Writing: toSlef / stringifySlef ─────────────────────────────────────────

const minimal: LoadoutEvent = { Ship: 'sidewinder', Modules: [] };

test('toSlef wraps a loadout with a header identifying this library', () => {
    const [entry] = toSlef(minimal);
    assert.equal(entry!.header.appName, LIBRARY_SLEF_HEADER.appName);
    assert.equal(entry!.header.appVersion, LIBRARY_SLEF_HEADER.appVersion);
    assert.equal(entry!.data.Ship, 'sidewinder');
});

test('toSlef credits a caller-supplied app', () => {
    const header = { appName: 'MyApp', appVersion: '1.2.0', appURL: 'https://example.test/b' };
    assert.deepEqual(toSlef(minimal, header)[0]!.header, header);
});

test('toSlef carries several builds in one export, in order', () => {
    const slef = toSlef([minimal, { Ship: 'anaconda', Modules: [] }]);
    assert.deepEqual(
        slef.map((e) => e.data.Ship),
        ['sidewinder', 'anaconda'],
    );
});

test('everything toSlef produces parses back', () => {
    const parsed = parseSlef(
        stringifySlef(toSlef(slefFixture[0]!.data as unknown as LoadoutEvent)),
    );
    assert.deepEqual(parsed[0]!.data, slefFixture[0]!.data);
});

test('stringifySlef is compact by default and indents on request', () => {
    const slef = toSlef(minimal);
    assert.doesNotMatch(stringifySlef(slef), /\n/);
    assert.match(stringifySlef(slef, { indent: 2 }), /\n {2}/);
});

test('toSlef rejects a loadout that parseSlef would not accept', () => {
    const invalid: unknown[] = [
        { Modules: [] }, // no Ship
        { Ship: 'sidewinder' }, // no Modules
        { Ship: 'sidewinder', Modules: [{ Slot: 'PowerPlant', Item: 'x', Priority: 9 }] },
        {
            Ship: 'sidewinder',
            Modules: [
                {
                    Slot: 'MainEngines',
                    Item: 'x',
                    Engineering: {
                        BlueprintName: 'Engine_Dirty',
                        Level: 6,
                        Quality: 1,
                        Modifiers: [],
                    },
                },
            ],
        },
    ];
    for (const loadout of invalid) {
        assert.throws(() => toSlef(loadout as LoadoutEvent), TypeError);
    }
});

test('toSlef rejects an empty export, which would not parse back', () => {
    assert.throws(() => toSlef([]), TypeError);
});

test('toSlef rejects a malformed header', () => {
    assert.throws(() => toSlef(minimal, { appName: 'x' } as unknown as SlefHeader), TypeError);
});

const fsdModule = slefFixture[0]!.data.Modules.find(
    (m) => m.Slot === 'FrameShiftDrive',
) as unknown as LoadoutModule;

test('getLoadoutModifier reads a numeric modifier case-insensitively', () => {
    assert.equal(getLoadoutModifier(fsdModule, 'FSDOptimalMass'), 7528.04);
    assert.equal(getLoadoutModifier(fsdModule, 'fsdoptimalmass'), 7528.04);
});

test('getLoadoutModifier returns null for an absent modifier or an unengineered module', () => {
    assert.equal(getLoadoutModifier(fsdModule, 'NoSuchLabel'), null);
    const fuelTank = slefFixture[0]!.data.Modules.find(
        (m) => m.Slot === 'FuelTank',
    ) as unknown as LoadoutModule;
    assert.equal(getLoadoutModifier(fuelTank, 'Mass'), null);
});
