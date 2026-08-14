import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ShipLoadout } from './ship-loadout.js';
import { parseSlef, type LoadoutEvent, type LoadoutModule } from './slef.js';
import { enumerateSlots, parseSlotName } from './slots.js';
import { getShipSlots, SHIPS } from './ships.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.jsonc' with { type: 'json' };
import kraitJournal from '../../../fixtures/ships/journal-krait-phantom.jsonc' with { type: 'json' };
import viperJournal from '../../../fixtures/ships/journal-viper-mkiv.jsonc' with { type: 'json' };
import pythonJournal from '../../../fixtures/ships/journal-python-mkii-antixeno.jsonc' with { type: 'json' };
import fixture from '../../../fixtures/ships/slef-export.jsonc' with { type: 'json' };
import jumpFixture from '../../../fixtures/ships/jump-range.jsonc' with { type: 'json' };
import inaraFixture from '../../../fixtures/ships/slef-inara-type-11.jsonc' with { type: 'json' };

const slefString = JSON.stringify(slefFixture);
const source = slefFixture[0]!.data as unknown as LoadoutEvent;
const TEST_SLEF_OPTIONS = { header: { appName: 'Test', appVersion: '1.0.0' } } as const;

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
    const parsed = parseSlef(ShipLoadout.fromSlef(slefString).toSlefString(TEST_SLEF_OPTIONS));

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

test('a blueprint that states no modifiers leaves the catalogue stats standing', () => {
    // SLEF allows an Engineering block to name a blueprint without spelling out what it
    // changed. There is then nothing to fold in, so the module performs as sold rather
    // than the build failing to compute.
    const laser = module('Hpt_BeamLaser_Gimbal_Huge');
    const build = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [
            {
                Slot: 'HugeHardpoint1',
                Item: laser.symbol.toLowerCase(),
                Engineering: { BlueprintName: 'Weapon_LightWeight', Level: 4, Quality: 0.95 },
            },
        ],
    });
    const fitted = build.fittedModuleAt('HugeHardpoint1')!;
    assert.equal(fitted.effectiveStats?.mass, laser.mass);
    assert.equal(fitted.effectiveStats?.damage, laser.damage);
    // …and it exports exactly as it came in, without an empty Modifiers array appearing.
    const exported = build.toLoadoutEvent().Modules[0]!.Engineering!;
    assert.deepEqual(exported, {
        BlueprintName: 'Weapon_LightWeight',
        Level: 4,
        Quality: 0.95,
    });
});

test('engineering survives the round trip intact', () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    const exported = event.Modules.find((m) => m.Slot === 'FrameShiftDrive')!;
    const original = source.Modules.find((m) => m.Slot === 'FrameShiftDrive')!;
    assert.deepEqual(exported.Engineering, original.Engineering);
});

test('journal-only metadata is excluded from a loadout and SLEF round trip', () => {
    const { topLevel, engineering } = fixture.journalFieldExclusions;
    const sourceTop = viperJournal as unknown as Record<string, unknown>;
    const viperRoundTrip = parseSlef(
        ShipLoadout.fromSlef(viperJournal).toSlefString(TEST_SLEF_OPTIONS),
    )[0]!.data as unknown as Record<string, unknown>;

    for (const key of topLevel) {
        assert.ok(Object.hasOwn(sourceTop, key), `real capture does not carry ${key}`);
        assert.ok(!Object.hasOwn(viperRoundTrip, key), `${key} survived the round trip`);
    }

    const sourceModule = kraitJournal.Modules.find((module) => module.Engineering !== undefined)!;
    const sourceEngineering = sourceModule.Engineering as unknown as Record<string, unknown>;
    const kraitBuild = ShipLoadout.fromSlef(kraitJournal);
    const fittedEngineering = kraitBuild.fittedModuleAt(sourceModule.Slot)!
        .engineering as unknown as Record<string, unknown>;
    const kraitRoundTrip = parseSlef(
        kraitBuild.toSlefString(TEST_SLEF_OPTIONS),
    )[0]!.data.Modules.find((module) => module.Slot === sourceModule.Slot)!;
    const roundTripEngineering = kraitRoundTrip.Engineering as unknown as Record<string, unknown>;

    for (const key of engineering) {
        assert.ok(Object.hasOwn(sourceEngineering, key), `real capture does not carry ${key}`);
        assert.ok(!Object.hasOwn(fittedEngineering, key), `Engineering.${key} entered the build`);
        assert.ok(
            !Object.hasOwn(roundTripEngineering, key),
            `Engineering.${key} survived the round trip`,
        );
    }

    const durableKeys = Object.keys(sourceEngineering).filter((key) => !engineering.includes(key));
    assert.deepEqual(Object.keys(roundTripEngineering), durableKeys);
    for (const key of durableKeys) {
        assert.deepEqual(roundTripEngineering[key], sourceEngineering[key], key);
    }
});

// ── The recomputed figures reproduce the game's own ──────────────────────────

test(`the export emits ${fixture.deepBlack.topLevelKeys.length} top-level keys, in journal order`, () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    assert.deepEqual(Object.keys(event), fixture.deepBlack.topLevelKeys);
    assert.equal(event.Modules.length, fixture.deepBlack.moduleCount);
});

test('every recomputed figure matches the fixture', () => {
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    assert.deepEqual(figuresOf(event, fixture.deepBlack.recomputed), fixture.deepBlack.recomputed);
});

test('the physical figures are the exporter’s own, not our invention', () => {
    // These are properties of the fit, so a real export is the ground truth and pinning
    // them means a catalogue regression fails here rather than being rubber-stamped.
    const expected = fixture.deepBlack.recomputed as unknown as Record<string, unknown>;
    for (const key of fixture.deepBlack.physicalFiguresMatchSource) {
        assert.deepEqual(
            expected[key],
            (source as unknown as Record<string, unknown>)[key],
            `${key} should reproduce the export's own figure`,
        );
    }
});

