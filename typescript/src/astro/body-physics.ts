/**
 * Bulk properties of a scanned body, and the geometry between a body and the one it
 * orbits: mass, density, Roche limits, Hill radius, apparent size.
 *
 * Every function takes {@link BodyProperties} — a journal `Scan` line as it comes, or any
 * record carrying the same fields — and works in the journal's own units: metres,
 * kilograms, seconds. Nothing here holds data or reads a catalogue. The type itself is
 * exported from `../astro`, alongside `BodyScanEvent`.
 *
 * **A calculation that compares two bodies takes both.** A journal line names a body's
 * parent only by `BodyID` ({@link BodyProperties} carries no parent), so
 * {@link rocheLimits}, {@link hillRadius} and {@link primaryAngularDiameter} take the
 * primary as a second argument. Resolve it from your own record of the system — the
 * `Parents` chain on the scan says which `BodyID` to look for.
 *
 * **Everything answers `null` rather than guessing.** A field the scan did not write, a
 * zero radius, a `NaN` mass: all are "cannot be computed", never a substituted zero.
 *
 * The maths is ported from the Canonn Research Group's
 * [canonn-signals](https://github.com/canonn-science/canonn-signals); see
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { bulkDensity } from '@elite-dangerous-almanac/core/astro/body-physics';
 *
 * bulkDensity({ MassEM: 1, Radius: 6_371_000 }); // -> 5513.2…
 * ```
 *
 * @packageDocumentation
 */

import type { BodyProperties } from './body-scan.js';
import { positiveQuantity, sphereVolume } from './internal/body-quantities.js';
import { requireObject } from '../internal/argument-guards.js';

/**
 * Newton's gravitational constant, in m³ kg⁻¹ s⁻² (CODATA).
 *
 * @remarks
 * Exported because every orbital figure this library reports is proportional to it, so a
 * consumer reproducing one gets the same answer rather than a near miss.
 */
export const GRAVITATIONAL_CONSTANT = 6.6743e-11;

/**
 * Kilograms in one Earth mass — the unit {@link BodyProperties.MassEM | MassEM} is written
 * in.
 */
export const KG_PER_EARTH_MASS = 5.972e24;

/**
 * Kilograms in one solar mass — the unit {@link BodyProperties.StellarMass | StellarMass}
 * is written in.
 */
export const KG_PER_SOLAR_MASS = 1.989e30;

/**
 * The two Roche limits for one pair of bodies, in metres from the primary's centre.
 *
 * @remarks
 * Inside the Roche limit a satellite is pulled apart by the tide the primary raises on it.
 * Which limit applies depends on what holds the satellite together: a rigid body resists
 * with its own strength, a fluid one only with self-gravity, so the fluid limit is the
 * larger and the truth for a real body sits between them.
 */
export interface RocheLimits {
    /**
     * Rigid-body limit, in metres — `1.26 · R · (ρ_primary / ρ_satellite)^(1/3)`. The
     * conservative figure: a solid body can survive closer than this only on its own
     * material strength.
     */
    readonly rigid: number;
    /**
     * Fluid-body limit, in metres — `2.456 · R · (ρ_primary / ρ_satellite)^(1/3)`. The
     * generous figure, for a satellite held together by gravity alone.
     */
    readonly fluid: number;
}

/** Coefficient on the rigid-body Roche limit. */
const RIGID_ROCHE_COEFFICIENT = 1.26;
/** Coefficient on the fluid-body Roche limit. */
const FLUID_ROCHE_COEFFICIENT = 2.456;

/**
 * A body's mass in kilograms, whichever unit the scan wrote it in.
 *
 * @param body - The body. A planet or moon carries
 * {@link BodyProperties.MassEM | MassEM} (Earth masses), a star
 * {@link BodyProperties.StellarMass | StellarMass} (solar masses).
 * @returns The mass in kilograms, or `null` when the scan wrote neither field usably. When
 * a record carries both — which no journal line does — `MassEM` is the one read.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { bodyMass } from '@elite-dangerous-almanac/core/astro/body-physics';
 *
 * bodyMass({ MassEM: 1 }); // -> 5.972e24
 * bodyMass({ StellarMass: 1 }); // -> 1.989e30
 * bodyMass({ Radius: 6_371_000 }); // -> null
 * ```
 */
export function bodyMass(body: BodyProperties): number | null {
    requireObject(body, 'bodyMass: body');
    return massOf(body);
}

/** {@link bodyMass} without the argument guard, for callers that have already run one. */
function massOf(body: BodyProperties): number | null {
    const earthMasses = positiveQuantity(body.MassEM);
    if (earthMasses !== null) return earthMasses * KG_PER_EARTH_MASS;
    const solarMasses = positiveQuantity(body.StellarMass);
    return solarMasses !== null ? solarMasses * KG_PER_SOLAR_MASS : null;
}

