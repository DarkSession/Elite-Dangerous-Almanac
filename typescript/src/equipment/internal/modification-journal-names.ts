/** Personal-equipment recipe symbols whose journal spelling omits technology. @internal */

import journalNamesData from '../../../../data/equipment/modification-journal-names.jsonc' with { type: 'json' };
import { deepFreeze } from '../../internal/deep-freeze.js';

export const PERSONAL_MODIFICATION_JOURNAL_NAMES: Readonly<Record<string, string>> = deepFreeze(
    journalNamesData as Record<string, string>,
);