test('credits are quoted at retail, so a discounted source does not match', () => {
    // The source paid 12.25% under list for its modules. That is one commander's
    // purchase history, not a property of the build, so the export quotes list.
    const { discount, recomputed } = fixture.deepBlack;
    assert.equal(discount.sourceHullValue, source.HullValue);
    assert.equal(discount.sourceModulesValue, source.ModulesValue);
    assert.equal(discount.sourceRebuy, source.Rebuy);

    // The hull was bought at full list, so only the modules diverge — and by exactly
    // the discount, which is what shows the retail figure is right rather than merely
    // different.
    assert.equal(recomputed.HullValue, discount.sourceHullValue);
    assert.ok(
        Math.abs(discount.sourceModulesValue / recomputed.ModulesValue - discount.moduleDiscount) <
            1e-4,
        `expected the source to sit at ${discount.moduleDiscount} of retail`,
    );
});

test('rebuy is a flat 5% of hull plus modules, truncated', () => {
    const { HullValue, ModulesValue, Rebuy } = fixture.deepBlack.recomputed;
    assert.equal(Math.trunc((HullValue + ModulesValue) * fixture.rebuyFraction), Rebuy);
});

// ── A real journal capture, decorations and all ──────────────────────────────

const krait = kraitJournal as unknown as LoadoutEvent;

test('journal cosmetics are valid non-outfitting entries', () => {
    const build = ShipLoadout.fromLoadout(krait);
    assert.equal(build.validation.valid, true);
    assert.equal(build.validation.complete, true);
    assert.equal(
        build.validation.issues.some((issue) => issue.code === 'unknownSlot'),
        false,
    );
});

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
    assert.equal(krait.CargoCapacity, fixture.kraitPhantom.recomputed.CargoCapacity);
});

test('the journal’s credits diverge from retail for three separate reasons', () => {
    // Worth pinning because each is a different way a source's own figures fail to be a
    // property of the build, and together they are why none of them is carried through.
    const { discount, recomputed } = fixture.kraitPhantom;
    assert.equal(discount.sourceHullValue, krait.HullValue);
    assert.equal(discount.sourceModulesValue, krait.ModulesValue);
    assert.equal(discount.sourceRebuy, krait.Rebuy);

    // 1. The game quotes the hull with its stock fittings; we quote the bare hull.
    assert.equal(discount.hullRetailCost, krait.HullValue);
    assert.ok(recomputed.HullValue < discount.hullRetailCost);

    // 2. It gives no price at all to the modules that came free with the hull…
    assert.deepEqual(
        krait.Modules.filter(
            (m) =>
                m.Value === undefined &&
                !/^(PaintJob|Ship|Bobble|Decal|Weapon|Engine|Vessel)/.test(m.Slot),
        ).map((m) => m.Slot),
        discount.unpricedInSource,
    );

    // 3. …and it bought the rest at a discount, so our total is the larger one.
    assert.ok(recomputed.ModulesValue > discount.sourceModulesValue);
});

test('decorations and hull geometry weigh nothing and cost nothing', () => {
    // A journal lists the cockpit, ship kit, nameplates, bobbles, paint and voice pack
    // alongside the fitted modules. None is an outfitting module, so none may be treated
    // as an unknown — that would make a whole build's mass and value incomputable.
    assert.equal(krait.Modules.length, fixture.kraitPhantom.moduleCount);
    const decorative = fixture.kraitPhantom.nonOutfittingSlots;
    assert.deepEqual(
        krait.Modules.map((m) => m.Slot).filter((s) => decorative.includes(s)),
        decorative,
    );

    const undressed: LoadoutEvent = {
        ...krait,
        Modules: krait.Modules.filter((m) => !decorative.includes(m.Slot)),
    };
    const bare = ShipLoadout.fromLoadout(undressed).toLoadoutEvent();
    const dressed = ShipLoadout.fromLoadout(krait).toLoadoutEvent();
    assert.equal(bare.UnladenMass, dressed.UnladenMass);
    assert.equal(bare.ModulesValue, dressed.ModulesValue);
});

// ── Outfitting, no mount at all, or unknown ──────────────────────────────────

/** A bare hull with one module in one slot, exported. */
const withOneModule = (slot: string, item: string): LoadoutEvent =>
    ShipLoadout.fromLoadout({
        Ship: 'krait_light',
        Modules: [{ Slot: slot, Item: item }],
    }).toLoadoutEvent();

test('the classification examples in the fixture come out as the fixture says', () => {
    // The rule that governs every mass and credit figure: the catalogue first, the slot
    // only for an article it cannot identify, and then only to ask whether the key names
    // an outfitting mount at all. Anything else is unknown, and an unknown omits figures
    // rather than counting as 0.
    const empty = ShipLoadout.fromLoadout({ Ship: 'krait_light', Modules: [] }).toLoadoutEvent();
    const dependent = ['ModulesValue', 'UnladenMass', 'MaxJumpRange', 'Rebuy'];

    for (const { slot, item, verdict } of fixture.classification.examples) {
        const event = withOneModule(slot, item);
        const exported = event.Modules[0]!;
        // The hull is knowable whatever is fitted, so it is emitted in every case.
        assert.equal(event.HullValue, fixture.kraitPhantom.recomputed.HullValue, slot);

        if (verdict === 'unknown') {
            for (const key of dependent) {
                assert.equal(Object.hasOwn(event, key), false, `${slot}.${key}`);
            }
            assert.equal(Object.hasOwn(exported, 'Value'), false, slot);
            continue;
        }
        if (verdict === 'nonOutfitting') {
            assert.equal(Object.hasOwn(exported, 'Value'), false, slot);
            assert.equal(event.ModulesValue, empty.ModulesValue, slot);
            assert.equal(event.UnladenMass, empty.UnladenMass, slot);
            continue;
        }
        const stats = module(item);
        assert.equal(exported.Value, stats.cost, slot);
        assert.equal(event.ModulesValue, empty.ModulesValue! + stats.cost!, slot);
        assert.equal(event.UnladenMass, empty.UnladenMass! + stats.mass!, slot);
    }
});

