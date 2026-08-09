/**
 * Deeply freeze JSON-derived catalogue values.
 *
 * Shared data is imported as process-wide module singletons. Freezing every nested
 * array and record prevents one consumer from changing later lookup results.
 *
 * @internal
 */
export function deepFreeze<T>(value: T): T {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;

    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}
