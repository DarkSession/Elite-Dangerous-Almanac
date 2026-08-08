import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ammunitionCapacity } from './ammunition.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { ShipLoadout } from './ship-loadout.js';
import fixture from '../../../fixtures/ships/build-metrics.json' with { type: 'json' };

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
    const capacity = ammunitionCapacity(module('Hpt_ATMultiCannon_Fixed_Large_V2'))!;
    assert.equal(capacity.clipSize + capacity.hopper, capacity.total);
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
    // An AFMU carries repair units and no clip to load them into.
    const capacity = ammunitionCapacity(module('Int_Repairer_Size3_Class1'))!;
    assert.equal(capacity.clipSize, 0);
    assert.equal(capacity.total, capacity.hopper);
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

    // Capacity is a per-weapon answer: adding it left the totals as they were, and a
    // capacity is nothing to add up across weapons anyway.
    assert.equal('ammunition' in guns.total, false);

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
