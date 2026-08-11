import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ShipLoadout } from './ship-loadout.js';
import { SourcePurchaseRecord, type SourceModuleValue } from './source-purchase.js';
import type { LoadoutEvent } from './slef.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import expected from '../../../fixtures/ships/source-purchase.jsonc' with { type: 'json' };
import exportFixture from '../../../fixtures/ships/slef-export.jsonc' with { type: 'json' };
import deepBlackSlef from '../../../fixtures/ships/slef-the-deep-black.jsonc' with { type: 'json' };
import viperJournal from '../../../fixtures/ships/journal-viper-mkiv.jsonc' with { type: 'json' };
import caspianJournal from '../../../fixtures/ships/journal-caspian-explorer.jsonc' with { type: 'json' };
import kraitJournal from '../../../fixtures/ships/journal-krait-phantom.jsonc' with { type: 'json' };

const module = (symbol: string) => getModuleBySymbol(symbol, ALL_MODULES)!;

const deepBlackEvent = deepBlackSlef[0]!.data as unknown as LoadoutEvent;
const viperEvent = viperJournal as unknown as LoadoutEvent;
const caspianEvent = caspianJournal as unknown as LoadoutEvent;
const kraitEvent = kraitJournal as unknown as LoadoutEvent;

/** The captures the fixture pins, by its own key. */
const CAPTURES: Record<string, LoadoutEvent> = {
    deepBlack: deepBlackEvent,
    viperMkIV: viperEvent,
    caspianExplorer: caspianEvent,
    kraitPhantom: kraitEvent,
};

// ── The fixture, as this suite reads it ─────────────────────────────────────

interface ExpectedRecord {
    readonly hullValue: number | null;
    readonly modulesValue: number | null;
    readonly rebuy: number | null;
    readonly moduleCount: number;
    readonly pricedModulesValue: number;
    readonly moduleValues: readonly SourceModuleValue[];
}

interface Edit {
    readonly setModule?: { readonly slot: string; readonly symbol: string };
    readonly removeModule?: { readonly slot: string };
    readonly applyBlueprint?: {
        readonly slot: string;
        readonly blueprint: string;
        readonly grade: number;
    };
}

interface Fixture {
    readonly captures: Record<
        string,
        {
            readonly record: ExpectedRecord;
            readonly sourceExport: {
                readonly topLevelCredits: Record<string, number>;
                readonly pricedSlots: Record<string, number>;
            };
        }
    >;
    readonly syntheticCaptures: Record<
        string,
        { readonly event: LoadoutEvent; readonly record: ExpectedRecord | null }
    >;
    readonly editedExports: {
        readonly groups: Record<
            string,
            {
                readonly scenarios: Record<
                    string,
                    {
                        readonly edits: readonly Edit[];
                        readonly topLevelCredits: Record<string, number>;
                        readonly unpricedSlots: readonly string[];
                        readonly unpricedNewSlots?: readonly string[];
                    }
                >;
            }
        >;
    };
}

const fixture = expected as unknown as Fixture;

/** The record's fixture-shaped form, for a whole-record comparison. */
const shapeOf = (record: SourcePurchaseRecord) => ({
    hullValue: record.hullValue,
    modulesValue: record.modulesValue,
    rebuy: record.rebuy,
    moduleCount: record.moduleCount,
    pricedModulesValue: record.pricedModulesValue,
    moduleValues: record.moduleValues.map((entry) => ({ ...entry })),
});

/** Only the credit keys an exported event carries, in the fixture's shape. */
const creditsOf = (event: LoadoutEvent): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const key of ['HullValue', 'ModulesValue', 'Rebuy'] as const) {
        if (event[key] !== undefined) out[key] = event[key];
    }
    return out;
};

/** Every slot an exported event prices, and what it prices it at. */
const pricedSlotsOf = (event: LoadoutEvent): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const m of event.Modules) if (m.Value !== undefined) out[m.Slot] = m.Value;
    return out;
};

