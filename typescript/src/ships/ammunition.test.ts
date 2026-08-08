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

// The fixture writes an unlimited reserve as `null`, because JSON has no infinity.
const expected = (entry: { clipSize: number; hopper: number | null; total: number | null }) => ({
    clipSize: entry.clipSize,
    hopper: entry.hopper ?? Number.POSITIVE_INFINITY,
    total: entry.total ?? Number.POSITIVE_INFINITY,
    unlimited: entry.hopper === null,
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

test('a magazine with no reserve stated is unlimited, not empty', () => {
    // The mining Abrasion Blaster is the catalogues' only module in that position.
    const capacity = ammunitionCapacity(module('Hpt_Mining_AbrBlstr_Fixed_Small'))!;
    assert.ok(capacity.unlimited);
    assert.equal(capacity.hopper, Number.POSITIVE_INFINITY);
    assert.equal(capacity.total, Number.POSITIVE_INFINITY);
    // A reserve of zero is a different thing, and reads as one.
    const empty = ammunitionCapacity({ clipSize: 1, ammoMaximum: 0 })!;
    assert.equal(empty.unlimited, false);
    assert.equal(empty.total, 1);
});

test('a reserve with no magazine stated is drawn from directly', () => {
    // An AFMU carries repair units and no clip to load them into.
    const capacity = ammunitionCapacity(module('Int_Repairer_Size3_Class1'))!;
    assert.equal(capacity.clipSize, 0);
    assert.equal(capacity.total, capacity.hopper);
    assert.equal(capacity.unlimited, false);
});

test('engineering moves both figures, and a fractional roll is left as it lands', () => {
    const { module: symbol, blueprint, stock, rolls } = fixture.ammunition.engineered;
    const build = ShipLoadout.empty('Viper');
    build.setModule('SmallHardpoint1', module(symbol));
    assert.deepEqual(build.getFittedModule('SmallHardpoint1')!.ammunition, {
        ...stock,
        unlimited: false,
    });

    for (const roll of rolls) {
        const engineered = ShipLoadout.empty('Viper');
        engineered.setModule('SmallHardpoint1', module(symbol));
        engineered
            .getFittedModule('SmallHardpoint1')!
            .applyBlueprint(blueprint, { grade: roll.grade, quality: roll.quality });
        assert.deepEqual(
            engineered.getFittedModule('SmallHardpoint1')!.ammunition,
            { clipSize: roll.clipSize, hopper: roll.hopper, total: roll.total, unlimited: false },
            `${blueprint} grade ${roll.grade}`,
        );
    }
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
});
