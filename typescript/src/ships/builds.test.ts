import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

import { ShipLoadout } from './ship-loadout.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import { SHIPS } from './ships.js';
import { getBlueprintGrade } from './blueprints.js';
import { getExperimentalEffect } from './experimental-effects.js';
import { missingBaseLabels } from './internal/loadout-engineering.js';
import { baseStats } from './internal/module-stat-labels.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import index from '../../../fixtures/ships/builds/index.jsonc' with { type: 'json' };
import optionsFixture from '../../../fixtures/ships/engineering-options.jsonc' with { type: 'json' };

/** One module as the corpus records it. */
interface CorpusModule {
    slot: string;
    item: string;
    priority?: number;
    on?: boolean;
    engineering?: { blueprint: string; grade: number; experimental?: string };
}

interface CorpusBuild {
    id: string;
    ship: string;
    role: string;
    modules: CorpusModule[];
    metrics: {
        unladenMass: number | null;
        cargoCapacity: number;
        fuelCapacity: number;
        maxJumpRange: number | null;
        power: { available: number; retracted: number; deployed: number; withinBudget: boolean };
        shields: {
            strength: number;
            resistances: { kinetic: number; thermal: number; explosive: number };
        } | null;
        armour: {
            hitPoints: number;
            resistances: { kinetic: number; thermal: number; explosive: number };
        };
        weapons: { count: number; damagePerSecond: number; sustainedDamagePerSecond: number };
    };
}

/**
 * The corpus is one file per build, so it is read from disk rather than imported the way
 * every other fixture is — 181 static `with { type: 'json' }` imports is not a fixture,
 * it is a wall. `index.jsonc` names the builds; the files themselves are the fixture. Each
 * carries a header comment, so the text is stripped before parsing, exactly as the loader
 * does for an imported fixture.
 */
const CORPUS_DIR = fileURLToPath(new URL('../../../fixtures/ships/builds/', import.meta.url));
const readBuild = (id: string): CorpusBuild =>
    JSON.parse(
        stripJsonComments(readFileSync(join(CORPUS_DIR, `${id}.jsonc`), 'utf8')),
    ) as CorpusBuild;

const builds: CorpusBuild[] = index.builds.map((entry) => readBuild(entry.id));
const ROLES = new Set([
    'antiXeno',
    'combat',
    'exploration',
    'mining',
    'multipurpose',
    'passenger',
    'trade',
]);

/** Assemble a build the way the corpus describes it: fit, power, but do not engineer. */
function assemble(build: CorpusBuild): ShipLoadout {
    const modules = build.modules.map((entry) => {
        const module = getModuleBySymbol(entry.item, ALL_MODULES);
        assert.ok(module, `${build.id}: no module "${entry.item}"`);
        return {
            Slot: entry.slot,
            Item: entry.item,
            ...(entry.on === undefined ? {} : { On: entry.on }),
            ...(entry.priority === undefined ? {} : { Priority: entry.priority }),
        };
    });
    // A corpus record is an outfitting build that omits the hull's built-in cargo hatch,
    // which `fromLoadout` restores from the default loadout while importing the stated
    // modules atomically. `setModule` is the invariant-preserving editor API and
    // intentionally makes fitting order observable.
    return ShipLoadout.fromLoadout({ Ship: build.ship, Modules: modules });
}

/**
 * The corpus rounds to 6 dp, so `1e-5` leaves 20× headroom over rounding while still
 * catching any real change in the maths. `index.jsonc` states the same tolerance, so a
 * port compares the same way.
 */
const TOLERANCE = 1e-5;
const close = (actual: number, expected: number, what: string): void => {
    assert.ok(
        Math.abs(actual - expected) < TOLERANCE,
        `${what}: got ${actual}, expected ${expected}`,
    );
};

test('the index names every build file, and only those', () => {
    const onDisk = readdirSync(CORPUS_DIR)
        .filter((file) => file.endsWith('.jsonc') && file !== 'index.jsonc')
        .map((file) => file.replace(/\.jsonc$/, ''))
        .sort();
    assert.deepEqual(
        index.builds.map((entry) => entry.id).sort(),
        onDisk,
        'index.jsonc and the build files must list the same ids',
    );
    for (const entry of index.builds) {
        const build = readBuild(entry.id);
        assert.equal(build.id, entry.id, `${entry.id}: file id must match its name`);
        assert.equal(build.ship, entry.ship, `${entry.id}: index ship must match the build`);
        assert.equal(build.role, entry.role, `${entry.id}: index role must match the build`);
    }
});

test('the corpus covers every hull with 2-5 builds and unique ids', () => {
    assert.equal(builds.length, index.count);
    const ids = new Set(builds.map((b) => b.id));
    assert.equal(ids.size, builds.length, 'build ids must be unique');

    const perHull = new Map<string, number>();
    for (const build of builds) {
        assert.ok(ROLES.has(build.role), `${build.id}: unknown role "${build.role}"`);
        perHull.set(build.ship, (perHull.get(build.ship) ?? 0) + 1);
    }
    for (const ship of SHIPS) {
        const count = perHull.get(ship.symbol) ?? 0;
        assert.ok(count >= 2 && count <= 5, `${ship.symbol}: ${count} builds, expected 2-5`);
    }
    assert.equal(perHull.size, SHIPS.length, 'every hull in the shipyard has builds');
});

