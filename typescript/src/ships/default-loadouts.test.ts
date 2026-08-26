import { test } from 'node:test';
import assert from 'node:assert/strict';

import fixture from '../../../fixtures/ships/default-loadouts.jsonc' with { type: 'json' };
import { DEFAULT_LOADOUTS, getDefaultLoadout } from './default-loadouts.js';
import { ALL_MODULES } from './modules-all.js';
import { SHIPS } from './ships.js';
import { getModuleBySymbol } from './modules.js';
import { enumerateSlots, parseSlotName } from './slots.js';
import { isBuiltInHullModule } from './internal/loadout-state.js';
import { moduleFitError } from './internal/loadout-fitting.js';
import { ShipLoadout } from './ship-loadout.js';
import { BuildMetrics } from './build-metrics.js';

test('every hull carries a free, weightless stock bulkhead and cargo hatch', () => {
    // What lets import stock those two mounts from absence without invalidating a
    // capture's own mass and credit figures — see `normalizeLoadoutEvent`. A core
    // internal is priced and massed, so stocking one does invalidate them.
    for (const loadout of DEFAULT_LOADOUTS) {
        for (const module of loadout.modules) {
            const kind = parseSlotName(module.slot)?.kind;
            if (kind !== 'armour' && kind !== 'cargoHatch') continue;
            // The Fer-de-Lance and Lynx Highliner name their own hatch symbol for the one
            // article the catalogue carries under the standard hatch.
            const stats = getModuleBySymbol(module.symbol, ALL_MODULES);
            if (stats === null) {
                assert.ok(isBuiltInHullModule({ Slot: module.slot, Item: module.symbol }));
                continue;
            }
            assert.equal(stats.cost, 0, `${loadout.symbol} ${module.slot} cost`);
            assert.equal(stats.mass, 0, `${loadout.symbol} ${module.slot} mass`);
        }
    }
});

test('every ship has one default loadout and every fitted symbol resolves', () => {
    assert.equal(DEFAULT_LOADOUTS.length, fixture.shipCount);
    assert.deepEqual(
        DEFAULT_LOADOUTS.map((loadout) => loadout.symbol),
        SHIPS.map((ship) => ship.symbol),
    );
    assert.equal(
        DEFAULT_LOADOUTS.reduce((count, loadout) => count + loadout.modules.length, 0),
        fixture.moduleCount,
    );

    const moduleBySymbol = new Map(
        ALL_MODULES.map((module) => [module.symbol.toLowerCase(), module]),
    );
    const cargoHatchSymbols = new Set(['modularcargobaydoor', 'modularcargobaydoorfdl']);
    for (const loadout of DEFAULT_LOADOUTS) {
        const ship = SHIPS.find((candidate) => candidate.symbol === loadout.symbol);
        assert.ok(ship, loadout.symbol);
        const slotByKey = new Map(
            enumerateSlots(ship).map((slot) => [slot.key.toLowerCase(), slot]),
        );
        const seen = new Set<string>();
        for (const fitted of loadout.modules) {
            const key = fitted.slot.toLowerCase();
            assert.ok(!seen.has(key), `${loadout.symbol}: duplicate ${fitted.slot}`);
            seen.add(key);
            const slot = slotByKey.get(key);
            assert.ok(slot, `${loadout.symbol}: unknown ${fitted.slot}`);
            const module = moduleBySymbol.get(fitted.symbol.toLowerCase());
            if (slot.kind === 'cargoHatch') {
                assert.ok(
                    cargoHatchSymbols.has(fitted.symbol.toLowerCase()),
                    `${loadout.symbol}: unknown cargo hatch ${fitted.symbol}`,
                );
            } else {
                assert.ok(module, `${loadout.symbol}: unknown ${fitted.symbol}`);
                assert.equal(moduleFitError(loadout.symbol, slot, module), null);
            }
        }
        for (const slot of slotByKey.values()) {
            if (
                slot.kind === 'core' ||
                slot.kind === 'armour' ||
                slot.kind === 'cargoHatch' ||
                slot.restriction === 'planetaryApproachSuite'
            ) {
                assert.ok(
                    seen.has(slot.key.toLowerCase()),
                    `${loadout.symbol}: missing ${slot.key}`,
                );
            }
        }
    }
});

test('the fixture pins representative fitted and empty mounts', () => {
    for (const expected of fixture.spot) {
        const loadout = getDefaultLoadout(expected.ship);
        assert.ok(loadout);
        for (const module of expected.modules) {
            assert.deepEqual(
                loadout.modules.find((candidate) => candidate.slot === module.slot),
                module,
            );
        }
        for (const slot of expected.empty) {
            assert.equal(
                loadout.modules.some((module) => module.slot === slot),
                false,
            );
        }
    }
});

test('default-loadout lookup trims and folds case, returns misses, and guards wrong types', () => {
    assert.equal(getDefaultLoadout(' sidewinder ')?.symbol, 'SideWinder');
    assert.equal(getDefaultLoadout('not_a_ship'), null);
    assert.equal(getDefaultLoadout(undefined as unknown as string), null);
    assert.throws(() => getDefaultLoadout(42 as unknown as string), {
        name: 'TypeError',
        message: 'getDefaultLoadout: shipSymbol must be a string, received number 42',
    });
});

test('every hull leaves the shipyard light enough for its own stock thrusters', () => {
    // The stock fit is the floor the outfitting screen starts from, so a hull that
    // shipped over its own rating would open the editor already invalid.
    for (const ship of SHIPS) {
        const build = ShipLoadout.default(ship.symbol);
        const maxMass = BuildMetrics.of(build).thrusters()?.maxMass;
        assert.ok(maxMass !== undefined, `${ship.symbol}: stock thrusters state no rated mass`);
        assert.ok(
            build.unladenMass <= maxMass,
            `${ship.symbol}: ${build.unladenMass} t unladen against a ${maxMass} t rating`,
        );
        assert.equal(build.validation().valid, true, ship.symbol);
    }
});
