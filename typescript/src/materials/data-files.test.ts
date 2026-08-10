/**
 * Guards the shared `data/materials/*.jsonc` files themselves, independently of the
 * modules that consume them. The sibling `src/astro/data-files.test.ts` explains the
 * invariants in full; the same ones apply here:
 *
 * 1. Every file is still strict JSON once comments are blanked (no trailing commas,
 *    so any language's standard parser accepts it).
 * 2. Attribution stays in the comment header, never in the parsed payload — every
 *    payload byte is inlined into consumers' bundles.
 * 3. Every payload matches `schemas/materials/catalogues.schema.json`.
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
