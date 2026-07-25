/**
 * Accepting a system address (`id64`) from wherever the caller got it.
 *
 * The library works in `bigint` internally, because address fields reach bit 55
 * and JS number bitwise operators truncate to 32 bits. Callers, however, rarely
 * hold a `bigint`: `JSON.parse` of a journal event yields a `number`, persisted
 * JSON and query strings yield a decimal `string`. Every public entry point that
 * takes an address therefore accepts {@link SystemAddressInput} and funnels it
 * through {@link toSystemAddress}.
 *
 * This module deliberately has no dependencies, so importing it (or any of the
 * address entry points that use it) costs nothing but the conversion itself.
 *
 * @packageDocumentation
 */

/**
 * A system address as a caller is likely to hold it.
 *
 * - `bigint` — the canonical form, and what this library returns.
 * - `number` — a normally parsed journal event (`event.SystemAddress`). Accepted
 *   only when it is a non-negative safe integer, since a rounded address would
 *   silently identify the wrong system.
 * - `string` — a decimal address from persisted JSON, a URL or a database column.
 */
export type SystemAddressInput = bigint | number | string;

/**
 * Convert a supported address representation to a `bigint`, without accepting a
 * value that may already have lost precision.
 *
 * @param address - A `bigint`, a non-negative safe-integer `number` (a normally
 * parsed journal address), or a decimal digit `string`.
 * @returns The address as a `bigint`, or `null` when the input cannot be *converted*
 * to one: a non-integer or unsafe `number` (beyond `2^53 - 1`, where the value has
 * already been rounded), a negative `number`, or a string that is not all decimal
 * digits. A `bigint` always passes through unchanged — whether it fits the 64-bit
 * address layout is the decoder's `RangeError` to raise, not a conversion failure.
 * @example
 * ```ts
 * tryToSystemAddress(10477373803);   // -> 10477373803n
 * tryToSystemAddress('10477373803'); // -> 10477373803n
 * tryToSystemAddress(1.5);           // -> null
 * ```
 */
export function tryToSystemAddress(address: SystemAddressInput): bigint | null {
    if (typeof address === 'bigint') return address;
    if (typeof address === 'number') {
        return Number.isSafeInteger(address) && address >= 0 ? BigInt(address) : null;
    }
    if (typeof address !== 'string') return null;

    const trimmed = address.trim();
    return /^\d+$/.test(trimmed) ? BigInt(trimmed) : null;
}

/**
 * Convert a supported address representation to a `bigint`, or throw.
 *
 * Use this at the edge of your own code when you want the failure to be loud;
 * the library's address entry points call it for you, so
 * `decodeSystemAddress(event.SystemAddress)` and
 * `StarSystem.fromSystemAddress(event.SystemAddress)` accept a journal number
 * directly.
 *
 * @param address - A `bigint`, a non-negative safe-integer `number` (a normally
 * parsed journal address), or a decimal digit `string`.
 * @returns The address as a `bigint`.
 * @throws {TypeError} If the value cannot be converted: a non-integer, a negative
 * `number`, a `number` beyond `2^53 - 1` (already rounded, so the identity is lost),
 * or a non-numeric string. The message names the offending value. A `bigint` outside
 * the 64-bit range is *not* a conversion failure — the decoder rejects it with a
 * `RangeError`.
 * @example
 * ```ts
 * toSystemAddress(event.SystemAddress); // journal number -> bigint
 * toSystemAddress('3309179996515');     // -> 3309179996515n
 * ```
 */
export function toSystemAddress(address: SystemAddressInput): bigint {
    const id64 = tryToSystemAddress(address);
    if (id64 === null) {
        throw new TypeError(
            `Not a usable system address (expected a bigint, a non-negative safe integer, or a decimal string): ${typeof address === 'string' ? JSON.stringify(address) : String(address)}`,
        );
    }
    return id64;
}
