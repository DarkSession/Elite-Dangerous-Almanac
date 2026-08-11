import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

import {
    ENGINEERING_OPTION_GROUPS,
    getEngineeringGroup,
    getBlueprintsForModule,
    getExperimentalsForModule,
    getExperimentalsForBlueprint,
    type EngineeringOptionGroup,
} from './engineering-options.js';
import { resolveBlueprintForModule } from './blueprint-journal.js';
import { BLUEPRINTS } from './blueprints.js';
import { EXPERIMENTAL_EFFECTS } from './experimental-effects.js';
import { getModuleBySymbol } from './modules.js';
import type { EngineeringGroupId } from './engineering-options.js';
import { ALL_MODULES } from './modules-all.js';
import { BLUEPRINT_JOURNAL_NAMES } from './internal/blueprint-journal-names.js';
import { isFinalGuardianWeaponEngineering } from './internal/loadout-engineering.js';
import fixture from '../../../fixtures/ships/engineering-options.jsonc' with { type: 'json' };
import engineeringFixture from '../../../fixtures/ships/engineering.jsonc' with { type: 'json' };
import buildIndex from '../../../fixtures/ships/builds/index.jsonc' with { type: 'json' };

function optionGroup(id: string): EngineeringOptionGroup {
    assert.ok(Object.hasOwn(ENGINEERING_OPTION_GROUPS, id), `unknown group ${id}`);
    return ENGINEERING_OPTION_GROUPS[id as EngineeringGroupId];
}

test('the catalogue holds the expected groups, modules and exclusions', () => {
    assert.equal(Object.keys(ENGINEERING_OPTION_GROUPS).length, fixture.counts.groups);
    const grouped = ALL_MODULES.filter((module) => getEngineeringGroup(module.symbol) !== null);
    assert.equal(grouped.length, fixture.counts.modules);
    const narrowed = grouped.filter((module) => {
        const group = ENGINEERING_OPTION_GROUPS[getEngineeringGroup(module.symbol)!]!;
        return getExperimentalsForModule(module.symbol).length < group.experimentals.length;
    });
    assert.equal(narrowed.length, fixture.counts.exclusions);
    assert.equal(
        grouped.filter((module) => getExperimentalsForModule(module.symbol).length === 0).length,
        fixture.counts.modulesWithoutExperimental,
    );
    const offered = new Set(
        Object.values(ENGINEERING_OPTION_GROUPS).flatMap((group) => group.blueprints),
    );
    assert.equal(offered.size, fixture.counts.blueprintsOffered);
    for (const blueprint of offered) assert.ok(BLUEPRINTS[blueprint], blueprint);
});

test('every group holds the modules, name and menu the fixture pins', () => {
    // Totals alone would let a module move between groups unnoticed; per-group sizes
    // catch it, and every group has to appear on both sides.
    const sizes: Record<string, number> = {};
    for (const module of ALL_MODULES) {
        const group = getEngineeringGroup(module.symbol);
        if (group !== null) sizes[group] = (sizes[group] ?? 0) + 1;
    }
    assert.deepEqual(sizes, fixture.groupSizes);
    assert.deepEqual(
        Object.keys(fixture.groupSizes).sort(),
        Object.keys(ENGINEERING_OPTION_GROUPS).sort(),
    );
    // Every group's menu, by content: a list that gains or loses an id fails here even
    // though the counts above would still balance.
    assert.deepEqual(
        fixture.groups.map((expected) => expected.id),
        Object.keys(ENGINEERING_OPTION_GROUPS),
    );
    for (const expected of fixture.groups) {
        const group = optionGroup(expected.id);
        assert.equal(group.name, expected.name);
        assert.deepEqual([...group.blueprints], expected.blueprints, expected.id);
        assert.deepEqual([...group.experimentals], expected.experimentals, expected.id);
    }
});

test('no menu offers two blueprints the game writes the same way', () => {
    // Resolution reads a menu against the journal-name catalogue, so it is only well defined
    // while each menu answers to a given journal id exactly once. A group that offered both
    // `Sensor_LongRange` and `Scanner_LongRange` would make the id genuinely ambiguous, and
    // this function would silently pick whichever came first.
    for (const [id, group] of Object.entries(ENGINEERING_OPTION_GROUPS)) {
        const seen = new Map<string, string>();
        for (const fdname of group.blueprints) {
            const journalName = (BLUEPRINT_JOURNAL_NAMES[fdname] ?? fdname).toLowerCase();
            const clash = seen.get(journalName);
            assert.equal(clash, undefined, `${id}: ${fdname} and ${clash} are both ${journalName}`);
            seen.set(journalName, fdname);
        }
    }
});

