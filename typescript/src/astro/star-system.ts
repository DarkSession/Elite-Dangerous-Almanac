/**
 * {@link StarSystem} — an immutable handle on a single Elite Dangerous system.
 *
 * This is a thin value object over the pure functions in this folder. Construct
 * one from a name or a system address; read its canonical name, sector, mass
 * code, coordinates and addresses back. Consumers who only need one calculation
 * can import the underlying function directly and skip the class entirely — the
 * algorithms do not live here, only the glue that composes them (including the
 * hand-authored-sector override, which needs the sector, region-origin and
 * HA-sphere lookups together).
 *
 * @packageDocumentation
 */

import { sectorNameFromCoords, sectorCoordsFromName } from './sector-name.js';
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
import { getNamedRegionOrigin, resolveRegionOrigin } from './named-regions.js';
import { handAuthoredRegionForCoords } from './hand-authored-regions.js';
import { isPermitLockedRegionName } from './permit-locked-regions.js';
import type { GalacticCoords } from './coords.js';

/** Attributes a hand-authored region contributes to a decoded system. */
interface HaOverride {
    parts: SystemNameParts;
    handAuthored: boolean;
    needsPermit: boolean;
}

/**
 * If galactic coordinates fall inside a hand-authored region, rewrite the region
 * name and letter code to that region's; otherwise leave the procedural parts
 * unchanged. Mass code and sequence are origin-independent and never change.
 */
function applyHaOverride(
    parts: SystemNameParts,
    decoded: DecodedAddress,
    coords: GalacticCoords | undefined,
): HaOverride {
    if (!coords) return { parts, handAuthored: false, needsPermit: false };

    const region = handAuthoredRegionForCoords(coords);
    if (!region) return { parts, handAuthored: false, needsPermit: false };

    const origin = resolveRegionOrigin(region.name);
    if (!origin || origin.x0 < 0 || origin.y0 < 0 || origin.z0 < 0) {
        return { parts, handAuthored: false, needsPermit: false };
    }

    const boxelCode = absoluteBoxelToBoxelCode(decoded.sizeClass, decoded.absoluteBoxel, origin);
    if (boxelCode === null) return { parts, handAuthored: false, needsPermit: false };

    const { l1, l2, l3, n1 } = boxelCodeToLetters(boxelCode);
    return {
        parts: { ...parts, regionName: region.name, l1, l2, l3, n1 },
        handAuthored: true,
        needsPermit: isPermitLockedRegionName(region.name),
    };
}

/**
 * An Elite Dangerous star system, identified by its procedural name and/or
 * system address.
 *
 * Instances are immutable. Derived values (name, addresses) are computed from the
 * stored parts on access; the system address is memoised.
 *
 * @remarks
 * **Failure model** — the three ways a `StarSystem` can fail are deliberately
 * split by cause:
 * - {@link StarSystem.fromName} returns `null` for a string that is not a
 *   well-formed system name (a parsing outcome, not an error).
 * - {@link StarSystem.fromSystemAddress} / {@link StarSystem.fromModSystemAddress}
 *   throw `RangeError` for an `id64` outside the unsigned 64-bit range or one
 *   whose sector-grid slot has no assigned procedural name.
 * - {@link StarSystem.systemAddress} / {@link StarSystem.modSystemAddress} throw
 *   *on access* when the name cannot be encoded (unknown region, or a field out of
 *   range for the address layout). Reading `.name`, `.sectorName`, `.coords` etc.
 *   never throws.
 *
 * For the galactic codex region of a system, pass its address to the standalone
 * `findRegionForBoxel` (from `./galactic-region-lookup`) — kept off this facade so
 * `StarSystem` does not bundle the region grid.
 *
 * @example
 * ```ts
 * // Name -> id64
 * const sys = StarSystem.fromName('Synuefe EN-H d11-96');
 * if (sys) sys.systemAddress; // bigint
 *
 * // id64 -> name (pass coords so hand-authored regions render correctly)
 * StarSystem.fromSystemAddress(id64, { x, y, z }).name;
 * ```
 */
export class StarSystem {
    readonly #parts: SystemNameParts;
    readonly #coords: GalacticCoords | undefined;
    #id64: bigint | undefined;

    /** Whether the system's region is a hand-authored named sector. */
    readonly isHandAuthoredSector: boolean;

    /**
     * Whether the system's **region** sits behind a permit lock (Col 70, Bleia,
     * the Cone Sector, …).
     *
     * @remarks
     * This is a region-level flag only. Individually permit-locked systems — Sol,
     * Shinrarta Dezhra, Achenar and 51 others — are not procedurally named, so they
     * never reach a `StarSystem`; check those with `permitLockForSystemName` from
     * `./permit-locks`, which covers both kinds of lock from a name alone.
     */
    readonly needsPermit: boolean;

    private constructor(
        parts: SystemNameParts,
        opts: {
            coords?: GalacticCoords;
            id64?: bigint;
            handAuthored: boolean;
            needsPermit: boolean;
        },
    ) {
        this.#parts = { ...parts };
        this.#coords = opts.coords ? { ...opts.coords } : undefined;
        this.#id64 = opts.id64;
        this.isHandAuthoredSector = opts.handAuthored;
        this.needsPermit = opts.needsPermit;
    }

