/**
 * Astrophysical data and calculations for the Elite Dangerous galaxy.
 *
 * This entry point re-exports the astro feature area. Every symbol is also
 * reachable from its own module, so bundlers can drop anything you do not use.
 *
 * **Start with {@link StarSystem}** — it composes the pieces below into one
 * immutable handle (name ⇄ `id64`, sector, mass code, hand-authored regions). Drop
 * to the individual functions when you need just one calculation.
 *
 * **A note on the word "region".** It means four different things here; the
 * exports are grouped to keep them apart:
 * - *procedural sector* — {@link sectorNameFromCoords} & co. (the boxel grid name).
 * - *region origin* — {@link resolveRegionOrigin} (a sector's corner, for `id64`).
 * - *hand-authored region* — {@link handAuthoredRegionForCoords} (Pleiades, Coalsack, …).
 * - *galactic codex region* — {@link findRegionAt} (one of the 42 codex zones).
 *
 * None of those is the **nebula catalogue** — the nebulae themselves, and where
 * they are: {@link nearestNebulae} & co. over {@link REAL_NEBULAE} and its sibling
 * catalogues.
 *
 * **Two `{x, y, z}` conventions, so check which one a function wants.**
 * {@link GalacticCoords} is light-years with Sol at the origin — what the journal,
 * EDSM and Spansh report, and what {@link findRegionAt},
 * {@link handAuthoredRegionForCoords} and {@link nearestNebulae} take.
 * {@link SectorCoords} is an integer *sector index* (0–127 per axis) on the 1280 ly
 * naming grid, which is what {@link sectorNameFromCoords} takes. They are the same
 * shape, so nothing stops you passing one for the other — convert a real position
 * with {@link sectorCoordsFromGalacticCoords} (or go straight to
 * {@link sectorNameFromGalacticCoords}).
 *
 * **Permit locks** are six similarly-named lookups; {@link permitLockForSystemName}
 * is the one to start from (it answers for both kinds of lock, from a name alone).
 *
 * @packageDocumentation
 */

// ── Start here ──────────────────────────────────────────────────────────────
// High-level facade over everything below.
export { StarSystem } from './star-system.js';

// ── Shared types ────────────────────────────────────────────────────────────
export type { GalacticCoords } from './coords.js';

// ── System names: parse / format / classify ─────────────────────────────────
export {
    parseSystemName,
    formatSystemName,
    canonicalizeSystemName,
    isProceduralSystemName,
    type SystemNameParts,
    type IsProceduralSystemNameOptions,
} from './system-name.js';

// ── System addresses (id64): decode / encode ────────────────────────────────
// Every entry point that takes an address accepts a `bigint`, a normally parsed
// journal `number`, or a decimal `string` (`SystemAddressInput`).
export {
    decodeSystemAddress,
    decodeModSystemAddress,
    encodeSystemAddress,
    encodeModSystemAddress,
    type DecodedAddress,
} from './system-address.js';

export {
    toSystemAddress,
    tryToSystemAddress,
    type SystemAddressInput,
} from './system-address-input.js';

// ── Procedural sectors: name ⇄ grid coordinates ─────────────────────────────
// `SectorCoords` are **sector grid indices** (0–127), not light-years. Convert a
// real position with `sectorCoordsFromGalacticCoords` / `sectorNameFromGalacticCoords`.
export {
    sectorNameFromCoords,
    sectorCoordsFromName,
    canonicalizeSectorName,
    type SectorCoords,
} from './sector-name.js';

export {
    sectorCoordsFromGalacticCoords,
    sectorNameFromGalacticCoords,
    GALAXY_ORIGIN,
    SECTOR_EDGE_LY,
} from './galaxy-grid.js';

// ── Mass codes (a–h size classes) ───────────────────────────────────────────
export {
    massCodeToSizeClass,
    sizeClassToMassCode,
    boxelEdgeLy,
    MASS_CODE_COUNT,
    BASE_BOXEL_LY,
} from './mass-code.js';

// ── Named-region origins (needed to encode a name to an id64) ────────────────
export { getNamedRegionOrigin, resolveRegionOrigin, type RegionOrigin } from './named-regions.js';

// ── Hand-authored regions (nebula / cluster named sectors) ──────────────────
export {
    handAuthoredRegionForCoords,
    HAND_AUTHORED_REGIONS,
    type HandAuthoredRegion,
    type HandAuthoredSphere,
} from './hand-authored-regions.js';

// ── Permit locks (which systems and regions need a permit) ──────────────────
// The only place permit state lives: `HandAuthoredRegion` carries no permit flag.
// Six lookups, easy to confuse — pick by what you hold and what you need back:
//
//   have a system name, want either kind of lock  -> permitLockForSystemName  (start here)
//   have a system name, want just yes/no          -> isPermitLockedSystemName (either kind)
//   have a system name, want only its own lock    -> permitLockedSystemForName
//   have an id64 / journal address                -> permitLockedSystemForAddress
//   have a *region* name (e.g. from coordinates)  -> isPermitLockedRegionName
//   have a system name, want its region's lock    -> permitLockedRegionForSystemName
export {
    permitLockForSystemName,
    isPermitLockedSystemName,
    permitLockedSystemForName,
    permitLockedSystemForAddress,
    isPermitLockedRegionName,
    permitLockedRegionForSystemName,
    PERMIT_LOCKED_SYSTEMS,
    PERMIT_LOCKED_REGIONS,
    type PermitLock,
    type PermitLockedSystem,
} from './permit-locks.js';

// ── Galactic codex regions (the 42 codex zones) ─────────────────────────────
export {
    GALACTIC_REGIONS,
    getGalacticRegion,
    getGalacticRegionByName,
    type GalacticRegion,
    type PlaneBounds,
    type PlanePoint,
} from './galactic-region.js';

export {
    findRegionAt,
    findRegionForBoxel,
    REGION_MAP_X0,
    REGION_MAP_Y0,
    REGION_MAP_Z0,
    REGION_MAP_LY_PER_CELL,
    type RegionLookup,
    type BoxelRegion,
} from './galactic-region-lookup.js';

// ── Nebulae (where the catalogued nebulae are) ──────────────────────────────
// Not the same thing as a hand-authored region: these are the nebulae themselves.
// The query functions hold no data; each catalogue is its own module, so import
// only the class you need.
export {
    nearestNebulae,
    nebulaeWithin,
    getNebulaByName,
    type Nebula,
    type NebulaType,
    type NebulaWithDistance,
} from './nebulae.js';

export { REAL_NEBULAE } from './nebulae-real.js';
export { PLANETARY_NEBULAE } from './nebulae-planetary.js';
export { PROCGEN_NEBULAE } from './nebulae-procgen.js';
export { ALL_NEBULAE } from './nebulae-all.js';

// ── Low-level boxel primitives ──────────────────────────────────────────────
// Building blocks the encoders use; most consumers never need these directly.
export { lettersToBoxelCode, boxelCodeToLetters } from './system-name.js';

export {
    boxelCodeToAbsoluteBoxel,
    absoluteBoxelToBoxelCode,
    boxelInternalSize,
    SECTOR_INTERNAL_SIZE,
} from './system-address.js';