test('the fixture’s mount and non-outfitting patterns agree with the classification', () => {
    // Pins both sides explicitly: a new slot family matches neither and is unknown.
    const patterns = fixture.classification.outfittingSlotPatterns.map((p) => new RegExp(p));
    const isMount = (slot: string) => patterns.some((p) => p.test(slot.toLowerCase()));
    const isNonOutfitting = (slot: string) =>
        new RegExp(fixture.classification.nonOutfittingSlotPattern).test(slot.toLowerCase());
    assert.deepEqual(
        krait.Modules.map((m) => m.Slot).filter((s) => !isMount(s)),
        fixture.kraitPhantom.nonOutfittingSlots,
    );

    // …and the patterns are the slot parser's own vocabulary, not a second copy of it
    // that could drift: every slot either implementation meets answers the same way.
    // Driven by every mount every hull in the registry actually has, so the check cannot
    // fall behind the patterns the way a hand-listed sample does — the restricted mounts
    // (`Military01`, `Cargo01`, `LimpetController01`, `FighterBay01`, `Passenger01`)
    // live on a handful of hulls and appear in no capture read here.
    const everyMount = SHIPS.flatMap((ship) =>
        enumerateSlots(getShipSlots(ship.symbol)!).map((s) => s.key),
    );
    const checked = [
        ...everyMount,
        ...krait.Modules.map((m) => m.Slot),
        ...viperJournal.Modules.map((m) => m.Slot),
        ...fixture.classification.examples.map((e) => e.slot),
        'slot03_size5',
        'LargeMiningHardpoint1',
        'Decal3',
        'Bobble10',
        'stringlights',
    ];
    for (const slot of checked) {
        assert.equal(isMount(slot), parseSlotName(slot) !== null, slot);
    }
    for (const slot of fixture.kraitPhantom.nonOutfittingSlots) {
        assert.equal(isNonOutfitting(slot), true, slot);
    }
    assert.equal(isMount('FutureMount'), false);
    assert.equal(isNonOutfitting('FutureMount'), false);

    // A pattern nothing above matches is a pattern this test does not pin, and an
    // unpinned one fails *silently*: the fixture names the mounts, so a pattern a port
    // transcribes wrongly makes a fitted module weightless and free rather than unknown.
    // Assert the sample exercises all of them rather than trusting that it does.
    const unexercised = fixture.classification.outfittingSlotPatterns.filter(
        (p) => !checked.some((slot) => new RegExp(p).test(slot.toLowerCase())),
    );
    assert.deepEqual(unexercised, []);
});

test('open-ended decoration families recognise slots not appearing in a fixture', () => {
    // A third decal, a tenth bobble, a lower-cased slot key: all fittings the corpus
    // happens not to hold, and none of them may move a figure.
    const dressed: LoadoutEvent = {
        ...krait,
        Modules: [
            ...krait.Modules,
            { Slot: 'Decal3', Item: 'decal_planet_shine' },
            { Slot: 'Bobble10', Item: 'bobble_christmastree' },
            { Slot: 'stringlights', Item: 'string_lights_coloured' },
        ],
    };
    const event = ShipLoadout.fromLoadout(dressed).toLoadoutEvent();
    assert.deepEqual(
        figuresOf(event, fixture.kraitPhantom.recomputed),
        fixture.kraitPhantom.recomputed,
    );
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
    assert.equal(round6(summary.totalUnladen.range), pinned.totalUnladenRange);
    assert.equal(round6(summary.totalLaden.range), pinned.totalLadenRange);
    assert.equal(summary.totalUnladen.jumps, pinned.totalJumps);
    assert.equal(summary.totalLaden.jumps, pinned.totalJumps);

    // …and the game's own MaxJumpRange, which is what makes the above trustworthy.
    assert.ok(Math.abs(summary.max - pinned.sourceMaxJumpRange) < 1e-4);
    assert.equal(pinned.sourceMaxJumpRange, krait.MaxJumpRange);
});

// ── A second journal capture, this one stock ─────────────────────────────────

const viper = viperJournal as unknown as LoadoutEvent;

test('a stock journal Loadout event reproduces every figure the game reported', () => {
    const event = ShipLoadout.fromLoadout(viper).toLoadoutEvent();
    assert.deepEqual(Object.keys(event), fixture.viperMkIV.topLevelKeys);
    assert.deepEqual(figuresOf(event, fixture.viperMkIV.recomputed), fixture.viperMkIV.recomputed);

    assert.equal(viper.Modules.length, fixture.viperMkIV.moduleCount);
    // Filtered by the rule rather than by the fixture's own list: `includes` alone would
    // pass a fixture that had simply left a decoration out. The Krait capture asserts the
    // same completeness one test up, off the fixture's patterns rather than the parser —
    // the two are held equivalent there, so either side of that pin is a fair filter.
    assert.deepEqual(
        viper.Modules.map((m) => m.Slot).filter((s) => parseSlotName(s) === null),
        fixture.viperMkIV.nonOutfittingSlots,
    );
});

test('an unengineered build agrees with Frontier with nothing folded in', () => {
    // The Krait Phantom matches the game only once Long Range and a Guardian booster are
    // applied, so it proves the engineered path. Nothing here is engineered: every module
    // performs as the catalogue sells it, so the same agreement is a reading of the base
    // module masses and drive stats themselves.
    assert.deepEqual(
        viper.Modules.filter((m) => m.Engineering !== undefined),
        [],
        'the fixture stopped being a stock build',
    );

    const event = ShipLoadout.fromLoadout(viper).toLoadoutEvent();
    const { journalTolerance } = fixture.viperMkIV;
    assert.ok(Math.abs(event.UnladenMass! - journalTolerance.UnladenMass) < 1e-4);
    assert.ok(Math.abs(event.MaxJumpRange! - journalTolerance.MaxJumpRange) < 1e-4);
    assert.equal(viper.CargoCapacity, fixture.viperMkIV.recomputed.CargoCapacity);
});

