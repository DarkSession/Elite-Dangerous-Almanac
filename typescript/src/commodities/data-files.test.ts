/**
 * Guards the shared `data/commodities/*.jsonc` files themselves, independently of the
 * modules that consume them. The `src/astro/data-files.test.ts` explains the two
 * invariants in full; the same ones apply here:
 *
 * 1. Every file is still strict JSON once comments are blanked (no trailing commas,
 *    so any language's standard parser accepts it).
 * 2. Attribution stays in the comment header, never in the parsed payload — every
 *    payload byte is inlined into consumers' bundles.
 * 3. Every payload matches `schemas/commodities/catalogues.schema.json`.
 */

import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'commodities.jsonc': 'commodityCatalogue',
    'rare-commodities.jsonc': 'commodityCatalogue',
};

registerCatalogueDataTests({
    domain: 'commodities',
    definitions: DEFINITION_BY_FILE,
});
