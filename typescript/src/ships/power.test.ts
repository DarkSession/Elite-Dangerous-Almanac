import { test } from 'node:test';
import assert from 'node:assert/strict';

import { powerBudget } from './power.js';
import fixture from '../../../fixtures/ships/build-metrics.jsonc' with { type: 'json' };

test('a build inside its budget powers every group', () => {
    const budget = powerBudget(20, [
        { draw: 5, priority: 1 },
        { draw: 4, priority: 2 },
        { draw: 3, priority: 5 },
    ]);
    assert.equal(budget.available, 20);
    assert.equal(budget.retracted, 12);
    assert.equal(budget.deployed, 12);
    assert.equal(budget.headroom, 8);
    assert.equal(budget.utilisation, 0.6);
    assert.ok(budget.withinBudget);
    assert.ok(budget.bands.every((band) => band.poweredDeployed && band.poweredRetracted));
});

test('weapons only draw with the hardpoints deployed', () => {
    const budget = powerBudget(10, [
        { draw: 2, priority: 1 },
        { draw: 3, priority: 1, deployedOnly: true },
    ]);
    assert.equal(budget.retracted, 2);
    assert.equal(budget.deployed, 5);
    // A group's own figures follow the same rule: deployed includes what it drew stowed.
    assert.equal(budget.bands[0]?.retracted, 2);
    assert.equal(budget.bands[0]?.deployed, 5);
    assert.equal(budget.bands[0]?.deployedTotal, 5);
});

test("each group's own draw sums back to the build's totals", () => {
    const budget = powerBudget(30, [
        { draw: 1.5, priority: 1 },
        { draw: 2, priority: 3, deployedOnly: true },
        { draw: 0.5, priority: 5 },
    ]);
    const sum = (pick: (band: (typeof budget.bands)[number]) => number) =>
        budget.bands.reduce((total, band) => total + pick(band), 0);
    assert.equal(
        sum((band) => band.retracted),
        budget.retracted,
    );
    assert.equal(
        sum((band) => band.deployed),
        budget.deployed,
    );
    // ...and every band is at least as hungry deployed as stowed.
    assert.ok(budget.bands.every((band) => band.deployed >= band.retracted));
});

test('a switched-off module draws nothing', () => {
    const budget = powerBudget(10, [
        { draw: 2, priority: 1 },
        { draw: 8, priority: 1, enabled: false },
    ]);
    assert.equal(budget.deployed, 2);
});

test('rejects invalid available power and known consumer draws', () => {
    for (const available of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => powerBudget(available, []), RangeError);
    }
    for (const draw of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => powerBudget(10, [{ draw }]), RangeError);
    }
});

test('does not validate irrelevant disabled or explicitly unknown placeholder draws', () => {
    const unknown = { draw: Number.NaN, drawUnknown: true, label: 'unknown' };
    const budget = powerBudget(10, [unknown, { draw: -1, enabled: false }]);
    assert.deepEqual(budget.unknownDraws, [unknown]);
    assert.equal(budget.deployed, 0);
});

test('priority groups are cumulative and the ones that overflow go dark', () => {
    const budget = powerBudget(6, [
        { draw: 4, priority: 1 },
        { draw: 1, priority: 2 },
        { draw: 3, priority: 3 },
        { draw: 1, priority: 4 },
    ]);
    assert.equal(budget.deployed, 9);
    assert.ok(!budget.withinBudget);
    assert.equal(budget.headroom, -3);
    const totals = budget.bands.map((band) => band.deployedTotal);
    assert.deepEqual(totals, [4, 5, 8, 9, 9]);
    assert.deepEqual(
        budget.bands.map((band) => band.deployed),
        [4, 1, 3, 1, 0],
    );
    assert.deepEqual(
        budget.bands.map((band) => band.poweredDeployed),
        [true, true, false, false, false],
    );
    // Nothing here is weapons-only, so stowing the hardpoints changes nothing.
    assert.deepEqual(
        budget.bands.map((band) => band.poweredRetracted),
        [true, true, false, false, false],
    );
});

test('a group can be lit retracted and dark deployed', () => {
    const budget = powerBudget(5, [
        { draw: 4, priority: 1 },
        { draw: 3, priority: 2, deployedOnly: true },
        { draw: 0.5, priority: 3 },
    ]);
    assert.ok(budget.bands[2]?.poweredRetracted);
    assert.ok(!budget.bands[2]?.poweredDeployed);
});

