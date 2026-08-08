import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ammunitionCapacity } from './ammunition.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { ShipLoadout } from './ship-loadout.js';
import fixture from '../../../fixtures/ships/build-metrics.json' with { type: 'json' };
import kraitJournal from '../../../fixtures/ships/journal-krait-phantom.json' with { type: 'json' };
import viperJournal from '../../../fixtures/ships/journal-viper-mkiv.json' with { type: 'json' };
import pythonJournal from '../../../fixtures/ships/journal-python-mkii-antixeno.json' with { type: 'json' };
import corsairJournal from '../../../fixtures/ships/journal-corsair.json' with { type: 'json' };

/** Every journal capture in the fixtures, by file name. */
const JOURNALS = [
    ['journal-krait-phantom.json', kraitJournal],
    ['journal-viper-mkiv.json', viperJournal],
    ['journal-python-mkii-antixeno.json', pythonJournal],
    ['journal-corsair.json', corsairJournal],
] as const;

const module = (symbol: string) => {
    const record = getModuleBySymbol(symbol, ALL_MODULES);
    assert.ok(record, `${symbol} is not in the catalogues`);
    return record;
};

// The fixture writes an unlimited reserve as `null`, because JSON has no infinity. Its
// own `unlimited` flag is read rather than recomputed, so the two cannot drift apart.
const expected = (entry: {
    clipSize: number;
    hopper: number | null;
    total: number | null;
    unlimited: boolean;
}) => ({
    clipSize: entry.clipSize,
    hopper: entry.hopper ?? Number.POSITIVE_INFINITY,
    total: entry.total ?? Number.POSITIVE_INFINITY,
    unlimited: entry.unlimited,
});

test('catalogue modules report the fixture’s magazine, reserve and total', () => {
    for (const entry of fixture.ammunition.catalogue) {
        assert.deepEqual(ammunitionCapacity(module(entry.symbol)), expected(entry), entry.symbol);
    }
});

test('a module that carries no ammunition has no capacity to report', () => {
    for (const symbol of fixture.ammunition.noAmmunition) {
        assert.equal(ammunitionCapacity(module(symbol)), null, symbol);
    }
    assert.equal(ammunitionCapacity(null), null);
    assert.equal(ammunitionCapacity(undefined), null);
    assert.equal(ammunitionCapacity({}), null);
});

test('the reserve excludes the magazine, as the journal’s own hopper does', () => {
    // The Enhanced AX Multi-Cannon the Python Mk II capture flies: 100 loaded, 2100 behind
    // it. The journal reports those two separately and so does this, so the total is the
    // sum rather than either figure on its own.
    const record = module('Hpt_ATMultiCannon_Fixed_Large_V2');
    const capacity = ammunitionCapacity(record)!;
    assert.equal(capacity.clipSize, record.clipSize);
    assert.equal(capacity.hopper, record.ammoMaximum);
    assert.equal(capacity.total, 2200);
});

test('a magazine with no reserve stated is unlimited, and one with an empty reserve is not', () => {
    // Both Abrasion Blasters state a magazine and no reserve, and no other module does.
    const unlimited = ALL_MODULES.filter(
        (record) => record.clipSize !== undefined && record.ammoMaximum === undefined,
    ).map((record) => record.symbol);
    assert.deepEqual(unlimited, [
        'Hpt_Mining_AbrBlstr_Fixed_Small',
        'Hpt_Mining_AbrBlstr_Turret_Small',
    ]);
    for (const symbol of unlimited) {
        const capacity = ammunitionCapacity(module(symbol))!;
        assert.ok(capacity.unlimited, symbol);
        assert.equal(capacity.hopper, Number.POSITIVE_INFINITY, symbol);
        assert.equal(capacity.total, Number.POSITIVE_INFINITY, symbol);
    }
    // A reserve of zero is a different answer and reads as one: this autocannon fires its
    // magazine and has nothing to reload from.
    const empty = ammunitionCapacity(module('Hpt_MkIIPlasmaShockAutocannon_Fixed_Large'))!;
    assert.equal(empty.unlimited, false);
    assert.equal(empty.hopper, 0);
    assert.equal(empty.total, 18);
});