test('the jump figures for the stock journal build match the fixture', () => {
    const build = ShipLoadout.fromLoadout(viper);
    const pinned = jumpFixture.builds.viperMkIV;
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
    assert.equal(round6(summary.totalUnladen.range), pinned.totalUnladenRange);
    assert.equal(round6(summary.totalLaden.range), pinned.totalLadenRange);
    assert.equal(summary.totalUnladen.jumps, pinned.totalJumps);
    assert.equal(summary.totalLaden.jumps, pinned.totalJumps);

    // A build with no cargo rack cannot be loaded, so laden and unladen are the same jump.
    assert.equal(summary.laden, summary.unladen);
    assert.ok(Math.abs(summary.max - pinned.sourceMaxJumpRange) < 1e-4);
    assert.equal(pinned.sourceMaxJumpRange, viper.MaxJumpRange);
});

test('the stock build was bought at one flat discount, and its hull at neither price', () => {
    // 20 modules at the same fraction of list is the widest reading of the price table any
    // single source gives — but it is still a purchase record, and the hull says so: the
    // Krait's HullValue was the hull with its stock fittings, to the credit, while this one
    // sits below even the bare hull. That is why no source's credits are carried through.
    const { discount, recomputed } = fixture.viperMkIV;
    assert.equal(discount.sourceHullValue, viper.HullValue);
    assert.equal(discount.sourceModulesValue, viper.ModulesValue);
    assert.equal(discount.sourceRebuy, viper.Rebuy);

    const priced = viper.Modules.filter((m) => m.Value !== undefined);
    assert.equal(priced.length, discount.pricedInSource);
    for (const m of priced) {
        const list = module(m.Item).cost!;
        const paid = Math.abs(m.Value! - list * discount.moduleDiscount);
        assert.ok(paid <= discount.moduleDiscountToleranceCr, `${m.Item} paid ${m.Value}`);
    }

    // The hull is quoted as the bare `hullCost`, which is above what the source paid and
    // below the retail price the Krait's journal reported for its hull.
    assert.equal(recomputed.HullValue, discount.hullCost);
    assert.ok(discount.sourceHullValue < discount.hullCost);
    assert.ok(discount.hullCost < discount.hullRetailCost);

    // Its own Rebuy is not even 5% of its own figures, so it cannot be reconciled at all.
    assert.equal(
        Math.trunc((viper.HullValue! + viper.ModulesValue!) * fixture.rebuyFraction),
        discount.rebuyFromOwnFigures,
    );
    assert.notEqual(discount.rebuyFromOwnFigures, discount.sourceRebuy);
});

test('the unpriced entries in a stock journal are the ones the hull came with', () => {
    assert.deepEqual(
        viper.Modules.filter(
            (m) =>
                m.Value === undefined &&
                !/^(PaintJob|Ship|Bobble|Decal|Weapon|Engine|Vessel)/.test(m.Slot),
        ).map((m) => m.Slot),
        fixture.viperMkIV.discount.unpricedInSource,
    );

    // …and pricing them at list is what puts our ModulesValue above the source's.
    const event = ShipLoadout.fromLoadout(viper).toLoadoutEvent();
    assert.ok(event.ModulesValue! > viper.ModulesValue!);
});

const python = pythonJournal as unknown as LoadoutEvent;

test('an anti-xeno journal Loadout event reproduces every figure the game reported', () => {
    const event = ShipLoadout.fromLoadout(python).toLoadoutEvent();
    assert.deepEqual(Object.keys(event), fixture.pythonMkII.topLevelKeys);
    assert.deepEqual(
        figuresOf(event, fixture.pythonMkII.recomputed),
        fixture.pythonMkII.recomputed,
    );

    assert.equal(python.Modules.length, fixture.pythonMkII.moduleCount);
    assert.deepEqual(
        python.Modules.map((m) => m.Slot).filter((s) => parseSlotName(s) === null),
        fixture.pythonMkII.nonOutfittingSlots,
    );
});

test('a stock anti-xeno build agrees with Frontier on a hull the other captures do not reach', () => {
    // The second unengineered capture, and the only one on a Python Mk II or an SCO drive.
    // Nothing is folded in, so the agreement reads the base module masses and the drive
    // constants themselves — on a 699t hull rather than the Viper's 261t.
    assert.deepEqual(
        python.Modules.filter((m) => m.Engineering !== undefined),
        [],
        'the fixture stopped being a stock build',
    );

    const event = ShipLoadout.fromLoadout(python).toLoadoutEvent();
    const { journalTolerance } = fixture.pythonMkII;
    assert.ok(Math.abs(event.UnladenMass! - journalTolerance.UnladenMass) < 1e-4);
    assert.ok(Math.abs(event.MaxJumpRange! - journalTolerance.MaxJumpRange) < 1e-4);
    assert.equal(python.CargoCapacity, fixture.pythonMkII.recomputed.CargoCapacity);
});