/**
 * A body's mean density, in kg/m³ — its mass spread evenly through a sphere of its radius.
 *
 * @param body - The body. Needs a mass ({@link bodyMass}) and
 * {@link BodyProperties.Radius | Radius}.
 * @returns Density in kg/m³, or `null` when either is missing. The scale is wide: an icy
 * moon reads near 1000, rock and metal a few thousand, a neutron star around 10¹⁷.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { bulkDensity } from '@elite-dangerous-almanac/core/astro/body-physics';
 *
 * // Earth: one Earth mass in a 6371 km sphere.
 * bulkDensity({ MassEM: 1, Radius: 6_371_000 }); // -> 5513.2…
 * ```
 */
export function bulkDensity(body: BodyProperties): number | null {
    requireObject(body, 'bulkDensity: body');
    return densityOf(body);
}

/** {@link bulkDensity} without the argument guard, for callers that have already run one. */
function densityOf(body: BodyProperties): number | null {
    const massKg = massOf(body);
    const radiusM = positiveQuantity(body.Radius);
    if (massKg === null || radiusM === null) return null;
    return massKg / sphereVolume(radiusM);
}

/**
 * Roche limits around a primary for a satellite of a stated density.
 *
 * @remarks
 * Use this when the satellite's density is assumed rather than measured — ring material,
 * for instance, whose density comes from its class rather than from a mass and a radius
 * (`ringRocheLimits` in `./body-rings` is this function with that density filled in).
 * When the satellite is a scanned body with a mass and a radius of its own, prefer
 * {@link rocheLimits}, which reads the density off it.
 *
 * @param primary - The body being orbited. Needs a mass and a
 * {@link BodyProperties.Radius | Radius}.
 * @param satelliteDensityKgM3 - The orbiting material's density in kg/m³.
 * @returns Both limits in metres from the primary's centre, or `null` when the primary's
 * own density cannot be computed.
 * @throws {TypeError} If `primary` is not an object.
 * @throws {RangeError} If `satelliteDensityKgM3` is not a finite positive number — an
 * assumed density is the caller's own figure, so a bad one is a mistake rather than a
 * missing scan field.
 * @example
 * ```ts
 * import { rocheLimitsForDensity } from '@elite-dangerous-almanac/core/astro/body-physics';
 *
 * // Icy particles (1000 kg/m³) around an Earth-density primary.
 * const limits = rocheLimitsForDensity({ MassEM: 1, Radius: 6_371_000 }, 1000);
 * limits?.rigid; // -> 14181242.2…
 * limits?.fluid; // -> 27642167.3…
 * ```
 */
export function rocheLimitsForDensity(
    primary: BodyProperties,
    satelliteDensityKgM3: number,
): RocheLimits | null {
    requireObject(primary, 'rocheLimitsForDensity: primary');
    if (!Number.isFinite(satelliteDensityKgM3) || satelliteDensityKgM3 <= 0) {
        throw new RangeError(
            'rocheLimitsForDensity: satelliteDensityKgM3 must be a finite positive number',
        );
    }
    const primaryRadiusM = positiveQuantity(primary.Radius);
    const primaryDensity = densityOf(primary);
    if (primaryRadiusM === null || primaryDensity === null) return null;

    const densityRatio = Math.cbrt(primaryDensity / satelliteDensityKgM3);
    return {
        rigid: RIGID_ROCHE_COEFFICIENT * primaryRadiusM * densityRatio,
        fluid: FLUID_ROCHE_COEFFICIENT * primaryRadiusM * densityRatio,
    };
}

/**
 * Roche limits around a primary for one scanned satellite.
 *
 * @remarks
 * Compare them against the satellite's **periapsis**, not its semi-major axis: a breach is
 * set by closest approach, so an eccentric moon can dip inside the rigid limit while its
 * mean distance looks safe. `orbitExtents` in `./body-orbit` gives that periapsis.
 *
 * @param satellite - The orbiting body. Needs a mass and a
 * {@link BodyProperties.Radius | Radius}, from which its density is taken.
 * @param primary - The body being orbited. Needs the same.
 * @returns Both limits in metres from the primary's centre, or `null` when either body's
 * density cannot be computed.
 * @throws {TypeError} If either argument is not an object.
 * @example
 * ```ts
 * import { rocheLimits } from '@elite-dangerous-almanac/core/astro/body-physics';
 * import { orbitExtents } from '@elite-dangerous-almanac/core/astro/body-orbit';
 *
 * const moon = { MassEM: 0.0123, Radius: 1_737_400, SemiMajorAxis: 3.844e8, Eccentricity: 0.0549 };
 * const earth = { MassEM: 1, Radius: 6_371_000 };
 *
 * const limits = rocheLimits(moon, earth);
 * const closest = orbitExtents(moon)?.periapsis ?? 0;
 *
 * closest < (limits?.rigid ?? 0); // -> false
 * ```
 */
