/**
 * Guards the shared `data/ships/*.jsonc` files themselves, independently of the
 * modules that consume them. The sibling `src/astro/data-files.test.ts` explains the
 * shared invariants in full — portable strict JSON, attribution kept in the comment
 * header, a schema definition mapped to every file, and conformance to
 * `schemas/ships/catalogues.schema.json`.
 *
 * This domain adds rules of its own, each argued where it is asserted below: a module
 * file states its category once, in its name; a module record belongs to the file it
 * sits in; and a symbol-keyed catalogue holds no duplicate symbols.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';

/**
 * The module files the per-record rules below know about. A fifth `modules-*.jsonc`
 * fails on this set before its records are looked at, so an *empty* new file cannot slip
 * through the per-record loop by having nothing to loop over. The `switch` on the same
 * names keeps its own `default: assert.fail`, so a name added here without a rule there
 * fails too — the two lists guard each other rather than one replacing the other.
 */
const MODULE_FILE_RULES = new Set([
    'modules-core.jsonc',
    'modules-internal.jsonc',
    'modules-hardpoint.jsonc',
    'modules-utility.jsonc',
]);
const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    // One definition per module file, not one shared `moduleCatalogue`: with the
    // category gone from the payload, the file *is* the category, and each file's
    // own definition is what still pins the `slot` rule that goes with it.
    'modules-core.jsonc': 'coreModuleCatalogue',
    'modules-internal.jsonc': 'internalModuleCatalogue',
    'modules-hardpoint.jsonc': 'hardpointModuleCatalogue',
    'modules-utility.jsonc': 'utilityModuleCatalogue',
    'ships.jsonc': 'shipCatalogue',
    'gunsights.jsonc': 'shipGunsightCatalogue',
    'default-loadouts.jsonc': 'defaultLoadoutCatalogue',
    'blueprints.jsonc': 'blueprintCatalogue',
    'blueprint-costs.jsonc': 'blueprintCostCatalogue',
    'blueprint-journal-names.jsonc': 'blueprintJournalNameCatalogue',
    'experimental-effects.jsonc': 'experimentalCatalogue',
    'experimental-effect-costs.jsonc': 'experimentalEffectCostCatalogue',
    'pre-engineered.jsonc': 'preEngineeredCatalogue',
    'engineering-options.jsonc': 'engineeringOptionCatalogue',
};

const DATA_FILES = registerCatalogueDataTests({
    domain: 'ships',
    definitions: DEFINITION_BY_FILE,
});

test('ships.jsonc keeps every installed minimum endpoint no greater than its full endpoint', () => {
    const shipsFile = DATA_FILES.find(({ name }) => name === 'ships.jsonc');
    assert.ok(shipsFile);
    const records = shipsFile.readPayload();
    assert.ok(Array.isArray(records));
    for (const record of records as readonly Record<string, unknown>[]) {
        const symbol = String(record.symbol);
        for (const [minimumField, maximumField] of [
            ['minimumSpeed', 'maximumSpeed'],
            ['minPitch', 'pitch'],
            ['minRoll', 'roll'],
            ['minYaw', 'yaw'],
        ] as const) {
            const minimum = record[minimumField];
            const maximum = record[maximumField];
            assert.equal(typeof minimum, 'number', `${symbol}: ${minimumField}`);
            assert.equal(typeof maximum, 'number', `${symbol}: ${maximumField}`);
            assert.ok(
                (minimum as number) <= (maximum as number),
                `${symbol}: ${minimumField} exceeds ${maximumField}`,
            );
        }
    }
});

