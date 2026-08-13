/** Guards every portable JSONC catalogue in `data/equipment`. */

import { registerCatalogueDataTests } from '../internal/catalogue-data-tests.js';

const DEFINITION_BY_FILE: Readonly<Record<string, string>> = {
    'modification-costs.jsonc': 'modificationCostCatalogue',
    'modification-journal-names.jsonc': 'modificationJournalNameCatalogue',
    'modifications.jsonc': 'modificationCatalogue',
    'suits.jsonc': 'suitCatalogue',
    'upgrade-costs.jsonc': 'upgradeCostCatalogue',
    'weapons.jsonc': 'weaponCatalogue',
};

registerCatalogueDataTests({
    domain: 'equipment',
    definitions: DEFINITION_BY_FILE,
});