export function rocheLimits(
    satellite: BodyProperties,
    primary: BodyProperties,
): RocheLimits | null {
    requireObject(satellite, 'rocheLimits: satellite');
    requireObject(primary, 'rocheLimits: primary');
    const satelliteDensity = densityOf(satellite);
    if (satelliteDensity === null) return null;
    return rocheLimitsForDensity(primary, satelliteDensity);
}

/**
 * The radius of a body's Hill sphere, in metres — how far its own gravity wins against the
 * body it orbits.
 *
 * @remarks
 * `r_H = a · (m / 3M)^(1/3)`. Anything orbiting the body must stay inside this radius to
 * remain bound to it, so it is the reach a moon has over nearby material — which is what
 * makes a small moon a shepherd of a ring it does not sit in.
 *
 * The semi-major axis is used as written, so the figure is the mean-distance Hill radius.
 * On an eccentric orbit the sphere shrinks at periapsis; recompute with
 * `orbitExtents(body)?.periapsis` in place of the axis when that matters.
 *
 * @param body - The body whose sphere is wanted. Needs
 * {@link BodyProperties.SemiMajorAxis | SemiMajorAxis} and a mass.
 * @param primary - The body it orbits. Needs a mass.
 * @returns The Hill radius in metres, or `null` when a mass or the orbit is missing.
 * @throws {TypeError} If either argument is not an object.
 * @example
 * ```ts
 * import { hillRadius } from '@elite-dangerous-almanac/core/astro/body-physics';
 *
 * // Earth about the Sun: about 1.5 million km.
 * hillRadius({ MassEM: 1, SemiMajorAxis: 1.496e11 }, { StellarMass: 1 }); // -> 1496417737.0…
 * ```
 */
export function hillRadius(body: BodyProperties, primary: BodyProperties): number | null {
    requireObject(body, 'hillRadius: body');
    requireObject(primary, 'hillRadius: primary');
    const semiMajorAxisM = positiveQuantity(body.SemiMajorAxis);
    const bodyMassKg = massOf(body);
    const primaryMassKg = massOf(primary);
    if (semiMajorAxisM === null || bodyMassKg === null || primaryMassKg === null) return null;
    return semiMajorAxisM * Math.cbrt(bodyMassKg / (3 * primaryMassKg));
}

/**
 * How large the body it orbits appears in a body's sky, as an angular diameter in degrees.
 *
 * @remarks
 * `2 · atan(R_primary / a)`, taken exactly rather than through the small-angle
 * approximation `2R/a`: the two diverge by percent at the tens of degrees a parent
 * actually subtends from a close moon, which is the range worth asking about. A landable
 * moon whose primary fills 45° of sky is a view; one at 0.5° is a dot.
 *
 * Distance is the body's own semi-major axis, centre to centre, so the figure is the mean.
 *
 * @param body - The body being stood on. Needs
 * {@link BodyProperties.SemiMajorAxis | SemiMajorAxis}.
 * @param primary - The body it orbits. Needs {@link BodyProperties.Radius | Radius}.
 * @returns The angular diameter in degrees, or `null` when the orbit or the primary's
 * radius is missing.
 * @throws {TypeError} If either argument is not an object.
 * @example
 * ```ts
 * import { primaryAngularDiameter } from '@elite-dangerous-almanac/core/astro/body-physics';
 *
 * // A primary as far away as it is wide fills a right angle of sky.
 * primaryAngularDiameter({ SemiMajorAxis: 1e9 }, { Radius: 1e9 }); // -> 90
 *
 * // Earth's Moon, looking back: Earth subtends about 2°.
 * primaryAngularDiameter({ SemiMajorAxis: 3.844e8 }, { Radius: 6_371_000 }); // -> 1.899…
 * ```
 */
export function primaryAngularDiameter(
    body: BodyProperties,
    primary: BodyProperties,
): number | null {
    requireObject(body, 'primaryAngularDiameter: body');
    requireObject(primary, 'primaryAngularDiameter: primary');
    const distanceM = positiveQuantity(body.SemiMajorAxis);
    const primaryRadiusM = positiveQuantity(primary.Radius);
    if (distanceM === null || primaryRadiusM === null) return null;
    return 2 * Math.atan(primaryRadiusM / distanceM) * (180 / Math.PI);
}
