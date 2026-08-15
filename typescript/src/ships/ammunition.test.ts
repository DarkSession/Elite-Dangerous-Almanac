import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ammunitionCapacity } from './ammunition.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { ShipLoadout } from './ship-loadout.js';
import { getPreEngineeredVariants } from './pre-engineered.js';
import { getPreEngineeredStats } from './pre-engineered-stats.js';
import fixture from '../../../fixtures/ships/build-metrics.jsonc' with { type: 'json' };
import slapacondaJournal from '../../../fixtures/ships/journal-anaconda-slapaconda.jsonc' with { type: 'json' };
import kraitJournal from '../../../fixtures/ships/journal-krait-phantom.jsonc' with { type: 'json' };
import viperJournal from '../../../fixtures/ships/journal-viper-mkiv.jsonc' with { type: 'json' };
import pythonJournal from '../../../fixtures/ships/journal-python-mkii-antixeno.jsonc' with { type: 'json' };
import spireOpsJournal from '../../../fixtures/ships/journal-python-mkii-spire-ops.jsonc' with { type: 'json' };
import corsairJournal from '../../../fixtures/ships/journal-corsair.jsonc' with { type: 'json' };
import corvetteJournal from '../../../fixtures/ships/journal-federation-corvette.jsonc' with { type: 'json' };
import corvetteBeamsJournal from '../../../fixtures/ships/journal-federation-corvette-beams.jsonc' with { type: 'json' };
import corvetteMultiroleJournal from '../../../fixtures/ships/journal-federation-corvette-multirole.jsonc' with { type: 'json' };
import corvetteMixedJournal from '../../../fixtures/ships/journal-federation-corvette-mixed.jsonc' with { type: 'json' };
import corvettePlasmaJournal from '../../../fixtures/ships/journal-federation-corvette-plasma.jsonc' with { type: 'json' };
import cobraJournal from '../../../fixtures/ships/journal-cobra-mkv.jsonc' with { type: 'json' };
import kestrelJournal from '../../../fixtures/ships/journal-kestrel-mkii.jsonc' with { type: 'json' };
import lynxRescueJournal from '../../../fixtures/ships/journal-lynx-highliner-rescue.jsonc' with { type: 'json' };
import lynxJournal from '../../../fixtures/ships/journal-lynx-highliner.jsonc' with { type: 'json' };
import lynxCurrentJournal from '../../../fixtures/ships/journal-lynx-highliner-rescue01-current.jsonc' with { type: 'json' };
import pantherJournal from '../../../fixtures/ships/journal-panther-mkii-fat-arse.jsonc' with { type: 'json' };
import deepBlackJournal from '../../../fixtures/ships/journal-the-deep-black.jsonc' with { type: 'json' };
import caspianJournal from '../../../fixtures/ships/journal-caspian-explorer.jsonc' with { type: 'json' };

/** The shape this file reads off a capture — a journal states more than the library models. */
interface JournalAmmoModule {
    Slot: string;
    Item: string;
    AmmoInClip?: number;
    AmmoInHopper?: number;
    Engineering?: {
        BlueprintName: string;
        Level: number;
        Quality: number;
        ExperimentalEffect?: string;
        Modifiers: { Label: string; Value?: number }[];
    };
}

