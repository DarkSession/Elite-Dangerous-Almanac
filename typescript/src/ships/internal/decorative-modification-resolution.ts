/** Fixed decorative-modification resolution against one module snapshot. @internal */

import type { DecorativeModification } from '../decorative-modifications.js';
import { computeModifiers } from '../engineering.js';
import type { OutfittingModule } from '../modules.js';
import type { EngineeringModifier } from '../slef.js';
import { fixedModifierFeatures } from './fixed-modifier-features.js';
import { journalModifiersFor } from './loadout-engineering.js';
import { baseStats } from './module-stat-labels.js';

/** One fixed transformation in both calculator and journal representations. */
export interface DecorativeStatResolution {
    /** Primitive labels retained for effective-stat calculations. */
    readonly primitiveModifiers: EngineeringModifier[];
    /** Module-specific labels written to a journal/SLEF block. */
    readonly modifiers: EngineeringModifier[];
    /** Authored labels for which the fitted record supplies no computable base. */
    readonly unresolved: string[];
}

/** Resolve one known transformation against the exact stats fitted in a slot. */
export function resolveDecorativeModificationStats(
    stats: OutfittingModule,
    modification: DecorativeModification,
): DecorativeStatResolution {
    const primitiveModifiers = computeModifiers(
        baseStats(stats),
        fixedModifierFeatures(modification.modifiers),
    );
    const resolvedLabels = new Set(primitiveModifiers.map((modifier) => modifier.Label));
    return {
        primitiveModifiers,
        modifiers: journalModifiersFor(stats, primitiveModifiers),
        unresolved: modification.modifiers
            .map((modifier) => modifier.label)
            .filter((label) => !resolvedLabels.has(label)),
    };
}
