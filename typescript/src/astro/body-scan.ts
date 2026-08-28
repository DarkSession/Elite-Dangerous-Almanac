/**
 * The shape a scanned body arrives in: {@link BodyProperties}, the physical body every
 * calculation reads, and {@link BodyScanEvent}, that body plus the game journal's own
 * `Scan` bookkeeping — with the records both nest.
 *
 * Types only. No catalogue, no parser, no computation, so importing costs nothing at
 * runtime; `./astro` re-exports every symbol, which is why there is no subpath of its own.
 * The orientation a reader needs lives on the two interfaces themselves.
 *
 * @packageDocumentation
 */

import type { SystemAddressInput } from './system-address-input.js';

/**
 * One step up a body's parent chain, as one entry of {@link BodyScanEvent.Parents}.
 *
 * @remarks
 * **Exactly one key is present**, and its value is that parent's
 * {@link BodyScanEvent.BodyID} — so a moon orbiting a planet reads `{ Planet: 4 }`.
 * The four keys are the four kinds of thing a body can orbit; `Null` is a barycentre,
 * which is a point rather than a body and has no scan of its own.
 *
 * @example
 * ```ts
 * import type { BodyParent } from '@elite-dangerous-almanac/core/astro';
 *
 * // A moon of the second planet, which orbits the main star.
 * const parents: readonly BodyParent[] = [{ Planet: 4 }, { Star: 0 }];
 *
 * Object.keys(parents[0] ?? {})[0]; // -> 'Planet'
 * ```
 */
export interface BodyParent {
    /** `BodyID` of the star this body orbits. */
    readonly Star?: number;
    /** `BodyID` of the planet this body orbits — the body is a moon of it. */
    readonly Planet?: number;
    /** `BodyID` of the ring this body sits in — written for a belt cluster. */
    readonly Ring?: number;
    /** `BodyID` of the barycentre this body orbits. A point, not a scannable body. */
    readonly Null?: number;
}

/**
 * One ring or belt around a body, as one entry of {@link BodyProperties.Rings}.
 *
 * @remarks
 * The same shape covers a planet's rings and a star's asteroid belts; `Name` tells them
 * apart, ending in `" A Ring"` or `" A Belt"`. Radii are **metres** from the body's
 * centre, and `MassMT` is **megatonnes** — the one mass in this module that is neither
 * solar nor Earth masses.
 */
export interface BodyRing {
    /** The ring's in-game name, e.g. `"Synuefe EN-H d11-96 A 1 A Ring"`. */
    readonly Name: string;
    /**
     * The ring's material class, as the game's internal token: `"eRingClass_Rocky"`,
     * `"eRingClass_Icy"`, `"eRingClass_MetalRich"` or `"eRingClass_Metalic"`.
     *
     * @remarks
     * `"eRingClass_Metalic"` is spelt that way by the game. It is Frontier's token, not a
     * typo introduced here, and a consumer matching on the string must spell it likewise.
     */
    readonly RingClass: string;
    /** The ring's total mass, in megatonnes. */
    readonly MassMT: number;
    /** Inner radius, in metres from the body's centre. */
    readonly InnerRad: number;
    /** Outer radius, in metres from the body's centre. */
    readonly OuterRad: number;
}

/**
 * One gas in a body's atmosphere, as one entry of
 * {@link BodyProperties.AtmosphereComposition}.
 */
export interface AtmosphereComponent {
    /** The gas, as the game names it, e.g. `"Nitrogen"`, `"SulphurDioxide"`. */
    readonly Name: string;
    /** Share of the atmosphere, as a **percentage** — `99.124542`, not `0.99124542`. */
    readonly Percent: number;
}

/**
 * One material available at a landable body's surface, as one entry of
 * {@link BodyProperties.Materials}.
 *
 * @remarks
 * `Name` is the journal's material symbol in lower case, which is what
 * `getMaterialBySymbol` (`../materials`) takes — the same spelling a `MaterialCollected`
 * line uses.
 */
export interface SurfaceMaterial {
    /** The material's journal symbol, lower-cased, e.g. `"iron"`, `"sulphur"`. */
    readonly Name: string;
    /** The material's display name, when the game localised it into the line. */
    readonly Name_Localised?: string;
    /** Share of the body's surface materials, as a **percentage** out of 100. */
    readonly Percent: number;
}

/**
 * What a planet or moon is made of, as {@link BodyProperties.Composition}.
 *
 * @remarks
 * Each share is a **fraction of 1**, not a percentage, and the three sum to 1. This is
 * the body's bulk composition; {@link BodyProperties.Materials} is the separate question
 * of what can be collected from its surface.
 */
