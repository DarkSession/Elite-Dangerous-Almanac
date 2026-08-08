import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { baseStats } from './module-stat-labels.js';
import { parseSlef, type LoadoutEvent } from './slef.js';
import statsFixture from '../../../fixtures/ships/module-stats.json' with { type: 'json' };
import corsairJournal from '../../../fixtures/ships/journal-corsair.json' with { type: 'json' };
import corvetteJournal from '../../../fixtures/ships/journal-federation-corvette.json' with { type: 'json' };
import kraitJournal from '../../../fixtures/ships/journal-krait-phantom.json' with { type: 'json' };
import pythonJournal from '../../../fixtures/ships/journal-python-mkii-antixeno.json' with { type: 'json' };
import viperJournal from '../../../fixtures/ships/journal-viper-mkiv.json' with { type: 'json' };
import deepBlackSlef from '../../../fixtures/ships/slef-the-deep-black.json' with { type: 'json' };

// Every capture the repository holds that could state a base value, named by the file the
// fixture names, so a new capture is joined here by adding it in both places.
const CAPTURES: readonly { file: string; loadouts: readonly LoadoutEvent[] }[] = [
    { file: 'journal-corsair.json', loadouts: [corsairJournal as LoadoutEvent] },
    { file: 'journal-federation-corvette.json', loadouts: [corvetteJournal as LoadoutEvent] },
    { file: 'journal-krait-phantom.json', loadouts: [kraitJournal as LoadoutEvent] },
    { file: 'journal-python-mkii-antixeno.json', loadouts: [pythonJournal as LoadoutEvent] },
    { file: 'journal-viper-mkiv.json', loadouts: [viperJournal as LoadoutEvent] },
    { file: 'slef-the-deep-black.json', loadouts: parseSlef(deepBlackSlef).map((e) => e.data) },
];

const { floatNoiseTolerance, captures: expected } = statsFixture.capturedBaseStats;

/**
 * One `(module, Label)` pair a capture states a base value for, deduplicated: a build can
 * fit the same module twice, and the second copy repeats the first's base values.
 */
interface StatedBase {
    readonly symbol: string;
    readonly label: string;
    readonly captured: number;
}

/** Every distinct base value a capture states, in the order the modules appear. */
function statedBases(loadouts: readonly LoadoutEvent[]): StatedBase[] {
    const seen = new Set<string>();
    const stated: StatedBase[] = [];
    for (const loadout of loadouts) {
        for (const fitted of loadout.Modules) {
            const modifiers = fitted.Engineering?.Modifiers ?? [];
            for (const modifier of modifiers) {
                if (typeof modifier.OriginalValue !== 'number') continue;
                // The catalogue's own spelling, so the fixture reads as the catalogue does
                // — a journal lower-cases every `Item`.
                const record = getModuleBySymbol(fitted.Item, ALL_MODULES);
                assert.ok(record, `no catalogue record for ${fitted.Item}`);
                const key = `${record.symbol}|${modifier.Label}`;
                if (seen.has(key)) continue;
                seen.add(key);
                stated.push({
                    symbol: record.symbol,
                    label: modifier.Label,
                    captured: modifier.OriginalValue,
                });
            }
        }
    }
    return stated;
}

/** Whether two readings of one stat differ by no more than the game's own float noise. */
function withinFloatNoise(ours: number, captured: number): boolean {
    const scale = Math.max(Math.abs(ours), Math.abs(captured));
    return scale === 0
        ? ours === captured
        : Math.abs(ours - captured) / scale < floatNoiseTolerance;
}

for (const { file, loadouts } of CAPTURES) {
    const pinned = expected.find((capture) => capture.file === file);

    test(`${file}: every base value it states agrees with the catalogue`, () => {
        // The capture is Frontier's own reading of the module the player fitted, so it
        // outranks the third-party registries the catalogue is derived from. A failure
        // here is a catalogue error until a second capture says otherwise.
        let mapped = 0;
        let exact = 0;
        let noise = 0;
        const unmapped: { symbol: string; label: string }[] = [];
        for (const { symbol, label, captured } of statedBases(loadouts)) {
            // The library's own label → field mapping, not a hand-written one, so the join
            // is the one `computeModifiers` engineers through.
            const ours = baseStats(getModuleBySymbol(symbol, ALL_MODULES)!)[label];
            if (ours === undefined) {
                unmapped.push({ symbol, label });
                continue;
            }
            mapped++;
            if (ours === captured) exact++;
            else {
                assert.ok(
                    withinFloatNoise(ours, captured),
                    `${symbol} ${label}: catalogue ${ours}, capture ${captured}`,
                );
                noise++;
            }
        }

        if (!pinned) {
            // A capture with nothing to say — no engineered module carries a base value —
            // is not pinned, and must stay that way rather than quietly stopping being read.
            assert.equal(
                mapped + unmapped.length,
                0,
                `${file} states base values but is not pinned`,
            );
            return;
        }
        assert.equal(mapped + unmapped.length, pinned.stated);
        assert.equal(mapped, pinned.mapped);
        assert.equal(exact, pinned.exact);
        assert.equal(noise, pinned.withinFloatNoise);
        // Sorted, because the fixture is a set of labels the catalogue models no field for
        // and not a record of where in the build they were found.
        unmapped.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.label.localeCompare(b.label));
        assert.deepEqual(unmapped, pinned.unmapped);
    });
}

test('the pinned captures are the ones that state base values', () => {
    // A fixture entry naming a file no test reads would pin nothing.
    assert.deepEqual(
        expected.map((capture) => capture.file),
        CAPTURES.filter(({ loadouts }) => statedBases(loadouts).length > 0).map((c) => c.file),
    );
});
