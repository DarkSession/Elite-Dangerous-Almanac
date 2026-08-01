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
    'ships.jsonc': 'shipCatalogue',
    'blueprints.jsonc': 'blueprintCatalogue',
    'experimental-effects.jsonc': 'experimentalCatalogue',
    'pre-engineered.jsonc': 'preEngineeredCatalogue',
};

// Ajv 6 is CommonJS; require it directly so Node's synchronous JSONC ESM hook does
// not have to forward a CommonJS module through tsx's loader chain.
const AjvConstructor = createRequire(import.meta.url)('ajv') as typeof Ajv;
const ajv = new AjvConstructor({ allErrors: true });
ajv.addSchema(catalogueSchema);

function schemaDefinition(name: string): string {
    if (name.startsWith('modules-')) return 'moduleCatalogue';
    const definition = DEFINITION_BY_FILE[name];
    assert.ok(definition, `no JSON Schema definition mapped for ${name}`);
    return definition;
}

test('data/ships holds the expected number of catalogues', () => {
    // 5 catalogues carrying identity + stats (ships + 4 module categories, each hull
    // and module now one record) + 2 engineering catalogues (blueprints — each grade
    // carrying its modifiers and its materials — and experimental-effects) + the
    // pre-engineered pairings joining a bought variant to the blueprint baked into it.
    assert.equal(DATA_FILES.length, 8);
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
