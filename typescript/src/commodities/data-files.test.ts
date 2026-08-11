/**
 * Guards the shared `data/commodities/*.jsonc` files themselves, independently of the
 * modules that consume them. The sibling `src/astro/data-files.test.ts` explains the
 * shared invariants in full — portable strict JSON, attribution kept out of the payload,
 * and schema conformance — and the same ones apply here, against
 * `schemas/commodities/catalogues.schema.json`.
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