test("a journal's own ammo counts check the catalogue's clip and hopper figures", () => {
    // The one external reading of `clipSize` / `ammoMaximum` a Loadout gives: the game
    // reports what is actually in the magazine and the reserve. Only weapons carrying ammo
    // at capture time say anything — a rearm state of zero is a fact about the ship.
    const loaded = fixture.pythonMkII.ammunition.loaded;
    assert.ok(loaded.length, 'no ammunition pinned');
    const build = ShipLoadout.fromLoadout(python);
    for (const expected of loaded) {
        // The counts themselves are read off the raw capture: a rearm state is not part of
        // a build, so `LoadoutModule` does not carry it. What the build answers is the
        // capacity those full weapons happen to be sitting at.
        const fitted = pythonJournal.Modules.find(
            (m) => m.Item.toLowerCase() === expected.symbol.toLowerCase(),
        );
        assert.ok(fitted, `${expected.symbol} is not in the capture`);
        assert.equal(fitted.AmmoInClip, expected.AmmoInClip, expected.symbol);
        assert.equal(fitted.AmmoInHopper, expected.AmmoInHopper, expected.symbol);

        const capacity = build.fittedModuleAt(fitted.Slot)!.ammunition;
        assert.deepEqual(
            capacity,
            {
                clipSize: expected.AmmoInClip,
                hopper: expected.AmmoInHopper,
                total: expected.AmmoInClip + expected.AmmoInHopper,
                unlimited: false,
            },
            expected.symbol,
        );
    }
});

test('importing a journal drops its ammunition state', () => {
    // Deliberate: `AmmoInClip` / `AmmoInHopper` say what was loaded at the instant of
    // capture, which the build is not a record of. The capacity is on the fitted module.
    const build = ShipLoadout.fromLoadout(python);
    const event = build.toLoadoutEvent();
    for (const exported of event.Modules) {
        assert.ok(!('AmmoInClip' in exported), exported.Slot);
        assert.ok(!('AmmoInHopper' in exported), exported.Slot);
    }
    const armed = fixture.pythonMkII.ammunition.loaded[0]!;
    const fitted = build.fittedModuleAt(
        pythonJournal.Modules.find((m) => m.Item.toLowerCase() === armed.symbol.toLowerCase())!
            .Slot,
    )!;
    assert.ok(!('AmmoInClip' in fitted.raw));
    assert.equal(fitted.ammunition?.clipSize, armed.AmmoInClip);
});

test('the jump figures for the anti-xeno journal build match the fixture', () => {
    const build = ShipLoadout.fromLoadout(python);
    const pinned = jumpFixture.builds.pythonMkII;
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
    assert.equal(round6(summary.totalUnladen.range), pinned.totalUnladenRange);
    assert.equal(round6(summary.totalLaden.range), pinned.totalLadenRange);
    assert.equal(summary.totalUnladen.jumps, pinned.totalJumps);
    assert.equal(summary.totalLaden.jumps, pinned.totalJumps);

    // Unlike the Viper this build carries a cargo rack, so a laden jump is the shorter one.
    assert.ok(summary.laden < summary.unladen);
    assert.ok(Math.abs(summary.max - pinned.sourceMaxJumpRange) < 1e-4);
    assert.equal(pinned.sourceMaxJumpRange, python.MaxJumpRange);
});

test('the anti-xeno build was bought at the same discount the Deep Black export was', () => {
    // A second independent reading of the price table at 0.8775, from a different source
    // kind — the Deep Black is an EDSY export, this is Frontier's own journal — and a third
    // discount overall beside the Viper's flat 0.85. The hull agrees with the Viper rather
    // than the Krait: below even the bare hullCost, and at neither convention's fraction.
    const { discount, recomputed } = fixture.pythonMkII;
    assert.equal(discount.sourceHullValue, python.HullValue);
    assert.equal(discount.sourceModulesValue, python.ModulesValue);
    assert.equal(discount.sourceRebuy, python.Rebuy);
    assert.equal(discount.moduleDiscount, fixture.deepBlack.discount.moduleDiscount);

    const priced = python.Modules.filter((m) => m.Value !== undefined);
    assert.equal(priced.length, discount.pricedInSource);
    for (const m of priced) {
        const list = module(m.Item).cost!;
        const paid = Math.abs(m.Value! - list * discount.moduleDiscount);
        assert.ok(paid <= discount.moduleDiscountToleranceCr, `${m.Item} paid ${m.Value}`);
    }

    assert.equal(recomputed.HullValue, discount.hullCost);
    assert.ok(discount.sourceHullValue < discount.hullCost);
    assert.ok(discount.hullCost < discount.hullRetailCost);

    assert.equal(
        Math.trunc((python.HullValue! + python.ModulesValue!) * fixture.rebuyFraction),
        discount.rebuyFromOwnFigures,
    );
    assert.notEqual(discount.rebuyFromOwnFigures, discount.sourceRebuy);

    assert.deepEqual(
        python.Modules.filter(
            (m) =>
                m.Value === undefined &&
                !/^(PaintJob|Ship|Bobble|Decal|Weapon|Engine|Vessel)/.test(m.Slot),
        ).map((m) => m.Slot),
        discount.unpricedInSource,
    );
});

test('every module is priced from the catalogue, whatever the source paid', () => {
    // The Deep Black's modules were all bought 12.25% under list. The export quotes
    // list for each one, so the same module costs the same in every build.
    const event = ShipLoadout.fromSlef(slefString).toLoadoutEvent();
    for (const exported of event.Modules) {
        const catalogued = getModuleBySymbol(exported.Item, ALL_MODULES);
        if (catalogued?.cost === undefined) {
            assert.ok(
                !Object.hasOwn(exported, 'Value'),
                `${exported.Item} priced without a source`,
            );
            continue;
        }
        assert.equal(exported.Value, catalogued.cost, exported.Item);
    }
    assert.equal(
        event.Modules.reduce((total, m) => total + (m.Value ?? 0), 0),
        event.ModulesValue,
        'the parts must add up to the total',
    );
});

test('a module fitted into an empty slot adds its list price', () => {
    const before = ShipLoadout.fromSlef(slefString).toLoadoutEvent().ModulesValue!;
    const build = ShipLoadout.fromSlef(slefString);
    const tank = module('Int_FuelTank_Size5_Class3');
    build.setModule('Slot04_Size5', tank);
    assert.equal(build.toLoadoutEvent().ModulesValue! - before, tank.cost);
});