test('a group drawing exactly the power available stays online', () => {
    const budget = powerBudget(4.8, [{ draw: 4.8, priority: 3 }]);
    assert.ok(budget.withinBudget);
    assert.ok(budget.bands[2]?.poweredDeployed);
    assert.equal(budget.headroom, 0);
});

test('priorities outside 1-5 are clamped, and an absent one means group 1', () => {
    const budget = powerBudget(10, [
        { draw: 1 },
        { draw: 2, priority: 0 },
        { draw: 4, priority: 99 },
    ]);
    assert.equal(budget.bands[0]?.retracted, 3);
    assert.equal(budget.bands[4]?.retracted, 4);
});

test('a build with no power plant powers nothing', () => {
    const budget = powerBudget(0, [{ draw: 1, priority: 1 }]);
    assert.equal(budget.available, 0);
    assert.equal(budget.utilisation, Infinity);
    assert.ok(!budget.withinBudget);
    assert.ok(budget.bands.every((band) => !band.poweredDeployed));
});

test('an empty build is trivially within budget', () => {
    const budget = powerBudget(0, []);
    assert.equal(budget.deployed, 0);
    assert.equal(budget.utilisation, 0);
    assert.ok(budget.withinBudget);
});

test('the five groups are always reported, in order', () => {
    const budget = powerBudget(10, []);
    assert.equal(budget.bands.length, 5);
    assert.deepEqual(
        budget.bands.map((band) => band.priority),
        [1, 2, 3, 4, 5],
    );
});

test('a draw the catalogue cannot supply is reported, not counted as zero', () => {
    const unknown = { draw: 0, drawUnknown: true, priority: 1, label: 'Slot05_Size3' };
    const budget = powerBudget(10, [{ draw: 4, priority: 1, label: 'MainEngines' }, unknown]);
    // The consumer itself comes back, so a caller can name it however it named it.
    assert.deepEqual(budget.unknownDraws, [unknown]);
    assert.equal(budget.unknownDraws[0], unknown);
    // Left out of every total, which is what makes the rest a lower bound.
    assert.equal(budget.retracted, 4);
    assert.equal(budget.deployed, 4);
    assert.equal(budget.headroom, 6);
    assert.equal(budget.bands[0]?.retracted, 4);
    assert.ok(budget.withinBudget);
});

test('an unknown draw is unknown whatever number came with it', () => {
    // The flag wins outright: a caller that passes a placeholder draw does not get it
    // silently added, and a switched-off module is skipped before the flag is read.
    const budget = powerBudget(10, [
        { draw: 99, drawUnknown: true, priority: 2, label: 'Slot06_Size2' },
        { draw: 99, drawUnknown: true, priority: 2, enabled: false, label: 'Slot07_Size2' },
        { draw: 5, priority: 1 },
    ]);
    assert.equal(budget.deployed, 5);
    assert.deepEqual(
        budget.unknownDraws.map((c) => c.label),
        ['Slot06_Size2'],
    );
});

test('an unlabelled unknown draw is still reported', () => {
    const budget = powerBudget(10, [{ draw: 0, drawUnknown: true }, { draw: 1 }]);
    assert.equal(budget.unknownDraws.length, 1);
    assert.equal(budget.unknownDraws[0]?.label, undefined);
    assert.equal(budget.deployed, 1);
});

test('a build with nothing unknown says so with an empty list', () => {
    assert.deepEqual(powerBudget(10, [{ draw: 1 }]).unknownDraws, []);
    assert.deepEqual(powerBudget(0, []).unknownDraws, []);
});

test('the shared fixture pins an unknown draw', () => {
    const expected = fixture.functions.powerBudgetUnknownDraw;
    const budget = powerBudget(expected.available, expected.consumers);
    assert.equal(budget.retracted, expected.retracted);
    assert.equal(budget.deployed, expected.deployed);
    assert.equal(budget.headroom, expected.headroom);
    assert.equal(budget.withinBudget, expected.withinBudget);
    assert.deepEqual(budget.unknownDraws, expected.unknownDraws);
});

test('the shared fixture pins the priority-band model', () => {
    const { available, consumers, retracted, deployed, bands } = fixture.functions.powerBudget;
    const budget = powerBudget(available, consumers);
    assert.equal(budget.retracted, retracted);
    assert.equal(budget.deployed, deployed);
    assert.deepEqual(
        budget.bands.map((band) => ({
            priority: band.priority,
            retracted: band.retracted,
            deployed: band.deployed,
            retractedTotal: band.retractedTotal,
            deployedTotal: band.deployedTotal,
            poweredRetracted: band.poweredRetracted,
            poweredDeployed: band.poweredDeployed,
        })),
        bands,
    );
});
