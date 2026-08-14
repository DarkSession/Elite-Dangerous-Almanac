import assert from 'node:assert/strict';
import { test } from 'node:test';

import fixture from '../../../fixtures/ships/gunsights.jsonc' with { type: 'json' };
import { SHIPS, getShipBySymbol } from './ships.js';
import { SHIP_GUNSIGHTS, getShipGunsight, projectGunsight } from './gunsights.js';
import { enumerateSlots } from './slots.js';

function assertPointsClose(
    actual: readonly { readonly horizontalTangent: number; readonly verticalTangent: number }[],
    expected: readonly (readonly number[])[],
): void {
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < expected.length; index += 1) {
        const point = actual[index]!;
        const horizontalTangent = expected[index]![0]!;
        const verticalTangent = expected[index]![1]!;
        assert.ok(Math.abs(point.horizontalTangent - horizontalTangent) < 1e-15);
        assert.ok(Math.abs(point.verticalTangent - verticalTangent) < 1e-15);
    }
}

test('the gunsight catalogue covers every hull and hardpoint exactly once', () => {
    assert.equal(Object.keys(SHIP_GUNSIGHTS).length, fixture.shipCount);
    assert.deepEqual(
        Object.keys(SHIP_GUNSIGHTS),
        SHIPS.map((ship) => ship.symbol),
    );
    assert.equal(
        Object.values(SHIP_GUNSIGHTS).reduce((total, gunsight) => total + gunsight.length, 0),
        fixture.hardpointCount,
    );

    for (const ship of SHIPS) {
        const gunsight = SHIP_GUNSIGHTS[ship.symbol];
        assert.ok(gunsight, ship.symbol);
        assert.equal(gunsight.length, ship.hardpoints.length, ship.symbol);
        for (const offset of gunsight) {
            assert.equal(offset.length, 2, ship.symbol);
            assert.ok(offset.every(Number.isFinite), ship.symbol);
        }
    }
});

test('shared parity cases pin offset ordering and range projection', () => {
    for (const expected of fixture.cases) {
        const gunsight = getShipGunsight(expected.ship);
        assert.ok(gunsight, expected.ship);
        assert.deepEqual(gunsight.slice(0, expected.offsets.length), expected.offsets);
        if (expected.slots) {
            const ship = getShipBySymbol(expected.ship);
            assert.ok(ship, expected.ship);
            assert.deepEqual(
                enumerateSlots(ship)
                    .filter((slot) => slot.kind === 'hardpoint')
                    .map((slot) => slot.key),
                expected.slots,
            );
        }
        assertPointsClose(
            projectGunsight(gunsight, expected.rangeMetres).slice(0, expected.points.length),
            expected.points,
        );
    }
});

test('gunsight lookup trims and folds case, returns misses, and guards wrong types', () => {
    assert.equal(getShipGunsight(' sidewinder '), SHIP_GUNSIGHTS.SideWinder);
    assert.equal(getShipGunsight('not_a_ship'), null);
    assert.equal(getShipGunsight(undefined as unknown as string), null);
    assert.throws(() => getShipGunsight(42 as unknown as string), {
        name: 'TypeError',
        message: 'getShipGunsight: shipSymbol must be a string, received number 42',
    });
});

test('projection preserves hardpoint order and rejects invalid ranges', () => {
    const sight = SHIP_GUNSIGHTS.SideWinder!;
    assertPointsClose(projectGunsight(sight, 1000), [
        [-0.0021956754475, -0.001166162014],
        [0.0021971644611, -0.001166162014],
    ]);
    for (const range of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => projectGunsight(sight, range), {
            name: 'RangeError',
            message: 'projectGunsight: targetRangeMetres must be a finite positive number',
        });
    }
});
