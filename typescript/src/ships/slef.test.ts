import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSlef, getModifier, type LoadoutModule } from './slef.js';
import slefFixture from '../../../fixtures/ships/slef-the-deep-black.json' with { type: 'json' };

const slefString = JSON.stringify(slefFixture);

test('parseSlef accepts the SLEF JSON string', () => {
    const entries = parseSlef(slefString);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.header.appName, 'EDSY');
    assert.equal(entries[0]!.data.Ship, 'explorer_nx');
    assert.ok(entries[0]!.data.Modules.length > 0);
});

test('parseSlef accepts an already-parsed SLEF array', () => {
    const entries = parseSlef(slefFixture);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.data.ShipName, 'The Deep Black');
});

test('parseSlef accepts a single { header, data } entry', () => {
    const entries = parseSlef(slefFixture[0]!);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.data.Ship, 'explorer_nx');
});

test('parseSlef accepts a bare Loadout event and synthesises a header', () => {
    const entries = parseSlef(slefFixture[0]!.data);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.header.appName, '');
    assert.equal(entries[0]!.data.Ship, 'explorer_nx');
});

test('parseSlef throws SyntaxError on invalid JSON', () => {
    assert.throws(() => parseSlef('{not json'), SyntaxError);
});

test('parseSlef throws TypeError when nothing is a loadout', () => {
    assert.throws(() => parseSlef({ foo: 'bar' }), TypeError);
    assert.throws(() => parseSlef([]), TypeError);
});

const fsdModule = slefFixture[0]!.data.Modules.find(
    (m) => m.Slot === 'FrameShiftDrive',
) as unknown as LoadoutModule;

test('getModifier reads a numeric modifier case-insensitively', () => {
    assert.equal(getModifier(fsdModule, 'FSDOptimalMass'), 7528.04);
    assert.equal(getModifier(fsdModule, 'fsdoptimalmass'), 7528.04);
});

test('getModifier returns null for an absent modifier or an unengineered module', () => {
    assert.equal(getModifier(fsdModule, 'NoSuchLabel'), null);
    const fuelTank = slefFixture[0]!.data.Modules.find(
        (m) => m.Slot === 'FuelTank',
    ) as unknown as LoadoutModule;
    assert.equal(getModifier(fuelTank, 'Mass'), null);
});