const applyEdits = (build: ShipLoadout, edits: readonly Edit[]): void => {
    for (const edit of edits) {
        if (edit.setModule) build.setModule(edit.setModule.slot, module(edit.setModule.symbol));
        else if (edit.removeModule) build.removeModule(edit.removeModule.slot);
        else if (edit.applyBlueprint) {
            build.applyBlueprint(edit.applyBlueprint.slot, edit.applyBlueprint.blueprint, {
                grade: edit.applyBlueprint.grade,
            });
        } else assert.fail(`unrecognised edit: ${JSON.stringify(edit)}`);
    }
};

// ── The record a capture arrives with ───────────────────────────────────────

for (const [name, event] of Object.entries(CAPTURES)) {
    test(`${name}: the source purchase record is the capture's own credit figures`, () => {
        const record = ShipLoadout.fromLoadout(event).sourcePurchase;
        assert.ok(record, 'a capture quoting credits has a record');
        assert.deepEqual(shapeOf(record), fixture.captures[name]!.record);
    });
}

for (const [name, { event, record }] of Object.entries(fixture.syntheticCaptures)) {
    test(`${name}: a hand-written capture records what it states and nothing more`, () => {
        const captured = SourcePurchaseRecord.fromLoadout(event);
        if (record === null) {
            assert.equal(captured, null);
            // …and a build loading the same event reports none either.
            assert.equal(ShipLoadout.fromLoadout(event).sourcePurchase, null);
            return;
        }
        assert.ok(captured);
        assert.deepEqual(shapeOf(captured), record);
        if (name === 'repeatedSlotKey') {
            // The source-record extractor can inspect malformed source data directly,
            // but a loadout cannot represent two modules in one mount and rejects it.
            assert.throws(() => ShipLoadout.fromLoadout(event), /duplicate slot/);
            return;
        }
        assert.deepEqual(shapeOf(ShipLoadout.fromLoadout(event).sourcePurchase!), record);
    });
}

test("the two fixtures that hold a capture's source totals agree", () => {
    // `slef-export.jsonc` states them to show how far retail is from what was paid;
    // `source-purchase.jsonc` states them as the record itself. Nothing else stops the
    // pair drifting apart.
    const discounts = exportFixture as unknown as Record<
        string,
        {
            discount?: {
                sourceHullValue?: number;
                sourceModulesValue?: number;
                sourceRebuy?: number;
            };
        }
    >;
    let compared = 0;
    for (const [name, { record }] of Object.entries(fixture.captures)) {
        const discount = discounts[name]?.discount;
        if (!discount) continue;
        compared += 1;
        assert.deepEqual(
            {
                sourceHullValue: discount.sourceHullValue,
                sourceModulesValue: discount.sourceModulesValue,
                sourceRebuy: discount.sourceRebuy,
            },
            {
                sourceHullValue: record.hullValue ?? undefined,
                sourceModulesValue: record.modulesValue ?? undefined,
                sourceRebuy: record.rebuy ?? undefined,
            },
            `${name} totals disagree between the two fixtures`,
        );
    }
    assert.ok(compared >= 3, `expected several shared captures, compared ${compared}`);
});

test('a SLEF import and the bare event it wraps capture the same record', () => {
    const fromSlef = ShipLoadout.fromSlef(JSON.stringify(deepBlackSlef)).sourcePurchase!;
    const fromEvent = ShipLoadout.fromLoadout(deepBlackEvent).sourcePurchase!;
    assert.deepEqual(shapeOf(fromSlef), shapeOf(fromEvent));
});

test('a build assembled from the catalogues has no source to record', () => {
    const build = ShipLoadout.empty('Anaconda');
    build.setModule('PowerPlant', module('Int_Powerplant_Size8_Class5'));
    assert.equal(build.sourcePurchase, null);
});

// ── Reading one slot back ───────────────────────────────────────────────────

