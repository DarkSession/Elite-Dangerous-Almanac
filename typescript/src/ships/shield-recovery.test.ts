import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cellBankSummary, shieldRecovery } from './shield-recovery.js';

test('shield recovery includes collapse delay and capacitor-supported phases', () => {
    assert.deepEqual(
        shieldRecovery({
            strength: 200,
            regenRate: 2,
            brokenRegenRate: 4,
            distributorDraw: 0.6,
            systemsCapacity: 20,
            systemsRecharge: 2,
        }),
        { regenRate: 2, brokenRegenRate: 4, recoveryTime: 41, regenTime: 50 },
    );
});

test('a depleted capacitor continues at recharge-limited speed or stalls at zero pips', () => {
    const twoPips = shieldRecovery({
        strength: 1000,
        regenRate: 10,
        brokenRegenRate: 20,
        distributorDraw: 0.6,
        systemsCapacity: 10,
        systemsRecharge: 2,
        systemsPips: 2,
    });
    assert.ok(Number.isFinite(twoPips.recoveryTime));
    assert.ok(Number.isFinite(twoPips.regenTime));

    const zeroPips = shieldRecovery({
        strength: 1000,
        regenRate: 10,
        brokenRegenRate: 20,
        distributorDraw: 0.6,
        systemsCapacity: 10,
        systemsRecharge: 2,
        systemsPips: 0,
    });
    assert.equal(zeroPips.recoveryTime, Infinity);
    assert.equal(zeroPips.regenTime, Infinity);

    assert.equal(
        shieldRecovery({
            strength: 100,
            regenRate: 2,
            brokenRegenRate: 4,
            distributorDraw: 0,
            systemsCapacity: 0,
            systemsRecharge: 0,
        }).regenTime,
        25,
    );
});

test('shield recovery validates pips and handles empty or non-regenerating shields', () => {
    const input = {
        strength: 1,
        regenRate: 1,
        brokenRegenRate: 1,
        distributorDraw: 0.6,
        systemsCapacity: 1,
        systemsRecharge: 1,
    };
    assert.deepEqual(
        shieldRecovery({
            strength: 0,
            regenRate: 0,
            brokenRegenRate: 0,
            distributorDraw: 0,
            systemsCapacity: 0,
            systemsRecharge: 0,
        }),
        { regenRate: 0, brokenRegenRate: 0, recoveryTime: 16, regenTime: 0 },
    );
    assert.throws(
        () =>
            shieldRecovery({
                ...input,
                systemsPips: -1,
            }),
        RangeError,
    );
    for (const invalid of [
        { ...input, strength: -1 },
        { ...input, regenRate: Number.NaN },
        { ...input, brokenRegenRate: -1 },
        { ...input, distributorDraw: -1 },
        { ...input, systemsCapacity: -1 },
        { ...input, systemsRecharge: -1 },
    ]) {
        assert.throws(() => shieldRecovery(invalid), RangeError);
    }
});

test('cell banks report one-cell reinforcement and the complete pool', () => {
    const summary = cellBankSummary([
        {
            slot: 'Slot01_Size6',
            symbol: 'bank-a',
            reinforcementRate: 12,
            cells: 4,
            spinUp: 5,
            duration: 1,
            heat: 170,
        },
        {
            slot: 'Slot02_Size5',
            symbol: 'bank-b',
            reinforcementRate: 10,
            cells: 3,
            spinUp: 4,
            duration: 2,
            heat: 200,
        },
    ]);
    assert.equal(summary.totalCells, 7);
    assert.equal(summary.totalRestorable, 108);
    assert.deepEqual(
        summary.banks.map((bank) => bank.reinforcement),
        [12, 20],
    );
    assert.ok(Object.isFrozen(summary));
    assert.ok(Object.isFrozen(summary.banks));
    assert.deepEqual(cellBankSummary([]), { banks: [], totalRestorable: 0, totalCells: 0 });
});