test('every corpus module fits and import restores the omitted cargo hatch', () => {
    for (const build of builds) {
        const loadout = assemble(build);
        const validation = loadout.validation;
        const diagnostics = validation.issues
            .map((issue) => `${issue.code}: ${issue.message}`)
            .join('; ');
        assert.equal(validation.valid, true, `${build.id}: invalid fit (${diagnostics})`);
        assert.equal(validation.complete, true, `${build.id}: incomplete fit (${diagnostics})`);
        const occupied = loadout.slots().filter((slot) => slot.module !== null);
        assert.equal(
            occupied.length,
            build.modules.length + 1,
            `${build.id}: fitted modules plus built-in cargo hatch`,
        );
        // A build always fills its seven core internals; that is what makes it flyable.
        assert.equal(
            loadout.slots('core').filter((slot) => slot.module !== null).length,
            7,
            `${build.id}: core internals must all be filled`,
        );
    }
});

test('every declared blueprint, grade and experimental effect is in the catalogues', () => {
    for (const build of builds) {
        for (const entry of build.modules) {
            const engineering = entry.engineering;
            if (!engineering) continue;
            assert.ok(
                getBlueprintGrade(engineering.blueprint, engineering.grade),
                `${build.id}: no blueprint "${engineering.blueprint}" grade ${engineering.grade}`,
            );
            if (engineering.experimental !== undefined) {
                assert.ok(
                    getExperimentalEffect(engineering.experimental),
                    `${build.id}: no experimental effect "${engineering.experimental}"`,
                );
            }
        }
    }
});

test('every declared engineering entry resolves against the base stats it needs', () => {
    // Check every corpus entry against the base stats needed to calculate its recipe.
    // Whether the module is offered the recipe is tested separately.
    let checked = 0;
    for (const build of builds) {
        for (const entry of build.modules) {
            const engineering = entry.engineering;
            if (!engineering) continue;
            const stats = getModuleBySymbol(entry.item, ALL_MODULES)!;
            // Which recipe the declared id names can depend on the module: a scanner's
            // `Sensor_LongRange` is the scanner's recipe, whose legs are not the sensor
            // suite's. Check the legs the build would actually fold, not the other
            // family's — those happen to land on stats the scanner also has, so reading
            // the id straight would pass while checking the wrong thing.
            const recipe = resolveBlueprintForModule(entry.item, engineering.blueprint);
            const grade = getBlueprintGrade(recipe, engineering.grade)!;
            const experimental =
                engineering.experimental === undefined
                    ? undefined
                    : getExperimentalEffect(engineering.experimental)!;
            assert.deepEqual(
                missingBaseLabels(stats, baseStats(stats), grade.features, experimental?.modifiers),
                [],
                `${build.id}: ${entry.item} + ${engineering.blueprint}`,
            );
            checked++;
        }
    }
    assert.equal(checked, index.declaredEngineering);
});

test('every applicable build declaration engineers through applyBlueprint', () => {
    // End to end, through the public API: the corpus is what real build tools wrote, so a
    // refusal here is this library disagreeing with the game. Final pre-engineered
    // Guardian and Expanded Cargo Rack articles are expected to refuse: their Engineering
    // blocks identify the acquired article, not a recipe to apply. The Mk II Plasma Shock
    // Accelerator entries are refused because that stock module cannot be engineered at all,
    // and the Abrasion Blaster entry identifies its community-goal reward rather than an
    // ordinary roll.
    const notEngineerable = new Set(
        optionsFixture.corpus.notEngineerable.map((row) => `${row.symbol}|${row.blueprint}`),
    );
    const refused = new Map<string, number>();
    let finalPreEngineered = 0;
    for (const build of builds) {
        const loadout = assemble(build);
        for (const entry of build.modules) {
            const engineering = entry.engineering;
            if (!engineering) continue;
            const final = optionsFixture.corpus.finalPreEngineered.find(
                (row) =>
                    row.symbol === entry.item &&
                    row.blueprint === engineering.blueprint &&
                    (('experimental' in row ? row.experimental : undefined) ?? null) ===
                        (engineering.experimental ?? null),
            );
            if (final) {
                assert.throws(() =>
                    loadout.applyBlueprint(entry.slot, engineering.blueprint, {
                        grade: engineering.grade,
                        ...(engineering.experimental !== undefined
                            ? { experimental: engineering.experimental }
                            : {}),
                    }),
                );
                finalPreEngineered += 1;
                continue;
            }
            try {
                loadout.applyBlueprint(entry.slot, engineering.blueprint, {
                    grade: engineering.grade,
                    ...(engineering.experimental !== undefined
                        ? { experimental: engineering.experimental }
                        : {}),
                });
            } catch (error) {
                const key = `${entry.item}|${engineering.blueprint}`;
                assert.ok(
                    notEngineerable.has(key),
                    `${build.id}: ${entry.item} + ${engineering.blueprint} — ${(error as Error).message}`,
                );
                refused.set(key, (refused.get(key) ?? 0) + 1);
            }
        }
    }
    assert.equal(finalPreEngineered, optionsFixture.corpus.finalPreEngineeredEntries);
    for (const row of optionsFixture.corpus.notEngineerable) {
        const key = `${row.symbol}|${row.blueprint}`;
        assert.equal(refused.get(key), row.entries, key);
    }
});

