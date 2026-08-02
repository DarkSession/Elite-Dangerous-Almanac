import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ShipLoadout } from './ship-loadout.js';
import { parseSlef, type LoadoutEvent, type LoadoutModule } from './slef.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.json' with { type: 'json' };
import kraitJournal from '../../../fixtures/ships/journal-krait-phantom.json' with { type: 'json' };
import fixture from '../../../fixtures/ships/slef-export.json' with { type: 'json' };
import jumpFixture from '../../../fixtures/ships/jump-range.json' with { type: 'json' };

const slefString = JSON.stringify(slefFixture);
const source = slefFixture[0]!.data as unknown as LoadoutEvent;

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const module = (symbol: string) => getModuleBySymbol(symbol, ALL_MODULES)!;

/** The recomputed figures, rounded the way the fixture stores them. */
const figuresOf = (event: LoadoutEvent, wanted: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(wanted)) {
        const value = (event as unknown as Record<string, unknown>)[key];
        out[key] = typeof value === 'number' ? round6(value) : value;
    }
    return out;
};

// ── Round-tripping a real export ────────────────────────────────────────────

test('a SLEF export survives a round trip through toSlef', () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    const parsed = parseSlef(ShipLoadout.fromSlef(slefString).toSlefString());

    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.data.Ship, source.Ship);
    assert.deepEqual(
        parsed[0]!.data.Modules.map((m) => m.Slot),
        source.Modules.map((m) => m.Slot),
    );
    assert.deepEqual(
        event.Modules.map((m) => m.Item),
        source.Modules.map((m) => m.Item),
    );
});

test('exporting is idempotent — re-importing an export re-exports identically', () => {
    const once = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    const twice = ShipLoadout.fromLoadout(once).toLoadoutEvent();
    assert.deepEqual(twice, once);
});

test('engineering survives the round trip intact', () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    const exported = event.Modules.find((m) => m.Slot === 'FrameShiftDrive')!;
    const original = source.Modules.find((m) => m.Slot === 'FrameShiftDrive')!;
    assert.deepEqual(exported.Engineering, original.Engineering);
});

// ── The recomputed figures reproduce the game's own ──────────────────────────

test(`the export emits ${fixture.deepBlack.topLevelKeys.length} top-level keys, in journal order`, () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    assert.deepEqual(Object.keys(event), fixture.deepBlack.topLevelKeys);
    assert.equal(event.Modules.length, fixture.deepBlack.moduleCount);
});

test('every recomputed figure matches the exported build’s own', () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    assert.deepEqual(figuresOf(event, fixture.deepBlack.recomputed), fixture.deepBlack.recomputed);
});

test('the recomputed figures are the journal’s, not our own invention', () => {
    // The fixture's expectations are the real export's values, so pinning them here
    // means a catalogue regression fails this test rather than being rubber-stamped.
    const expected = fixture.deepBlack.recomputed;
    assert.equal(expected.HullValue, source.HullValue);
    assert.equal(expected.ModulesValue, source.ModulesValue);
    assert.equal(expected.UnladenMass, source.UnladenMass);
    assert.equal(expected.CargoCapacity, source.CargoCapacity);
    assert.equal(expected.MaxJumpRange, source.MaxJumpRange);
    assert.equal(expected.Rebuy, source.Rebuy);
    assert.deepEqual(expected.FuelCapacity, source.FuelCapacity);
});

test('rebuy is a flat 5% of hull plus modules, truncated', () => {
    const { HullValue, ModulesValue, Rebuy } = fixture.deepBlack.recomputed;
    assert.equal(Math.trunc((HullValue + ModulesValue) * fixture.rebuyFraction), Rebuy);
});

// ── A real journal capture, cosmetics and all ────────────────────────────────

const krait = kraitJournal as unknown as LoadoutEvent;

test('a real journal Loadout event reproduces every figure the game reported', () => {
    const event = ShipLoadout.fromLoadout(krait).toLoadoutEvent();
    assert.deepEqual(Object.keys(event), fixture.kraitPhantom.topLevelKeys);
    assert.deepEqual(
        figuresOf(event, fixture.kraitPhantom.recomputed),
        fixture.kraitPhantom.recomputed,
    );
});