    /**
     * Build a system from a procedural name.
     *
     * Procedural and catalogued hand-authored region names are re-cased
     * canonically. Unknown region strings remain parseable but are not flagged as
     * hand-authored; encoding their address throws. Returns `null` for malformed
     * syntax.
     *
     * @param name - A system name in any casing, e.g. `blae eock kc-c d0`.
     */
    static fromName(name: string): StarSystem | null {
        const parts = parseSystemName(name);
        if (!parts) return null;

        const sectorCoords = sectorCoordsFromName(parts.regionName);
        const namedOrigin = sectorCoords ? null : getNamedRegionOrigin(parts.regionName);
        const named = namedOrigin !== null;
        const regionName = sectorCoords
            ? sectorNameFromCoords(sectorCoords)
            : (namedOrigin?.name ?? parts.regionName);

        return new StarSystem(
            { ...parts, regionName },
            {
                handAuthored: named,
                needsPermit: named && isPermitLockedRegionName(regionName),
            },
        );
    }

    /**
     * Build a system from its 64-bit system address.
     *
     * When `coords` are supplied and the system sits inside a hand-authored
     * region, the name is overridden with the hand-authored one (as the game
     * displays it). Without `coords`, the procedural name is used.
     *
     * @remarks
     * **Pass `coords` if you can.** An `id64` alone encodes only the boxel, not the
     * exact position, so it cannot tell whether the system falls inside a
     * hand-authored region (Pleiades, Coalsack, …). Without `coords`, such a system
     * silently renders under its *procedural* name instead of the name the game
     * shows. Coordinates come from an external source you already have the `id64`
     * from — the player journal, EDSM or Spansh — in light-years with Sol at origin.
     *
     * @param id64 - The system address.
     * @param coords - Galactic position (light-years, Sol at origin). Optional, but
     *   required for correct hand-authored-region names.
     * @throws {RangeError} If the address is outside 64 bits or its grid slot has no
     * assigned procedural name.
     */
    static fromSystemAddress(id64: bigint, coords?: GalacticCoords): StarSystem {
        return StarSystem.#fromDecoded(decodeSystemAddress(id64), id64, coords);
    }

    /**
     * Build a system from its 64-bit modulated system address.
     *
     * @param id64 - The modulated system address.
     * @param coords - Optional galactic position (light-years, Sol at origin).
     * @throws {RangeError} If the address is outside 64 bits or its grid slot has no
     * assigned procedural name.
     */
    static fromModSystemAddress(id64: bigint, coords?: GalacticCoords): StarSystem {
        // The modulated form is a different bit layout, not a different id64, so it
        // is not memoised as `this.#id64`.
        return StarSystem.#fromDecoded(decodeModSystemAddress(id64), undefined, coords);
    }

    static #fromDecoded(
        decoded: DecodedAddress,
        id64: bigint | undefined,
        coords: GalacticCoords | undefined,
    ): StarSystem {
        const { l1, l2, l3, n1 } = boxelCodeToLetters(decoded.boxelCode);
        const base: SystemNameParts = {
            regionName: sectorNameFromCoords(decoded.sectorCoords),
            l1,
            l2,
            l3,
            massCode: decoded.sizeClass,
            n1,
            n2: decoded.sequence,
        };
        const { parts, handAuthored, needsPermit } = applyHaOverride(base, decoded, coords);
        const opts = { handAuthored, needsPermit } as {
            coords?: GalacticCoords;
            id64?: bigint;
            handAuthored: boolean;
            needsPermit: boolean;
        };
        if (coords) opts.coords = coords;
        if (id64 !== undefined) opts.id64 = id64;
        return new StarSystem(parts, opts);
    }

    /** The canonical system name, e.g. `Synuefe EN-H d11-96`. */
    get name(): string {
        return formatSystemName(this.#parts);
    }

    /**
     * The region (sector) name — a procedural sector (`Synuefe`) or, when the
     * system is inside a hand-authored region, that region's name
     * (`Pleiades Sector`). See {@link StarSystem.isHandAuthoredSector} to tell which.
     */
    get sectorName(): string {
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

    /** Galactic position (light-years, Sol at origin), if known. */
    get coords(): GalacticCoords | undefined {
        return this.#coords ? { ...this.#coords } : undefined;
    }

    /**
     * A shallow copy of the parsed name parts.
     *
     * @remarks
     * Letters and mass code are **zero-based numeric indices**, not characters — the
     * form the address encoder consumes (see {@link SystemNameParts}). Use
     * {@link StarSystem.name} / {@link StarSystem.massCode} for the display strings.
     *
     * @example
     * ```ts
     * StarSystem.fromName('Synuefe EN-H d11-96')!.parts;
     * // { regionName: 'Synuefe', l1: 4, l2: 13, l3: 7, massCode: 3, n1: 11, n2: 96 }
     * ```
     */
    get parts(): SystemNameParts {
        return { ...this.#parts };
    }

    /**
     * The 64-bit system address. Memoised; computed from the region origin when
     * the system was built from a name.
     *
     * @remarks
     * This can throw even on a `StarSystem` that {@link StarSystem.fromName} returned
     * successfully: parsing a well-formed name always succeeds, but encoding it can
     * still fail (unknown region, or a field out of range). If the name is untrusted,
     * wrap the access in `try`/`catch` — or read {@link StarSystem.name},
     * {@link StarSystem.sectorName} and {@link StarSystem.coords}, which never throw.
     *
     * @throws {Error} If the region origin is unknown.
     * @throws {RangeError} If any field is out of range for the address layout.
     */
    get systemAddress(): bigint {
        if (this.#id64 === undefined) this.#id64 = encodeSystemAddress(this.#parts, this.#origin());
        return this.#id64;
    }

    /**
     * The 64-bit modulated system address, computed from the region origin.
     *
     * @throws {Error} If the region origin is unknown.
     * @throws {RangeError} If any field is out of range for the address layout.
     */
    get modSystemAddress(): bigint {
        return encodeModSystemAddress(this.#parts, this.#origin());
    }

    #origin() {
        const origin = resolveRegionOrigin(this.#parts.regionName);
        if (!origin) throw new Error(`Unknown sector: ${this.#parts.regionName}`);
        return origin;
    }
}
