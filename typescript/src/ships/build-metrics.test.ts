import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BuildMetrics } from './build-metrics.js';
import { ShipLoadout } from './ship-loadout.js';
import { ALL_MODULES } from './modules-all.js';
import { getShipBySymbol } from './ships.js';
import { powerBudget as calculatePowerBudget } from './power.js';
import { distributorInputResultFor, heatInputResultFor } from './internal/loadout-metrics.js';
import type { OutfittingModule } from './modules.js';

/** The catalogue record for a symbol, which every fixture below starts from. */
function catalogued(symbol: string): OutfittingModule {
    const record = ALL_MODULES.find((module) => module.symbol === symbol);
    assert.ok(record, `expected ${symbol} in the catalogue`);
    return record;
}

/** The same record with one stat removed, as a caller-supplied record may arrive. */
function without(symbol: string, field: keyof OutfittingModule): OutfittingModule {
    const { [field]: dropped, ...rest } = catalogued(symbol);
    assert.notEqual(dropped, undefined, `expected ${symbol} to state ${String(field)}`);
    return rest as OutfittingModule;
}

test('heatMetricsResult names the power plant state that made heat unavailable', () => {
    const disabled = ShipLoadout.default('SideWinder').setModuleEnabled('PowerPlant', false);
    assert.equal(BuildMetrics.of(disabled).heatMetrics(), null);
    assert.deepEqual(BuildMetrics.of(disabled).heatMetricsResult().issues[0], {
        field: 'powerCapacity',
        reason: 'disabled',
        slot: 'PowerPlant',
        symbol: 'Int_Powerplant_Size2_Class1',
        message: 'PowerPlant: Int_Powerplant_Size2_Class1 is switched off',
        params: {
            field: 'powerCapacity',
            reason: 'disabled',
            slot: 'PowerPlant',
            symbol: 'Int_Powerplant_Size2_Class1',
        },
    });

    // A record that does not state the plant's heat efficiency is `unresolved`, not
    // "no plant": the article is fitted, the number is not there.
    const vague = ShipLoadout.default('SideWinder').setModule(
        'PowerPlant',
        without('Int_Powerplant_Size2_Class1', 'heatEfficiency'),
    );
    assert.equal(BuildMetrics.of(vague).heatMetrics(), null);
    assert.deepEqual(BuildMetrics.of(vague).heatMetricsResult().issues[0], {
        field: 'heatEfficiency',
        reason: 'unresolved',
        slot: 'PowerPlant',
        symbol: 'Int_Powerplant_Size2_Class1',
        message: 'PowerPlant: heat efficiency unavailable for Int_Powerplant_Size2_Class1',
        params: {
            field: 'heatEfficiency',
            reason: 'unresolved',
            slot: 'PowerPlant',
            symbol: 'Int_Powerplant_Size2_Class1',
        },
    });

    const complete = BuildMetrics.of(ShipLoadout.default('SideWinder')).heatMetricsResult();
    assert.equal(complete.complete, true);
    assert.deepEqual(complete.issues, []);
});

test('heat reports a missing plant as `missing` rather than as an unread stat', () => {
    // No `ShipLoadout` can reach this state — every build fills its core mounts — so the
    // fitted set is handed to the adapter directly.
    const ship = getShipBySymbol('SideWinder');
    assert.ok(ship);
    const result = heatInputResultFor(ship, [], calculatePowerBudget(10, []), () => null);
    assert.equal(result.complete, false);
    assert.deepEqual(result.issues[0], {
        field: 'powerCapacity',
        reason: 'missing',
        slot: 'PowerPlant',
        message: 'PowerPlant: no power plant is fitted',
        params: { field: 'powerCapacity', reason: 'missing', slot: 'PowerPlant' },
    });
});

test('distributorMetricsResult tells the four unavailable states apart', () => {
    const stock = BuildMetrics.of(ShipLoadout.default('Anaconda')).distributorMetricsResult();
    assert.equal(stock.complete, true);

    const disabled = ShipLoadout.default('Anaconda').setModuleEnabled('PowerDistributor', false);
    assert.equal(BuildMetrics.of(disabled).distributorMetrics(), null);
    assert.deepEqual(BuildMetrics.of(disabled).distributorMetricsResult().issues[0], {
        field: 'powerDistributor',
        reason: 'disabled',
        slot: 'PowerDistributor',
        symbol: 'Int_PowerDistributor_Size8_Class1',
        message: 'PowerDistributor: Int_PowerDistributor_Size8_Class1 is switched off',
        params: {
            field: 'powerDistributor',
            reason: 'disabled',
            slot: 'PowerDistributor',
            symbol: 'Int_PowerDistributor_Size8_Class1',
        },
    });

    const vague = ShipLoadout.default('Anaconda').setModule(
        'PowerDistributor',
        without('Int_PowerDistributor_Size8_Class1', 'enginesCapacity'),
    );
    assert.deepEqual(BuildMetrics.of(vague).distributorMetricsResult().issues[0], {
        field: 'powerDistributor',
        reason: 'unresolved',
        slot: 'PowerDistributor',
        symbol: 'Int_PowerDistributor_Size8_Class1',
        message:
            'PowerDistributor: power-distributor stats unavailable for Int_PowerDistributor_Size8_Class1',
        params: {
            field: 'powerDistributor',
            reason: 'unresolved',
            slot: 'PowerDistributor',
            symbol: 'Int_PowerDistributor_Size8_Class1',
        },
    });

    // A plant too small to keep the distributor's priority group lit sheds it.
    const source = ShipLoadout.default('Anaconda').toLoadoutEvent();
    const shed = ShipLoadout.fromLoadout({
        ...source,
        Modules: source.Modules.map((module) => ({
            ...module,
            ...(module.Slot === 'PowerPlant' ? { Item: 'Int_Powerplant_Size2_Class1' } : {}),
            Priority: module.Slot === 'PowerDistributor' ? 4 : 0,
        })),
    });
    assert.equal(BuildMetrics.of(shed).distributorMetrics(), null);
    assert.deepEqual(BuildMetrics.of(shed).distributorMetricsResult().issues[0], {
        field: 'powerDistributor',
        reason: 'shed',
        slot: 'PowerDistributor',
        symbol: 'int_powerdistributor_size8_class1',
        message:
            'PowerDistributor: int_powerdistributor_size8_class1 is not powered with hardpoints retracted',
        params: {
            field: 'powerDistributor',
            reason: 'shed',
            slot: 'PowerDistributor',
            symbol: 'int_powerdistributor_size8_class1',
        },
    });
});

