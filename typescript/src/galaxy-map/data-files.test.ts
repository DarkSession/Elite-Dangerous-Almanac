/**
 * Guards the shared `data/galaxy-map/*.jsonc` files themselves, independently of the
 * modules that consume them. The sibling `src/astro/data-files.test.ts` explains the
 * shared invariants in full — portable strict JSON, attribution kept in the comment
 * header, a schema definition mapped to every file, and conformance to
 * `schemas/galaxy-map/catalogues.schema.json`.
 */

import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'markers.jsonc': 'markerCatalogue',
};

registerCatalogueDataTests({
    domain: 'galaxy-map',
    definitions: DEFINITION_BY_FILE,
});