export interface BodyComposition {
    /** Ice share of the body, 0–1. */
    readonly Ice: number;
    /** Rock share of the body, 0–1. */
    readonly Rock: number;
    /** Metal share of the body, 0–1. */
    readonly Metal: number;
}

/**
 * The physical body a scan describes — everything a calculation reads, and nothing that
 * names the journal line it arrived on.
 *
 * @remarks
 * {@link BodyScanEvent} extends this with the journal's own bookkeeping — `event`,
 * `timestamp`, `ScanType`, `BodyName`, `BodyID`, `StarSystem`, `SystemAddress`,
 * `DistanceFromArrivalLS`, `Parents` and the discovery flags. None of that is physics, so
 * none of it is required here: every field below is optional, and a body assembled from a
 * database row, an EDSM or Spansh record, or a literal in a test is as good an input as a
 * captured line. A `BodyScanEvent` is a `BodyProperties`, so a parsed journal line passes
 * to every calculation unchanged.
 *
 * Each calculation states which fields it needs and returns `null` when one is missing —
 * see `./body-physics`, `./body-orbit`, `./body-rings` and `./star-physics`.
 *
 * Units are the journal's throughout: metres, seconds, kelvin, pascals, Earth masses for
 * a planet and solar masses for a star. Angles are degrees except
 * {@link BodyProperties.AxialTilt | AxialTilt}, which is radians.
 *
 * @example
 * Only the fields a calculation reads need be present.
 *
 * ```ts
 * import type { BodyProperties } from '@elite-dangerous-almanac/core/astro';
 * import { bulkDensity } from '@elite-dangerous-almanac/core/astro/body-physics';
 *
 * const earthLike: BodyProperties = { MassEM: 1, Radius: 6_371_000 };
 *
 * bulkDensity(earthLike); // -> 5513.2…
 * ```
 */
export interface BodyProperties {
    // ── Orbit and rotation ──────────────────────────────────────────────────
    /** Semi-major axis of the body's orbit, in **metres**. */
    readonly SemiMajorAxis?: number;
    /** Orbital eccentricity, 0 for a circular orbit and approaching 1 for a long ellipse. */
    readonly Eccentricity?: number;
    /** Orbital inclination, in **degrees**. */
    readonly OrbitalInclination?: number;
    /** Argument of periapsis, in **degrees**. */
    readonly Periapsis?: number;
    /** Time to complete one orbit, in **seconds**. */
    readonly OrbitalPeriod?: number;
    /** Longitude of the ascending node, in **degrees**. */
    readonly AscendingNode?: number;
    /** Mean anomaly at the moment the body was observed, in **degrees**. */
    readonly MeanAnomaly?: number;
    /**
     * Time to complete one rotation, in **seconds**. Negative when the body rotates
     * retrograde.
     */
    readonly RotationPeriod?: number;
    /**
     * Axial tilt, in **radians** — the one angle here that is not degrees.
     */
    readonly AxialTilt?: number;
    /** Whether the body keeps one face to its parent. */
    readonly TidalLock?: boolean;

    // ── Written for a star ──────────────────────────────────────────────────
    /**
     * The star's spectral class, e.g. `"G"`, `"M"`, `"TTS"` (T Tauri), `"N"` (neutron
     * star), `"H"` (black hole). Present only on a star's line, and the surest way to
     * tell one.
     */
    readonly StarType?: string;
    /** The spectral subclass, 0–9, hotter at 0. */
    readonly Subclass?: number;
    /** The star's mass, in **solar masses**. */
    readonly StellarMass?: number;
    /** The star's absolute magnitude — smaller is brighter, and it can be negative. */
    readonly AbsoluteMagnitude?: number;
    /** The star's age, in **millions of years**. */
    readonly Age_MY?: number;
    /** The star's luminosity class, e.g. `"V"`, `"Va"`, `"VI"`. */
    readonly Luminosity?: string;