test('the journal’s own rounded figures agree with ours', () => {
    // The game writes fewer decimals than it computes with, so compare loosely — but
    // against Frontier's numbers, which is the strongest ground truth available.
    const event = ShipLoadout.fromLoadout(krait).toLoadoutEvent();
    const { journalTolerance } = fixture.kraitPhantom;
    assert.ok(Math.abs(event.UnladenMass! - journalTolerance.UnladenMass) < 1e-4);
    assert.ok(Math.abs(event.MaxJumpRange! - journalTolerance.MaxJumpRange) < 1e-4);
    assert.equal(krait.HullValue, fixture.kraitPhantom.recomputed.HullValue);
    assert.equal(krait.ModulesValue, fixture.kraitPhantom.recomputed.ModulesValue);
    assert.equal(krait.Rebuy, fixture.kraitPhantom.recomputed.Rebuy);
    assert.equal(krait.CargoCapacity, fixture.kraitPhantom.recomputed.CargoCapacity);
});

test('cosmetics and hull geometry weigh nothing and cost nothing', () => {
    // A journal lists the cockpit, ship kit, nameplates, bobbles, paint and voice pack
    // alongside the fitted modules. None is an outfitting module, so none may be treated
    // as an unknown — that would make a whole build's mass and value incomputable.
    assert.equal(krait.Modules.length, fixture.kraitPhantom.moduleCount);
    const cosmetic = fixture.kraitPhantom.nonOutfittingSlots;
    assert.deepEqual(
        krait.Modules.map((m) => m.Slot).filter((s) => cosmetic.includes(s)),
        cosmetic,
    );

    const withoutCosmetics: LoadoutEvent = {
        ...krait,
        Modules: krait.Modules.filter((m) => !cosmetic.includes(m.Slot)),
    };
    const bare = ShipLoadout.fromLoadout(withoutCosmetics).toLoadoutEvent();
    const dressed = ShipLoadout.fromLoadout(krait).toLoadoutEvent();
    assert.equal(bare.UnladenMass, dressed.UnladenMass);
    assert.equal(bare.ModulesValue, dressed.ModulesValue);
});

test('the jump figures for a real journal build match the fixture', () => {
    const build = ShipLoadout.fromLoadout(krait);
    const pinned = jumpFixture.builds.kraitPhantom;
    assert.deepEqual(
        {
            optMass: round6(build.frameShiftDrive.optMass),
            maxFuel: build.frameShiftDrive.maxFuel,
            fuelMul: build.frameShiftDrive.fuelMul,
            fuelPower: build.frameShiftDrive.fuelPower,
            jumpBoost: build.frameShiftDrive.jumpBoost,
        },
        pinned.frameShiftDrive,
    );

    const summary = build.jumpRangeSummary();
    assert.equal(round6(summary.max), pinned.maxJumpRange);
    assert.equal(round6(summary.unladen), pinned.unladenJumpRange);
    assert.equal(round6(summary.laden), pinned.ladenJumpRange);
    assert.equal(round6(summary.totalUnladen), pinned.totalUnladenRange);
    assert.equal(round6(summary.totalLaden), pinned.totalLadenRange);

    // …and the game's own MaxJumpRange, which is what makes the above trustworthy.
    assert.ok(Math.abs(summary.max - pinned.sourceMaxJumpRange) < 1e-4);
    assert.equal(pinned.sourceMaxJumpRange, krait.MaxJumpRange);
});

test('a stated price is trusted over the catalogue, but not across an edit', () => {
    // Prices record a purchase — the station discount, and which hull convention the
    // exporter used — so they are read from the build, not rebuilt from list prices.
    // Editing the fit invalidates that, and only then are they derived.
    const build = ShipLoadout.fromLoadout(krait);
    assert.equal(build.toLoadoutEvent().ModulesValue, krait.ModulesValue);

    build.removeModule('Slot05_Size3');
    const edited = build.toLoadoutEvent();
    assert.notEqual(edited.ModulesValue, krait.ModulesValue);
    assert.ok(edited.ModulesValue! < krait.ModulesValue!, 'removing a module must cost less');
    assert.equal(
        edited.Rebuy,
        Math.trunc((edited.HullValue! + edited.ModulesValue!) * fixture.rebuyFraction),
    );
});

test('a module fitted into an empty slot is priced, not treated as a hull freebie', () => {
    // A missing `Value` means two different things: "came free with the hull" on an
    // imported module, and "we have not priced it yet" on one fitted here. Conflating
    // them made an added module cost nothing.
    const before = ShipLoadout.fromSlef(slefString).toLoadoutEvent().ModulesValue!;
    const build = ShipLoadout.fromSlef(slefString);
    const tank = module('Int_FuelTank_Size5_Class3');
    build.setModule('Slot04_Size5', tank);
    assert.equal(build.toLoadoutEvent().ModulesValue! - before, tank.cost);
});

