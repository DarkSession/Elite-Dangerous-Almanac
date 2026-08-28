/**
 * Rings and belts: how fast they turn, how thinly their mass is spread, whether the game
 * draws them at all, and where the material could have survived forming.
 *
 * Every function takes a {@link BodyRing} — one entry of a scan's
 * {@link BodyProperties.Rings | Rings} array — and, where the maths needs the body the
 * ring goes round, that body as a second argument. Radii are metres, as the journal
 * writes them. Both types are exported from `../astro`.
 *
 * **Elite Dangerous rings are not Keplerian.** In a real ring every particle keeps its own
 * orbit, so the inner edge outruns the outer one. The game instead turns the whole ring as
 * one rigid sheet: a single period for all of it, which makes the *outer* edge the faster
 * one. {@link ringDynamics} models that, and the note on it explains where its one fitted
 * constant comes from.
 *
 * **`MassMT` is not an SI megatonne.** See {@link ringSurfaceDensity} before converting a
 * ring's mass to kilograms.
 *
 * The maths is ported from the Canonn Research Group's
 * [canonn-signals](https://github.com/canonn-science/canonn-signals), whose ring model is
 * their own observational research; see
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { ringParticleDensity } from '@elite-dangerous-almanac/core/astro/body-rings';
 *
 * ringParticleDensity('eRingClass_Icy'); // -> 1000
 * ringParticleDensity('eRingClass_MetalRich'); // -> 4500
 * ```
 *
 * @packageDocumentation
 */

import type { BodyProperties, BodyRing } from './body-scan.js';
import {
    bodyMass,
    rocheLimitsForDensity,
    GRAVITATIONAL_CONSTANT,
    type RocheLimits,
} from './body-physics.js';
import { positiveQuantity } from './internal/body-quantities.js';
import { requireObject, requireString } from '../internal/argument-guards.js';

/** Assumed density of icy ring material, in kg/m³ — water ice. */
const ICY_PARTICLE_DENSITY = 1000;
/** Assumed density of rocky ring material, in kg/m³ — silicates. */
const ROCKY_PARTICLE_DENSITY = 3000;
/** Assumed density of metallic ring material, in kg/m³ — iron and nickel. */
const METALLIC_PARTICLE_DENSITY = 4500;

/**
 * Fraction of a ring's width at which its single rotation period is taken —
 * {@link ringDynamics} explains where the figure comes from.
 */
export const RING_NOMINAL_RADIUS_FRACTION = 3 / 8;

/**
 * Surface density, in Mt/km², at or above which the game draws a ring — see
 * {@link isInvisibleRing}.
 */
export const VISIBLE_RING_MIN_SURFACE_DENSITY = 0.1;

/**
 * Width, in metres, below which a ring is drawn whatever its density — see
 * {@link isInvisibleRing}.
 */
export const VISIBLE_RING_MAX_WIDTH = 1e9;

/** How fast a ring turns, and how fast each of its edges is therefore moving. */
export interface RingDynamics {
    /** The single period the whole ring turns in, in seconds. */
    readonly orbitalPeriod: number;
    /** The radius that period is taken at, in metres — see {@link ringDynamics}. */
    readonly nominalRadius: number;
    /** Speed of the inner edge, in m/s. The slower one, because the ring turns rigidly. */
    readonly innerVelocity: number;
    /** Speed of the outer edge, in m/s. */
    readonly outerVelocity: number;
}

/**
 * The density assumed for the particles making up a ring of a given class, in kg/m³.
 *
 * @remarks
 * A scan reports what a ring is made of but never how dense its particles are, and the
 * Roche limit that says where the material could have survived needs one. These are the
 * standing assumptions the Canonn tooling uses: water ice, silicate rock, and iron-nickel
 * metal.
 *
 * @param ringClass - A ring's {@link BodyRing.RingClass | RingClass} token. Matched
 * case-insensitively on the material in the name, so both of the game's metallic
 * spellings — `"eRingClass_MetalRich"` and the misspelt `"eRingClass_Metalic"` — resolve.
 * @returns The assumed particle density in kg/m³: 4500 metallic, 3000 rocky, 1000 icy.
 * An unrecognised class falls back to the icy figure, which is the game's commonest ring
 * and its least dense — so a Roche limit computed from it is the conservative one.
 * @throws {TypeError} If `ringClass` is not a string. This returns a density rather than
 * reporting whether a class is known, so there is no miss for a nullish one to be.
 * @example
 * ```ts
 * import { ringParticleDensity } from '@elite-dangerous-almanac/core/astro/body-rings';
 *
 * ringParticleDensity('eRingClass_Rocky'); // -> 3000
 * ringParticleDensity('eRingClass_Metalic'); // -> 4500
 * ringParticleDensity('eRingClass_Something_New'); // -> 1000
 * ```
 */