test('the journal-name catalogue contains only real recipe collisions', () => {
    assert.deepEqual(BLUEPRINT_JOURNAL_NAMES, engineeringFixture.journalNames.map);
    assert.ok(Object.isFrozen(BLUEPRINT_JOURNAL_NAMES));
    for (const [fdname, journalName] of Object.entries(BLUEPRINT_JOURNAL_NAMES)) {
        assert.notEqual(journalName.toLowerCase(), fdname.toLowerCase());
        assert.ok(BLUEPRINTS[fdname], `${fdname} is not a blueprint`);
        // The id it is written as is a real recipe in its own right — that is the collision.
        assert.ok(BLUEPRINTS[journalName], `${fdname}: ${journalName}`);
    }
});

test('the same journal id resolves to a different recipe on a scanner and on a suite', () => {
    // The game writes `Sensor_LongRange` for both, and the two roll different stats, so the
    // module decides which recipe the id names.
    assert.equal(
        resolveBlueprintForModule('Hpt_CloudScanner_Size0_Class5', 'Sensor_LongRange'),
        'Scanner_LongRange',
    );
    assert.equal(
        resolveBlueprintForModule('Int_Sensors_Size4_Class5', 'Sensor_LongRange'),
        'Sensor_LongRange',
    );
    // Case and whitespace are matched the way every other lookup matches them, and when a
    // journal name resolves, the answer is the catalogue's spelling rather than the caller's.
    assert.equal(
        resolveBlueprintForModule('  hpt_cloudscanner_size0_class5 ', ' sensor_wideangle '),
        'Scanner_WideAngle',
    );
    // But an id the menu already lists comes back **byte for byte** as it was passed, never
    // canonicalised. `applyBlueprint` compares the two by identity to decide whether an
    // error should name both spellings, so rewriting a caller's own id here would make
    // every mis-cased call report a resolution that never happened.
    for (const spelling of ['Scanner_LongRange', 'scanner_longrange', ' Scanner_LongRange ']) {
        assert.equal(
            resolveBlueprintForModule('Hpt_CloudScanner_Size0_Class5', spelling),
            spelling,
        );
    }
    // Resolution runs into a menu, never out of one. The menu's own id, an id no entry on
    // this menu is written as, and a module with no menu at all all come back untouched —
    // and coming back untouched is not the same as being offered.
    assert.equal(
        resolveBlueprintForModule('Hpt_CloudScanner_Size0_Class5', 'Scanner_LongRange'),
        'Scanner_LongRange',
    );
    assert.equal(
        resolveBlueprintForModule('Int_Sensors_Size4_Class5', 'Scanner_LongRange'),
        'Scanner_LongRange',
    );
    assert.ok(!getBlueprintsForModule('Int_Sensors_Size4_Class5').includes('Scanner_LongRange'));
    assert.equal(
        resolveBlueprintForModule('Int_Hyperdrive_Size5_Class5', 'FSD_LongRange'),
        'FSD_LongRange',
    );
    assert.equal(
        resolveBlueprintForModule('Int_FuelTank_Size5_Class3', 'Sensor_LongRange'),
        'Sensor_LongRange',
    );
    // An id no blueprint answers to is not invented into one.
    assert.equal(
        resolveBlueprintForModule('Hpt_CloudScanner_Size0_Class5', 'NoSuchBlueprint'),
        'NoSuchBlueprint',
    );
});

