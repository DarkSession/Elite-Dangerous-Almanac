/**
 * Guards the shared `data/ships/*.jsonc` files themselves, independently of the
 * modules that consume them. The sibling `src/astro/data-files.test.ts` explains the
 * portability invariants in full; the same ones apply here. This domain also has a
 * language-neutral JSON Schema because the payloads drive public calculations:
 *
 * 1. Every file is still strict JSON once comments are blanked (no trailing commas,
 *    so any language's standard parser accepts it).
 * 2. Attribution stays in the comment header, never in the parsed payload — every
 *    payload byte is inlined into consumers' bundles.
 * 3. Every record matches `schemas/ships/catalogues.schema.json`.
 * 4. Symbol-keyed catalogues contain no duplicate symbols.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type Ajv from 'ajv';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

const DATA_DIR = fileURLToPath(new URL('../../../data/ships/', import.meta.url));
const SCHEMA_PATH = fileURLToPath(
    new URL('../../../schemas/ships/catalogues.schema.json', import.meta.url),
);
const DATA_FILES = readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.jsonc'))
    .sort();

/** Payload keys that would put non-data prose back into the bundle. */
const BANNED_KEYS = ['attribution', 'description'];
const catalogueSchema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as {
    readonly $id: string;
};

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    // One definition per module file, not one shared `moduleCatalogue`: with the
    // category gone from the payload, the file *is* the category, and each file's
    // own definition is what still pins the `slot` rule that goes with it.
    'modules-core.jsonc': 'coreModuleCatalogue',
    'modules-internal.jsonc': 'internalModuleCatalogue',
    'modules-hardpoint.jsonc': 'hardpointModuleCatalogue',
    'modules-utility.jsonc': 'utilityModuleCatalogue',
    'ships.jsonc': 'shipCatalogue',
    'blueprints.jsonc': 'blueprintCatalogue',
    'experimental-effects.jsonc': 'experimentalCatalogue',
    'pre-engineered.jsonc': 'preEngineeredCatalogue',
    'engineering-options.jsonc': 'engineeringOptionCatalogue',
};

// Ajv 6 is CommonJS; require it directly so Node's synchronous JSONC ESM hook does
// not have to forward a CommonJS module through tsx's loader chain.
const AjvConstructor = createRequire(import.meta.url)('ajv') as typeof Ajv;
const ajv = new AjvConstructor({ allErrors: true });
ajv.addSchema(catalogueSchema);

function schemaDefinition(name: string): string {
    const definition = DEFINITION_BY_FILE[name];
    assert.ok(definition, `no JSON Schema definition mapped for ${name}`);
    return definition;
}

test('data/ships holds the expected number of catalogues', () => {
    // 5 catalogues carrying identity + stats (ships + 4 module categories, each hull
    // and module now one record) + 2 engineering catalogues (blueprints — each grade
    // carrying its modifiers and its materials — and experimental-effects) + the
    // pre-engineered pairings joining a bought variant to the blueprint baked into it,
    // and the engineering options each module group offers.
    assert.equal(DATA_FILES.length, 9);
});

