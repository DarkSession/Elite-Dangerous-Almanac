/**
 * Astrophysical data and calculations for the Elite Dangerous galaxy.
 *
 * This entry point re-exports the astro feature area. Every symbol is also
 * reachable from its own module, so bundlers can drop anything you do not use.
 *
 * **Start with {@link ProceduralSystem}** — it composes the pieces below into one
 * immutable handle (name ⇄ `id64`, sector, mass code, hand-authored regions). Drop
 * to the individual functions when you need just one calculation.
 *
 * **A note on the word "region".** It means four different things here; the
 * exports are grouped to keep them apart:
 * - *procedural sector* — {@link sectorNameFromGridPosition} & co. (the boxel grid name).
 * - *naming-region origin* — {@link resolveNamingRegionOrigin} (a sector's corner, for `id64`).
 * - *hand-authored region* — {@link findHandAuthoredRegionAt} (Pleiades, Coalsack, …).
 * - *galactic codex region* — {@link findCodexRegionAt} (one of the 42 codex zones).
 *
 * None of those is the **nebula catalogue** — the nebulae themselves, and where
 * they are: {@link nearestNebulae} & co. over {@link REAL_NEBULAE} and its sibling
 * catalogues.
 *
 * **Coordinate spaces have different shapes.**
 * {@link GalacticPosition} is `{x, y, z}` in light-years with Sol at the origin — what the journal,
 * EDSM and Spansh report, and what {@link findHandAuthoredRegionAt} and
 * {@link nearestNebulae} take.
 * {@link SectorGridPosition} uses `{sectorX, sectorY, sectorZ}` integer indices on the
 * 1280 ly naming grid, which is what {@link sectorNameFromGridPosition} takes. The
 * distinct axis names prevent accidentally passing light-years as sector indices.
 * Convert a real position with {@link sectorGridPositionFromGalacticPosition} (or go
 * straight to {@link sectorNameFromGalacticPosition}).
 *
 * {@link findCodexRegionAt} is the odd one out: it takes a flat {@link GalacticPlanePosition}
 * (`{x, z}` in light-years), because the region map is an X/Z projection. A
 * `GalacticPosition` **variable** passes straight through, but an inline
 * `{ x, y, z }` literal is a compile error — see {@link findCodexRegionAt}.
 *
 * **Permit locks** are six similarly-named lookups; {@link permitLockForSystemName}
 * is the one to start from (it answers for both kinds of lock, from a name alone).
 *
 * @packageDocumentation
 */

// ── Start here ──────────────────────────────────────────────────────────────
// High-level facade over everything below.
export { ProceduralSystem } from './procedural-system.js';

// ── Shared types ────────────────────────────────────────────────────────────
export type { GalacticPosition } from './galactic-position.js';

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
// `SectorGridPosition` uses named sector indices, not light-years. Convert a real
// position with the galaxy-grid helpers below.
export {
    sectorNameFromGridPosition,
    sectorGridPositionFromName,
    canonicalizeSectorName,
    type SectorGridPosition,
} from './sector-name.js';

export {
    sectorGridPositionFromGalacticPosition,
    sectorNameFromGalacticPosition,
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
export {
    getHandAuthoredRegionOrigin,
    resolveNamingRegionOrigin,
    type NamingRegionOrigin,
} from './naming-region-origins.js';

// ── Hand-authored regions (nebula / cluster named sectors) ──────────────────
export {
    findHandAuthoredRegionAt,
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
    CODEX_REGIONS,
    getCodexRegion,
    getCodexRegionByName,
    type CodexRegion,
    type CodexRegionBounds,
    type GalacticPlanePosition,
} from './codex-region.js';

// The two lookups return different shapes on purpose: `findCodexRegionAt` answers with the
// region alone (`CodexRegion | null`), while `findCodexRegionForBoxel` also hands back
// the boxel-corner coordinates it had to derive, so its region sits at `.region`.
export {
    findCodexRegionAt,
    findCodexRegionForBoxel,
    CODEX_REGION_MAP_X0,
    CODEX_REGION_MAP_Y0,
    CODEX_REGION_MAP_Z0,
    CODEX_REGION_MAP_LY_PER_CELL,
    type CodexRegionLookup,
    type BoxelCodexRegionLookup,
} from './codex-region-lookup.js';

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
