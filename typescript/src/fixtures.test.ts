/**
 * Guards the shared `fixtures/**` files themselves, independently of the tests that read
 * them.
 *
 * Three invariants, all easy to break by accident:
 *
 * 1. **Every fixture opens with a comment header.** A fixture's provenance lives in that
 *    header and nowhere else (AGENTS.md §Attribution), so a fixture without one is a
 *    capture whose origin, checksum and scrubbing are unrecorded, or a parity fixture that
 *    never says what it pins.
 *
 * 2. **Every fixture is still strict JSON once comments are blanked.** JSONC's other
 *    extension — trailing commas — is deliberately not accepted, because `fixtures/` is
 *    shared with future language implementations whose standard parsers reject them too.
 *
 * 3. **The prose stays in the header, out of the payload.** A top-level `description` key
 *    is what these files used to carry; it is a comment now, and a re-added one would put
 *    a port's parser back in the position of skipping fields that are not data.
 *
 * 4. **Every fixture matches its generated family schema.** The schema is shared with
 *    future language implementations, while the generated TypeScript declarations type
 *    imports in this implementation. `npm run check:fixtures` ensures both artefacts
 *    exactly describe the checked-in payloads.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Ajv } from 'ajv';

import { stripJsonComments } from '../scripts/jsonc.mjs';

const FIXTURE_ROOT = fileURLToPath(new URL('../../fixtures/', import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL('../../schemas/fixtures.schema.json', import.meta.url));

interface FixtureSchema {
    readonly $id: string;
    readonly definitions: Readonly<Record<string, unknown>>;
    readonly 'x-fixture-families': readonly {
        readonly definition: string;
        readonly files: readonly string[];
    }[];
}

/** Every fixture in the shared tree, as a path relative to `fixtures/`. */
function fixtureFiles(directory: string, prefix = ''): string[] {
    return readdirSync(directory)
        .sort()
        .flatMap((entry) => {
            const full = join(directory, entry);
            return statSync(full).isDirectory()
                ? fixtureFiles(full, `${prefix}${entry}/`)
                : [`${prefix}${entry}`];
        });
}

const FILES = fixtureFiles(FIXTURE_ROOT);
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as FixtureSchema;
const DEFINITION_BY_FILE = new Map<string, string>();
for (const family of SCHEMA['x-fixture-families']) {
    assert.ok(Object.hasOwn(SCHEMA.definitions, family.definition));
    for (const file of family.files) {
        assert.ok(!DEFINITION_BY_FILE.has(file), `${file} belongs to two fixture schema families`);
        DEFINITION_BY_FILE.set(file, family.definition);
    }
}

// Ajv is CommonJS. Requiring it directly avoids forwarding it through the tsx and
// synchronous JSONC loader chain.
const AjvConstructor = createRequire(import.meta.url)('ajv') as typeof Ajv;
const ajv = new AjvConstructor({ allErrors: true, strictTypes: false });
ajv.addKeyword('x-fixture-families');
ajv.addSchema(SCHEMA);
const VALIDATOR_BY_DEFINITION = new Map<string, ReturnType<typeof ajv.compile>>();

function validatorFor(definition: string): ReturnType<typeof ajv.compile> {
    let validate = VALIDATOR_BY_DEFINITION.get(definition);
    if (!validate) {
        validate = ajv.compile({ $ref: `${SCHEMA.$id}#/definitions/${definition}` });
        VALIDATOR_BY_DEFINITION.set(definition, validate);
    }
    return validate;
}

test('every shared fixture is a .jsonc file', () => {
    assert.deepEqual(
        FILES.filter((file) => !file.endsWith('.jsonc')),
        [],
    );
    assert.ok(FILES.length > 200, `expected the whole tree, found ${FILES.length} files`);
});

test('every shared fixture belongs to exactly one generated schema family', () => {
    assert.deepEqual([...DEFINITION_BY_FILE.keys()].sort(), FILES);
});

for (const file of FILES) {
    const raw = readFileSync(join(FIXTURE_ROOT, file), 'utf8');
    let payload: unknown;
    const readPayload = (): unknown => (payload ??= JSON.parse(stripJsonComments(raw)) as unknown);

    test(`${file} opens with its provenance header`, () => {
        assert.ok(raw.startsWith('/*'), 'a fixture states what it pins, and where it came from');
        assert.ok(raw.indexOf('*/') > 40, 'the header is empty');
    });

    test(`${file} parses as strict JSON once comments are stripped`, () => {
        const parsed = readPayload();
        assert.ok(parsed !== null && typeof parsed === 'object');
    });

    test(`${file} keeps prose out of its payload`, () => {
        const parsed = readPayload();
        if (Array.isArray(parsed) || parsed === null) return;
        for (const banned of ['description', 'attribution', 'comment']) {
            assert.ok(
                !Object.hasOwn(parsed as Record<string, unknown>, banned),
                `${banned} belongs in the header comment`,
            );
        }
    });

    test(`${file} matches its generated family schema`, () => {
        const definition = DEFINITION_BY_FILE.get(file);
        assert.ok(definition, `${file} has no generated schema family`);
        const validate = validatorFor(definition);
        assert.equal(
            validate(readPayload()),
            true,
            `${file}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`,
        );
    });
}