test('stripping a source’s own prices changes nothing', () => {
    // The strongest statement of the policy: credits are a function of the hull and the
    // fitted module symbols alone. Whatever a source claims to have paid — everything,
    // something, nothing — the export is identical.
    const strip = (m: LoadoutModule): LoadoutModule => {
        const bare: Record<string, unknown> = { ...m };
        delete bare.Value;
        return bare as unknown as LoadoutModule;
    };
    const unpriced: Record<string, unknown> = {
        ...krait,
        Modules: krait.Modules.map(strip),
    };
    delete unpriced.ModulesValue;
    delete unpriced.HullValue;
    delete unpriced.Rebuy;

    assert.deepEqual(
        ShipLoadout.fromLoadout(unpriced as unknown as LoadoutEvent).toLoadoutEvent(),
        ShipLoadout.fromLoadout(krait).toLoadoutEvent(),
    );
});

test('a build survives repeated export/import hops without its price drifting', () => {
    // An export must reconcile with itself: the `Value`s it writes have to add up to
    // the `ModulesValue` it declares. If they do not, re-importing cannot tell a free
    // hull fitting from one we priced, and every hop re-prices the stock modules that
    // `HullValue` already covers.
    const rack = module('Int_CargoRack_Size3_Class1');
    let event: LoadoutEvent = krait;
    const seen: (number | undefined)[] = [];
    for (let hop = 0; hop < 3; hop++) {
        const build = ShipLoadout.fromLoadout(event);
        build.setModule('Slot05_Size3', rack);
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

test('a real capture carrying a Community Goal rack exports no module total or rebuy, and its own Value is not a list price', async () => {
    // The hand-built case above, but from outside: a real Inara export of an anti-xeno
    // Cutter fitting five corrosion-resistant racks. Two size-6 and one size-5 are the
    // Community Goal rewards this catalogue leaves unpriced, so a total cannot be built.
    const { default: capture } = await import(
        '../../../fixtures/ships/slef-inara-cutter-antixeno.jsonc',
        { with: { type: 'json' } }
    );
    const source = capture[0]!.data as unknown as LoadoutEvent;

    // The two figures that need a price for *every* module are dropped rather than
    // under-reported. `HullValue` needs only the hull, so it survives — quoted at retail,
    // which is a different number from the one the capture declares. What convention that
    // one follows is not worked out; see `data/ships/SOURCES.md`.
    for (const key of ['HullValue', 'ModulesValue', 'Rebuy'] as const) {
        assert.ok(Object.hasOwn(source, key), `the capture should declare ${key}`);
    }
    const event = ShipLoadout.fromLoadout(source).toLoadoutEvent();
    assert.ok(!Object.hasOwn(event, 'ModulesValue'), 'priced a build it cannot price');
    assert.ok(!Object.hasOwn(event, 'Rebuy'), 'invented a rebuy');
    assert.equal(event.HullValue, 200493413);
    assert.notEqual(event.HullValue, source.HullValue);

    // ...and the reason is the two reward racks specifically, not the hull or the rest.
    for (const symbol of [
        'Int_CorrosionProofCargoRack_Size5_Class1',
        'Int_CorrosionProofCargoRack_Size6_Class1',
    ]) {
        assert.equal(module(symbol).cost, undefined, `${symbol} should carry no cost`);
    }

    // Why the capture's own `Value` on the size-5 rack (318174) is not adopted as that
    // missing price: `Value` is net of the station discount, which the capture proves
    // against itself. Its two size-4 racks are the same module at one list price, and
    // they read differently — so no single `Value` recovers a list price, and a reward
    // module was never bought at a station to begin with.
    // Resolve the mount, not the price: a bare `.find(...)?.Value` reads `undefined` both
    // when the capture reports no `Value` and when the slot key is not there at all, so
    // the "reward racks carry no Value" assertions below would pass on a fixture that had
    // lost them entirely.
    const entryFor = (slot: string): LoadoutModule => {
        const entry = source.Modules.find((m: LoadoutModule) => m.Slot === slot);
        assert.ok(entry, `the capture should fit something in ${slot}`);
        return entry;
    };
    const size4 = module('Int_CorrosionProofCargoRack_Size4_Class1').cost!;
    assert.equal(size4, 94330);

    // The two size-4 racks are one module at one list price, and they report different
    // figures — both below list. That is what makes `Value` a paid price rather than a
    // list one, and it is read off the capture rather than restated as literals.
    const paid = ['slot06_size5', 'slot07_size5'].map((slot) => {
        const entry = entryFor(slot);
        assert.equal(entry.Item, 'int_corrosionproofcargorack_size4_class1');
        assert.ok(typeof entry.Value === 'number', `${slot} should report a Value`);
        assert.ok(entry.Value < size4, `${slot}: ${entry.Value} is not below list ${size4}`);
        return entry.Value;
    });
    assert.equal(new Set(paid).size, 2, 'the same module should report two paid figures');
    assert.deepEqual(paid, [82774, 91970]);

    // The size-5 reward reports a Value; both size-6 rewards report none at all.
    assert.equal(entryFor('slot05_size6').Value, 318174);
    assert.equal(entryFor('slot03_size6').Value, undefined);
    assert.equal(entryFor('slot04_size6').Value, undefined);
});

test('an import whose own prices disagree with its total is corrected to retail', () => {
    // Some journals omit `Value` on modules that were paid for, so a source's parts can
    // fall short of the total it declares. Neither figure is carried through, so the
    // inconsistency simply does not propagate.
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
    const retail = fixture.kraitPhantom.recomputed.ModulesValue;

    for (let hop = 0; hop < 3; hop++) {
        event = ShipLoadout.fromLoadout(event).toLoadoutEvent();
        assert.equal(event.ModulesValue, retail, `hop ${hop} did not settle at retail`);
        assert.equal(
            event.Modules.reduce((total, m) => total + (m.Value ?? 0), 0),
            retail,
            `hop ${hop}: the parts must add up to the total`,
        );
    }
});

test('a journal build round-trips through SLEF unchanged', () => {
    const build = ShipLoadout.fromLoadout(krait);
    const reimported = ShipLoadout.fromSlef(build.toSlefString(TEST_SLEF_OPTIONS));
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
    const parsed = parseSlef(assembledBuild().toSlefString(TEST_SLEF_OPTIONS));
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

test('fitted-module snapshots preserve their point-in-time power state', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const before = build.fittedModuleAt('PowerPlant')!;
    build.setModulePriority(before.slot, 4).setModuleEnabled(before.slot, false);
    const after = build.fittedModuleAt(before.slot)!;
    assert.notEqual(after, before);
    assert.notEqual(before.priority, 4);
    assert.notEqual(before.on, false);
    assert.equal(after.priority, 4);
    assert.equal(after.on, false);
});

test('switching off a Guardian FSD Booster changes the exported jump range', () => {
    const build = ShipLoadout.fromSlef(slefString);
    const boosted = build.toLoadoutEvent().MaxJumpRange!;
    const boosterSlot = build
        .fittedModules()
        .find((module) => module.symbol.toLowerCase().startsWith('int_guardianfsdbooster'))!.slot;
    build.setModuleEnabled(boosterSlot, false);
    assert.ok(build.toLoadoutEvent().MaxJumpRange! < boosted);
});

test('a restricted mount survives a SLEF round trip under its journal name', () => {
    // The keys restricted mounts get are the game's own, so SLEF — which is the
    // journal `Loadout` event in an envelope — must carry them unchanged.
    const build = ShipLoadout.empty('LakonMiner')
        .setModule('LargeMiningHardpoint1', module('Hpt_MiningToolV2_Fixed_Large'))
        .setModule('MediumMiningHardpoint1', module('Hpt_Mining_SubSurfDispMisle_Fixed_Medium'))
        .setModule('MediumHardpoint3', module('Hpt_MultiCannon_Fixed_Medium'))
        .setModule('SmallMiningHardpoint1', module('Hpt_Mining_AbrBlstr_Fixed_Small'))
        .setModule('LimpetController01', module('Int_MultiDroneControl_MiningV2_Size5_Class5'))
        .setModule('FighterBay01', module('Int_FighterBay_Size5_Class1'))
        .setModule('FrameShiftDrive', module('Int_Hyperdrive_Size5_Class5'))
        .setModule('FuelTank', module('Int_FuelTank_Size5_Class3'));

    const exported = build.toSlefString({ header: { appName: 'Test', appVersion: '1' } });
    const slots = parseSlef(exported)[0]!.data.Modules.map((m) => m.Slot);
    assert.ok(slots.includes('LargeMiningHardpoint1'));
    assert.ok(slots.includes('MediumMiningHardpoint1'));
    assert.ok(slots.includes('LimpetController01'));
    assert.ok(slots.includes('FighterBay01'));

    // Re-importing puts every module back in the mount it came from, and the mount
    // still knows what it takes — so an edit after a round trip is still checked.
    const back = ShipLoadout.fromSlef(exported);
    assert.deepEqual(
        back
            .fittedModules()
            .map((module) => module.slot)
            .sort(),
        build
            .fittedModules()
            .map((module) => module.slot)
            .sort(),
    );
    const mount = back.slots().find((s) => s.key === 'MediumMiningHardpoint1');
    assert.equal(mount?.restriction, 'mining');
    assert.ok(mount?.module);
    assert.throws(
        () => back.setModule('MediumMiningHardpoint1', module('Hpt_MultiCannon_Fixed_Medium')),
        /only takes mining tools/,
    );
});

test('a SLEF producer with generic Type-11 mount names still imports', () => {
    // Import preserves a producer's generic mount key: the module counts towards the
    // build's figures, and is re-exported unchanged — it is simply not one of the
    // hull's own mounts, so `slots()` does not report it as occupied.
    const foreign: LoadoutEvent = {
        Ship: 'lakonminer',
        Modules: [
            { Slot: 'MediumHardpoint1', Item: 'hpt_mining_subsurfdispmisle_fixed_medium' },
            { Slot: 'FrameShiftDrive', Item: 'int_hyperdrive_size5_class5' },
            { Slot: 'FuelTank', Item: 'int_fueltank_size5_class3' },
        ],
    };
    const build = ShipLoadout.fromLoadout(foreign);
    assert.equal(build.fittedModules().length, 3);
    assert.equal(
        build.fittedModuleAt('MediumHardpoint1')?.symbol,
        'hpt_mining_subsurfdispmisle_fixed_medium',
    );
    assert.equal(build.weaponMetrics().weapons.length, 1);
    assert.equal(
        build.slots().find((s) => s.key === 'MediumHardpoint1'),
        undefined,
        'the hull has no plain MediumHardpoint1 — its first two mediums are mining mounts',
    );
    assert.deepEqual(
        build.toLoadoutEvent().Modules.map((m) => m.Slot),
        ['MediumHardpoint1', 'FrameShiftDrive', 'FuelTank'],
    );
});

test("a real Inara export confirms the Type-11's journal slot vocabulary", async () => {
    // External ground truth: Inara wrote these slot names, not this library. It is the
    // only source in the corpus that exercises the restricted mounts end to end.
    const { default: inara } = await import('../../../fixtures/ships/slef-inara-type-11.jsonc', {
        with: { type: 'json' },
    });
    const exported = inara[0]!.data.Modules.map((m) => m.Slot);

    // Inara lower-cases every slot key, as the SLEF specification's own example does,
    // and an import keeps its producer's spelling, so compare case-insensitively —
    // which is how `ShipLoadout` binds them too.
    const canonical = new Map(
        ShipLoadout.empty('LakonMiner')
            .slots()
            .map((s) => [s.key.toLowerCase(), s.key]),
    );
    const unknown = exported.filter((slot) => !canonical.has(slot.toLowerCase()));
    assert.deepEqual(unknown, [], 'Inara named a mount this hull does not have');

    // The restricted mounts specifically: Inara's spelling is ours, character for
    // character once case is set aside.
    for (const key of [
        'LargeMiningHardpoint1',
        'MediumMiningHardpoint1',
        'MediumMiningHardpoint2',
        'MediumHardpoint3',
        'SmallMiningHardpoint1',
        'LimpetController01',
        'FighterBay01',
    ]) {
        assert.ok(exported.includes(key.toLowerCase()), `Inara did not name ${key}`);
    }
    // ...and the numbering rule holds in a real export: a restricted optional consumes
    // no SlotNN number, so the size-4 that follows the two size-5s is Slot06, not Slot08.
    assert.ok(exported.includes('slot05_size5'));
    assert.ok(exported.includes('slot06_size4'));
    assert.ok(!exported.some((s) => /^slot(07|08)_size[45]$/.test(s)));
});

test("the Type-11 export's credits are a purchase record, and ours are retail", () => {
    // Every figure Inara states is below list, at three different ratios — the hull at
    // a 2.5% shipyard discount, the modules at ~5.2% across 23 priced entries. That is
    // one commander's purchase history, not a property of the build, so the recomputed
    // export quotes list and the source's own figures stay reachable on the getters.
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    const stated = inaraFixture[0]!.data;
    const ours = build.toLoadoutEvent();

    for (const key of ['HullValue', 'ModulesValue', 'Rebuy'] as const) {
        assert.ok(
            ours[key]! > stated[key],
            `${key}: retail ${ours[key]} should exceed the discounted ${stated[key]}`,
        );
    }
    assert.ok(Math.abs(stated.HullValue / ours.HullValue! - 0.975) < 1e-4, 'hull discount');

    // The source's own figures are not lost — they are what the getters report.
    assert.equal(build.modulesValue, stated.ModulesValue);
    assert.equal(build.rebuy, stated.Rebuy);

    // Inara rounds its rebuy where the game truncates: 5% of its own hull + modules is
    // 5_613_800.75, which it states as ...801. We follow the journal and truncate.
    const fivePercent = (stated.HullValue + stated.ModulesValue) * fixture.rebuyFraction;
    assert.equal(stated.Rebuy, Math.round(fivePercent));
    assert.equal(
        Math.trunc((ours.HullValue! + ours.ModulesValue!) * fixture.rebuyFraction),
        ours.Rebuy,
    );
});

test('every figure the Type-11 export needs is computable from it', () => {
    // A build carrying an unpriced or unrecognised module exports no credits at all, so
    // this doubles as a check that all 27 of its modules resolve in the catalogues.
    const build = ShipLoadout.fromSlef(JSON.stringify(inaraFixture));
    assert.equal(build.fittedModules().length, 27);
    const ours = build.toLoadoutEvent();
    for (const key of [
        'UnladenMass',
        'CargoCapacity',
        'MaxJumpRange',
        'ModulesValue',
        'Rebuy',
    ] as const) {
        assert.ok(ours[key] !== undefined, `${key} was omitted`);
    }
    assert.equal(build.cargoCapacity, 208);
    assert.equal(build.weaponMetrics().weapons.length, 5);
});

test('a build assembled here exports the slot keys a game journal would use', () => {
    // The whole point of the per-hull names: an export of a build assembled from scratch
    // has to name mounts the game has. The Anaconda's smallest two optionals are 13 and
    // 14, and it has no 11 or 12 at all.
    const build = ShipLoadout.empty('Anaconda')
        .setModule('Slot13_Size2', module('Int_DetailedSurfaceScanner_Tiny'))
        .setModule('Slot14_Size1', module('Int_DockingComputer_Advanced'));
    const slots = build.toLoadoutEvent().Modules.map((m) => m.Slot);
    assert.deepEqual(slots, ['Slot13_Size2', 'Slot14_Size1']);
    assert.throws(
        () => build.setModule('Slot11_Size2', module('Int_DetailedSurfaceScanner_Tiny')),
        /has no slot "Slot11_Size2"/,
    );
});

test('a journal build on a renamed hull binds to the mounts it names', () => {
    // The key written by the game must find the mount, not land beside it as an extra.
    const event: LoadoutEvent = {
        Ship: 'type9',
        Modules: [
            { Slot: 'Slot00_Size8', Item: 'int_cargorack_size8_class1' },
            { Slot: 'Slot11_Size2', Item: 'int_cargorack_size2_class1' },
        ],
    };
    const build = ShipLoadout.fromLoadout(event);
    assert.equal(build.cargoCapacity, 260);
    for (const slot of build.slots()) {
        if (slot.key === 'Slot00_Size8' || slot.key === 'Slot11_Size2') {
            assert.ok(slot.module, `${slot.key} bound no module`);
        }
    }
    // Every fitted module sits in a mount the hull declares — nothing left over.
    const keys = new Set(build.slots().map((s) => s.key));
    for (const module of build.fittedModules()) {
        assert.ok(keys.has(module.slot), `stray slot ${module.slot}`);
    }

    // …and the same holds for an Inara-style producer that lower-cases its keys, so a
    // hull's own names are bound by the same case rule as every other slot key.
    const lowered = ShipLoadout.fromLoadout({
        Ship: 'anaconda',
        Modules: [{ Slot: 'slot13_size2', Item: 'int_detailedsurfacescanner_tiny' }],
    });
    assert.ok(
        lowered.slots().find((s) => s.key === 'Slot13_Size2')?.module,
        'a lower-cased hull-specific key bound no module',
    );
});