for (const name of DATA_FILES) {
    test(`${name} parses as strict JSON once comments are stripped`, () => {
        const raw = readFileSync(DATA_DIR + name, 'utf8');
        assert.match(raw, /^\/\*/, `${name} must open with an attribution comment header`);
        // Throws with the original line number — comments are blanked, not deleted.
        JSON.parse(stripJsonComments(raw));
    });

    test(`${name} keeps its attribution out of the parsed payload`, () => {
        const parsed: unknown = JSON.parse(
            stripJsonComments(readFileSync(DATA_DIR + name, 'utf8')),
        );
        if (Array.isArray(parsed)) return;
        for (const key of BANNED_KEYS) {
            assert.ok(
                !Object.hasOwn(parsed as object, key),
                `${name} has a top-level "${key}" — move it into the comment header`,
            );
        }
    });

    test(`${name} matches the shared JSON Schema`, () => {
        const parsed: unknown = JSON.parse(
            stripJsonComments(readFileSync(DATA_DIR + name, 'utf8')),
        );
        const reference = `${catalogueSchema.$id}#/definitions/${schemaDefinition(name)}`;
        const validate = ajv.compile({ $ref: reference });
        assert.equal(
            validate(parsed),
            true,
            `${name}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`,
        );
    });

    if (name.startsWith('modules-')) {
        test(`${name} states its category once, in its name`, () => {
            // Every payload byte is inlined into consumers' bundles, and this one said
            // nothing the file name did not: the loader adds `category` back from the
            // file it read (src/ships/module-catalogue.ts).
            const parsed: unknown = JSON.parse(
                stripJsonComments(readFileSync(DATA_DIR + name, 'utf8')),
            );
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
            // The replacement for what dropping `category` cost. While each record
            // spelled its own category, a record filed into the wrong modules-*.jsonc
            // was caught by comparing the two; now the file *is* the category, so that
            // comparison would only ever check the loader. These four rules discriminate
            // the categories from the record alone, so a misfiled record still fails:
            //
            //   hardpoint  Hpt_ symbol, size 1-4     utility  Hpt_ symbol, size 0
            //   core       carries `slot`            internal Int_ symbol, no `slot`*
            //
            // (*bar the Guardian hybrids, which the JSON Schema pins by symbol.) They are
            // game facts, not conventions: a utility mount has no size, which is why its
            // fittings are class 0 and a hardpoint weapon never is.
            const parsed: unknown = JSON.parse(
                stripJsonComments(readFileSync(DATA_DIR + name, 'utf8')),
            );
            assert.ok(Array.isArray(parsed));
            for (const record of parsed as readonly Record<string, unknown>[]) {
                const symbol = String(record.symbol);
                const mounted = symbol.toLowerCase().startsWith('hpt_');
                const where = `${name}: ${symbol}`;
                switch (name) {
                    case 'modules-hardpoint.jsonc':
                        assert.ok(mounted, `${where} is not a hardpoint symbol`);
                        assert.ok(
                            record.class !== 0,
                            `${where} is size 0 — that is a utility fitting`,
                        );
                        break;
                    case 'modules-utility.jsonc':
                        assert.ok(mounted, `${where} is not a utility-mount symbol`);
                        assert.equal(record.class, 0, `${where} is sized — utility mounts are not`);
                        break;
                    case 'modules-core.jsonc':
                        assert.ok(!mounted, `${where} is a hardpoint symbol`);
                        assert.ok('slot' in record, `${where} names no core mount`);
                        break;
                    case 'modules-internal.jsonc':
                        assert.ok(!mounted, `${where} is a hardpoint symbol`);
                        break;
                }
            }
        });
    }

    test(`${name} has unique symbols when it is symbol-keyed`, () => {
        // `pre-engineered.jsonc` is exempt by design: its records are *pairings*, not
        // modules, and one base module is sold in several pre-engineered flavours — so
        // `symbol` repeats there. Neither column is unique on its own; the invariant
        // that holds is on the (symbol, blueprint) pair, asserted in
        // pre-engineered.test.ts.
        if (name === 'pre-engineered.jsonc') return;
        const parsed: unknown = JSON.parse(
            stripJsonComments(readFileSync(DATA_DIR + name, 'utf8')),
        );
        if (!Array.isArray(parsed)) return;
        const symbols = parsed.flatMap((record: unknown) => {
            if (typeof record !== 'object' || record === null || !('symbol' in record)) return [];
            const symbol = (record as { symbol?: unknown }).symbol;
            return typeof symbol === 'string' ? [symbol.toLowerCase()] : [];
        });
        assert.equal(new Set(symbols).size, symbols.length, `${name} has duplicate symbols`);
    });
}