test('a build whose stated prices do not add up will not invent a total', () => {
    // Older journals omit `Value` on modules that were nonetheless paid for, so their
    // per-module sum falls short of the total the same event declares. An unpriced
    // module there means "we were not told", not "free with the hull" — costing it at
    // nothing would under-report the build by millions.
    let kept = 0;
    const partiallyPriced: LoadoutEvent = {
        ...krait,
        Modules: krait.Modules.map((m) => {
            if (m.Value === undefined || kept++ < 2) return m;
            const stripped: Record<string, unknown> = { ...m };
            delete stripped.Value;
            return stripped as unknown as LoadoutModule;
        }),
    };
    const build = ShipLoadout.fromLoadout(partiallyPriced);
    assert.equal(build.toLoadoutEvent().ModulesValue, krait.ModulesValue, 'stated total stands');

    build.removeModule('Slot05_Size3');
    const edited = build.toLoadoutEvent();
    // Now derived. The catalogue's list prices are not the discounted figures the
    // journal recorded, so this cannot be exact — but it must be the right ship, not a
    // near-empty one. Anything below the journal's own total minus the module removed
    // would mean unpriced modules were silently costed at nothing.
    const removed = krait.Modules.find((m) => m.Slot === 'Slot05_Size3')!.Value!;
    assert.ok(
        edited.ModulesValue! > krait.ModulesValue! - removed,
        `derived ModulesValue ${edited.ModulesValue} dropped below the discounted total`,
    );
});

test('a build survives repeated export/import hops without its price drifting', () => {
    // An export must reconcile with itself: the `Value`s it writes have to add up to
    // the `ModulesValue` it declares. If they do not, re-importing cannot tell a free
    // hull fitting from one we priced, and every hop re-prices the stock modules that
    // `HullValue` already covers.
    const drive = module('Int_ShieldGenerator_Size3_Class3');
    let event: LoadoutEvent = krait;
    const seen: (number | undefined)[] = [];
    for (let hop = 0; hop < 3; hop++) {
        const build = ShipLoadout.fromLoadout(event);
        build.setModule('Slot05_Size3', drive);
        event = build.toLoadoutEvent();
        seen.push(event.ModulesValue);

        const summed = event.Modules.reduce((total, m) => total + (m.Value ?? 0), 0);
        assert.equal(summed, event.ModulesValue, `hop ${hop}: export does not add up`);
    }
    assert.deepEqual(seen, [seen[0], seen[0], seen[0]], 'ModulesValue drifted across hops');
});

test('an unknown capacity is omitted rather than reported as zero', () => {
    // A rack the catalogues do not know cannot be summed, and a hull they do not know
    // has no reserve — reporting either as 0 would silently contradict the import.
    const unknownRack = ShipLoadout.fromLoadout({
        Ship: 'krait_light',
        CargoCapacity: 512,
        Modules: [{ Slot: 'Slot01_Size6', Item: 'int_cargorack_size9_class1', Value: 1 }],
    });
    unknownRack.removeModule('Slot01_Size6');
    unknownRack.setModule('Slot01_Size6', module('Int_CargoRack_Size6_Class1'));
    assert.ok(Object.hasOwn(unknownRack.toLoadoutEvent(), 'CargoCapacity'));

    const stillUnknown = ShipLoadout.fromLoadout({
        Ship: 'krait_light',
        Modules: [{ Slot: 'Slot01_Size6', Item: 'int_cargorack_size9_class1' }],
    });
    const event = stillUnknown.toLoadoutEvent();
    assert.ok(!Object.hasOwn(event, 'CargoCapacity'), `got ${event.CargoCapacity}`);
});

test('a build we cannot price stays unpriced however many times it is re-exported', () => {
    // The export omits `ModulesValue` exactly when it failed to price something. If it
    // still wrote prices on the modules it *could* cost, a re-import would read that as
    // "priced, no total declared" and treat the unpriceable module as free — turning a
    // correctly omitted figure into a confident wrong one.
    const build = ShipLoadout.empty('Krait_Light');
    build.setModule('Armour', module('Krait_Light_Armour_Grade1')); // priced at 0
    build.setModule('Slot01_Size6', module('Int_CorrosionProofCargoRack_Size6_Class1')); // unpriced

    let event = build.toLoadoutEvent();
    assert.ok(!Object.hasOwn(event, 'ModulesValue'), 'should not price an unpriceable build');
    for (let hop = 0; hop < 3; hop++) {
        event = ShipLoadout.fromLoadout(event).toLoadoutEvent();
        assert.ok(!Object.hasOwn(event, 'ModulesValue'), `hop ${hop} invented a total`);
        assert.ok(!Object.hasOwn(event, 'Rebuy'), `hop ${hop} invented a rebuy`);
    }
});

