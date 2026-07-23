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
export {
    decodeSystemAddress,
    decodeModSystemAddress,
    encodeSystemAddress,
    encodeModSystemAddress,
    type DecodedAddress,
} from './system-address.js';

// ── Procedural sectors: name ⇄ grid coordinates ─────────────────────────────
export {
    sectorNameFromCoords,
    sectorCoordsFromName,
    canonicalizeSectorName,
    type SectorCoords,
} from './sector-name.js';

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
export {
    lettersToBoxelCode,
    boxelCodeToLetters,
} from './system-name.js';

export {
    boxelCodeToAbsoluteBoxel,
    absoluteBoxelToBoxelCode,
    boxelInternalSize,
    SECTOR_INTERNAL_SIZE,
} from './system-address.js';
