/** Shared exact-damage component scaling. @internal */

import type { DamageComponents } from '../modules.js';

/**
 * Scale exact damage components by the same ratio as the weapon's total damage.
 *
 * A missing or zero base, or a missing effective value, leaves the components at their
 * stock amounts: there is no meaningful ratio to apply. Whether a damage conversion
 * replaces the components altogether remains the caller's decision.
 */
export function scaleDamageComponents(
    components: DamageComponents,
    baseDamage: number | undefined,
    effectiveDamage: number | undefined,
): DamageComponents {
    const scale =
        baseDamage !== undefined && baseDamage !== 0 && effectiveDamage !== undefined
            ? effectiveDamage / baseDamage
            : 1;
    return {
        ...(components.kinetic === undefined ? {} : { kinetic: components.kinetic * scale }),
        ...(components.thermal === undefined ? {} : { thermal: components.thermal * scale }),
        ...(components.explosive === undefined ? {} : { explosive: components.explosive * scale }),
        ...(components.absolute === undefined ? {} : { absolute: components.absolute * scale }),
        ...(components.antiXeno === undefined ? {} : { antiXeno: components.antiXeno * scale }),
        ...(components.unclassified === undefined
            ? {}
            : { unclassified: components.unclassified.map((value) => value * scale) }),
    };
}
