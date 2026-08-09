import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getModuleBySymbol, type OutfittingModule } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import {
    baseStats,
    damageTypeForLabel,
    fieldForLabel,
    labelsForField,
    scaleForLabel,
} from './internal/module-stat-labels.js';
import { parseSlef, type LoadoutEvent } from './slef.js';
import { ShipLoadout } from './ship-loadout.js';
import { damagePerSecond } from './weapons.js';
import statsFixture from '../../../fixtures/ships/module-stats.json' with { type: 'json' };
import corsairJournal from '../../../fixtures/ships/journal-corsair.json' with { type: 'json' };
import corvetteJournal from '../../../fixtures/ships/journal-federation-corvette.json' with { type: 'json' };
import corvetteBeamsJournal from '../../../fixtures/ships/journal-federation-corvette-beams.json' with { type: 'json' };
import corvetteMultiroleJournal from '../../../fixtures/ships/journal-federation-corvette-multirole.json' with { type: 'json' };
import corvetteMixedJournal from '../../../fixtures/ships/journal-federation-corvette-mixed.json' with { type: 'json' };
import corvettePlasmaJournal from '../../../fixtures/ships/journal-federation-corvette-plasma.json' with { type: 'json' };
import caspianJournal from '../../../fixtures/ships/journal-caspian-explorer.json' with { type: 'json' };
import cobraJournal from '../../../fixtures/ships/journal-cobra-mkv.json' with { type: 'json' };
import kestrelJournal from '../../../fixtures/ships/journal-kestrel-mkii.json' with { type: 'json' };
import lynxJournal from '../../../fixtures/ships/journal-lynx-highliner.json' with { type: 'json' };
import kraitJournal from '../../../fixtures/ships/journal-krait-phantom.json' with { type: 'json' };
import pythonJournal from '../../../fixtures/ships/journal-python-mkii-antixeno.json' with { type: 'json' };
import viperJournal from '../../../fixtures/ships/journal-viper-mkiv.json' with { type: 'json' };
import deepBlackSlef from '../../../fixtures/ships/slef-the-deep-black.json' with { type: 'json' };

// Every capture the repository holds that could state a base value, named by the file the
// fixture names, so a new capture is joined here by adding it in both places.
const CAPTURES: readonly { file: string; loadouts: readonly LoadoutEvent[] }[] = [
    { file: 'journal-caspian-explorer.json', loadouts: [caspianJournal as LoadoutEvent] },
    { file: 'journal-cobra-mkv.json', loadouts: [cobraJournal as LoadoutEvent] },
    { file: 'journal-corsair.json', loadouts: [corsairJournal as LoadoutEvent] },
    {
        file: 'journal-federation-corvette-beams.json',
        loadouts: [corvetteBeamsJournal as LoadoutEvent],
    },
    {
        file: 'journal-federation-corvette-multirole.json',
        loadouts: [corvetteMultiroleJournal as LoadoutEvent],
    },
    {
        file: 'journal-federation-corvette-mixed.json',
        loadouts: [corvetteMixedJournal as LoadoutEvent],
    },
    {
        file: 'journal-federation-corvette-plasma.json',
        loadouts: [corvettePlasmaJournal as LoadoutEvent],
    },
    { file: 'journal-federation-corvette.json', loadouts: [corvetteJournal as LoadoutEvent] },
    { file: 'journal-kestrel-mkii.json', loadouts: [kestrelJournal as LoadoutEvent] },
    { file: 'journal-krait-phantom.json', loadouts: [kraitJournal as LoadoutEvent] },
    { file: 'journal-lynx-highliner.json', loadouts: [lynxJournal as LoadoutEvent] },
    { file: 'journal-python-mkii-antixeno.json', loadouts: [pythonJournal as LoadoutEvent] },
    { file: 'journal-viper-mkiv.json', loadouts: [viperJournal as LoadoutEvent] },
    { file: 'slef-the-deep-black.json', loadouts: parseSlef(deepBlackSlef).map((e) => e.data) },
];

const {
    floatNoiseTolerance,
    captures: expected,
    weapons: capturedWeapons,
    convertedDamageDistributions,
    rebuildTolerance,
    rebuilds,
    engineered,
} = statsFixture.capturedBaseStats;

/**
 * One `(module, Label)` pair a capture states a base value for, deduplicated: a build can
 * fit the same module twice, and the second copy repeats the first's base values.
 */
interface StatedBase {
    readonly record: OutfittingModule;
    readonly label: string;
    readonly captured: number;
}