for (const { name, readPayload } of DATA_FILES) {
    if (name.startsWith('modules-')) {
        test(`${name} states its category once, in its name`, () => {
            // Every payload byte is inlined into consumers' bundles, and this one said
            // nothing the file name did not: the loader adds `category` back from the
            // file it read (src/ships/internal/module-catalogue.ts).
            const parsed = readPayload();
            assert.ok(Array.isArray(parsed));
            const repeated = parsed.filter(
                (record: unknown) =>
                    typeof record === 'object' && record !== null && 'category' in record,
            );
            assert.equal(
                repeated.length,
                0,
                `${name} repeats "category" on ${repeated.length} records — the file is the category`,
            );
        });

        test(`${name} holds only records that belong in it`, () => {
            // The file defines the category. These independent rules discriminate the
            // categories from the record alone, so a misfiled record fails:
            //
            //   hardpoint  Hpt_ symbol, size 1-4    utility   Hpt_ symbol, size 0
            //   core       carries `slot`           internal  no `slot`, bar the hybrids
            //
            // They are game facts rather than conventions: a utility mount has no size,
            // which is why its fittings are class 0 and a hardpoint weapon never is, and
            // only a module built for one fixed mount has a `slot` to name.
            //
            // One move satisfies the rules here and is caught next door rather than
            // silently: a Guardian hybrid put in `modules-core.jsonc` does carry a
            // `slot`, and fails the schema, whose core `oneOf` pairs each symbol family
            // with its mount and has no branch for a Guardian one.
            const parsed = readPayload();
            assert.ok(Array.isArray(parsed));
            assert.ok(
                MODULE_FILE_RULES.has(name),
                `${name} is a module catalogue with no rule below — add one, or a record misfiled into it goes unnoticed (an empty file would not even reach the loop)`,
            );
            for (const record of parsed as readonly Record<string, unknown>[]) {
                const symbol = String(record.symbol);
                const mounted = symbol.toLowerCase().startsWith('hpt_');
                const guardianHybrid = /^Int_GuardianPower(?:[Pp]lant|Distributor)_/.test(symbol);
                const where = `${name}: ${symbol}`;
                switch (name) {
                    case 'modules-hardpoint.jsonc':
                        assert.ok(mounted, `${where} is not a hardpoint symbol`);
                        assert.ok(
                            typeof record.class === 'number' &&
                                record.class >= 1 &&
                                record.class <= 4,
                            `${where} is not a hardpoint size (1-4) — size 0 is a utility fitting`,
                        );
                        assert.ok(!('slot' in record), `${where} names a fixed mount`);
                        break;
                    case 'modules-utility.jsonc':
                        assert.ok(mounted, `${where} is not a utility-mount symbol`);
                        assert.equal(record.class, 0, `${where} is sized — utility mounts are not`);
                        assert.ok(!('slot' in record), `${where} names a fixed mount`);
                        break;
                    case 'modules-core.jsonc':
                        assert.ok(!mounted, `${where} is a hardpoint symbol`);
                        assert.ok('slot' in record, `${where} names no core mount`);
                        break;
                    case 'modules-internal.jsonc':
                        assert.ok(!mounted, `${where} is a hardpoint symbol`);
                        assert.ok(
                            !('slot' in record) || guardianHybrid,
                            `${where} names a fixed mount but is not a Guardian hybrid`,
                        );
                        break;
                    default:
                        assert.fail(
                            `${name} is in MODULE_FILE_RULES with no rule here — add one, or a record misfiled into it goes unnoticed`,
                        );
                }
            }
        });
    }

    test(`${name} has unique symbols when it is symbol-keyed`, () => {
        // `pre-engineered.jsonc` is exempt by design: its records are *pairings*, not
        // modules, and one base module is sold in several pre-engineered flavours — so
        // `symbol` repeats there. Neither column is unique on its own; the invariant
        // that holds includes grade and experimental identity, asserted in
        // pre-engineered.test.ts.
        if (name === 'pre-engineered.jsonc') return;
        const parsed = readPayload();
        if (!Array.isArray(parsed)) return;
        const symbols = parsed.flatMap((record: unknown) => {
            if (typeof record !== 'object' || record === null || !('symbol' in record)) return [];
            const symbol = (record as { symbol?: unknown }).symbol;
            return typeof symbol === 'string' ? [symbol.toLowerCase()] : [];
        });
        assert.equal(new Set(symbols).size, symbols.length, `${name} has duplicate symbols`);
    });
}
