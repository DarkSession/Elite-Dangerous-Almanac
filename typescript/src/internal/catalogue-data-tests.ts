/**
 * Shared test registration for the language-neutral JSONC catalogues.
 *
 * @internal
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Ajv } from 'ajv';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

const BANNED_PAYLOAD_KEYS = ['attribution', 'description'] as const;

/** Configuration for one domain's shared catalogue validation suite. */
export interface CatalogueDataTestOptions {
    /** Domain directory name used in test descriptions, such as `astro`. */
    readonly domain: string;
    /** Expected schema definition for each JSONC file. */
    readonly definitions: Readonly<Record<string, string>>;
}

/** One discovered catalogue exposed to domain-specific invariant tests. */
export interface CatalogueDataTestCase {
    /** JSONC file name within the domain directory. */
    readonly name: string;
    /** Read and parse this catalogue, caching the result. */
    readonly readPayload: () => unknown;
}

/**
 * Register the portable-format, attribution, and schema tests common to every domain.
 *
 * @param options - Domain name and its exact file-to-schema-definition mapping.
 * @returns Discovered catalogue cases for extra domain-specific tests.
 * @internal
 */
export function registerCatalogueDataTests(
    options: CatalogueDataTestOptions,
): readonly CatalogueDataTestCase[] {
    const dataDirectory = fileURLToPath(
        new URL(`../../../data/${options.domain}/`, import.meta.url),
    );
    const schemaPath = new URL(
        `../../../schemas/${options.domain}/catalogues.schema.json`,
        import.meta.url,
    );
    const files = readdirSync(dataDirectory)
        .filter((name) => name.endsWith('.jsonc'))
        .sort();
    const parsedByName = new Map<string, unknown>();
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as { readonly $id: string };

    // Ajv is CommonJS. Requiring it directly avoids forwarding it through the tsx and
    // synchronous JSONC loader chain; strictTypes is an Ajv convention that would make
    // language-neutral schemas repeat parent types in every conditional branch.
    const AjvConstructor = createRequire(import.meta.url)('ajv') as typeof Ajv;
    const ajv = new AjvConstructor({ allErrors: true, strictTypes: false });
    ajv.addSchema(schema);

    function read(name: string): unknown {
        assert.ok(files.includes(name), `${name} is not a data/${options.domain} catalogue`);
        if (!parsedByName.has(name)) {
            const raw = readFileSync(join(dataDirectory, name), 'utf8');
            parsedByName.set(name, JSON.parse(stripJsonComments(raw)) as unknown);
        }
        return parsedByName.get(name);
    }

    test(`data/${options.domain} contains exactly its mapped catalogues`, () => {
        assert.deepEqual(files, Object.keys(options.definitions).sort());
    });

    for (const name of files) {
        test(`${name} parses as strict JSON once comments are stripped`, () => {
            const raw = readFileSync(join(dataDirectory, name), 'utf8');
            assert.match(raw, /^\/\*/, `${name} must open with an attribution comment header`);
            // Throws with the original line number: stripJsonComments blanks comments.
            read(name);
        });

        test(`${name} keeps its attribution out of the parsed payload`, () => {
            const parsed = read(name);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
            for (const key of BANNED_PAYLOAD_KEYS) {
                assert.ok(
                    !Object.hasOwn(parsed, key),
                    `${name} has a top-level "${key}" — move it into the comment header`,
                );
            }
        });

        test(`${name} matches the shared JSON Schema`, () => {
            const definition = options.definitions[name];
            assert.ok(definition, `no JSON Schema definition mapped for ${name}`);
            const validate = ajv.compile({
                $ref: `${schema.$id}#/definitions/${definition}`,
            });
            assert.equal(
                validate(read(name)),
                true,
                `${name}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`,
            );
        });
    }

    return files.map((name) => ({ name, readPayload: () => read(name) }));
}
