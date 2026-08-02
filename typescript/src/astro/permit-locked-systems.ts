/**
 * Individually permit-locked systems, indexed independently from region locks.
 *
 * Import this leaf module when only exact system locks or journal addresses are
 * needed; it does not load the permit-locked region catalogue.
 *
 * @packageDocumentation
 */

import systemsData from '../../../data/astro/permit-locked-systems.jsonc' with { type: 'json' };
import { tryToSystemAddress, type SystemAddressInput } from './system-address-input.js';

export type { SystemAddressInput };

/** One individually permit-locked system. */
export interface PermitLockedSystem {
    /** Canonically-cased system name, e.g. `"Shinrarta Dezhra"`. */
    readonly name: string;
    /**
     * The system's 64-bit system address, as reported by the player journal's
     * `SystemAddress` field.
     *
     * @remarks
     * Most of these systems are hand-named rather than procedural, so their address
     * cannot be computed from the name. It is recorded from Spansh/EDSM; see
     * [`data/astro/SOURCES.md`](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/data/astro/SOURCES.md).
     */
    readonly id64: bigint;
}

interface PermitLockedSystemData {
    readonly name: string;
    readonly id64: string;
}

/**
 * The 54 individually permit-locked systems, sorted by name.
 *
 * @remarks
 * The array and every record are frozen at runtime. Region-locked systems are not
 * listed here; see `PERMIT_LOCKED_REGIONS` in `./permit-locked-regions`.
 *
 * @example
 * ```ts
 * PERMIT_LOCKED_SYSTEMS.find((system) => system.name === 'Sol')?.id64;
 * // -> 10477373803n
 * ```
 */
export const PERMIT_LOCKED_SYSTEMS: readonly PermitLockedSystem[] = Object.freeze(
    (systemsData as readonly PermitLockedSystemData[]).map((system) =>
        Object.freeze({ name: system.name, id64: BigInt(system.id64) }),
    ),
);

/** Lookup key: lower-cased and trimmed, so matching ignores case and padding. */
function normalizeName(name: string): string {
    return name.trim().toLowerCase();
}

const SYSTEM_BY_NAME: ReadonlyMap<string, PermitLockedSystem> = new Map(
    PERMIT_LOCKED_SYSTEMS.map((system) => [normalizeName(system.name), system]),
);

const SYSTEM_BY_ADDRESS: ReadonlyMap<bigint, PermitLockedSystem> = new Map(
    PERMIT_LOCKED_SYSTEMS.map((system) => [system.id64, system]),
);

/**
 * Find an individually permit-locked system by exact name.
 *
 * @param name - A system name in any casing, with optional surrounding whitespace.
 * @returns The frozen catalogue record, or `null` when the name is not individually
 * permit-locked. Region prefixes are not checked.
 */
export function permitLockedSystemForName(name: string): PermitLockedSystem | null {
    return SYSTEM_BY_NAME.get(normalizeName(name)) ?? null;
}

/**
 * Find an individually permit-locked system by its system address.
 *
 * @param address - A `bigint` from this library, a safe integer from a normally
 * parsed journal event, or a decimal string from persisted JSON. Unsafe numbers,
 * non-integers and malformed strings yield `null` rather than risking a rounded
 * address comparison.
 * @returns The frozen catalogue record, or `null` when the address is invalid or
 * not individually permit-locked.
 * @example
 * ```ts
 * permitLockedSystemForAddress(event.SystemAddress)?.name; // -> 'Sol'
 * permitLockedSystemForAddress('10477373803')?.name;       // -> 'Sol'
 * ```
 */
export function permitLockedSystemForAddress(
    address: SystemAddressInput,
): PermitLockedSystem | null {
    const normalized = tryToSystemAddress(address);
    return normalized === null ? null : (SYSTEM_BY_ADDRESS.get(normalized) ?? null);
}