test('every build reproduces its pinned metrics', () => {
    for (const build of builds) {
        const loadout = assemble(build);
        const expected = build.metrics;

        assert.notEqual(loadout.unladenMass, null, `${build.id}: mass`);
        close(loadout.unladenMass!, expected.unladenMass!, `${build.id} unladenMass`);
        assert.equal(loadout.cargoCapacity, expected.cargoCapacity, `${build.id} cargoCapacity`);
        close(loadout.fuelCapacity!.main, expected.fuelCapacity, `${build.id} fuelCapacity`);
        close(loadout.maxJumpRange(), expected.maxJumpRange!, `${build.id} maxJumpRange`);

        const power = loadout.powerBudget();
        close(power.available, expected.power.available, `${build.id} power.available`);
        close(power.retracted, expected.power.retracted, `${build.id} power.retracted`);
        close(power.deployed, expected.power.deployed, `${build.id} power.deployed`);
        assert.equal(
            power.withinBudget,
            expected.power.withinBudget,
            `${build.id} power.withinBudget`,
        );

        const shields = loadout.shieldMetrics();
        if (expected.shields === null) {
            assert.equal(shields, null, `${build.id}: expected no shields`);
        } else {
            assert.ok(shields, `${build.id}: expected shields`);
            close(shields.strength, expected.shields.strength, `${build.id} shields.strength`);
            for (const type of ['kinetic', 'thermal', 'explosive'] as const) {
                close(
                    shields.resistances[type],
                    expected.shields.resistances[type],
                    `${build.id} shields.${type}`,
                );
            }
        }

        const armour = loadout.armourMetrics()!;
        close(armour.hitPoints, expected.armour.hitPoints, `${build.id} armour.hitPoints`);
        for (const type of ['kinetic', 'thermal', 'explosive'] as const) {
            close(
                armour.resistances[type],
                expected.armour.resistances[type],
                `${build.id} armour.${type}`,
            );
        }

        const weapons = loadout.weaponMetrics();
        assert.equal(weapons.weapons.length, expected.weapons.count, `${build.id} weapons.count`);
        close(
            weapons.total.damagePerSecond,
            expected.weapons.damagePerSecond,
            `${build.id} weapons.dps`,
        );
        close(
            weapons.total.sustainedDamagePerSecond,
            expected.weapons.sustainedDamagePerSecond,
            `${build.id} weapons.sustainedDps`,
        );
    }
});

test('the corpus spans the roles, the hull sizes and the engineered/stock divide', () => {
    const roles = new Set(builds.map((b) => b.role));
    for (const role of ['combat', 'exploration', 'mining', 'trade', 'passenger', 'antiXeno']) {
        assert.ok(roles.has(role), `no ${role} build in the corpus`);
    }

    // Both ends of the shipyard: the lightest and heaviest hulls both carry builds, and
    // the corpus spans them — a corpus of nothing but mid-size hulls would prove less.
    const hullMasses = SHIPS.map((s) => s.hullMass).filter((m) => typeof m === 'number');
    assert.equal(hullMasses.length, SHIPS.length, 'every hull declares a hull mass');
    const byHull = new Map(SHIPS.map((s) => [s.symbol, s.hullMass]));
    const built = builds.map((b) => byHull.get(b.ship)).filter((m) => typeof m === 'number');
    assert.equal(built.length, builds.length, 'every corpus build names a known hull');
    assert.equal(Math.min(...built), Math.min(...hullMasses), 'the lightest hull has no build');
    assert.equal(Math.max(...built), Math.max(...hullMasses), 'the heaviest hull has no build');

    // Engineering is the half of a build the catalogues cannot infer, so the corpus has
    // to carry a lot of it — and some stock builds too, or the stock path goes unproven.
    const engineered = builds.filter((b) => b.modules.some((m) => m.engineering));
    assert.ok(
        engineered.length >= 120,
        `only ${engineered.length} builds carry engineering, expected at least 120`,
    );
    assert.ok(
        engineered.length < builds.length,
        'the corpus should keep some entirely stock builds',
    );
    const entries = builds.reduce((n, b) => n + b.modules.filter((m) => m.engineering).length, 0);
    assert.ok(entries >= 1800, `only ${entries} engineered modules, expected at least 1800`);
});
