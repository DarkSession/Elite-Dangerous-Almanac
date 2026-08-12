/**
 * {@link ProceduralSystem} — an immutable handle on a procedurally named Elite
 * Dangerous system.
 *
 * This is a thin value object over the pure functions in this folder. Construct
 * one from a name or a system address; read its canonical name, naming region, mass
 * code, position and addresses back. Consumers who only need one calculation
 * can import the underlying function directly and skip the class entirely — the
 * algorithms do not live here, only the glue that composes them (including the
 * hand-authored-sector override, which needs the sector, region-origin and
 * HA-sphere lookups together).
 *
 * @packageDocumentation
 */

import { sectorNameFromGridPosition, sectorGridPositionFromName } from './sector-name.js';
import {
    parseSystemName,
    formatSystemName,
    boxelCodeToLetters,
    type SystemNameParts,
} from './system-name.js';
import { sizeClassToMassCode } from './mass-code.js';
import {
    decodeSystemAddress,
    decodeModSystemAddress,
    encodeSystemAddress,
    encodeModSystemAddress,
    absoluteBoxelToBoxelCode,
    type DecodedAddress,
} from './system-address.js';
import { getHandAuthoredRegionOrigin, resolveNamingRegionOrigin } from './naming-region-origins.js';
import { findHandAuthoredRegionAt } from './hand-authored-regions.js';
import { isPermitLockedRegionName } from './permit-locked-regions.js';
import type { GalacticPosition } from './galactic-position.js';
import { toSystemAddress, type SystemAddressInput } from './system-address-input.js';
import { requireString, truncate } from '../internal/argument-guards.js';

export type { SystemAddressInput } from './system-address-input.js';

/** Attributes a hand-authored region contributes to a decoded system. */
interface HaOverride {
    parts: SystemNameParts;
    handAuthored: boolean;
    requiresPermit: boolean;
}

function tryEncodeModAddress(parts: SystemNameParts): bigint | null {
    const origin = resolveNamingRegionOrigin(parts.regionName);
    if (!origin) return null;
    try {
        return encodeModSystemAddress(parts, origin);
    } catch (error) {
        // `null` means "this sequence has no modulated form", a normal answer, so the
        // filter must not flatten anything else through it. Nothing else can arrive:
        // the origin is from `resolveNamingRegionOrigin` and is never negative, and
        // every caller already constrains the mass code, boxel code and origin to what
        // `boxelCodeToAbsoluteBoxel` accepts — `fromName` via the `encodeSystemAddress`
        // evaluated before it, `#fromDecoded` via a decode that takes the mass code
        // from three bits and masks each axis to it.
        if (error instanceof RangeError) return null;
        throw error;
    }
}

/**
 * If galactic coordinates fall inside a hand-authored region, rewrite the region
 * name and letter code to that region's; otherwise leave the procedural parts
 * unchanged. Mass code and sequence are origin-independent and never change.
 */
function applyHaOverride(
    parts: SystemNameParts,
    decoded: DecodedAddress,
    position: GalacticPosition | undefined,
): HaOverride {
    if (!position) return { parts, handAuthored: false, requiresPermit: false };

    const region = findHandAuthoredRegionAt(position);
    if (!region) return { parts, handAuthored: false, requiresPermit: false };

    const origin = resolveNamingRegionOrigin(region.name);
    if (!origin || origin.x0 < 0 || origin.y0 < 0 || origin.z0 < 0) {
        return { parts, handAuthored: false, requiresPermit: false };
    }

    const boxelCode = absoluteBoxelToBoxelCode(decoded.sizeClass, decoded.absoluteBoxel, origin);
    if (boxelCode === null) return { parts, handAuthored: false, requiresPermit: false };

    const { l1, l2, l3, n1 } = boxelCodeToLetters(boxelCode);
    return {
        parts: { ...parts, regionName: region.name, l1, l2, l3, n1 },
        handAuthored: true,
        requiresPermit: isPermitLockedRegionName(region.name),
    };
}

