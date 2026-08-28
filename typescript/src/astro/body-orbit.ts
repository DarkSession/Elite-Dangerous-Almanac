/**
 * What a scanned body's orbit and spin work out to: where the orbit actually reaches, how
 * eccentric it is, whether the spin is locked to the orbit, and how fast the surface moves.
 *
 * Every function takes {@link BodyProperties} — a journal `Scan` line as it comes, or any
 * record carrying the same fields — and works in the journal's own units: metres for
 * distance, seconds for a period, degrees for an angle. Nothing here holds data. The type
 * itself is exported from `../astro`, alongside `BodyScanEvent`.
 *
 * These read the body's own fields only, so none of them needs the primary.
 *
 * The maths is ported from the Canonn Research Group's
 * [canonn-signals](https://github.com/canonn-science/canonn-signals); see
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { orbitExtents } from '@elite-dangerous-almanac/core/astro/body-orbit';
 *
 * // A semi-major axis is a mean: this orbit is 10% closer at one end and 10% further at the other.
 * const extents = orbitExtents({ SemiMajorAxis: 1e9, Eccentricity: 0.1 });
 * extents?.periapsis; // -> 900000000
 * extents?.apoapsis; // -> 1100000000
 * ```
 *
 * @packageDocumentation
 */

import type { BodyProperties } from './body-scan.js';
import { finiteQuantity, positiveQuantity } from './internal/body-quantities.js';
import { requireObject } from '../internal/argument-guards.js';

/** How far an orbit actually reaches at each end, in metres from the primary's centre. */
export interface OrbitExtents {
    /** The orbit's semi-major axis, in metres — its mean distance, as the scan wrote it. */
    readonly semiMajorAxis: number;
    /** Closest approach, in metres — `a(1 − e)`. */
    readonly periapsis: number;
    /** Furthest recession, in metres — `a(1 + e)`. */
    readonly apoapsis: number;
    /** The eccentricity used, which is `0` when the scan wrote none. */
    readonly eccentricity: number;
}

/**
 * How round an orbit is, in the four bands the Canonn tooling reports.
 *
 * - `circular` — eccentricity exactly `0`.
 * - `nearly-circular` — below `0.4`.
 * - `eccentric` — below `0.8`.
 * - `highly-eccentric` — `0.8` and above.
 *
 * @remarks
 * The bands are descriptive rather than physical: nothing changes at `0.4`. They exist so
 * that "how unusual is this orbit" has one answer everywhere instead of a different
 * threshold per caller.
 */
export type EccentricityClass = 'circular' | 'nearly-circular' | 'eccentric' | 'highly-eccentric';

/** A spin-orbit resonance as the small whole-number ratio it is. */
export interface SpinOrbitResonance {
    /** Rotations the body makes — the `3` of a 3:2 resonance. */
    readonly rotations: number;
    /** Orbits it makes in the same time — the `2` of a 3:2 resonance. */
    readonly orbits: number;
}

/** Largest numerator and denominator {@link spinOrbitResonance} will report. */
const MAX_RESONANCE_TERM = 5;
/** Relative error a ratio may carry and still count as that resonance. */
const RESONANCE_TOLERANCE = 0.01;

/**
 * Where a body's orbit actually reaches, from the mean distance and eccentricity the scan
 * wrote.
 *
 * @remarks
 * {@link BodyProperties.SemiMajorAxis | SemiMajorAxis} is an average, and an eccentric
 * orbit spends none of its time there. Periapsis is the figure a Roche breach, a tidal
 * heating argument or a close-approach question turns on.
 *
 * @param body - The body. Needs {@link BodyProperties.SemiMajorAxis | SemiMajorAxis};
 * {@link BodyProperties.Eccentricity | Eccentricity} is taken as `0` when absent, which is
 * what a circular orbit means.
 * @returns The extents in metres, or `null` when the body has no usable semi-major axis —
 * a single-star system's primary star, which orbits nothing, among them.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { orbitExtents } from '@elite-dangerous-almanac/core/astro/body-orbit';
 *
 * orbitExtents({ SemiMajorAxis: 1e9, Eccentricity: 0.25 })?.periapsis; // -> 750000000
 *
 * // No eccentricity written means a circle: both ends sit on the axis.
 * orbitExtents({ SemiMajorAxis: 1e9 })?.apoapsis; // -> 1000000000
 *
 * orbitExtents({ MassEM: 1 }); // -> null
 * ```
 */
export function orbitExtents(body: BodyProperties): OrbitExtents | null {
    requireObject(body, 'orbitExtents: body');
    const semiMajorAxis = positiveQuantity(body.SemiMajorAxis);
    if (semiMajorAxis === null) return null;
    const eccentricity = finiteQuantity(body.Eccentricity) ?? 0;
    return {
        semiMajorAxis,
        periapsis: semiMajorAxis * (1 - eccentricity),
        apoapsis: semiMajorAxis * (1 + eccentricity),
        eccentricity,
    };
}

