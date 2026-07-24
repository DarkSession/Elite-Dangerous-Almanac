/**
 * Guards the shared `data/materials/*.jsonc` files themselves, independently of the
 * modules that consume them. The sibling `src/astro/data-files.test.ts` explains the
 * two invariants in full; the same two apply here:
 *
 * 1. Every file is still strict JSON once comments are blanked (no trailing commas,
 *    so any language's standard parser accepts it).
 * 2. Attribution stays in the comment header, never in the parsed payload — every
 *    payload byte is inlined into consumers' bundles.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stripJsonComments } from '../../scripts/jsonc.mjs';

const DATA_DIR = fileURLToPath(new URL('../../../data/materials/', import.meta.url));
const DATA_FILES = readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.jsonc'))
    .sort();

/** Payload keys that would put non-data prose back into the bundle. */
const BANNED_KEYS = ['attribution', 'description'];

test('data/materials holds the expected number of catalogues', () => {
    assert.equal(DATA_FILES.length, 3);
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
}