/**
 * An Elite Dangerous star system, identified by its procedural name and/or
 * system address. Hand-named systems such as Sol are deliberately outside this type.
 *
 * Instances are immutable. The normal system address is validated and computed by the
 * factory, so reading a successfully constructed system never throws; the modulated
 * form is `null` when its narrower sequence field cannot represent the system.
 *
 * @remarks
 * **Failure model** — factory failures are deliberately
 * split by cause:
 * - {@link ProceduralSystem.fromName} returns `null` for a string that is not a
 *   well-formed system name (a parsing outcome, not an error).
 * - {@link ProceduralSystem.fromSystemAddress} / {@link ProceduralSystem.fromModSystemAddress}
 *   throw `RangeError` for an `id64` outside the unsigned 64-bit range or one
 *   whose sector-grid slot has no assigned procedural name.
 * - {@link ProceduralSystem.fromModSystemAddress} also throws `RangeError` when the
 *   modulated layout's sequence cannot fit the normal layout. Every constructed
 *   instance guarantees a normal {@link ProceduralSystem.systemAddress}.
 * - {@link ProceduralSystem.fromName} throws `RangeError` immediately when a
 *   syntactically valid name cannot be encoded (unknown naming region, or an address
 *   field out of range).
 * - {@link ProceduralSystem.fromName} throws `TypeError` when `name` is not a string at
 *   all, a missing one included — that is a caller bug, not a name the scheme does not
 *   cover, so it is not reported as `null`.
 *
 * For the galactic codex region of a system, pass its address to the standalone
 * `findCodexRegionForBoxel` (from `./codex-region-lookup`) — kept off this facade so
 * `ProceduralSystem` does not bundle the region grid.
 *
 * @example
 * ```ts
 * import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
 *
 * declare const id64: bigint;
 * declare const x: number;
 * declare const y: number;
 * declare const z: number;
 *
 * // Name -> id64
 * const sys = ProceduralSystem.fromName('Synuefe EN-H d11-96');
 * if (sys) sys.systemAddress; // bigint
 *
 * // id64 -> name (pass coords so hand-authored regions render correctly)
 * ProceduralSystem.fromSystemAddress(id64, { x, y, z }).name;
 * ```
 */
export class ProceduralSystem {
    readonly #parts: SystemNameParts;
    readonly #position: GalacticPosition | undefined;
    readonly #id64: bigint;
    readonly #modId64: bigint | null;

    /** Whether the name uses a hand-authored region instead of a procedural sector. */
    readonly usesHandAuthoredRegion: boolean;

    /**
     * Whether the system's **region** sits behind a permit lock (Col 70, Bleia,
     * the Cone Sector, …).
     *
     * @remarks
     * This is a region-level flag only. Individually permit-locked systems — Sol,
     * Shinrarta Dezhra, Achenar and 51 others — are not procedurally named, so they
     * never reach a `ProceduralSystem`; check those with `permitLockForSystemName` from
     * `./permit-locks`, which covers both kinds of lock from a name alone.
     */
    readonly requiresRegionPermit: boolean;

    private constructor(
        parts: SystemNameParts,
        opts: {
            position?: GalacticPosition;
            id64: bigint;
            modId64: bigint | null;
            handAuthored: boolean;
            requiresPermit: boolean;
        },
    ) {
        this.#parts = { ...parts };
        this.#position = opts.position ? { ...opts.position } : undefined;
        this.#id64 = opts.id64;
        this.#modId64 = opts.modId64;
        this.usesHandAuthoredRegion = opts.handAuthored;
        this.requiresRegionPermit = opts.requiresPermit;
    }