/**
 * Which of the four descriptive bands an eccentricity falls in.
 *
 * @param eccentricity - An orbital eccentricity, as
 * {@link BodyProperties.Eccentricity | Eccentricity} carries it: `0` for a circle, rising
 * towards `1` for a long ellipse.
 * @returns The band. See {@link EccentricityClass} for the thresholds.
 * @throws {RangeError} If `eccentricity` is not a finite non-negative number. This takes a
 * bare number rather than a body, so there is no absent field for a bad one to be.
 * @example
 * ```ts
 * import { classifyEccentricity } from '@elite-dangerous-almanac/core/astro/body-orbit';
 *
 * classifyEccentricity(0); // -> 'circular'
 * classifyEccentricity(0.0549); // -> 'nearly-circular'
 * classifyEccentricity(0.9); // -> 'highly-eccentric'
 * ```
 */
export function classifyEccentricity(eccentricity: number): EccentricityClass {
    if (!Number.isFinite(eccentricity) || eccentricity < 0) {
        throw new RangeError(
            'classifyEccentricity: eccentricity must be a finite non-negative number',
        );
    }
    if (eccentricity === 0) return 'circular';
    if (eccentricity < 0.4) return 'nearly-circular';
    if (eccentricity < 0.8) return 'eccentric';
    return 'highly-eccentric';
}

/**
 * The simple whole-number resonance between a body's spin and its orbit, when there is one.
 *
 * @remarks
 * A body in a spin-orbit resonance turns a whole number of times for a whole number of
 * orbits. `1:1` is tidal locking — one face kept to the primary, which the scan also
 * reports as {@link BodyProperties.TidalLock | TidalLock} — and `3:2` is the next most
 * common, the resonance Mercury sits in.
 *
 * Both terms are searched up to 5, and a ratio counts as a resonance when it lands within
 * 1% of it. A retrograde rotation is written as a negative period; the resonance is a
 * ratio of magnitudes, so a retrograde tidally-locked body still reads `1:1`.
 *
 * @param body - The body. Needs {@link BodyProperties.RotationPeriod | RotationPeriod} and
 * {@link BodyProperties.OrbitalPeriod | OrbitalPeriod}. Both are seconds, and only their
 * ratio matters.
 * @returns The resonance, or `null` when either period is missing or the ratio is not
 * close to any simple one — most bodies are in no resonance at all.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { spinOrbitResonance } from '@elite-dangerous-almanac/core/astro/body-orbit';
 *
 * // One rotation per orbit: tidally locked.
 * spinOrbitResonance({ RotationPeriod: 86400, OrbitalPeriod: 86400 }); // -> { rotations: 1, orbits: 1 }
 *
 * // Mercury: three rotations every two orbits.
 * spinOrbitResonance({ RotationPeriod: 5067360, OrbitalPeriod: 7600544 }); // -> { rotations: 3, orbits: 2 }
 *
 * spinOrbitResonance({ RotationPeriod: 86400, OrbitalPeriod: 271828 }); // -> null
 * ```
 */
export function spinOrbitResonance(body: BodyProperties): SpinOrbitResonance | null {
    requireObject(body, 'spinOrbitResonance: body');
    const rotationPeriod = finiteQuantity(body.RotationPeriod);
    const orbitalPeriod = finiteQuantity(body.OrbitalPeriod);
    if (rotationPeriod === null || orbitalPeriod === null) return null;
    if (rotationPeriod === 0 || orbitalPeriod === 0) return null;

    const rotationsPerOrbit = Math.abs(orbitalPeriod) / Math.abs(rotationPeriod);
    for (let orbits = 1; orbits <= MAX_RESONANCE_TERM; orbits++) {
        for (let rotations = 1; rotations <= MAX_RESONANCE_TERM; rotations++) {
            const candidate = rotations / orbits;
            if (Math.abs(candidate - rotationsPerOrbit) / candidate <= RESONANCE_TOLERANCE) {
                return { rotations, orbits };
            }
        }
    }
    return null;
}

/**
 * How fast a body's equator moves as it turns, in metres per second.
 *
 * @remarks
 * `2πR / T`. This is the ground speed a point on the equator carries, which is why a fast
 * rotator is worth knowing about before landing on one: the surface of a neutron star
 * spinning in milliseconds is moving at a sizeable fraction of light speed.
 *
 * Speed is a magnitude, so a retrograde body — written with a negative
 * {@link BodyProperties.RotationPeriod | RotationPeriod} — reads the same as a prograde
 * one turning as fast.
 *
 * @param body - The body. Needs {@link BodyProperties.Radius | Radius} and
 * {@link BodyProperties.RotationPeriod | RotationPeriod}.
 * @returns The equatorial speed in m/s, or `null` when either is missing. A body the scan
 * reports as not rotating carries no period, and answers `null` rather than `0`.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { equatorialVelocity } from '@elite-dangerous-almanac/core/astro/body-orbit';
 *
 * // Earth: about 465 m/s at the equator.
 * equatorialVelocity({ Radius: 6_378_137, RotationPeriod: 86164.1 }); // -> 465.1…
 *
 * // Retrograde is the same speed, the other way round.
 * equatorialVelocity({ Radius: 6_378_137, RotationPeriod: -86164.1 }); // -> 465.1…
 * ```
 */
export function equatorialVelocity(body: BodyProperties): number | null {
    requireObject(body, 'equatorialVelocity: body');
    const radiusM = positiveQuantity(body.Radius);
    const rotationPeriod = finiteQuantity(body.RotationPeriod);
    if (radiusM === null || rotationPeriod === null || rotationPeriod === 0) return null;
    return (2 * Math.PI * radiusM) / Math.abs(rotationPeriod);
}