/** Every distinct base value a capture states, in the order the modules appear. */
function statedBases(loadouts: readonly LoadoutEvent[]): StatedBase[] {
    const seen = new Set<string>();
    const stated: StatedBase[] = [];
    for (const loadout of loadouts) {
        for (const fitted of loadout.Modules) {
            const modifiers = (fitted.Engineering?.Modifiers ?? []).filter(
                (modifier) => typeof modifier.OriginalValue === 'number',
            );
            if (modifiers.length === 0) continue;
            // The catalogue's own spelling, so the fixture reads as the catalogue does —
            // a journal lower-cases every `Item`. Looked up once per module, not once per
            // modifier: the catalogue scan covers every module record.
            const record = getModuleBySymbol(fitted.Item, ALL_MODULES);
            assert.ok(record, `no catalogue record for ${fitted.Item}`);
            for (const modifier of modifiers) {
                const key: string = `${record.symbol}|${modifier.Label}`;
                if (seen.has(key)) {
                    // A build can fit the same module twice; the second copy must repeat
                    // the first's base values rather than quietly winning or losing.
                    assert.equal(
                        stated.find((row) => `${row.record.symbol}|${row.label}` === key)?.captured,
                        modifier.OriginalValue,
                        `${key}: two copies state different base values`,
                    );
                    continue;
                }
                seen.add(key);
                stated.push({
                    record,
                    label: modifier.Label,
                    captured: modifier.OriginalValue!,
                });
            }
        }
    }
    return stated;
}

/** The directory the captures are stored in, read for the sweeps that guard the lists. */
const FIXTURE_DIR = fileURLToPath(new URL('../../../fixtures/ships/', import.meta.url));

