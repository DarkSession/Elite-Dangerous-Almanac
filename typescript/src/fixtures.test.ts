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
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { stripJsonComments } from '../scripts/jsonc.mjs';

const FIXTURE_ROOT = fileURLToPath(new URL('../../fixtures/', import.meta.url));

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

test('every shared fixture is a .jsonc file', () => {
    assert.deepEqual(
        FILES.filter((file) => !file.endsWith('.jsonc')),
        [],
    );
    assert.ok(FILES.length > 200, `expected the whole tree, found ${FILES.length} files`);
});

for (const file of FILES) {
    const raw = readFileSync(join(FIXTURE_ROOT, file), 'utf8');

    test(`${file} opens with its provenance header`, () => {
        assert.ok(raw.startsWith('/*'), 'a fixture states what it pins, and where it came from');
        assert.ok(raw.indexOf('*/') > 40, 'the header is empty');
    });

    test(`${file} parses as strict JSON once comments are stripped`, () => {
        const payload: unknown = JSON.parse(stripJsonComments(raw));
        assert.ok(payload !== null && typeof payload === 'object');
    });

    test(`${file} keeps prose out of its payload`, () => {
        const payload: unknown = JSON.parse(stripJsonComments(raw));
        if (Array.isArray(payload) || payload === null) return;
        for (const banned of ['description', 'attribution', 'comment']) {
            assert.ok(
                !Object.hasOwn(payload as Record<string, unknown>, banned),
                `${banned} belongs in the header comment`,
            );
        }
    });
}
