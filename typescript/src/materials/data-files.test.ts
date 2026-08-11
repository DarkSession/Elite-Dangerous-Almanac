/**
 * Guards the shared `data/materials/*.jsonc` files themselves, independently of the
 * modules that consume them. The sibling `src/astro/data-files.test.ts` explains the
 * shared invariants in full — portable strict JSON, attribution kept in the comment
 * header, a schema definition mapped to every file, and conformance to
 * `schemas/materials/catalogues.schema.json`.
 */

import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'materials-encoded.jsonc': 'encodedMaterialCatalogue',
    'materials-manufactured.jsonc': 'manufacturedMaterialCatalogue',
    'materials-raw.jsonc': 'rawMaterialCatalogue',
    'micro-resources-component.jsonc': 'componentMicroResourceCatalogue',
    'micro-resources-consumable.jsonc': 'consumableMicroResourceCatalogue',
    'micro-resources-data.jsonc': 'dataMicroResourceCatalogue',
    'micro-resources-item.jsonc': 'itemMicroResourceCatalogue',
};

registerCatalogueDataTests({
    domain: 'materials',
    definitions: DEFINITION_BY_FILE,
});