test('a slot is priced by either spelling of its key', () => {
    const record = ShipLoadout.fromLoadout(kraitEvent).sourcePurchase!;
    const stated = kraitEvent.Modules.find((m) => m.Value !== undefined)!;
    assert.equal(record.valueForSlot(stated.Slot), stated.Value);
    assert.equal(record.valueForSlot(stated.Slot.toLowerCase()), stated.Value);
    assert.equal(record.valueForSlot(stated.Slot.toUpperCase()), stated.Value);
    assert.equal(record.entryForSlot(stated.Slot)?.item, stated.Item);
});

test('a slot the source left unpriced is null, and so is a slot it never named', () => {
    const record = ShipLoadout.fromLoadout(caspianEvent).sourcePurchase!;
    const unpriced = caspianEvent.Modules.find((m) => m.Value === undefined)!;
    // Unpriced is not free: a decoration never costs credits, but a journal also omits
    // `Value` on modules that came with the hull and on some that were bought.
    assert.equal(record.valueForSlot(unpriced.Slot), null);
    assert.equal(record.entryForSlot(unpriced.Slot), null);
    assert.equal(record.valueForSlot('NoSuchSlot42'), null);
});

test('a capture spelling one mount two ways is rejected before prices become ambiguous', () => {
    const event: LoadoutEvent = {
        Ship: 'sidewinder',
        Modules: [
            { Slot: 'PowerPlant', Item: 'int_powerplant_size2_class1', Value: 10 },
            { Slot: 'powerplant', Item: 'int_powerplant_size2_class3', Value: 30 },
        ],
    };
    assert.throws(() => ShipLoadout.fromLoadout(event), /duplicate slot "powerplant"/);
});

// ── The record is fixed at import ───────────────────────────────────────────

test('editing a build leaves its source purchase record untouched', () => {
    const build = ShipLoadout.fromSlef(JSON.stringify(deepBlackSlef));
    const record = build.sourcePurchase!;
    const before = shapeOf(record);
    const drive = build.slots().find((slot) => slot.core === 'frameShiftDrive')!;
    const pricedSlot = record.moduleValues[0]!.slot;

    build.setModule(drive.key, module('Int_Hyperdrive_Size6_Class3'));
    build.removeModule(pricedSlot);

    // The live figures are gone — no catalogue records what a replaced module was paid
    // for — while the capture's own record stands.
    assert.equal(build.modulesValue, null);
    assert.equal(build.rebuy, null);
    assert.equal(build.sourcePurchase, record);
    assert.deepEqual(shapeOf(build.sourcePurchase!), before);
    assert.equal(build.sourcePurchase!.valueForSlot(pricedSlot), before.moduleValues[0]!.value);
});

test('the record and everything in it is frozen', () => {
    const record = ShipLoadout.fromLoadout(viperEvent).sourcePurchase!;
    assert.ok(Object.isFrozen(record));
    assert.ok(Object.isFrozen(record.moduleValues));
    assert.ok(Object.isFrozen(record.moduleValues[0]));
    assert.throws(() => {
        (record as { hullValue: number }).hullValue = 1;
    }, TypeError);
    assert.throws(() => {
        (record.moduleValues as SourceModuleValue[]).push(record.moduleValues[0]!);
    }, TypeError);
});

test('the record does not alias the event it was captured from', () => {
    const event: LoadoutEvent = {
        Ship: 'sidewinder',
        HullValue: 32000,
        Modules: [{ Slot: 'PowerPlant', Item: 'int_powerplant_size2_class1', Value: 1234 }],
    };
    const record = SourcePurchaseRecord.fromLoadout(event)!;
    (event.Modules as unknown as { Value?: number }[])[0]!.Value = 9999;
    assert.equal(record.valueForSlot('PowerPlant'), 1234);
});

// ── Exporting the record instead of retail ──────────────────────────────────

for (const [name, event] of Object.entries(CAPTURES)) {
    test(`${name}: an unedited capture re-exports its own credit figures`, () => {
        const exported = ShipLoadout.fromLoadout(event).toLoadoutEvent({ credits: 'source' });
        const wanted = fixture.captures[name]!.sourceExport;
        assert.deepEqual(creditsOf(exported), wanted.topLevelCredits);
        assert.deepEqual(pricedSlotsOf(exported), wanted.pricedSlots);
    });
}

