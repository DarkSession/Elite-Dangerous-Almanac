/** Blueprint recipe ids whose journal spelling collides with another recipe. @internal */

import journalNamesData from '../../../../data/ships/blueprint-journal-names.jsonc' with { type: 'json' };
import { deepFreeze } from '../../internal/deep-freeze.js';

export const BLUEPRINT_JOURNAL_NAMES: Readonly<Record<string, string>> = deepFreeze(
    journalNamesData as Record<string, string>,
);
