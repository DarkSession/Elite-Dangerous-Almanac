/**
 * Guards the shared `data/astro/*.jsonc` files themselves, independently of the
 * modules that consume them.
 *
 * Two invariants, both easy to break by accident:
 *
 * 1. **Every file is still strict JSON once comments are blanked.** JSONC's other
 *    extension — trailing commas — is deliberately *not* accepted by
 *    `stripJsonComments`, because `data/` is shared with future language
 *    implementations whose standard parsers (Python's `json`, for one) reject
 *    them too. An editor that reformats a `.jsonc` file as JSON5 will introduce
 *    them silently; this test names the offending file instead of failing later
 *    as an opaque module-load error.
 *
 * 2. **Attribution stays in the comment header.** It belongs next to the data
 *    (AGENTS.md §Attribution) but not in the parsed payload, where every byte is
 *    inlined into consumers' bundles. A re-added `attribution` or `description`
 *    key would rebuild exactly the bloat the comment header exists to avoid.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

const DATA_DIR = fileURLToPath(new URL('../../../data/astro/', import.meta.url));
const DATA_FILES = readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.jsonc'))
    .sort();

/** Payload keys that would put non-data prose back into the bundle. */
const BANNED_KEYS = ['attribution', 'description'];

test('data/astro holds the expected number of catalogues', () => {
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
        const parsed: unknown = JSON.parse(stripJsonComments(readFileSync(DATA_DIR + name, 'utf8')));
        if (Array.isArray(parsed)) return;
        for (const key of BANNED_KEYS) {
            assert.ok(
                !Object.hasOwn(parsed as object, key),
                `${name} has a top-level "${key}" — move it into the comment header`
            );
        }
    });
}