    // ── Written for a planet or moon ────────────────────────────────────────
    /**
     * The body's class, e.g. `"High metal content body"`, `"Icy body"`,
     * `"Earthlike body"`, `"Water world"`, `"Sudarsky class I gas giant"`. Present only
     * on a planet's or moon's line.
     */
    readonly PlanetClass?: string;
    /**
     * Whether the body's terraforming potential has been realised: `""` when there is
     * none, `"Terraformable"` when it is a candidate, `"Terraformed"` when it already is.
     */
    readonly TerraformState?: string;
    /**
     * The atmosphere as the game describes it in full, e.g.
     * `"thin sulphur dioxide atmosphere"`. `""` when the body has none.
     */
    readonly Atmosphere?: string;
    /**
     * The atmosphere's dominant gas as a bare token, e.g. `"Nitrogen"`,
     * `"SulphurDioxide"`, `"None"`.
     *
     * @remarks
     * The token drops the density and temperature that {@link BodyProperties.Atmosphere | Atmosphere}
     * spells out, so `"thin nitrogen atmosphere"` and `"hot thick nitrogen atmosphere"`
     * share one `AtmosphereType`. Match on this and read the other for the qualifiers.
     */
    readonly AtmosphereType?: string;
    /** What the atmosphere is made of, by percentage. */
    readonly AtmosphereComposition?: readonly AtmosphereComponent[];
    /**
     * The body's volcanism as the game describes it, e.g.
     * `"minor silicate vapour geysers volcanism"`. `""` when the body has none.
     */
    readonly Volcanism?: string;
    /** The body's mass, in **Earth masses**. */
    readonly MassEM?: number;
    /**
     * Surface gravity, in **m/s²** — divide by `9.80665` for the `g` figure the game's
     * own UI shows.
     */
    readonly SurfaceGravity?: number;
    /**
     * Atmospheric pressure at the surface, in **pascals** — divide by `101325` for
     * atmospheres. `0` on an airless body.
     */
    readonly SurfacePressure?: number;
    /** Whether a ship can land on the body. */
    readonly Landable?: boolean;
    /** The body's bulk composition, when the scan resolved it. */
    readonly Composition?: BodyComposition;
    /**
     * The materials collectable at the surface, by percentage.
     *
     * @remarks
     * Written for a landable body. Each `Name` is a journal material symbol that
     * `getMaterialBySymbol` (`../materials`) resolves.
     */
    readonly Materials?: readonly SurfaceMaterial[];

    // ── Written for either ──────────────────────────────────────────────────
    /**
     * The body's radius, in **metres** — for a star as much as for a planet.
     */
    readonly Radius?: number;
    /** Surface — or, for a star, photospheric — temperature, in **kelvin**. */
    readonly SurfaceTemperature?: number;
    /** The body's rings and belts, absent when it has none. */
    readonly Rings?: readonly BodyRing[];
    /**
     * How rich the body's rings are, e.g. `"PristineResources"`, `"MajorResources"`,
     * `"CommonResources"`, `"LowResources"`, `"DepletedResources"` — the game's reserve
     * levels, each suffixed `Resources`.
     *
     * @remarks
     * Written only when the body has rings, and it describes those rings rather than the
     * body itself.
     */
    readonly ReserveLevel?: string;
}

/**
 * A journal `Scan` event — one scanned star, planet, moon or belt cluster, and the
 * library's import shape for body data.
 *
 * @remarks
 * Elite Dangerous writes one `Scan` line per body whenever the discovery scanner, the FSS
 * or a nav beacon resolves it, and that line is the community's lingua franca for bodies:
 * EDDN relays it, EDSM and Spansh store it, every journal-reading app already holds it.
 * So it is what this library takes in, field for field — the journal's own names,
 * capitalisation and units — and a parsed line is already this type:
 *
 * ```ts
 * const scan = JSON.parse(line) as BodyScanEvent;
 * ```
 *
 * **Units are the journal's, and they are not the ones the game's UI shows.** Radii and
 * orbital distances are metres, not light-seconds; pressure is pascals, not atmospheres;
 * surface gravity is m/s², not g; `AxialTilt` is radians while every other angle is
 * degrees. Every field below says which, because getting this wrong is silent — a
 * plausible number in the wrong scale.
 *
 * **Almost every field is optional, because almost every field is conditional.** A star's
 * line carries no {@link BodyProperties.PlanetClass | PlanetClass}, a planet's no
 * {@link BodyProperties.StarType | StarType}, a belt cluster's little beyond its identity, and a body
 * with no rings no {@link BodyProperties.ReserveLevel | ReserveLevel}. Only `ScanType`, `BodyName`,
 * `BodyID`, `StarSystem`, `SystemAddress`, `DistanceFromArrivalLS`, `WasDiscovered` and
 * `WasMapped` are written for every body. Treat a missing field as "not written for this
 * body, or not resolved by this scan" — never as a zero.
 *
 * **A body has no id64 of its own.** {@link BodyScanEvent.SystemAddress | SystemAddress} identifies the
 * system and {@link BodyScanEvent.BodyID | BodyID} the body within it; the pair is the identity to
 * store and join on.
 *
 * `event` and `timestamp` name the journal line rather than the body, and are optional so
 * that a record reassembled from a database or an EDDN message is still this type.
 *
 * @example
 * A parsed line is already the interface, and its address goes straight into the rest of
 * the astro API.
 *
 * ```ts
 * import type { BodyScanEvent } from '@elite-dangerous-almanac/core/astro';
 * import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
 *
 * const scan: BodyScanEvent = {
 *     event: 'Scan',
 *     ScanType: 'Detailed',
 *     BodyName: 'Synuefe EN-H d11-96 A 1',
 *     BodyID: 3,
 *     StarSystem: 'Synuefe EN-H d11-96',
 *     SystemAddress: 3309179996515,
 *     DistanceFromArrivalLS: 543.2,
 *     WasDiscovered: false,
 *     WasMapped: false,
 * };
 *
 * ProceduralSystem.fromSystemAddress(scan.SystemAddress).massCode; // -> 'd'
 * ```
 *
 * @example
 * Which kind of body a line describes is told by which fields it carries: `StarType` for
 * a star, `PlanetClass` for a planet or moon, neither for a belt cluster.
 *
 * ```ts
 * import type { BodyScanEvent } from '@elite-dangerous-almanac/core/astro';
 *
 * declare const scan: BodyScanEvent;
 *
 * const kind =
 *     scan.StarType !== undefined
 *         ? 'star'
 *         : scan.PlanetClass !== undefined
 *           ? 'planet'
 *           : 'belt cluster or barycentre';
 * ```
 *
 * @example
 * A landable body's {@link BodyProperties.Materials | Materials} name journal material symbols, which
 * the materials catalogue reads directly.
 *
 * ```ts
 * import { getMaterialBySymbol } from '@elite-dangerous-almanac/core/materials';
 *
 * getMaterialBySymbol('sulphur')?.name; // -> 'Sulphur'
 * ```
 */
