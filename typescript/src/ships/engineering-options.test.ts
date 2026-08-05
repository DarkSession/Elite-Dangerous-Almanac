import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ENGINEERING_OPTION_GROUPS,
    getEngineeringGroup,
    getBlueprintsForModule,
    getExperimentalsForModule,
    getExperimentalsForBlueprint,
} from './engineering-options.js';
import { BLUEPRINTS } from './blueprints.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { getModuleBySymbol } from './modules.js';
import { ALL_MODULES } from './modules-all.js';
import fixture from '../../../fixtures/ships/engineering-options.json' with { type: 'json' };
import buildIndex from '../../../fixtures/ships/builds/index.json' with { type: 'json' };

test('the catalogue holds the expected groups, modules and exclusions', () => {
    assert.equal(Object.keys(ENGINEERING_OPTION_GROUPS).length, fixture.counts.groups);
    const grouped = ALL_MODULES.filter((module) => getEngineeringGroup(module.symbol) !== null);
    assert.equal(grouped.length, fixture.counts.modules);
    const narrowed = grouped.filter((module) => {
        const group = ENGINEERING_OPTION_GROUPS[getEngineeringGroup(module.symbol)!]!;
        return getExperimentalsForModule(module.symbol).length < group.experimentals.length;
    });
    assert.equal(narrowed.length, fixture.counts.exclusions);
    for (const expected of fixture.groups) {
        const group = ENGINEERING_OPTION_GROUPS[expected.id];
        assert.ok(group, `missing group ${expected.id}`);
        assert.equal(group.name, expected.name);
        assert.equal(group.blueprints.length, expected.blueprintCount);
        assert.equal(group.experimentals.length, expected.experimentalCount);
    }
});

test('every id in the catalogue joins to a real blueprint or experimental effect', () => {
    for (const [id, group] of Object.entries(ENGINEERING_OPTION_GROUPS)) {
        for (const blueprint of group.blueprints) {
            assert.ok(BLUEPRINTS[blueprint], `${id}: unknown blueprint ${blueprint}`);
        }
        for (const effect of group.experimentals) {
            assert.ok(EXPERIMENTAL_EFFECTS[effect], `${id}: unknown effect ${effect}`);
        }
    }
});

test('every module in the catalogue is a real module in a real group', () => {
    for (const expected of fixture.modules) {
        assert.ok(getModuleBySymbol(expected.symbol, ALL_MODULES), expected.symbol);
        assert.equal(getEngineeringGroup(expected.symbol), expected.group);
    }
});

test('getEngineeringGroup normalises input and misses cleanly', () => {
    assert.equal(getEngineeringGroup('  hpt_beamlaser_fixed_small  '), 'beamLasers');
    assert.equal(getEngineeringGroup('HPT_BEAMLASER_FIXED_SMALL'), 'beamLasers');
    for (const symbol of fixture.notEngineerable) {
        assert.equal(getEngineeringGroup(symbol), null, symbol);
        assert.deepEqual(getBlueprintsForModule(symbol), []);
        assert.deepEqual(getExperimentalsForModule(symbol), []);
    }
});

test('a module offers its whole group unless it is explicitly excluded', () => {
    for (const { symbol, excluded } of fixture.exclusions) {
        const group = ENGINEERING_OPTION_GROUPS[getEngineeringGroup(symbol)!]!;
        const offered = getExperimentalsForModule(symbol);
        for (const effect of excluded) {
            assert.ok(group.experimentals.includes(effect), `${symbol}: ${effect} not in group`);
            assert.ok(!offered.includes(effect), `${symbol} still offers ${effect}`);
        }
        assert.equal(offered.length, group.experimentals.length - excluded.length);
    }
});

test('a Guardian variant and its ordinary twin are different groups, not one merged menu', () => {
    // Upstream denies the ordinary recipes to the Guardian module and Anti-Guardian Zone
    // Resistance to the ordinary one. Merging the two would offer each the other's menu.
    for (const family of fixture.splitFamilies) {
        for (const half of [family.ordinary, family.guardian]) {
            assert.equal(getEngineeringGroup(half.symbol), half.group, half.symbol);
            assert.deepEqual([...getBlueprintsForModule(half.symbol)], half.blueprints);
        }
        const ordinary = new Set(getBlueprintsForModule(family.ordinary.symbol));
        for (const blueprint of getBlueprintsForModule(family.guardian.symbol)) {
            assert.ok(!ordinary.has(blueprint), `${family.guardian.group}: ${blueprint} shared`);
        }
        // Same kind of module, so the experimental slot is unchanged by the split.
        assert.deepEqual(
            ENGINEERING_OPTION_GROUPS[family.guardian.group]!.experimentals,
            ENGINEERING_OPTION_GROUPS[family.ordinary.group]!.experimentals,
        );
    }
});

test('the small Multi-cannon is exactly one effect short of its group', () => {
    const all = getExperimentalsForModule('Hpt_MultiCannon_Fixed_Medium');
    const small = getExperimentalsForModule('Hpt_MultiCannon_Fixed_Small');
    assert.equal(small.length, all.length - 1);
    assert.ok(all.includes('special_phasing_sequence'));
    assert.ok(!small.includes('special_phasing_sequence'));
});

test('an engineerable module with no experimental slot still has blueprints', () => {
    // The Abrasion Blaster is grouped and takes blueprints but no experimental —
    // distinct from a module the catalogue does not group, which has neither.
    const symbol = 'Hpt_Mining_AbrBlstr_Fixed_Small';
    assert.ok(getEngineeringGroup(symbol));
    assert.ok(getBlueprintsForModule(symbol).length > 0);
    assert.deepEqual(getExperimentalsForModule(symbol), []);
});