test('an import whose prices do not add up is copied faithfully, not corrected', () => {
    // The source's own total and its own per-module prices disagree. Re-emitting our
    // derived prices under its declared total would invent purchases it never made, so
    // the export copies what it was given and stays put across hops.
    let kept = 0;
    let event: LoadoutEvent = {
        ...krait,
        Modules: krait.Modules.map((m) => {
            if (m.Value === undefined || kept++ < 2) return m;
            const stripped: Record<string, unknown> = { ...m };
            delete stripped.Value;
            return stripped as unknown as LoadoutModule;
        }),
    };
    const sourceSum = event.Modules.reduce((total, m) => total + (m.Value ?? 0), 0);

    for (let hop = 0; hop < 3; hop++) {
        event = ShipLoadout.fromLoadout(event).toLoadoutEvent();
        assert.equal(event.ModulesValue, krait.ModulesValue, `hop ${hop} moved the total`);
        assert.equal(
            event.Modules.reduce((total, m) => total + (m.Value ?? 0), 0),
            sourceSum,
            `hop ${hop} invented module prices`,
        );
    }
});

test('a journal build round-trips through SLEF unchanged', () => {
    const build = ShipLoadout.fromLoadout(krait);
    const reimported = ShipLoadout.fromSlef(build.toSlefString());
    assert.deepEqual(reimported.toLoadoutEvent(), build.toLoadoutEvent());
});

// ── Module ordering and casing ───────────────────────────────────────────────

test('modules keep the order the build carries by default', () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    assert.deepEqual(
        event.Modules.map((m) => m.Slot),
        fixture.deepBlack.fittedOrder,
    );
});

test('moduleOrder "slots" emits outfitting-panel order instead', () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent({ moduleOrder: 'slots' });
    assert.deepEqual(
        event.Modules.map((m) => m.Slot),
        fixture.deepBlack.slotOrder,
    );
});

test('moduleOrder "slots" drops no module, even in a slot the layout omits', () => {
    const withStrayHardpoint: LoadoutEvent = {
        ...source,
        Modules: [...source.Modules, { Slot: 'HugeHardpoint9', Item: 'hpt_beamlaser_fixed_huge' }],
    };
    const event = ShipLoadout.fromLoadout(withStrayHardpoint).toLoadoutEvent({
        moduleOrder: 'slots',
    });
    assert.equal(event.Modules.length, withStrayHardpoint.Modules.length);
    assert.equal(event.Modules.at(-1)!.Slot, 'HugeHardpoint9');
});

test('moduleOrder "slots" throws when the hull has no known layout', () => {
    const build = ShipLoadout.fromLoadout({ Ship: 'not_a_real_hull', Modules: [] });
    assert.throws(() => build.toLoadoutEvent({ moduleOrder: 'slots' }), /no slot layout/);
});

test('catalogue-cased ids are lower-cased on the way out', () => {
    const build = ShipLoadout.empty(fixture.assembled.ship);
    for (const [slot, symbol] of Object.entries(fixture.assembled.fit)) {
        build.setModule(slot, module(symbol));
    }
    const event = build.toLoadoutEvent();
    assert.equal(event.Ship, fixture.assembled.recomputed.Ship);
    for (const m of event.Modules) assert.equal(m.Item, m.Item.toLowerCase());
    assert.deepEqual(event.Modules, fixture.assembled.modules);
});

// ── Assembled builds ─────────────────────────────────────────────────────────

const assembledBuild = (): ShipLoadout => {
    const build = ShipLoadout.empty(fixture.assembled.ship);
    for (const [slot, symbol] of Object.entries(fixture.assembled.fit)) {
        build.setModule(slot, module(symbol));
    }
    return build;
};

test('a build assembled from scratch exports every figure it can compute', () => {
    const event = assembledBuild().toLoadoutEvent();
    assert.deepEqual(Object.keys(event), fixture.assembled.topLevelKeys);
    assert.deepEqual(figuresOf(event, fixture.assembled.recomputed), fixture.assembled.recomputed);
    for (const key of fixture.assembled.omittedKeys) {
        assert.ok(!Object.hasOwn(event, key), `expected ${key} to be omitted`);
    }
});