export function ringParticleDensity(ringClass: string): number {
    const token = requireString(ringClass, 'ringParticleDensity: ringClass').toLowerCase();
    if (token.includes('metal')) return METALLIC_PARTICLE_DENSITY;
    if (token.includes('rock')) return ROCKY_PARTICLE_DENSITY;
    return ICY_PARTICLE_DENSITY;
}

/**
 * How thinly a ring's mass is spread over the annulus it occupies, in **megatonnes per
 * square kilometre**.
 *
 * @remarks
 * `MassMT / π(r_outer² − r_inner²)`, with the radii converted to kilometres.
 *
 * **The unit is the journal's, deliberately.** Frontier's `MassMT` is not the SI megatonne
 * of 10⁹ kg: the Canonn physics that calibrated the threshold below treats it as 10¹² kg,
 * a teragram, because that is what makes ring densities and Roche limits agree with what
 * the game shows. That is an interpretation of an undocumented field rather than a
 * published fact, so this reports the ratio in the units the scan supplied and leaves the
 * conversion to a caller who wants one.
 *
 * @param ring - The ring. Needs {@link BodyRing.MassMT | MassMT},
 * {@link BodyRing.InnerRad | InnerRad} and {@link BodyRing.OuterRad | OuterRad}.
 * @returns Surface density in Mt/km², or `null` when a radius is missing or the outer
 * radius does not exceed the inner one, leaving no area to spread the mass over.
 * @throws {TypeError} If `ring` is not an object.
 * @example
 * ```ts
 * import { ringSurfaceDensity } from '@elite-dangerous-almanac/core/astro/body-rings';
 *
 * // 1e13 Mt spread between 1e8 m and 2e8 m: an annulus of 3π × 10⁴ km².
 * const ring = { Name: 'A Ring', RingClass: 'eRingClass_Icy', MassMT: 1e13, InnerRad: 1e8, OuterRad: 2e8 };
 * ringSurfaceDensity(ring); // -> 106.1…
 * ```
 */
export function ringSurfaceDensity(ring: BodyRing): number | null {
    requireObject(ring, 'ringSurfaceDensity: ring');
    const innerM = positiveQuantity(ring.InnerRad);
    const outerM = positiveQuantity(ring.OuterRad);
    const massMt = positiveQuantity(ring.MassMT);
    if (innerM === null || outerM === null || massMt === null) return null;
    if (outerM <= innerM) return null;

    const innerKm = innerM / 1000;
    const outerKm = outerM / 1000;
    return massMt / (Math.PI * (outerKm * outerKm - innerKm * innerKm));
}

/**
 * Whether the game leaves a ring undrawn — present in the scan, invisible in the sky.
 *
 * @remarks
 * A ring both very wide and very diffuse has nothing to catch the light, and the game
 * renders nothing where the scan says a ring is. The test is Canonn's, and it is an
 * observational heuristic rather than a rule read out of the game: wider than
 * {@link VISIBLE_RING_MAX_WIDTH} **and** thinner than
 * {@link VISIBLE_RING_MIN_SURFACE_DENSITY}. Either one alone still draws.
 *
 * @param ring - The ring. Needs the fields {@link ringSurfaceDensity} needs.
 * @returns `true` when the ring meets both conditions. A ring whose density cannot be
 * computed is reported as visible, because there is no evidence it is not.
 * @throws {TypeError} If `ring` is not an object.
 * @example
 * ```ts
 * import { isInvisibleRing } from '@elite-dangerous-almanac/core/astro/body-rings';
 *
 * // Two million km wide and next to no mass in it.
 * const faint = { Name: 'A Ring', RingClass: 'eRingClass_Icy', MassMT: 1e6, InnerRad: 1e9, OuterRad: 3e9 };
 * isInvisibleRing(faint); // -> true
 *
 * // The same mass packed into a narrow ring is drawn.
 * const narrow = { Name: 'A Ring', RingClass: 'eRingClass_Icy', MassMT: 1e6, InnerRad: 1e9, OuterRad: 1.1e9 };
 * isInvisibleRing(narrow); // -> false
 * ```
 */
export function isInvisibleRing(ring: BodyRing): boolean {
    requireObject(ring, 'isInvisibleRing: ring');
    const surfaceDensity = ringSurfaceDensity(ring);
    if (surfaceDensity === null) return false;
    // Both radii are usable whenever a density came back, so the width is meaningful here.
    const width = ring.OuterRad - ring.InnerRad;
    return width > VISIBLE_RING_MAX_WIDTH && surfaceDensity < VISIBLE_RING_MIN_SURFACE_DENSITY;
}

