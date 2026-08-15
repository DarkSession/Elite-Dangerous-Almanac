/**
 * Convert fixed-article modifier contributions into engineering-calculator features.
 *
 * @internal
 */

import type { BlueprintFeature, ModifierMethod } from '../engineering.js';

/** The structural fields shared by every pre-engineered fixed modifier. */
interface FixedModifier {
    readonly label: string;
    readonly method: ModifierMethod;
    readonly value: number;
}

/** Read each fixed value as both ends of a quality-independent feature. */
export function fixedModifierFeatures(
    modifiers: readonly FixedModifier[],
): readonly BlueprintFeature[] {
    return modifiers.map((modifier) => ({
        label: modifier.label,
        method: modifier.method,
        min: modifier.value,
        max: modifier.value,
    }));
}