/** Every journal capture in the fixtures, by file name. */
const JOURNALS = [
    ['journal-anaconda-slapaconda.jsonc', slapacondaJournal],
    ['journal-krait-phantom.jsonc', kraitJournal],
    ['journal-viper-mkiv.jsonc', viperJournal],
    ['journal-python-mkii-antixeno.jsonc', pythonJournal],
    ['journal-python-mkii-spire-ops.jsonc', spireOpsJournal],
    ['journal-corsair.jsonc', corsairJournal],
    ['journal-federation-corvette.jsonc', corvetteJournal],
    ['journal-federation-corvette-beams.jsonc', corvetteBeamsJournal],
    ['journal-federation-corvette-multirole.jsonc', corvetteMultiroleJournal],
    ['journal-federation-corvette-mixed.jsonc', corvetteMixedJournal],
    ['journal-federation-corvette-plasma.jsonc', corvettePlasmaJournal],
    ['journal-cobra-mkv.jsonc', cobraJournal],
    ['journal-kestrel-mkii.jsonc', kestrelJournal],
    ['journal-lynx-highliner-rescue.jsonc', lynxRescueJournal],
    ['journal-lynx-highliner.jsonc', lynxJournal],
    ['journal-lynx-highliner-rescue01-current.jsonc', lynxCurrentJournal],
    ['journal-panther-mkii-fat-arse.jsonc', pantherJournal],
    ['journal-the-deep-black.jsonc', deepBlackJournal],
    ['journal-caspian-explorer.jsonc', caspianJournal],
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

test('engineering loads whole rounds in the clip and reserve', () => {
    // Every roll is fitted to the slot the fixture names, on a hull refitted per roll so
    // nothing carries over. Utility and hardpoint modules go through the same two calls.
    for (const roll of fixture.ammunition.engineered.rolls) {
        const build = ShipLoadout.empty('Viper');
        build.setModule(roll.slot, module(roll.module));
        assert.deepEqual(
            build.fittedModuleAt(roll.slot)!.ammunition,
            { ...roll.stock, unlimited: false },
            `${roll.module} stock`,
        );

        build.applyBlueprint(roll.slot, roll.blueprint, {
            grade: roll.grade,
            quality: 1,
            ...('experimental' in roll ? { experimental: roll.experimental } : {}),
        });
        const engineered = build.fittedModuleAt(roll.slot)!;
        const label = `${roll.module} ${roll.blueprint} grade ${roll.grade}`;
        assert.deepEqual(
            engineered.ammunition,
            { clipSize: roll.clipSize, hopper: roll.hopper, total: roll.total, unlimited: false },
            label,
        );
        if ('burstRounds' in roll) {
            // The clip is a whole number of bursts, not merely a whole number — whether the
            // burst is the recipe's own (Double Shot) or the weapon's (a Concord Cannon).
            const stockBurst = module(roll.module).burstRounds;
            if (stockBurst !== undefined) {
                assert.equal(engineered.effectiveStats?.burstRounds, roll.burstRounds, label);
            } else {
                assert.equal(engineered.effectiveStats?.burstRounds, undefined, label);
                assert.ok(
                    engineered.engineering?.Modifiers?.some(
                        (modifier) => modifier.Label === 'RateOfFire',
                    ),
                    label,
                );
            }
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
    build.applyBlueprint('MediumHardpoint1', 'Weapon_HighCapacity', { grade: 5 });
    build.applyBlueprint('TinyHardpoint1', 'Misc_ChaffCapacity', { grade: 1 });

    const gun = build.weaponMetrics().weapons.find((weapon) => weapon.slot === 'MediumHardpoint1');
    assert.deepEqual(gun?.ammunition, build.fittedModuleAt('MediumHardpoint1')!.ammunition);
    assert.deepEqual(build.fittedModuleAt('TinyHardpoint1')!.ammunition, {
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
    build.setModuleEnabled('SmallHardpoint1', false);
    const off = build.weaponMetrics();
    const disabled = off.weapons.find((weapon) => weapon.slot === 'SmallHardpoint1')!;
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.ammunition?.total, 2200);
    const laser = off.weapons.find((weapon) => weapon.slot === 'SmallHardpoint2')!;
    assert.equal(off.total.damagePerSecond, laser.metrics.damagePerSecond);
    assert.ok(off.total.damagePerSecond < guns.total.damagePerSecond);
});

test('every ammo count a journal reports fits inside the capacity for that module', () => {
    // A rearm state is a lower bound on a capacity, never a reading of one. All 92 counts
    // across the nineteen captures happen to sit at capacity — that is what makes them a
    // check on the catalogue — but a partly spent launcher would report less and say
    // nothing.
    const pinned = fixture.ammunition.journalReadings;
    const below: Record<string, unknown>[] = [];
    let readings = 0;
    let atCapacity = 0;
    const modules = new Set<string>();

    for (const [capture, event] of JOURNALS) {
        const build = ShipLoadout.fromLoadout(event as never);
        for (const fitted of event.Modules as readonly JournalAmmoModule[]) {
            const clip = fitted.AmmoInClip ?? 0;
            const hopper = fitted.AmmoInHopper ?? 0;
            if (!clip && !hopper) continue;
            readings++;
            modules.add(fitted.Item);

            const capacity = build.fittedModuleAt(fitted.Slot)!.ammunition!;
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
    // Seven captures state an engineered clip or reserve. A parsed build always agrees
    // with the capture, because a stated modifier is used verbatim. Two captures carry
    // stale quality metadata; the fixture preserves it as `reportedQuality` and uses the
    // manually verified quality for simulation.
    for (const pinned of fixture.ammunition.engineeredGroundTruth.cases) {
        const capture = JOURNALS.find(([file]) => file === pinned.capture)?.[1];
        assert.ok(capture, `${pinned.capture} is pinned but not read`);
        const build = ShipLoadout.fromLoadout(capture as never);
        const fitted = (capture as { Modules: JournalAmmoModule[] }).Modules.find(
            (m) => m.Slot === pinned.slot,
        )!;
        const label = `${pinned.symbol} ${pinned.blueprint} g${pinned.grade} q${pinned.quality}`;
        const stated = (name: string) =>
            fitted.Engineering!.Modifiers.find((m) => m.Label === name)?.Value;
        // A recipe need not touch the magazine: the heat-sink launcher's only ammunition
        // leg is its reserve, so its clip stands at the catalogue's figure.
        const gameClip = pinned.game.clipSize ?? pinned.base.clipSize;

        // The capture says what the fixture says it says.
        assert.equal(fitted.Item, pinned.symbol, label);
        assert.equal(fitted.Engineering!.Level, pinned.grade, label);
        assert.equal(
            fitted.Engineering!.Quality,
            'reportedQuality' in pinned ? pinned.reportedQuality : pinned.quality,
            label,
        );
        assert.equal(fitted.Engineering!.ExperimentalEffect ?? null, pinned.experimental, label);
        assert.equal(stated('AmmoClipSize'), pinned.game.clipSize, label);
        assert.equal(stated('AmmoMaximum'), pinned.game.ammoMaximum, label);
        assert.equal(fitted.AmmoInClip, pinned.game.loadedClip, label);
        assert.equal(fitted.AmmoInHopper, pinned.game.loadedHopper, label);

        // A parsed build reports the game's own figures, engineering and all.
        assert.deepEqual(
            build.fittedModuleAt(pinned.slot)!.ammunition,
            {
                clipSize: gameClip,
                hopper: pinned.game.ammoMaximum,
                total: gameClip + pinned.game.ammoMaximum,
                unlimited: false,
            },
            `${label}: imported`,
        );

        // Simulating the corrected roll from the catalogue is the part that can disagree,
        // and the fixture pins its output, including known limitations.
        const record = module(pinned.symbol);
        assert.equal(record.clipSize, pinned.base.clipSize, `${label}: base clip`);
        assert.equal(record.ammoMaximum, pinned.base.ammoMaximum, `${label}: base reserve`);

        const simulated = ShipLoadout.empty(pinned.ship);
        if ('preEngineered' in pinned && pinned.preEngineered) {
            const variant = getPreEngineeredVariants(pinned.symbol).find(
                (candidate) => candidate.blueprint === pinned.blueprint,
            );
            assert.ok(variant, `${label}: missing pre-engineered variant`);
            simulated.setModule(pinned.slot, getPreEngineeredStats(variant)!);
        } else {
            simulated.setModule(pinned.slot, record);
            simulated.applyBlueprint(pinned.slot, pinned.blueprint, {
                grade: pinned.grade,
                quality: pinned.quality,
                ...(pinned.experimental ? { experimental: pinned.experimental } : {}),
            });
        }
        const rolled = simulated.fittedModuleAt(pinned.slot)!.ammunition!;
        assert.equal(
            rolled.clipSize,
            pinned.simulated.clipSize ?? pinned.base.clipSize,
            `${label}: simulated clip`,
        );
        assert.equal(rolled.hopper, pinned.simulated.ammoMaximum, `${label}: simulated reserve`);

        // Whether that simulation matches Frontier is the fixture's `agrees` flag.
        const agrees = rolled.clipSize === gameClip && rolled.hopper === pinned.game.ammoMaximum;
        assert.equal(agrees, pinned.agrees, `${label}: agreement with the game`);
    }
    // The only non-matching simulation is explicitly a legacy roll, whose attributes
    // advanced independently and cannot be reconstructed from one shared quality. Counting
    // it is not the guard — the sweep below is, because a case list that quietly shrinks is
    // how the evidence would be dropped rather than faced.
    const { cases } = fixture.ammunition.engineeredGroundTruth;
    const legacy = cases.filter((c) => !c.agrees);
    assert.equal(legacy.length, 1);
    assert.equal('legacyEngineering' in legacy[0]! && legacy[0].legacyEngineering, true);
});

test('the Corsair capture recomputes to the figures Frontier reports for it', () => {
    // An engineered build whose own aggregates this library reproduces from its parts, so
    // the mass and jump-range maths answer to Frontier and not only to themselves.
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
    const fitted = build.fittedModuleAt('SmallHardpoint1')!;
    assert.equal(fitted.stats, null);
    assert.equal(fitted.ammunition, null);
});

test('every journal capture in the fixtures is read for its ammunition', () => {
    // The list above is hand-maintained, and a capture's ammunition readings are the only
    // external readings of what a module had loaded, so a capture missing from it is ground
    // truth the repository holds and never looks at.
    const onDisk = readdirSync(fileURLToPath(new URL('../../../fixtures/ships/', import.meta.url)))
        .filter((file) => file.startsWith('journal-') && file.endsWith('.jsonc'))
        .sort();
    assert.deepEqual(
        JOURNALS.map(([file]) => file)
            .slice()
            .sort(),
        onDisk,
    );
});

test('every engineered clip or reserve a capture states is pinned', () => {
    // The one list on this fixture that a magic number cannot guard: a reading dropped from
    // it is evidence the repository holds and stops looking at, which is exactly what the
    // four disagreements make costly.
    const stated: { capture: string; slot: string }[] = [];
    for (const [file, event] of JOURNALS) {
        for (const fitted of (event as { Modules: JournalAmmoModule[] }).Modules) {
            const carries = (fitted.Engineering?.Modifiers ?? []).some(
                (modifier) => modifier.Label === 'AmmoClipSize' || modifier.Label === 'AmmoMaximum',
            );
            if (carries) stated.push({ capture: file, slot: fitted.Slot });
        }
    }
    // Compared as a set: the fixture reads in capture order, the sweep in list order.
    const key = ({ capture, slot }: { capture: string; slot: string }) => `${capture}|${slot}`;
    assert.deepEqual(
        fixture.ammunition.engineeredGroundTruth.cases.map(key).sort(),
        stated.map(key).sort(),
    );
});