    /**
     * Build a system from a procedural name.
     *
     * Procedural and catalogued hand-authored region names are re-cased canonically.
     * Unknown naming regions and out-of-range address fields are rejected here rather
     * than creating an object whose address getter fails later.
     *
     * @param name - A system name in any casing, e.g. `blae eock kc-c d0`.
     * @returns The system, or `null` when `name` is not a **procedurally named**
     * system. Hand-named systems (`Sol`, `Maia`, `Shinrarta Dezhra`) have no
     * algorithmic address and so yield `null` too — that is a "not covered by the
     * scheme" answer, not "your string was malformed".
     * @throws {TypeError} If `name` is not a string. A missing or wrong-typed argument
     * is a caller bug, not a name the scheme does not cover, so it is not reported as
     * `null`.
     * @throws {RangeError} If a syntactically valid name has no known naming-region
     * origin, or a name field cannot fit the normal system-address layout.
     * @example
     * ```ts
     * import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
     *
     * ProceduralSystem.fromName('blae eock kc-c d0')?.name; // -> 'Blae Eock KC-C d0'
     * ProceduralSystem.fromName('Sol');                     // -> null (hand-named system)
     * ```
     */
    static fromName(name: string): ProceduralSystem | null {
        const parts = parseSystemName(requireString(name, 'ProceduralSystem.fromName: name'));
        if (!parts) return null;

        const sectorPosition = sectorGridPositionFromName(parts.regionName);
        const namedOrigin = sectorPosition ? null : getHandAuthoredRegionOrigin(parts.regionName);
        const named = namedOrigin !== null;
        const regionName = sectorPosition
            ? sectorNameFromGridPosition(sectorPosition)
            : (namedOrigin?.name ?? parts.regionName);
        const canonicalParts = { ...parts, regionName };
        const origin = resolveNamingRegionOrigin(regionName);
        if (!origin) throw new RangeError(`Unknown sector: ${truncate(regionName)}`);
        return new ProceduralSystem(canonicalParts, {
            id64: encodeSystemAddress(canonicalParts, origin),
            modId64: tryEncodeModAddress(canonicalParts),
            handAuthored: named,
            requiresPermit: named && isPermitLockedRegionName(regionName),
        });
    }

    /**
     * Build a system from its 64-bit system address.
     *
     * When `position` is supplied and the system sits inside a hand-authored
     * region, the name is overridden with the hand-authored one (as the game
     * displays it). Without `position`, the procedural name is used.
     *
     * @remarks
     * **Pass `position` if you can.** An `id64` alone encodes only the boxel, not the
     * exact position, so it cannot tell whether the system falls inside a
     * hand-authored region (Pleiades, Coalsack, …). Without `position`, such a system
     * silently renders under its *procedural* name instead of the name the game
     * shows. Coordinates come from an external source you already have the `id64`
     * from — the player journal, EDSM or Spansh — in light-years with Sol at origin.
     *
     * @param id64 - The system address, as a `bigint`, a normally parsed journal
     *   `number` (`event.SystemAddress`), or a decimal `string` (see
     *   {@link SystemAddressInput}).
     * @param position - Galactic position (light-years, Sol at origin). Optional, but
     *   required for correct hand-authored-region names.
     * @returns The system at that address.
     * @throws {TypeError} If the address is not a usable representation — a
     * non-integer, or a `number` beyond `2^53 - 1` that has already been rounded.
     * @throws {RangeError} If the address is outside 64 bits or its grid slot has no
     * assigned procedural name.
     * @example
     * ```ts
     * import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
     *
     * ProceduralSystem.fromSystemAddress(3309179996515n).name;
     * // -> 'Synuefe EN-H d11-96'
     * ```
     */
    static fromSystemAddress(
        id64: SystemAddressInput,
        position?: GalacticPosition,
    ): ProceduralSystem {
        const address = toSystemAddress(id64);
        return ProceduralSystem.#fromDecoded(decodeSystemAddress(address), address, position);
    }