test('a Guardian group holds Guardian modules and its ordinary twin holds none', () => {
    // Sizes alone would let two modules swap groups. This is the rule the split follows,
    // so it holds for every member rather than for the pinned representative alone.
    for (const family of fixture.splitFamilies) {
        const guardian = ALL_MODULES.filter(
            (module) => getEngineeringGroup(module.symbol) === family.guardian.group,
        );
        const ordinary = ALL_MODULES.filter(
            (module) => getEngineeringGroup(module.symbol) === family.ordinary.group,
        );
        assert.ok(guardian.length > 0 && ordinary.length > 0, family.guardian.group);
        for (const module of guardian) {
            assert.match(module.symbol, /guardian/i, `${module.symbol} is not a Guardian module`);
        }
        for (const module of ordinary) {
            assert.doesNotMatch(module.symbol, /guardian/i, module.symbol);
        }
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
    // Read the payload itself, not just the lookups over it: a symbol that does not name
    // a module — a typo or stale entry — is invisible
    // to `getEngineeringGroup`, which is only ever asked about symbols that do exist.
    const payload = JSON.parse(
        stripJsonComments(
            readFileSync(
                fileURLToPath(
                    new URL('../../../data/ships/engineering-options.jsonc', import.meta.url),
                ),
                'utf8',
            ),
        ),
    ) as {
        modules: Record<string, EngineeringGroupId>;
        exclusions: Record<string, readonly string[]>;
    };
    for (const [symbol, group] of Object.entries(payload.modules)) {
        assert.ok(getModuleBySymbol(symbol, ALL_MODULES), `${symbol} is not a module`);
        assert.equal(optionGroup(group), ENGINEERING_OPTION_GROUPS[group], symbol);
    }
    for (const symbol of Object.keys(payload.exclusions)) {
        assert.ok(payload.modules[symbol], `${symbol} is excluded but not grouped`);
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
            assert.deepEqual([...getExperimentalsForModule(half.symbol)], half.experimentals);
        }
        const ordinary = new Set(getBlueprintsForModule(family.ordinary.symbol));
        for (const blueprint of getBlueprintsForModule(family.guardian.symbol)) {
            assert.ok(!ordinary.has(blueprint), `${family.guardian.group}: ${blueprint} shared`);
        }
        // The experimental slot goes with the recipe, not with the kind of module: the
        // ordinary half keeps the family's effects and the Guardian half has none, because
        // Anti-Guardian Zone Resistance is the whole of its menu.
        assert.deepEqual(optionGroup(family.guardian.group).experimentals, []);
        assert.ok(optionGroup(family.ordinary.group).experimentals.length > 0);
    }
});

test('the one recipe a Guardian module takes offers no experimental effect', () => {
    // A Guardian module is engineered with Anti-Guardian Zone Resistance and nothing else,
    // and that recipe has no experimental slot. Engineered Guardian modules that do carry
    // one are pre-engineered rewards, sold already applied rather than rolled at an
    // engineer.
    const { blueprint, experimentals, groups, modules } = fixture.antiGuardianZoneResistance;
    const offering = Object.entries(ENGINEERING_OPTION_GROUPS)
        .filter(([, group]) => group.blueprints.includes(blueprint))
        .map(([id]) => id);
    assert.deepEqual(offering, groups);
    for (const id of offering) {
        assert.deepEqual([...optionGroup(id).experimentals], experimentals, id);
    }
    // The blueprint-level union is empty too, matching the group menus.
    assert.deepEqual(getExperimentalsForBlueprint(blueprint), experimentals);
    for (const symbol of modules) {
        assert.deepEqual([...getBlueprintsForModule(symbol)], [blueprint], symbol);
        assert.deepEqual([...getExperimentalsForModule(symbol)], experimentals, symbol);
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
        for (const blueprint of optionGroup(group).blueprints) {
            const union = getExperimentalsForBlueprint(blueprint);
            for (const effect of getExperimentalsForModule(symbol)) {
                assert.ok(union.includes(effect), `${blueprint}: union misses ${effect}`);
            }
        }
    }
});

/**
 * The community build corpus, read the way `builds.test.ts` reads it: `index.jsonc` names
 * the builds, one file each. Only the fitted symbol and the declared engineering matter
 * here, so the rest of a build is left untyped.
 */
interface CorpusEngineering {
    modules: { item: string; engineering?: { blueprint: string; experimental?: string } }[];
}
const CORPUS_DIR = fileURLToPath(new URL('../../../fixtures/ships/builds/', import.meta.url));
const corpus: CorpusEngineering[] = buildIndex.builds.map(
    (entry) =>
        JSON.parse(
            stripJsonComments(readFileSync(join(CORPUS_DIR, `${entry.id}.jsonc`), 'utf8')),
        ) as CorpusEngineering,
);
const declared = corpus.flatMap((build) =>
    build.modules
        .filter((module) => module.engineering)
        .map((module) => ({ symbol: module.item, ...module.engineering! })),
);

test('every module the build corpus declares as engineered is grouped, bar the Mk II weapon', () => {
    assert.equal(declared.length, fixture.corpus.declaredEngineering);
    const ungrouped = declared.filter((entry) => getEngineeringGroup(entry.symbol) === null);
    assert.deepEqual(
        [...new Set(ungrouped.map((entry) => entry.symbol))].sort(),
        fixture.corpus.notEngineerable.map((row) => row.symbol).sort(),
    );
    assert.equal(ungrouped.length, fixture.corpus.ungroupedEntries);
    for (const row of fixture.corpus.notEngineerable) {
        const entries = declared.filter((entry) => entry.symbol === row.symbol);
        assert.equal(entries.length, row.entries, row.symbol);
        for (const entry of entries) assert.equal(entry.blueprint, row.blueprint, row.symbol);
    }
});

