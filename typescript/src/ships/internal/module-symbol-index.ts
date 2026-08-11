/** One immutable symbol index shared by module lookups and the loadout facade. @internal */

import { createKeyIndex, findInKeyIndex } from '../../internal/registry-index.js';
import { ALL_MODULES } from '../modules-all.js';
import type { OutfittingModule } from '../modules.js';

const MODULES_BY_SYMBOL = /* @__PURE__ */ createKeyIndex(ALL_MODULES, 'symbol');

/** Resolve a module from the complete built-in catalogue. */
export function builtInModuleBySymbol(symbol: string): OutfittingModule | null {
    return findInKeyIndex(MODULES_BY_SYMBOL, symbol);
}