test('a partially priced capture fills in neither the missing total nor the missing slots', () => {
    // 16 of the Caspian Explorer's 35 entries carry no `Value`, and it states no
    // `HullValue`. The catalogue could price both, and deliberately does not.
    const exported = ShipLoadout.fromLoadout(caspianEvent).toLoadoutEvent({ credits: 'source' });
    assert.equal('HullValue' in exported, false);
    assert.equal(exported.Modules.filter((m) => m.Value === undefined).length, 16);
    assert.notEqual(
        ShipLoadout.fromLoadout(caspianEvent).toLoadoutEvent().HullValue,
        undefined,
        'the retail export does price the hull',
    );
});

test('a discounted capture exports what it paid, not what the catalogue charges', () => {
    // Every priced module on this build sits at 0.8775 of list, and no source says so.
    const build = ShipLoadout.fromLoadout(deepBlackEvent);
    const paid = build.toLoadoutEvent({ credits: 'source' });
    const retail = build.toLoadoutEvent();

    assert.notEqual(paid.ModulesValue, retail.ModulesValue);
    const slot = build.sourcePurchase!.moduleValues[0]!.slot;
    const paidValue = paid.Modules.find((m) => m.Slot === slot)!.Value!;
    const retailValue = retail.Modules.find((m) => m.Slot === slot)!.Value!;
    assert.equal(paidValue, build.sourcePurchase!.valueForSlot(slot));
    assert.ok(paidValue < retailValue);
});

for (const [capture, group] of Object.entries(fixture.editedExports.groups)) {
    // A group names either a real capture or one of the hand-written ones.
    const event = CAPTURES[capture] ?? fixture.syntheticCaptures[capture]!.event;
    for (const [name, scenario] of Object.entries(group.scenarios)) {
        test(`editing ${capture} then exporting its source record: ${name}`, () => {
            const build = ShipLoadout.fromLoadout(event);
            const record = build.sourcePurchase!;
            applyEdits(build, scenario.edits);
            const exported = build.toLoadoutEvent({ credits: 'source' });
            const priced = pricedSlotsOf(exported);

            assert.deepEqual(creditsOf(exported), scenario.topLevelCredits);
            assert.deepEqual(
                record.moduleValues.filter((e) => priced[e.slot] === undefined).map((e) => e.slot),
                [...scenario.unpricedSlots],
            );
            // Every slot still holding the article the capture priced keeps its figure,
            // and nothing else is priced at all.
            const stillPriced = record.moduleValues.filter(
                (e) => !scenario.unpricedSlots.includes(e.slot),
            );
            assert.deepEqual(
                priced,
                Object.fromEntries(stillPriced.map((e) => [e.slot, e.value])),
                'only the capture-priced articles still fitted carry a value',
            );
            for (const slot of scenario.unpricedNewSlots ?? []) {
                const fitted = exported.Modules.find((m) => m.Slot === slot);
                assert.ok(fitted, `${slot} is in the export`);
                assert.equal(fitted.Value, undefined, `${slot} exports unpriced`);
            }
            // And the record itself is the same one throughout.
            assert.equal(build.sourcePurchase, record);
        });
    }
}

test('a total the capture built from an unpriced module outlives that module', () => {
    // The one thing the article test cannot catch, pinned as
    // `editedExports.groups.partsDoNotAddUp` and stated in the export's documentation:
    // when a capture's total counted a module it never priced, removing that module
    // leaves the total standing over parts that no longer reach it. The record has no way
    // to know which unpriced module the total covered — only the capture did.
    const event = fixture.syntheticCaptures.partsDoNotAddUp!.event;
    const build = ShipLoadout.fromLoadout(event);
    build.removeModule('Slot01_Size4');
    const exported = build.toLoadoutEvent({ credits: 'source' });

    assert.equal(exported.ModulesValue, 4940956);
    const reimported = ShipLoadout.fromLoadout(exported).sourcePurchase!;
    assert.equal(reimported.modulesValue, 4940956);
    assert.equal(reimported.pricedModulesValue, 3942898);
});