test('a reserve with no magazine stated is drawn from directly', () => {
    // An AFMU carries repair units and no clip to load them into, so its whole capacity is
    // the reserve — not an unlimited one, and not a magazine of unknown size.
    const record = module('Int_Repairer_Size3_Class1');
    assert.equal(record.clipSize, undefined);
    const capacity = ammunitionCapacity(record)!;
    assert.equal(capacity.clipSize, 0);
    assert.equal(capacity.total, record.ammoMaximum);
    assert.equal(capacity.unlimited, false);
});

test('engineering loads whole rounds in the clip, and leaves the reserve as it lands', () => {
    // Every roll is fitted to the slot the fixture names, on a hull refitted per roll so
    // nothing carries over. Utility and hardpoint modules go through the same two calls.
    for (const roll of fixture.ammunition.engineered.rolls) {
        const build = ShipLoadout.empty('Viper');
        build.setModule(roll.slot, module(roll.module));
        assert.deepEqual(
            build.getFittedModule(roll.slot)!.ammunition,
            { ...roll.stock, unlimited: false },
            `${roll.module} stock`,
        );

        build.getFittedModule(roll.slot)!.applyBlueprint(roll.blueprint, {
            grade: roll.grade,
            quality: 1,
            ...('experimental' in roll ? { experimental: roll.experimental } : {}),
        });
        const engineered = build.getFittedModule(roll.slot)!;
        const label = `${roll.module} ${roll.blueprint} grade ${roll.grade}`;
        assert.deepEqual(
            engineered.ammunition,
            { clipSize: roll.clipSize, hopper: roll.hopper, total: roll.total, unlimited: false },
            label,
        );
        if ('burstRounds' in roll) {
            // The clip is a whole number of bursts, not merely a whole number — whether the
            // burst is the recipe's own (Double Shot) or the weapon's (a Concord Cannon).
            assert.equal(engineered.effectiveStats?.burstRounds, roll.burstRounds, label);
            assert.equal(roll.clipSize % roll.burstRounds, 0, label);
        }
    }
});

test('the two capacity paths agree, on a weapon and on a utility module', () => {
    // `FittedModule.ammunition` reads the effective record; `weaponMetrics()` reads the
    // weapon stats. They are separate folds of the same engineering and must not diverge —
    // and a utility module, which no weapon path touches, still answers.
    const build = ShipLoadout.empty('Viper');
    build.setModule('MediumHardpoint1', module('Hpt_MultiCannon_Fixed_Medium'));
    build.setModule('TinyHardpoint1', module('Hpt_ChaffLauncher_Tiny'));
    build.getFittedModule('MediumHardpoint1')!.applyBlueprint('Weapon_HighCapacity', { grade: 5 });
    build.getFittedModule('TinyHardpoint1')!.applyBlueprint('Misc_ChaffCapacity', { grade: 1 });

    const gun = build.weaponMetrics().weapons.find((weapon) => weapon.slot === 'MediumHardpoint1');
    assert.deepEqual(gun?.ammunition, build.getFittedModule('MediumHardpoint1')!.ammunition);
    assert.deepEqual(build.getFittedModule('TinyHardpoint1')!.ammunition, {
        clipSize: 1,
        hopper: 15,
        total: 16,
        unlimited: false,
    });
    // A utility module is not a weapon, so it is not in the firepower report at all.
    assert.equal(
        build.weaponMetrics().weapons.some((weapon) => weapon.slot === 'TinyHardpoint1'),
        false,
    );
});

