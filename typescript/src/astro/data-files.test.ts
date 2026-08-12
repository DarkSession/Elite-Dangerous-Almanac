/**
 * Guards the shared `data/astro/*.jsonc` files themselves, independently of the
 * modules that consume them.
 *
 * Four invariants, all easy to break by accident:
 *
 * 1. **Every file is strict JSON once comments are blanked.** JSONC's other
 *    extension — trailing commas — is deliberately *not* accepted by
 *    `stripJsonComments`, because `data/` is shared with other language
 *    implementations whose standard parsers (Python's `json`, for one) reject
 *    them too. An editor that reformats a `.jsonc` file as JSON5 will introduce
 *    them silently; this test names the offending file instead of failing later
 *    as an opaque module-load error.
 *
 * 2. **Every file opens with a comment header, and attribution stays in it.**
 *    Attribution belongs next to the data (AGENTS.md §Attribution) but not in the
 *    parsed payload, where every byte is inlined into consumers' bundles. An
 *    `attribution`, `description` or `comment` key would add prose to every bundle.
 *
 * 3. **Every catalogue in the directory is mapped to a schema definition.** The
 *    directory listing is compared against this file's `DEFINITION_BY_FILE` map, so a
 *    new `.jsonc` cannot land unvalidated and a deleted one cannot leave a stale
 *    mapping behind.
 *
 * 4. **Every payload matches its domain's `schemas/<domain>/catalogues.schema.json`.**
 *    This keeps the static data contract language-neutral instead of encoding it only
 *    in TypeScript types.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';
import planetaryNebulaeData from '../../../data/astro/nebulae-planetary.jsonc' with { type: 'json' };

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'galactic-region-cells.jsonc': 'regionCellCatalogue',
    'galactic-regions.jsonc': 'galacticRegionCatalogue',
    'hand-authored-regions.jsonc': 'handAuthoredRegionCatalogue',
    'named-region-origins.jsonc': 'namedRegionOriginCatalogue',
    'nebulae-planetary.jsonc': 'planetaryNebulaCatalogue',
    'nebulae-procgen.jsonc': 'procgenNebulaCatalogue',
    'nebulae-real.jsonc': 'realNebulaCatalogue',
    'permit-locked-regions.jsonc': 'permitLockedRegionCatalogue',
    'permit-locked-systems.jsonc': 'permitLockedSystemCatalogue',
};

registerCatalogueDataTests({
    domain: 'astro',
    definitions: DEFINITION_BY_FILE,
});

test('planetary nebula data carries only systems that differ from their names', () => {
    const records = planetaryNebulaeData as readonly {
        readonly name: string;
        readonly system?: string;
    }[];
    const explicitSystems = records.filter((record) => record.system !== undefined);
    assert.equal(explicitSystems.length, 279);
    for (const record of explicitSystems) {
        assert.notEqual(record.system, record.name, record.name);
    }
});