test('an assembled build round-trips through parseSlef', () => {
    const parsed = parseSlef(assembledBuild().toSlefString());
    assert.equal(parsed[0]!.data.Ship, fixture.assembled.recomputed.Ship);
});

test('power state is omitted unless explicitly asked for', () => {
    assert.deepEqual(assembledBuild().toLoadoutEvent().Modules, fixture.assembled.modules);
    assert.deepEqual(
        assembledBuild().toLoadoutEvent({ explicitPower: true }).Modules,
        fixture.assembled.modulesWithExplicitPower,
    );
});

// ── Omission rather than stale or zero values ────────────────────────────────

test('figures that cannot be computed are left out, not emitted as zero', () => {
    const build = ShipLoadout.fromLoadout({
        Ship: fixture.unknownHull.ship,
        Modules: [{ Slot: 'PowerPlant', Item: 'int_powerplant_size2_class1' }],
    });
    const event = build.toLoadoutEvent();
    assert.deepEqual(Object.keys(event), fixture.unknownHull.topLevelKeys);
    for (const key of fixture.unknownHull.omittedKeys) {
        assert.ok(
            !Object.hasOwn(event, key),
            `expected ${key} to be omitted, got ${String(
                (event as unknown as Record<string, unknown>)[key],
            )}`,
        );
    }
});

test('an unpriceable module omits the value figures rather than under-reporting', () => {
    const build = ShipLoadout.fromLoadout({
        Ship: 'sidewinder',
        Modules: [{ Slot: 'PowerPlant', Item: 'no_such_module_symbol' }],
    });
    const event = build.toLoadoutEvent();
    assert.ok(!Object.hasOwn(event, 'ModulesValue'));
    assert.ok(!Object.hasOwn(event, 'Rebuy'));
});

test('editing a build recomputes rather than echoing the import', () => {
    const { afterEdit } = fixture.deepBlack;
    const build = ShipLoadout.fromSlef(slefString);
    build.setModule(afterEdit.slot, module(afterEdit.item));
    const event = build.toLoadoutEvent();
    assert.deepEqual(Object.keys(event), afterEdit.topLevelKeys);
    assert.deepEqual(figuresOf(event, afterEdit.recomputed), afterEdit.recomputed);
});

// ── Power setters ────────────────────────────────────────────────────────────

test('setModulePriority and setModuleEnabled show up in the export', () => {
    const build = ShipLoadout.fromSlef(slefString);
    build.setModulePriority('PowerPlant', 3).setModuleEnabled('TinyHardpoint5', false);
    const event = build.toLoadoutEvent();
    assert.equal(event.Modules.find((m) => m.Slot === 'PowerPlant')!.Priority, 3);
    assert.equal(event.Modules.find((m) => m.Slot === 'TinyHardpoint5')!.On, false);
});

test('changing power state leaves the credit figures alone', () => {
    // Unlike fitting a module, toggling power costs nothing — the aggregates must survive.
    const build = ShipLoadout.fromSlef(slefString);
    build.setModulePriority('PowerPlant', 2);
    const event = build.toLoadoutEvent();
    assert.equal(event.ModulesValue, fixture.deepBlack.recomputed.ModulesValue);
    assert.equal(event.Rebuy, fixture.deepBlack.recomputed.Rebuy);
});

test('setModulePriority rejects a group outside the journal’s 0-4', () => {
    const build = ShipLoadout.fromSlef(slefString);
    for (const bad of [-1, 5, 1.5, Number.NaN]) {
        assert.throws(() => build.setModulePriority('PowerPlant', bad), RangeError);
    }
});

test('the power setters reject an empty slot', () => {
    const build = ShipLoadout.fromSlef(slefString);
    assert.throws(() => build.setModulePriority('Slot04_Size5', 1), RangeError);
    assert.throws(() => build.setModuleEnabled('Slot04_Size5', false), RangeError);
});

test('a live FittedModule handle survives a power change and sees it', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const plant = build.getFittedModule('PowerPlant')!;
    plant.setPriority(4).setEnabled(false);
    assert.equal(plant.priority, 4);
    assert.equal(plant.on, false);
});

test('switching off a Guardian FSD Booster changes the exported jump range', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const boosted = build.toLoadoutEvent().MaxJumpRange!;
    const boosterSlot = build.modules.find((m) =>
        m.Item.toLowerCase().startsWith('int_guardianfsdbooster'),
    )!.Slot;
    build.setModuleEnabled(boosterSlot, false);
    assert.ok(build.toLoadoutEvent().MaxJumpRange! < boosted);
});