export interface BodyScanEvent extends BodyProperties {
    // ── The journal line itself ─────────────────────────────────────────────
    /** `"Scan"` when a journal line supplied it. */
    readonly event?: string;
    /** When the scan happened, ISO 8601 in UTC, e.g. `"2026-08-26T21:04:11Z"`. */
    readonly timestamp?: string;

    // ── Identity ────────────────────────────────────────────────────────────
    /**
     * How the body was scanned: `"AutoScan"` (passive, on approach or from the discovery
     * scanner's honk), `"Basic"`, `"Detailed"` (resolved in the FSS or by flying to the
     * body) or `"NavBeaconDetail"` (read off a populated system's nav beacon).
     *
     * @remarks
     * This is the field that decides how much of the rest is present. A `"Detailed"` or
     * `"NavBeaconDetail"` line is the full record; an `"AutoScan"` of a distant body may
     * carry little more than its identity and orbit.
     */
    readonly ScanType: string;
    /** The body's in-game name, e.g. `"Synuefe EN-H d11-96 A 1"`. */
    readonly BodyName: string;
    /**
     * The body's id within its system, unique and stable there, with the system's first
     * star at 0.
     *
     * @remarks
     * A body has no galaxy-wide id of its own: `SystemAddress` + `BodyID` is the identity
     * to store and join on. It is also what {@link BodyParent} entries point at.
     */
    readonly BodyID: number;
    /** The system's name, e.g. `"Synuefe EN-H d11-96"`. */
    readonly StarSystem: string;
    /**
     * The system's `id64` address.
     *
     * @remarks
     * Typed as {@link SystemAddressInput} rather than `number`, so the value survives
     * however the line was parsed: `JSON.parse` yields a `number`, a lossless parser a
     * `bigint`, a database column a decimal `string`. All three pass straight into
     * `decodeSystemAddress`, `ProceduralSystem.fromSystemAddress` and the permit-lock
     * lookups. Addresses reach bit 55, so a `number` beyond `2^53 - 1` has already been
     * rounded — those entry points reject one rather than answer for the wrong system.
     */
    readonly SystemAddress: SystemAddressInput;
    /**
     * Distance from the system's arrival point, in **light-seconds**. The main star reads
     * `0`.
     */
    readonly DistanceFromArrivalLS: number;
    /**
     * The body's parent chain, nearest first and ending at the system's root — so a moon
     * reads `[{ Planet: … }, { Star: 0 }]`.
     *
     * @remarks
     * Absent for a body that orbits nothing, i.e. a single-star system's main star.
     */
    readonly Parents?: readonly BodyParent[];

    // ── First-discovery state ───────────────────────────────────────────────
    /** Whether someone had already discovered the body before this scan. */
    readonly WasDiscovered: boolean;
    /** Whether someone had already surface-mapped the body before this scan. */
    readonly WasMapped: boolean;
    /**
     * Whether someone had already set foot on the body. Written since Odyssey, and only
     * for a body that can be walked on.
     */
    readonly WasFootfalled?: boolean;
}