/** Every `.json` in that directory, so a sweep sees a new capture the moment it lands. */
const FIXTURE_FILES = readdirSync(FIXTURE_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();

/**
 * Every `Loadout` event a stored fixture holds, whatever container it arrived in: a bare
 * event, or a SLEF array whose entries wrap one. A file that is neither yields nothing.
 */
function eventsInFixture(file: string): LoadoutEvent[] {
    const parsed: unknown = JSON.parse(readFileSync(FIXTURE_DIR + file, 'utf8'));
    const events = Array.isArray(parsed)
        ? (parsed as { data?: LoadoutEvent }[]).map((entry) => entry?.data)
        : [parsed as LoadoutEvent];
    return events.filter((event): event is LoadoutEvent => Array.isArray(event?.Modules));
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
        for (const { record, label, captured } of statedBases(loadouts)) {
            // The library's own label → field mapping, not a hand-written one, so the join
            // is the one `computeModifiers` engineers through.
            const ours = baseStats(record)[label];
            const symbol = record.symbol;
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

test('the pinned damage-per-second readings are the ones the captures state', () => {
    // The fixture is a pinned list, not a hand-transcription: a row deleted from it, or a
    // figure edited to match a broken `damagePerSecond`, has to disagree with the captures
    // themselves to survive here.
    const stated = new Map<string, number>();
    for (const { loadouts } of CAPTURES) {
        for (const { record, label, captured } of statedBases(loadouts)) {
            if (label === 'DamagePerSecond') stated.set(record.symbol, captured);
        }
    }
    assert.deepEqual(
        [...stated]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([symbol, damagePerSecond]) => ({ symbol, damagePerSecond })),
        capturedWeapons.map((weapon) => ({ ...weapon })),
    );
});

test('the captures reproduce this library’s damage per second, weapon for weapon', () => {
    // `DamagePerSecond` is Frontier's own arithmetic over damage, rate of fire, rounds per
    // shot and burst structure, stated for the weapon before its recipe. These are the only
    // external readings of an *unmodified* weapon's folded figure — in-game verification
    // reads the stored inputs one at a time, and the one product it holds is a decorative
    // launcher's panel DPS, a modified weapon at one decimal. On the huge and medium
    // gimballed beam lasers it is also the only check `damage` has, since `inGameVerified`
    // does not pin those two and no journal states `Damage` for a beam laser at all.
    // See https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/12.
    for (const { symbol, damagePerSecond: captured } of capturedWeapons) {
        const weapon = getModuleBySymbol(symbol, ALL_MODULES);
        assert.ok(weapon, `missing ${symbol}`);
        assert.ok(
            withinFloatNoise(damagePerSecond(weapon), captured),
            `${symbol}: computed ${damagePerSecond(weapon)}, capture ${captured}`,
        );
    }
});

test('every capture in the fixtures that states a base value is joined here', () => {
    // The list above is hand-maintained, so a capture added to `fixtures/ships/` and to no
    // list would be stored ground truth that nothing checks. The rule is mechanical rather
    // than a judgement about which files matter: any fixture that states an `OriginalValue`
    // must be read here, journal or SLEF alike.
    const statesBaseValues = FIXTURE_FILES.filter((file) =>
        eventsInFixture(file).some((event) =>
            event.Modules.some((fitted) =>
                (fitted.Engineering?.Modifiers ?? []).some(
                    (modifier) => typeof modifier.OriginalValue === 'number',
                ),
            ),
        ),
    );
    assert.deepEqual(
        CAPTURES.filter(({ loadouts }) => statedBases(loadouts).length > 0)
            .map(({ file }) => file)
            .sort(),
        statesBaseValues,
    );
});

test('every capture rebuilds to the mass and jump range it states', () => {
    // What says a stored capture is faithful: it states its own `UnladenMass` and
    // `MaxJumpRange`, and both are dropped before the rebuild so the library computes them
    // from the modules alone. Every module mass, every engineered mass modifier and the
    // drive's whole fuel curve have to be right for the two figures to land. What is left
    // is the game's own float32 arithmetic, not a disagreement — the widest is 9.8e-5 t.
    for (const { file, unladenMass, maxJumpRange } of rebuilds) {
        const capture = CAPTURES.find((entry) => entry.file === file);
        assert.ok(capture, `${file} is pinned for rebuild but not read`);
        const [loadout] = capture.loadouts;
        assert.ok(loadout);
        assert.equal(loadout.UnladenMass, unladenMass, `${file}: stated mass`);
        assert.equal(loadout.MaxJumpRange, maxJumpRange, `${file}: stated jump range`);
        const withoutTotals: LoadoutEvent = { ...loadout };
        delete (withoutTotals as { UnladenMass?: number }).UnladenMass;
        delete (withoutTotals as { MaxJumpRange?: number }).MaxJumpRange;
        const built = ShipLoadout.fromLoadout(withoutTotals);
        assert.ok(
            Math.abs(built.unladenMass! - unladenMass) < rebuildTolerance,
            `${file}: computed mass ${built.unladenMass}, stated ${unladenMass}`,
        );
        assert.ok(
            Math.abs(built.maxJumpRange()! - maxJumpRange) < rebuildTolerance,
            `${file}: computed jump ${built.maxJumpRange()}, stated ${maxJumpRange}`,
        );
    }
});

test('every journal capture is pinned for rebuild', () => {
    // A journal capture that states both totals is evidence about the stored text, so none
    // may sit in the fixtures unchecked. Swept from the directory rather than from
    // `CAPTURES`: a capture with no engineering at all states no base value, so it would
    // join neither list, and reading the list against itself would let it in unrebuilt.
    // The one SLEF export that states both totals, `slef-the-deep-black.json`, is out of
    // scope: it is an EDSY re-export rather than Frontier's own file, so its totals are the
    // producing app's arithmetic and say nothing about whether the stored text is faithful.
    assert.deepEqual(
        rebuilds.map(({ file }) => file).sort(),
        FIXTURE_FILES.filter(
            (file) =>
                file.startsWith('journal-') &&
                eventsInFixture(file).some(
                    (event) => event.UnladenMass !== undefined && event.MaxJumpRange !== undefined,
                ),
        ),
    );
});

/**
 * Where a wrong label → field resolution hides, and so what has to be read back rather
 * than trusted: a label that is not the field's own first name, because a stat with two
 * labels can be written to whichever the mapping is asked for, and a label naming a field
 * the record does not carry, because a resolution to nothing goes missing in
 * `effectiveStats` rather than failing. Derived from the mapping and the record, so no
 * hand-kept list decides what the sweep below looks at.
 */
function needsReadingBack(record: OutfittingModule, label: string): boolean {
    // Nested damage-type labels have their own fixture and consumer assertion below.
    if (damageTypeForLabel(label) !== null) return false;
    const field = fieldForLabel(label, record);
    if (!field) return false;
    return labelsForField(field)[0] !== label || record[field] === undefined;
}

test('captured damage-type conversions reach effective stats and weapon metrics', () => {
    for (const {
        file,
        slot,
        symbol,
        experimental,
        base,
        effective,
    } of convertedDamageDistributions) {
        const capture = CAPTURES.find((entry) => entry.file === file);
        assert.ok(capture?.loadouts[0], `${file} is pinned but not read`);
        const record = getModuleBySymbol(symbol, ALL_MODULES);
        assert.ok(record, `no catalogue record for ${symbol}`);
        assert.deepEqual(record.damageDistribution, base);

        const build = ShipLoadout.fromLoadout(capture.loadouts[0]);
        const fitted = build.getFittedModule(slot);
        assert.ok(fitted, `${file}: no module in ${slot}`);
        assert.equal(fitted.engineering?.ExperimentalEffect, experimental);
        assert.deepEqual(fitted.effectiveStats?.damageDistribution, effective);

        const weapon = build.weaponMetrics().weapons.find((entry) => entry.slot === slot);
        assert.ok(weapon, `${file}: no weapon metrics for ${slot}`);
        const total = weapon.metrics.damagePerSecond;
        assert.ok(withinFloatNoise(weapon.metrics.damageByType.kinetic, total * effective.kinetic));
        assert.ok(
            withinFloatNoise(weapon.metrics.damageByType.explosive, total * effective.explosive),
        );

        // Import/export keeps Frontier's own nested modifier labels intact.
        const exported = build.toLoadoutEvent().Modules.find((module) => module.Slot === slot)
            ?.Engineering?.Modifiers;
        for (const label of ['$Kinetic;', '$Explosive;']) {
            assert.deepEqual(
                exported?.find((modifier) => modifier.Label === label),
                capture.loadouts[0].Modules.find(
                    (module) => module.Slot === slot,
                )?.Engineering?.Modifiers?.find((modifier) => modifier.Label === label),
            );
        }
    }
});

test('every engineered result that needs reading back is pinned', () => {
    // One row per distinct (module, field) — a build fits the same weapon twice and two
    // ships carry the same sensor suite, and repeats say nothing new. Sweeping rather than
    // counting is what stops the list being emptied, or a new capture resolving a label
    // this way with nothing reading the result back.
    const stated = new Set<string>();
    for (const { loadouts } of CAPTURES) {
        for (const loadout of loadouts) {
            for (const fitted of loadout.Modules) {
                for (const modifier of fitted.Engineering?.Modifiers ?? []) {
                    if (typeof modifier.Value !== 'number') continue;
                    const record = getModuleBySymbol(fitted.Item, ALL_MODULES);
                    assert.ok(record, `no catalogue record for ${fitted.Item}`);
                    if (!needsReadingBack(record, modifier.Label)) continue;
                    stated.add(`${record.symbol}|${fieldForLabel(modifier.Label, record)}`);
                }
            }
        }
    }
    assert.deepEqual(
        [...new Set(engineered.map(({ symbol, field }) => `${symbol}|${field}`))].sort(),
        [...stated].sort(),
    );
});

test('every engineered result reaches a consumer at the field the fixture names', () => {
    // `effectiveStats` is what a consumer reads, and it is where a label that resolves to
    // no field goes missing rather than failing. The fixture writes the field out rather
    // than resolving it, so a mapping that sent the value elsewhere fails here. Frontier
    // states the engineered `Value` beside the base, so the capture settles both ends.
    for (const { file, slot, symbol, field, value } of engineered) {
        const capture = CAPTURES.find((entry) => entry.file === file);
        assert.ok(capture?.loadouts[0], `${file} is pinned but not read`);
        const fitted = ShipLoadout.fromLoadout(capture.loadouts[0]).getFittedModule(slot);
        assert.ok(fitted, `${file}: no module in ${slot}`);
        // A journal lower-cases every `Item`; the fixture reads as the catalogue spells it.
        assert.equal(fitted.symbol.toLowerCase(), symbol.toLowerCase());
        assert.equal(fitted.effectiveStats?.[field as keyof OutfittingModule], value);
        // And the pinned figure is Frontier's, not this library's: the capture states it as
        // the `Value` beside the base the join above checks.
        // Whichever of the field's labels this capture spells it with — `falloffRange` is
        // `FalloffRange` to a recipe and `DamageFalloffRange` to a journal.
        const labels = labelsForField(field as keyof OutfittingModule);
        const modifiers = capture.loadouts[0].Modules.find((m) => m.Slot === slot)?.Engineering
            ?.Modifiers;
        const modifier = modifiers?.find((m) => labels.includes(m.Label));
        // In the catalogue's units: a journal states a shield generator's strength as the
        // percentage the panel shows, where the record holds the multiplier.
        const stated = modifier && modifier.Value! / scaleForLabel(modifier.Label);
        assert.equal(stated, value, `${file} ${slot}: the capture states ${String(stated)}`);
    }
});