test('a build reports the capacity of every weapon it carries', () => {
    const build = ShipLoadout.empty('Viper');
    build.setModule('SmallHardpoint1', module('Hpt_MultiCannon_Fixed_Small'));
    build.setModule('SmallHardpoint2', module('Hpt_BeamLaser_Fixed_Small'));

    const guns = build.weaponMetrics();
    const byslot = new Map(guns.weapons.map((weapon) => [weapon.slot, weapon.ammunition]));
    assert.deepEqual(byslot.get('SmallHardpoint1'), {
        clipSize: 100,
        hopper: 2100,
        total: 2200,
        unlimited: false,
    });
    // A beam laser draws from the capacitor, so it has nothing to count.
    assert.equal(byslot.get('SmallHardpoint2'), null);

    // A weapon switched off is still a weapon that holds rounds: it keeps its capacity in
    // the report, and only the per-second totals leave it out.
    build.getFittedModule('SmallHardpoint1')!.setEnabled(false);
    const off = build.weaponMetrics();
    const disabled = off.weapons.find((weapon) => weapon.slot === 'SmallHardpoint1')!;
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.ammunition?.total, 2200);
    const laser = off.weapons.find((weapon) => weapon.slot === 'SmallHardpoint2')!;
    assert.equal(off.total.damagePerSecond, laser.metrics.damagePerSecond);
    assert.ok(off.total.damagePerSecond < guns.total.damagePerSecond);
});

test('every ammo count a journal reports fits inside the capacity for that module', () => {
    // A rearm state is a lower bound on a capacity, never a reading of one. Eight of the
    // nine counts across the three captures happen to sit at capacity — that is what makes
    // them a check on the catalogue — and the ninth is a launcher that has fired once.
    const pinned = fixture.ammunition.journalReadings;
    const below: Record<string, unknown>[] = [];
    let readings = 0;
    let atCapacity = 0;
    const modules = new Set<string>();

    for (const [capture, event] of JOURNALS) {
        const build = ShipLoadout.fromLoadout(event as never);
        for (const fitted of event.Modules) {
            const clip = fitted.AmmoInClip ?? 0;
            const hopper = fitted.AmmoInHopper ?? 0;
            if (!clip && !hopper) continue;
            readings++;
            modules.add(fitted.Item);

            const capacity = build.getFittedModule(fitted.Slot)!.ammunition!;
            assert.ok(clip <= capacity.clipSize, `${capture} ${fitted.Item} clip`);
            assert.ok(hopper <= capacity.hopper, `${capture} ${fitted.Item} hopper`);
            if (clip === capacity.clipSize && hopper === capacity.hopper) atCapacity++;
            else {
                below.push({
                    capture,
                    symbol: fitted.Item,
                    AmmoInClip: clip,
                    AmmoInHopper: hopper,
                    clipSize: capacity.clipSize,
                    ammoMaximum: capacity.hopper,
                });
            }
        }
    }

    assert.equal(readings, pinned.readings);
    assert.equal(modules.size, pinned.distinctModules);
    assert.equal(atCapacity, pinned.atCapacity);
    assert.deepEqual(below, pinned.belowCapacity);
});

