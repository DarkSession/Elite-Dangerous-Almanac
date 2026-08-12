/** One immutable symbol index shared by module lookups and the loadout facade. @internal */

import { createKeyIndex, findInKeyIndex } from '../../internal/registry-index.js';
import { ALL_MODULES } from '../modules-all.js';
import type { OutfittingModule } from '../modules.js';

const MODULES_BY_SYMBOL = /* @__PURE__ */ createKeyIndex(ALL_MODULES, 'symbol');

/**
 * Resolve a module from the complete built-in catalogue.
 *
 * @param label - How to name `symbol` in a failure — see `normalizeKey`. Each caller
 * passes the public parameter or imported field it holds, so a wrong-typed symbol names
 * where it came from rather than this shared index.
 */
export function builtInModuleBySymbol(symbol: string, label: string): OutfittingModule | null {
    return findInKeyIndex(MODULES_BY_SYMBOL, symbol, label);
}