/**
 * The period a ring turns in and the speed of each of its edges.
 *
 * @remarks
 * **The game turns a ring as one rigid sheet.** A real ring shears — every particle on its
 * own Kepler orbit, the inner edge fastest. Elite Dangerous gives the whole ring a single
 * period instead, so the outer edge is the fast one, which is the opposite of the physical
 * answer and the reason this cannot be computed edge by edge.
 *
 * That single period is recovered by applying Kepler's third law at a *nominal radius*
 * some way across the ring:
 *
 * ```text
 * nominal = inner + (outer − inner) × 3/8
 * T = 2π √(nominal³ / GM)
 * ```
 *
 * The `3/8` is a fitted constant, not a derivation — the Canonn Research Group arrived at
 * it from in-game measurements, having also weighed `1/e` (≈ 0.368) and `1/φ²` (≈ 0.382),
 * which it sits between. Two things bound how exact the result can be: the journal writes
 * ring radii to four significant figures, and the fit is still being refined against new
 * observations. Treat the figures as close, not exact.
 *
 * @param ring - The ring. Needs {@link BodyRing.InnerRad | InnerRad} and
 * {@link BodyRing.OuterRad | OuterRad}, in metres.
 * @param primary - The body the ring goes round. Needs a mass — see `bodyMass` in
 * `./body-physics`.
 * @returns The period in seconds, the nominal radius in metres and both edge speeds in
 * m/s, or `null` when a radius or the primary's mass is missing, or the outer radius does
 * not exceed the inner one.
 * @throws {TypeError} If either argument is not an object.
 * @example
 * ```ts
 * import { ringDynamics } from '@elite-dangerous-almanac/core/astro/body-rings';
 *
 * const ring = { Name: 'A Ring', RingClass: 'eRingClass_Icy', MassMT: 1e13, InnerRad: 1e8, OuterRad: 2e8 };
 * const dynamics = ringDynamics(ring, { MassEM: 300 });
 *
 * dynamics?.orbitalPeriod; // -> 29296.1…
 *
 * // The outer edge outruns the inner one: rigid rotation, not Keplerian shear.
 * (dynamics?.outerVelocity ?? 0) > (dynamics?.innerVelocity ?? 0); // -> true
 * ```
 */
export function ringDynamics(ring: BodyRing, primary: BodyProperties): RingDynamics | null {
    requireObject(ring, 'ringDynamics: ring');
    const inner = positiveQuantity(ring.InnerRad);
    const outer = positiveQuantity(ring.OuterRad);
    const primaryMassKg = bodyMass(primary);
    if (inner === null || outer === null || primaryMassKg === null) return null;
    if (outer <= inner) return null;

    const nominalRadius = inner + (outer - inner) * RING_NOMINAL_RADIUS_FRACTION;
    const orbitalPeriod =
        2 * Math.PI * Math.sqrt(nominalRadius ** 3 / (GRAVITATIONAL_CONSTANT * primaryMassKg));
    return {
        orbitalPeriod,
        nominalRadius,
        innerVelocity: (2 * Math.PI * inner) / orbitalPeriod,
        outerVelocity: (2 * Math.PI * outer) / orbitalPeriod,
    };
}

/**
 * Roche limits around a body for material of the kind its ring is made of.
 *
 * @remarks
 * Ring material inside the Roche limit could never have accreted into a moon, which is the
 * usual account of why the ring is there at all. A ring sitting outside it wants a
 * different explanation.
 *
 * The particle density is assumed from the ring's class ({@link ringParticleDensity})
 * rather than measured, so the limits move with that assumption; the fluid limit is the
 * one to compare a diffuse ring against.
 *
 * @param ring - The ring. Needs {@link BodyRing.RingClass | RingClass}.
 * @param primary - The body it goes round. Needs a mass and a
 * {@link BodyProperties.Radius | Radius}.
 * @returns Both limits in metres from the primary's centre, or `null` when the primary's
 * density cannot be computed.
 * @throws {TypeError} If either argument is not an object, or the ring carries no
 * `RingClass` string.
 * @example
 * ```ts
 * import { ringRocheLimits } from '@elite-dangerous-almanac/core/astro/body-rings';
 *
 * const ring = { Name: 'A Ring', RingClass: 'eRingClass_Icy', MassMT: 1e13, InnerRad: 1e8, OuterRad: 2e8 };
 * ringRocheLimits(ring, { MassEM: 1, Radius: 6_371_000 })?.fluid; // -> 27642167.3…
 * ```
 */
export function ringRocheLimits(ring: BodyRing, primary: BodyProperties): RocheLimits | null {
    requireObject(ring, 'ringRocheLimits: ring');
    return rocheLimitsForDensity(primary, ringParticleDensity(ring.RingClass));
}
