/**
 * Shared numeric guards for the body calculations.
 *
 * A scanned field is either usable or it is not. These turn "present in the record" into
 * "usable as a quantity", so every calculation answers `null` for the same reasons: the
 * field was not written, or it carries a value no physical quantity can take.
 *
 * @internal
 * @packageDocumentation
 */

/**
 * A finite, strictly positive quantity, or `null`.
 *
 * @param value - A scanned field: a radius, a mass, a period.
 * @returns `value` when it is finite and above zero, `null` otherwise — an absent field, a
 * zero radius and a `NaN` mass are all equally unusable.
 * @internal
 */
export function positiveQuantity(value: number | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * A finite quantity of any sign, or `null`.
 *
 * @param value - A scanned field that may legitimately be zero or negative — an
 * eccentricity, a retrograde rotation period, an absolute magnitude.
 * @returns `value` when it is finite, `null` otherwise.
 * @internal
 */
export function finiteQuantity(value: number | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Volume of a sphere, in m³.
 *
 * @param radiusM - Radius in metres.
 * @returns `4/3 π r³`.
 * @internal
 */
export function sphereVolume(radiusM: number): number {
    return (4 / 3) * Math.PI * radiusM ** 3;
}