test("Frontier's own engineered ammunition figures, against what this library computes", () => {
    // The Corsair capture is the only ground truth for an *engineered* clip or reserve. A
    // parsed build always agrees with it, because a stated modifier is used verbatim; a
    // simulated roll of the same recipe agrees only at full quality.
    const build = ShipLoadout.fromLoadout(corsairJournal as never);
    for (const pinned of fixture.ammunition.engineeredGroundTruth.cases) {
        const fitted = corsairJournal.Modules.find((m) => m.Slot === pinned.slot)!;
        const label = `${pinned.symbol} ${pinned.blueprint} g${pinned.grade} q${pinned.quality}`;
        const stated = (name: string) =>
            fitted.Engineering!.Modifiers.find((m) => m.Label === name)?.Value;

        // The capture says what the fixture says it says.
        assert.equal(fitted.Item, pinned.symbol, label);
        assert.equal(fitted.Engineering!.Level, pinned.grade, label);
        assert.equal(fitted.Engineering!.Quality, pinned.quality, label);
        assert.equal(fitted.Engineering!.ExperimentalEffect ?? null, pinned.experimental, label);
        assert.equal(stated('AmmoClipSize'), pinned.game.clipSize, label);
        assert.equal(stated('AmmoMaximum'), pinned.game.ammoMaximum, label);
        assert.equal(fitted.AmmoInClip, pinned.game.loadedClip, label);
        assert.equal(fitted.AmmoInHopper, pinned.game.loadedHopper, label);

        // A parsed build reports the game's own figures, engineering and all.
        assert.deepEqual(
            build.getFittedModule(pinned.slot)!.ammunition,
            {
                clipSize: pinned.game.clipSize,
                hopper: pinned.game.ammoMaximum,
                total: pinned.game.clipSize + pinned.game.ammoMaximum,
                unlimited: false,
            },
            `${label}: imported`,
        );

        // Simulating the same roll from the catalogue is the part that can disagree, and
        // the fixture pins what it currently produces — including where that is wrong.
        const record = module(pinned.symbol);
        assert.equal(record.clipSize, pinned.base.clipSize, `${label}: base clip`);
        assert.equal(record.ammoMaximum, pinned.base.ammoMaximum, `${label}: base reserve`);

        const simulated = ShipLoadout.empty('Corsair');
        simulated.setModule(pinned.slot, record);
        simulated.getFittedModule(pinned.slot)!.applyBlueprint(pinned.blueprint, {
            grade: pinned.grade,
            quality: pinned.quality,
            ...(pinned.experimental ? { experimental: pinned.experimental } : {}),
        });
        const rolled = simulated.getFittedModule(pinned.slot)!.ammunition!;
        assert.equal(rolled.clipSize, pinned.simulated.clipSize, `${label}: simulated clip`);
        assert.equal(rolled.hopper, pinned.simulated.ammoMaximum, `${label}: simulated reserve`);

        // Whether that simulation matches Frontier is the fixture's `agrees` flag, and the
        // one `false` is https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/57.
        const agrees =
            rolled.clipSize === pinned.game.clipSize && rolled.hopper === pinned.game.ammoMaximum;
        assert.equal(agrees, pinned.agrees, `${label}: agreement with the game`);
    }
    // Full quality agrees; the interpolated roll does not. If that ever changes, this count
    // moves and the issue can be revisited rather than the fixture quietly rewritten.
    assert.equal(fixture.ammunition.engineeredGroundTruth.cases.filter((c) => c.agrees).length, 2);
});

test('the Corsair capture recomputes to the figures Frontier reports for it', () => {
    // The first engineered capture whose own aggregates this library reproduces — the other
    // three are stock builds, so nothing checked an engineered mass or jump range before.
    const pinned = fixture.ammunition.engineeredGroundTruth.recomputed;
    const stripped = { ...corsairJournal } as Record<string, unknown>;
    delete stripped.UnladenMass;
    delete stripped.MaxJumpRange;
    delete stripped.CargoCapacity;

    const build = ShipLoadout.fromLoadout(stripped as never);
    assert.ok(Math.abs(build.unladenMass! - pinned.unladenMass) < 1e-6);
    assert.ok(Math.abs(build.unladenMass! - pinned.journalUnladenMass) < 1e-4);
    assert.equal(Number(build.maxJumpRange().toFixed(6)), pinned.maxJumpRange);
    assert.ok(Math.abs(build.maxJumpRange() - pinned.journalMaxJumpRange) < 1e-4);
    assert.equal(build.cargoCapacity, pinned.cargoCapacity);
});

test('a module the catalogues do not know reports no capacity', () => {
    // `fromLoadout` accepts what a journal carries, including a module this library has no
    // record for; a capacity it cannot compute is `null` rather than a guess.
    const build = ShipLoadout.fromLoadout({
        Ship: 'viper',
        Modules: [{ Slot: 'SmallHardpoint1', Item: 'hpt_not_a_real_module' }],
    });
    const fitted = build.getFittedModule('SmallHardpoint1')!;
    assert.equal(fitted.stats, null);
    assert.equal(fitted.ammunition, null);
});