test('every menu is sorted, because the API promises it is', () => {
    // `getBlueprintsForModule` documents "Blueprint ids, sorted" and its `@example` quotes
    // a menu's first element. Nothing enforced that: renaming a key moved it within four
    // menus and silently falsified both. Sorted case-insensitively, which is also ASCII
    // order for these ids, so the two readings cannot disagree.
    for (const [id, group] of Object.entries(ENGINEERING_OPTION_GROUPS)) {
        assert.deepEqual(
            [...group.blueprints],
            [...group.blueprints].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
            `${id} blueprints are not sorted`,
        );
        assert.deepEqual(
            [...group.experimentals],
            [...group.experimentals].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
            `${id} experimentals are not sorted`,
        );
    }
    // And the shipped example is the menu it claims to be.
    assert.equal(
        getBlueprintsForModule('Hpt_BeamLaser_Fixed_Small')[0],
        'BeamLaser_ThermalPlasmaConversion',
    );
});

test('every applicable corpus recipe is one its module offers', () => {
    // A recipe that applies to several module families is stored under each family's own
    // journal id; the catalogue lists the family-specific one, so a build spelling it the
    // generic way is declaring the same thing — and the alias must be one of *this*
    // module's family, not merely some family's. The scanner ids are the other kind: one
    // journal spelling, two different recipes, which only the module's own menu read
    // against the journal-name catalogue can settle. Guardian entries describing final
    // pre-engineered articles are classified before this menu check: their Engineering
    // blocks identify what was bought, not a recipe a player can apply.
    const aliases: Record<string, readonly string[]> = fixture.corpus.blueprintAliases;
    let viaAlias = 0;
    let viaJournalSpelling = 0;
    let finalPreEngineered = 0;
    for (const entry of declared) {
        const groupId = getEngineeringGroup(entry.symbol);
        if (groupId === null) continue; // pinned by the previous test
        const final = fixture.corpus.finalPreEngineered.find(
            (row) =>
                row.symbol === entry.symbol &&
                row.blueprint === entry.blueprint &&
                (row.experimental ?? null) === (entry.experimental ?? null),
        );
        if (final) {
            finalPreEngineered += 1;
            continue;
        }
        const offered = getBlueprintsForModule(entry.symbol);
        if (!offered.includes(entry.blueprint)) {
            const resolved = resolveBlueprintForModule(entry.symbol, entry.blueprint);
            const specific = aliases[entry.blueprint] ?? [];
            const matching = specific.filter((id) => offered.includes(id));
            if (resolved !== entry.blueprint) {
                assert.ok(offered.includes(resolved), `${entry.symbol}: ${resolved} not offered`);
                assert.equal(matching.length, 0, `${entry.symbol}: two ways to read one id`);
                viaJournalSpelling += 1;
            } else if (matching.length > 0) {
                assert.equal(matching.length, 1, `${entry.symbol}: ambiguous alias`);
                viaAlias += 1;
            } else {
                assert.fail(`${entry.symbol}: ${entry.blueprint} is not offered`);
            }
        }
        if (
            entry.experimental &&
            !getExperimentalsForModule(entry.symbol).includes(entry.experimental)
        ) {
            assert.fail(`${entry.symbol}: ${entry.experimental} is not offered`);
        }
    }
    assert.equal(viaAlias, fixture.corpus.aliasSpellingsAccepted);
    assert.equal(viaJournalSpelling, fixture.corpus.journalSpellingsAccepted);
    assert.equal(finalPreEngineered, fixture.corpus.finalPreEngineeredEntries);
});

test('the final pre-engineered corpus entries are exactly the ones the fixture names', () => {
    for (const row of fixture.corpus.finalPreEngineered) {
        const matches = declared.filter(
            (entry) =>
                entry.symbol === row.symbol &&
                entry.blueprint === row.blueprint &&
                (entry.experimental ?? null) === (row.experimental ?? null),
        );
        assert.equal(matches.length, row.entries, `${row.symbol}: ${row.blueprint}`);
        assert.deepEqual(getBlueprintsForModule(row.symbol), ['GuardianModule_Sturdy']);
        assert.deepEqual(getExperimentalsForModule(row.symbol), []);
        assert.ok(
            isFinalGuardianWeaponEngineering(row.symbol, row.blueprint),
            `${row.symbol}: ${row.blueprint} is not recognised as a final article`,
        );
    }
});

test('getExperimentalsForBlueprint normalises input and misses cleanly', () => {
    assert.deepEqual(
        getExperimentalsForBlueprint('  fsd_longrange  '),
        fixture.blueprintUnion.experimentals,
    );
    assert.deepEqual(getExperimentalsForBlueprint('NoSuchBlueprint'), []);
});
