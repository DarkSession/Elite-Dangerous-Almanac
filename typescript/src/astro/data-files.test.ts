/**
 * Guards the shared `data/astro/*.jsonc` files themselves, independently of the
 * modules that consume them.
 *
 * Three invariants, all easy to break by accident:
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
 *
 * 3. **Every payload matches the shared JSON Schema.** This keeps the static data
 *    contract language-neutral instead of encoding it only in TypeScript types.
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
