import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseSlef,
    inspectSlef,
    getLoadoutModifier,
    toSlef,
    stringifySlef,
    type DecorativeModuleEngineering,
    type LoadoutEvent,
    type LoadoutModule,
    type SlefHeader,
} from './slef.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.jsonc' with { type: 'json' };

const slefString = JSON.stringify(slefFixture);
const TEST_HEADER: SlefHeader = { appName: 'Test', appVersion: '1.0.0' };

test('parseSlef accepts the SLEF JSON string', () => {
    const entries = parseSlef(slefString);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.header.appName, 'EDSY');
    assert.equal(entries[0]!.data.Ship, 'explorer_nx');
    assert.ok(entries[0]!.data.Modules.length > 0);
});

test('parseSlef accepts unknown parser input', () => {
    const input: unknown = slefFixture;
    const entries = parseSlef(input);
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

test('only a bare Loadout receives a synthetic header', () => {
    const data = { Ship: 'sidewinder', Modules: [] };
    for (const envelope of [{ data }, { header: null, data }]) {
        assert.throws(() => parseSlef(envelope), /entries\[0\]\.header/);
        assert.deepEqual(
            inspectSlef(envelope).diagnostics.map(({ code, path }) => ({ code, path })),
            [{ code: 'invalidHeader', path: 'entries[0].header' }],
        );
    }
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

test('parseSlef is strict while inspectSlef recovers valid entries with diagnostics', () => {
    const mixed = [
        { Ship: 'sidewinder', Modules: [] },
        { Ship: 'sidewinder', Modules: [{ Slot: 'PowerPlant', Item: 42 }] },
    ];
    assert.throws(() => parseSlef(mixed), /entries\[1\]\.Modules\[0\]\.Item/);
    const inspected = inspectSlef(mixed);
    assert.equal(inspected.entries.length, 1);
    assert.deepEqual(inspected.diagnostics, [
        {
            index: 1,
            code: 'invalidModule',
            path: 'entries[1].Modules[0].Item',
            constraint: 'stringRequired',
            message: 'entries[1].Modules[0].Item must be a string',
            params: {
                path: 'entries[1].Modules[0].Item',
                constraint: 'stringRequired',
            },
        },
    ]);
});

test('inspectSlef pinpoints invalid envelope and engineering fields', () => {
    const inspected = inspectSlef([
        { header: { appName: 3, appVersion: '1' }, data: { Ship: 'sidewinder', Modules: [] } },
        {
            Ship: 'sidewinder',
            Modules: [
                {
                    Slot: 'MainEngines',
                    Item: 'x',
                    Engineering: { BlueprintName: 'Engine_Dirty', Level: 6, Quality: 1 },
                },
            ],
        },
    ]);
    assert.deepEqual(
        inspected.diagnostics.map(({ code, path }) => ({ code, path })),
        [
            { code: 'invalidHeader', path: 'entries[0].header.appName' },
            { code: 'invalidEngineering', path: 'entries[1].Modules[0].Engineering.Level' },
        ],
    );
});

test('inspectSlef pinpoints every invalid modifier field', () => {
    const invalidFields = [
        ['Value', Number.NaN],
        ['OriginalValue', Number.POSITIVE_INFINITY],
        ['ValueStr', 4],
        ['LessIsGood', 2],
    ] as const;
    for (const [field, value] of invalidFields) {
        const diagnostic = inspectSlef({
            Ship: 'sidewinder',
            Modules: [
                {
                    Slot: 'MainEngines',
                    Item: 'x',
                    Engineering: {
                        BlueprintName: 'Engine_Dirty',
                        Level: 5,
                        Quality: 1,
                        Modifiers: [{ Label: 'Mass', [field]: value }],
                    },
                },
            ],
        }).diagnostics[0];
        assert.equal(diagnostic?.code, 'invalidEngineering');
        assert.equal(diagnostic?.path, `entries[0].Modules[0].Engineering.Modifiers[0].${field}`);
    }
});

test('grade-less decorative engineering is typed and parsed without fabricated fields', () => {
    const engineering: DecorativeModuleEngineering = {
        BlueprintName: 'Decorative_Red',
        Modifiers: [{ Label: 'Damage', Value: 0.06, OriginalValue: 6 }],
    };
    const loadout: LoadoutEvent = {
        Ship: 'krait_mkii',
        Modules: [
            {
                Slot: 'MediumHardpoint1',
                Item: 'Hpt_PulseLaser_Fixed_Small',
                Engineering: engineering,
            },
        ],
    };

    const parsed = parseSlef(loadout)[0]!.data.Modules[0]!.Engineering!;
    assert.deepEqual(parsed, engineering);
    assert.ok(!Object.hasOwn(parsed, 'Level'));
    assert.ok(!Object.hasOwn(parsed, 'Quality'));
    assert.deepEqual(toSlef(loadout, TEST_HEADER)[0]!.data, loadout);
});

test('a modification block is either fully graded or fully grade-less', () => {
    const engineering = (fields: Record<string, unknown>) => ({
        Ship: 'sidewinder',
        Modules: [
            {
                Slot: 'MainEngines',
                Item: 'x',
                Engineering: { BlueprintName: 'Decorative_Red', ...fields },
            },
        ],
    });

    for (const [fields, path] of [
        [{ Level: 1, Modifiers: [] }, 'Quality'],
        [{ Quality: 1, Modifiers: [] }, 'Level'],
        [{}, 'Modifiers'],
        [{ ExperimentalEffect: 'special_test', Modifiers: [] }, 'ExperimentalEffect'],
    ] as const) {
        assert.equal(
            inspectSlef(engineering(fields)).diagnostics[0]?.path,
            `entries[0].Modules[0].Engineering.${path}`,
        );
    }
});

test('duplicate slot keys are rejected case-insensitively', () => {
    const duplicate = {
        Ship: 'sidewinder',
        Modules: [
            { Slot: 'PowerPlant', Item: 'a' },
            { Slot: 'powerplant', Item: 'b' },
        ],
    };
    assert.throws(() => parseSlef(duplicate), /duplicate slot "powerplant"/);
    assert.deepEqual(inspectSlef(duplicate).diagnostics[0], {
        index: 0,
        code: 'duplicateSlot',
        path: 'entries[0].Modules[1].Slot',
        constraint: 'uniqueSlot',
        message: 'Entry 0 contains duplicate slot "powerplant"',
        params: { index: 0, slot: 'powerplant' },
    });
    assert.ok(Object.isFrozen(inspectSlef(duplicate).diagnostics[0]?.params));
});

test('duplicate-slot diagnostics abbreviate the slot copied from a capture', () => {
    const slot = 's'.repeat(20_000);
    const duplicate = {
        Ship: 'sidewinder',
        Modules: [
            { Slot: slot, Item: 'a' },
            { Slot: slot, Item: 'b' },
        ],
    };
    const diagnostic = inspectSlef(duplicate).diagnostics[0]!;
    assert.ok(diagnostic.message.length < 200);
    assert.match(diagnostic.message, /duplicate slot "s+…"$/);
    assert.throws(
        () => parseSlef(duplicate),
        ({ message }: Error) => {
            assert.ok(message.length < 200);
            assert.match(message, /duplicate slot "s+…"$/);
            return true;
        },
    );
    assert.throws(
        () => toSlef(duplicate, TEST_HEADER),
        ({ message }: Error) => {
            assert.ok(message.length < 200);
            assert.match(message, /duplicate slot "s+…"$/);
            return true;
        },
    );
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

test('toSlef wraps a loadout with the required exporter header', () => {
    const [entry] = toSlef(minimal, TEST_HEADER);
    assert.deepEqual(entry!.header, TEST_HEADER);
    assert.equal(entry!.data.Ship, 'sidewinder');
});

test('toSlef credits a caller-supplied app', () => {
    const header = { appName: 'MyApp', appVersion: '1.2.0', appURL: 'https://example.test/b' };
    assert.deepEqual(toSlef(minimal, header)[0]!.header, header);
});

test('toSlef carries several builds in one export, in order', () => {
    const slef = toSlef([minimal, { Ship: 'anaconda', Modules: [] }], TEST_HEADER);
    assert.deepEqual(
        slef.map((e) => e.data.Ship),
        ['sidewinder', 'anaconda'],
    );
});

test('everything toSlef produces parses back', () => {
    const parsed = parseSlef(
        stringifySlef(toSlef(slefFixture[0]!.data as unknown as LoadoutEvent, TEST_HEADER)),
    );
    assert.deepEqual(parsed[0]!.data, slefFixture[0]!.data);
});

test('stringifySlef is compact by default and indents on request', () => {
    const slef = toSlef(minimal, TEST_HEADER);
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
        assert.throws(() => toSlef(loadout as LoadoutEvent, TEST_HEADER), TypeError);
    }
});

/**
 * The example from the Inara SLEF specification, <https://inara.cz/elite/inara-impexp-slef/>,
 * verbatim. Only `Ship`, `Modules`, `Slot` and `Item` are required: its engineered
 * module states no `Modifiers`, and its second module lower-cases both slot and item.
 */
const SPEC_EXAMPLE = [
    {
        header: {
            appName: 'Inara',
            appVersion: '1.0',
            appURL: 'https://inara.cz/cmdr-fleet/1/32243/',
            appCustomProperties: { anything: 'here' },
        },
        data: {
            Ship: 'Anaconda',
            Modules: [
                {
                    Slot: 'HugeHardpoint1',
                    Item: 'Hpt_BeamLaser_Gimbal_Huge',
                    Engineering: {
                        BlueprintName: 'Weapon_LightWeight',
                        Level: 4,
                        Quality: 0.95,
                        ExperimentalEffect: 'special_corrosive_shell',
                    },
                },
                { Slot: 'largehardpoint1', Item: 'hpt_multicannon_gimbal_large' },
            ],
        },
    },
];

test('the specification’s own example parses, Modifiers and all', () => {
    // Engineering without a Modifiers array is the case worth pinning: a journal always
    // writes one, so it is easy to require it and then be unable to read the format.
    const [entry] = parseSlef(SPEC_EXAMPLE);
    assert.equal(entry!.header.appName, 'Inara');
    assert.equal(entry!.data.Modules.length, 2);
    const engineered = entry!.data.Modules[0]!.Engineering!;
    assert.equal(engineered.BlueprintName, 'Weapon_LightWeight');
    assert.equal(engineered.Modifiers, undefined);
});

test('a blueprint that states no Modifiers survives toSlef and a round trip', () => {
    const loadout = SPEC_EXAMPLE[0]!.data as unknown as LoadoutEvent;
    const wrapped = toSlef(loadout, TEST_HEADER);
    assert.deepEqual(parseSlef(stringifySlef(wrapped))[0]!.data, loadout);
    // Absent, not an invented empty array — "not stated" is not "changed nothing".
    assert.equal(
        Object.hasOwn(
            parseSlef(stringifySlef(wrapped))[0]!.data.Modules[0]!.Engineering!,
            'Modifiers',
        ),
        false,
    );
});

test('getLoadoutModifier returns null when the blueprint states no modifiers', () => {
    assert.equal(
        getLoadoutModifier(SPEC_EXAMPLE[0]!.data.Modules[0]! as LoadoutModule, 'Mass'),
        null,
    );
});

test('toSlef rejects an empty export, which would not parse back', () => {
    assert.throws(() => toSlef([], TEST_HEADER), TypeError);
});

test('toSlef names the duplicate slot in its refusal', () => {
    // The two spellings differ from each other *and* from the normalized key, so the
    // assertion pins which string reaches the message: the second module's own
    // casing. A lower-cased fixture would pass whether the refusal reported the raw
    // slot or the comparison key, and reporting the record whole would say
    // `[object Object]`.
    const duplicate: LoadoutEvent = {
        Ship: 'sidewinder',
        Modules: [
            { Slot: 'PowerPlant', Item: 'a' },
            { Slot: 'PowerPLANT', Item: 'b' },
        ],
    };
    assert.throws(() => toSlef(duplicate, TEST_HEADER), {
        name: 'TypeError',
        message: /duplicate slot "PowerPLANT"/,
    });
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
