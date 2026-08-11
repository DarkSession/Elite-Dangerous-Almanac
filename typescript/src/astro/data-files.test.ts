/**
 * Guards the shared `data/astro/*.jsonc` files themselves, independently of the
 * modules that consume them.
 *
 * Four invariants, all easy to break by accident:
 *
 * 1. **Every file is still strict JSON once comments are blanked.** JSONC's other
 *    extension — trailing commas — is deliberately *not* accepted by
 *    `stripJsonComments`, because `data/` is shared with future language
 *    implementations whose standard parsers (Python's `json`, for one) reject
 *    them too. An editor that reformats a `.jsonc` file as JSON5 will introduce
 *    them silently; this test names the offending file instead of failing later
 *    as an opaque module-load error.
 *
 * 2. **Every file opens with a comment header, and attribution stays in it.**
 *    Attribution belongs next to the data (AGENTS.md §Attribution) but not in the
 *    parsed payload, where every byte is inlined into consumers' bundles. A re-added
 *    `attribution`, `description` or `comment` key would rebuild exactly the bloat the
 *    comment header exists to avoid.
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

import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';

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