test('a blueprint query returns the union across every group offering it', () => {
    const { blueprint, experimentals } = fixture.blueprintUnion;
    assert.deepEqual(getExperimentalsForBlueprint(blueprint), experimentals);
});

test('the blueprint union is a superset of each of its modules', () => {
    // The union is deliberately looser than the per-module answer; it must never be
    // narrower, or a caller would miss a legitimate pairing.
    for (const [symbol, group] of Object.entries(
        Object.fromEntries(fixture.modules.map((m) => [m.symbol, m.group] as const)) as Record<
            string,
            string
        >,
    )) {
        for (const blueprint of ENGINEERING_OPTION_GROUPS[group]!.blueprints) {
            const union = getExperimentalsForBlueprint(blueprint);
            for (const effect of getExperimentalsForModule(symbol)) {
                assert.ok(union.includes(effect), `${blueprint}: union misses ${effect}`);
            }
        }
    }
});

/**
 * The community build corpus, read the way `builds.test.ts` reads it: `index.json` names
 * the builds, one file each. Only the fitted symbol and the declared engineering matter
 * here, so the rest of a build is left untyped.
 */
interface CorpusEngineering {
    modules: { item: string; engineering?: { blueprint: string; experimental?: string } }[];
}
const CORPUS_DIR = fileURLToPath(new URL('../../../fixtures/ships/builds/', import.meta.url));
const corpus: CorpusEngineering[] = buildIndex.builds.map(
    (entry) =>
        JSON.parse(readFileSync(join(CORPUS_DIR, `${entry.id}.json`), 'utf8')) as CorpusEngineering,
);
const declared = corpus.flatMap((build) =>
    build.modules
        .filter((module) => module.engineering)
        .map((module) => ({ symbol: module.item, ...module.engineering! })),
);

test('every module the build corpus engineers is grouped, bar the one upstream refuses', () => {
    assert.equal(declared.length, fixture.corpus.declaredEngineering);
    const ungrouped = declared.filter((entry) => getEngineeringGroup(entry.symbol) === null);
    assert.deepEqual(
        [...new Set(ungrouped.map((entry) => entry.symbol))].sort(),
        fixture.corpus.notGrouped.map((row) => row.symbol).sort(),
    );
    assert.equal(ungrouped.length, fixture.corpus.ungroupedEntries);
    for (const row of fixture.corpus.notGrouped) {
        assert.equal(
            declared.filter((entry) => entry.symbol === row.symbol).length,
            row.entries,
            row.symbol,
        );
    }
});

test('every recipe the build corpus declares is one its module offers', () => {
    // A recipe that applies to several module families is stored under each family's own
    // journal id; the catalogue lists the family-specific one, so a build spelling it the
    // generic way is declaring the same thing — and the alias must be one of *this*
    // module's family, not merely some family's. `notOffered` is the real residue: eleven
    // declarations no registry lists for that module —
    // https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/36 for the ten on the
    // Guardian weapons, and issues/32 for the scanner id collision.
    const aliases: Record<string, readonly string[]> = fixture.corpus.blueprintAliases;
    const exempt = new Set(
        fixture.corpus.notOffered.map(
            (row) => `${row.symbol}|${'blueprint' in row ? row.blueprint : row.experimental}`,
        ),
    );
    let viaAlias = 0;
    for (const entry of declared) {
        const groupId = getEngineeringGroup(entry.symbol);
        if (groupId === null) continue; // pinned by the previous test
        const group = ENGINEERING_OPTION_GROUPS[groupId]!;
        const offered = getBlueprintsForModule(entry.symbol);
        if (!offered.includes(entry.blueprint)) {
            const specific = aliases[entry.blueprint] ?? [];
            const matching = specific.filter((id) => offered.includes(id));
            if (matching.length > 0) {
                assert.equal(matching.length, 1, `${entry.symbol}: ambiguous alias`);
                viaAlias += 1;
            } else {
                assert.ok(exempt.has(`${entry.symbol}|${entry.blueprint}`), `${entry.symbol}`);
            }
        }
        if (
            entry.experimental &&
            !getExperimentalsForModule(entry.symbol).includes(entry.experimental)
        ) {
            assert.ok(exempt.has(`${entry.symbol}|${entry.experimental}`), `${entry.symbol}`);
            assert.ok(!group.experimentals.includes(entry.experimental));
        }
    }
    assert.equal(viaAlias, fixture.corpus.aliasSpellingsAccepted);
});

test('the exempted corpus declarations are exactly the ones the fixture names', () => {
    // Pinned so the exemption cannot quietly grow: each row is a declaration the corpus
    // makes and the catalogue does not offer, with the number of entries that make it.
    for (const row of fixture.corpus.notOffered) {
        const recipe = 'blueprint' in row ? row.blueprint : row.experimental;
        const matches = declared.filter(
            (entry) =>
                entry.symbol === row.symbol &&
                (entry.blueprint === recipe || entry.experimental === recipe),
        );
        assert.equal(matches.length, row.entries, `${row.symbol}: ${recipe}`);
        const offered =
            'blueprint' in row
                ? getBlueprintsForModule(row.symbol)
                : getExperimentalsForModule(row.symbol);
        assert.ok(!offered.includes(recipe!), `${row.symbol} does offer ${recipe}`);
    }
});

test('getExperimentalsForBlueprint normalises input and misses cleanly', () => {
    assert.deepEqual(
        getExperimentalsForBlueprint('  fsd_longrange  '),
        fixture.blueprintUnion.experimentals,
    );
    assert.deepEqual(getExperimentalsForBlueprint('NoSuchBlueprint'), []);
});