test('a build with no distributor at all reports `missing`', () => {
    const result = distributorInputResultFor(
        [],
        { systemsPips: 4, enginesPips: 4, weaponsPips: 4 },
        calculatePowerBudget(10, []),
        () => null,
    );
    assert.equal(result.complete, false);
    assert.deepEqual(result.issues[0], {
        field: 'powerDistributor',
        reason: 'missing',
        slot: 'PowerDistributor',
        message: 'PowerDistributor: no power distributor is fitted',
        params: { field: 'powerDistributor', reason: 'missing', slot: 'PowerDistributor' },
    });
});

test('a disabled distributor does not hide an enabled one', () => {
    const record = catalogued('Int_PowerDistributor_Size8_Class1');
    const result = distributorInputResultFor(
        [
            { Slot: 'PowerDistributor', Item: record.symbol, On: false },
            { Slot: 'Slot01_Size8', Item: record.symbol },
        ],
        { systemsPips: 4, enginesPips: 4, weaponsPips: 4 },
        calculatePowerBudget(100, []),
        () => record,
    );
    assert.equal(result.complete, true);
    assert.equal(result.value?.enginesCapacity, record.enginesCapacity);
});

test('standardLoad is the nullable twin of standardLoadResult', () => {
    const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));
    assert.deepEqual(metrics.standardLoad('laden'), metrics.standardLoadResult('laden').value);
    assert.equal(metrics.standardLoad('laden')?.mass, 1210);

    // Only `'maximum'` validates the drive, so only it can answer `null`.
    const noDrive = ShipLoadout.default('Anaconda').setModule(
        'FrameShiftDrive',
        without('Int_Hyperdrive_Size6_Class1', 'maxFuel'),
    );
    assert.equal(BuildMetrics.of(noDrive).standardLoad('maximum'), null);
    assert.equal(
        BuildMetrics.of(noDrive).standardLoadResult('maximum').issues[0]?.reason,
        'unresolved',
    );
    assert.ok(BuildMetrics.of(noDrive).standardLoad('unladen'));
});

test('an absent shield-generator distributorDraw is unresolved, never a stand-in 0.6', () => {
    // Every catalogued generator states this draw, so nothing shipped can reach the
    // branch; a caller-supplied record can, and used to get an invented number back
    // dressed as a measurement.
    const generators = ALL_MODULES.filter((module) =>
        module.symbol.toLowerCase().startsWith('int_shieldgenerator'),
    );
    assert.equal(generators.length, 57);
    assert.deepEqual([...new Set(generators.map((module) => module.distributorDraw))], [0.6]);

    const build = ShipLoadout.default('Anaconda').setModule(
        'Slot03_Size6',
        without('Int_ShieldGenerator_Size6_Class1', 'distributorDraw'),
    );
    const metrics = BuildMetrics.of(build);
    assert.equal(metrics.shieldRecovery(), null);
    assert.deepEqual(metrics.shieldRecoveryResult().issues[0], {
        field: 'shieldGenerator',
        reason: 'unresolved',
        slot: 'Slot03_Size6',
        symbol: 'Int_ShieldGenerator_Size6_Class1',
        message:
            'Slot03_Size6: shield-generator stats unavailable for Int_ShieldGenerator_Size6_Class1',
        params: {
            field: 'shieldGenerator',
            reason: 'unresolved',
            slot: 'Slot03_Size6',
            symbol: 'Int_ShieldGenerator_Size6_Class1',
        },
    });

    // Strength does not depend on the draw, so that metric still answers.
    assert.ok((metrics.shieldMetrics()?.strength ?? 0) > 0);

    // The complete record recovers, so the branch above is the missing stat and not the fit.
    const stated = ShipLoadout.default('Anaconda');
    assert.ok((BuildMetrics.of(stated).shieldRecovery()?.recoveryTime ?? 0) > 0);
});

test('the two shield options types carry the two deliberate SYS-pip defaults', () => {
    const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));
    assert.equal(
        metrics.shieldMetrics()?.resistances.thermal,
        metrics.shieldMetrics({ systemsPips: 0 })?.resistances.thermal,
    );
    assert.notEqual(
        metrics.shieldMetrics()?.resistances.thermal,
        metrics.shieldMetrics({ systemsPips: 4 })?.resistances.thermal,
    );
    assert.deepEqual(metrics.shieldRecovery(), metrics.shieldRecovery({ systemsPips: 4 }));
    assert.notDeepEqual(metrics.shieldRecovery(), metrics.shieldRecovery({ systemsPips: 0 }));
});