test('a build with no source record exports no credits rather than falling back', () => {
    const build = ShipLoadout.empty('Sidewinder');
    build.setModule('PowerPlant', module('Int_Powerplant_Size2_Class1'));
    const event = build.toLoadoutEvent({ credits: 'source' });

    assert.deepEqual(creditsOf(event), {});
    assert.equal(event.Modules[0]!.Value, undefined);
    // The physical figures are still recomputed as they always are.
    assert.ok((event.UnladenMass ?? 0) > 0);
});

test('asking for the source record changes nothing but the credits', () => {
    const build = ShipLoadout.fromLoadout(viperEvent);
    const paid = build.toLoadoutEvent({ credits: 'source' });
    const retail = build.toLoadoutEvent();

    assert.equal(paid.UnladenMass, retail.UnladenMass);
    assert.equal(paid.CargoCapacity, retail.CargoCapacity);
    assert.equal(paid.MaxJumpRange, retail.MaxJumpRange);
    assert.deepEqual(paid.FuelCapacity, retail.FuelCapacity);
    assert.deepEqual(
        paid.Modules.map((m) => m.Item),
        retail.Modules.map((m) => m.Item),
    );
});

test('the credits are chosen independently of module order and power state', () => {
    const build = ShipLoadout.fromLoadout(deepBlackEvent);
    const plain = build.toLoadoutEvent({ credits: 'source' });
    for (const options of [
        { credits: 'source', moduleOrder: 'slots' },
        { credits: 'source', explicitPower: true },
        { credits: 'source', moduleOrder: 'slots', explicitPower: true },
    ] as const) {
        const event = build.toLoadoutEvent(options);
        assert.deepEqual(creditsOf(event), creditsOf(plain));
        assert.deepEqual(pricedSlotsOf(event), pricedSlotsOf(plain));
    }
});

test('the default export still quotes retail on a build that has a record', () => {
    const build = ShipLoadout.fromLoadout(deepBlackEvent);
    assert.deepEqual(build.toLoadoutEvent(), build.toLoadoutEvent({ credits: 'retail' }));
    assert.notEqual(build.toLoadoutEvent().ModulesValue, deepBlackEvent.ModulesValue);
});

test('a source-record SLEF string carries the captured figures', () => {
    const build = ShipLoadout.fromLoadout(kraitEvent);
    const written = JSON.parse(
        build.toSlefString({
            credits: 'source',
            header: { appName: 'Test', appVersion: '1.0.0' },
        }),
    ) as {
        data: LoadoutEvent;
    }[];
    assert.equal(written[0]!.data.HullValue, kraitEvent.HullValue);
    assert.equal(written[0]!.data.Rebuy, kraitEvent.Rebuy);
});

test('re-importing a source-record export carries the record forward', () => {
    // The export is a capture in its own right, so reading it back records the same
    // purchase — which is what makes the round trip a way to hand the provenance on.
    const build = ShipLoadout.fromLoadout(deepBlackEvent);
    const reimported = ShipLoadout.fromLoadout(build.toLoadoutEvent({ credits: 'source' }));
    assert.deepEqual(shapeOf(reimported.sourcePurchase!), shapeOf(build.sourcePurchase!));
});

test('an edited build re-exports a record whose parts still add up', () => {
    // The point of dropping the totals rather than echoing them: a document this library
    // wrote must not claim a `ModulesValue` its own parts contradict, because on re-import
    // that reads exactly like a capture whose owner bought a module the journal missed.
    const build = ShipLoadout.fromLoadout(deepBlackEvent);
    build.setModule('Slot13_Size1', module('Int_DockingComputer_Standard'));
    const reimported = ShipLoadout.fromLoadout(build.toLoadoutEvent({ credits: 'source' }));
    const record = reimported.sourcePurchase!;

    assert.equal(record.modulesValue, null);
    assert.equal(record.rebuy, null);
    assert.equal(record.hullValue, deepBlackEvent.HullValue);
    assert.equal(record.pricedModulesValue, build.sourcePurchase!.pricedModulesValue - 8003);
});