    /**
     * Build a system from its 64-bit modulated system address.
     *
     * @param id64 - The modulated system address, as a `bigint`, a safe-integer
     *   `number`, or a decimal `string` (see {@link SystemAddressInput}). Modulated
     *   addresses routinely exceed `2^53`; those values must be supplied as a
     *   `bigint` or string because a JS `number` has already lost precision.
     * @param position - Galactic position (light-years, Sol at origin). Optional,
     *   but required for correct hand-authored-region names.
     * @returns The system at that address.
     * @throws {TypeError} If the address is not a usable representation.
     * @throws {RangeError} If the address is outside 64 bits or its grid slot has no
     * assigned procedural name, or if its sequence cannot fit the normal address
     * layout that every `ProceduralSystem` exposes.
     * @example
     * ```ts
     * import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
     *
     * declare const modulatedAddress: bigint;
     *
     * const normal = ProceduralSystem.fromModSystemAddress(modulatedAddress);
     * normal.systemAddress; // normal-layout id64
     * ```
     */
    static fromModSystemAddress(
        id64: SystemAddressInput,
        position?: GalacticPosition,
    ): ProceduralSystem {
        const address = toSystemAddress(id64);
        return ProceduralSystem.#fromDecoded(
            decodeModSystemAddress(address),
            undefined,
            position,
            address,
        );
    }

    static #fromDecoded(
        decoded: DecodedAddress,
        id64: bigint | undefined,
        position: GalacticPosition | undefined,
        modId64?: bigint,
    ): ProceduralSystem {
        const { l1, l2, l3, n1 } = boxelCodeToLetters(decoded.boxelCode);
        const base: SystemNameParts = {
            regionName: sectorNameFromGridPosition(decoded.sectorGridPosition),
            l1,
            l2,
            l3,
            massCode: decoded.sizeClass,
            n1,
            n2: decoded.sequence,
        };
        const overridden = applyHaOverride(base, decoded, position);
        const origin = resolveNamingRegionOrigin(overridden.parts.regionName);
        // Defensive: every name `sectorNameFromGridPosition` emits resolves, and an
        // override name is proven resolvable before it is applied, so no decoded
        // address reaches this. Keep the guard so unsupported decoded positions fail loudly.
        if (!origin) {
            throw new RangeError(`Unknown sector: ${truncate(overridden.parts.regionName)}`);
        }
        const normalAddress = id64 ?? encodeSystemAddress(overridden.parts, origin);
        const opts = {
            id64: normalAddress,
            modId64: modId64 ?? tryEncodeModAddress(overridden.parts),
            handAuthored: overridden.handAuthored,
            requiresPermit: overridden.requiresPermit,
            ...(position ? { position } : {}),
        };
        return new ProceduralSystem(overridden.parts, opts);
    }

    /** The canonical system name, e.g. `Synuefe EN-H d11-96`. */
    get name(): string {
        return formatSystemName(this.#parts);
    }

    /**
     * The region (sector) name — a procedural sector (`Synuefe`) or, when the
     * system is inside a hand-authored region, that region's name
     * (`Pleiades Sector`). See {@link ProceduralSystem.usesHandAuthoredRegion} to tell which.
     */
    get namingRegionName(): string {
        return this.#parts.regionName;
    }

    /** The mass-code letter `a`–`h`. */
    get massCode(): string {
        return sizeClassToMassCode(this.#parts.massCode);
    }

    /** The system's sequence number (`N2`). */
    get sequence(): number {
        return this.#parts.n2;
    }

    /**
     * Galactic position (light-years, Sol at origin), if known.
     *
     * @remarks
     * Only ever the position **you supplied** to
     * {@link ProceduralSystem.fromSystemAddress} or
     * {@link ProceduralSystem.fromModSystemAddress} — a name or an `id64` does not carry
     * an exact position, so this is `null` for a system built from either alone. For an
     * approximate position from an address, use `findCodexRegionForBoxel(id64)` from
     * `./codex-region-lookup`, which returns the boxel corner in light-years.
     * @returns A copy of the position, or `null` when none is known (`null`, not
     * `undefined` — every "absent" result in this library is `null`).
     */
    get position(): GalacticPosition | null {
        return this.#position ? { ...this.#position } : null;
    }

    /**
     * A shallow copy of the parsed name parts.
     *
     * @remarks
     * Letters and mass code are **zero-based numeric indices**, not characters — the
     * form the address encoder consumes (see {@link SystemNameParts}). Use
     * {@link ProceduralSystem.name} / {@link ProceduralSystem.massCode} for the display strings.
     *
     * @example
     * ```ts
     * import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
     *
     * ProceduralSystem.fromName('Synuefe EN-H d11-96')!.parts;
     * // { regionName: 'Synuefe', l1: 4, l2: 13, l3: 7, massCode: 3, n1: 11, n2: 96 }
     * ```
     */
    get parts(): SystemNameParts {
        return { ...this.#parts };
    }

    /**
     * The validated 64-bit system address.
     *
     * @remarks
     * Construction validates the naming region and every normal-address field, so this
     * getter has no deferred failure mode.
     */
    get systemAddress(): bigint {
        return this.#id64;
    }

    /**
     * The 64-bit modulated system address, computed from the region origin, or `null`
     * when the system sequence cannot fit the modulated layout.
     *
     * A `null` result is explicit and has no deferred failure mode.
     */
    get modSystemAddress(): bigint | null {
        return this.#modId64;
    }
}
