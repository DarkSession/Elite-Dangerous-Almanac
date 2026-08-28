/**
 * What a scanned star's own numbers imply: how long it should live, how bright it really
 * is, how small it would have to be to become a black hole, what kind of pulsar it is, and
 * when its mass says it should not exist at all.
 *
 * Every function takes {@link BodyProperties} — a journal `Scan` line as it comes, or any
 * record carrying the same fields — and reads the star's own fields only. Masses are solar
 * masses, radii metres, periods seconds, ages millions of years: the journal's units
 * throughout. The type itself is exported from `../astro`, alongside `BodyScanEvent`.
 *
 * **These are order-of-magnitude astrophysics, and the game is procedural.** A relation
 * like the main-sequence lifetime is a textbook scaling, not a measurement, and Elite
 * Dangerous generates stars that sometimes sit outside what the relation allows. That is
 * the point of {@link assessMassStability}: it names an implausibility, never a fact about
 * a real star.
 *
 * The maths is ported from the Canonn Research Group's
 * [canonn-signals](https://github.com/canonn-science/canonn-signals); see
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @example
 * ```ts
 * import { mainSequenceLifetime } from '@elite-dangerous-almanac/core/astro/star-physics';
 *
 * // The Sun: about ten billion years on the main sequence.
 * mainSequenceLifetime({ StellarMass: 1 }); // -> 10000
 *
 * // Twice the mass burns through it more than five times faster.
 * mainSequenceLifetime({ StellarMass: 2 }); // -> 1767.7…
 * ```
 *
 * @packageDocumentation
 */

import type { BodyProperties } from './body-scan.js';
import { bodyMass, GRAVITATIONAL_CONSTANT } from './body-physics.js';
import { finiteQuantity, positiveQuantity } from './internal/body-quantities.js';
import { requireObject } from '../internal/argument-guards.js';

/** Speed of light in vacuum, in m/s. */
export const SPEED_OF_LIGHT = 299_792_458;

/** Metres in one nominal solar radius, for the magnitude relation below. */
export const SOLAR_RADIUS = 695_700_000;

/** The Sun's effective temperature, in kelvin. */
const SOLAR_EFFECTIVE_TEMPERATURE = 5772;

/** The Sun's absolute bolometric magnitude. */
const SOLAR_ABSOLUTE_BOLOMETRIC_MAGNITUDE = 4.74;

/** The Sun's main-sequence lifetime, in millions of years, as the scaling below anchors it. */
const SOLAR_MAIN_SEQUENCE_LIFETIME_MY = 10_000;

/**
 * The Chandrasekhar limit, in solar masses — the most mass electron degeneracy pressure
 * can hold up, and so the heaviest a white dwarf can be.
 */
export const CHANDRASEKHAR_LIMIT_SOLAR_MASSES = 1.44;

/**
 * The Tolman–Oppenheimer–Volkoff limit, in solar masses — the theoretical ceiling on a
 * neutron star, as constrained by the GW170817 neutron-star merger.
 */
export const TOV_LIMIT_SOLAR_MASSES = 2.17;

/**
 * The mass, in solar masses, past which neutron stars become rare **in Elite Dangerous**.
 *
 * @remarks
 * A figure from the game's own generated galaxy rather than from astronomy, and not a
 * ceiling: the game does produce neutron stars above it. It is where the observed
 * population drops off sharply, so a star past it is unusual even by the game's standards.
 */
export const NEUTRON_STAR_MASS_DROP_OFF_SOLAR_MASSES = 2.51;

/**
 * Which mass threshold a star has passed: one of the two degeneracy-pressure ceilings, or
 * the mass past which the game rarely generates neutron stars.
 */
export type MassStabilityLimit =
    'chandrasekhar' | 'tolman-oppenheimer-volkoff' | 'neutron-star-mass-drop-off';

/** A star whose mass exceeds a limit its kind should not be able to exceed. */
export interface MassStabilityAssessment {
    /** The limit that was passed. */
    readonly limit: MassStabilityLimit;
    /** That limit's value, in solar masses. */
    readonly limitSolarMasses: number;
    /**
     * How far outside expectation the star is: `warning` for a neutron star past the
     * theoretical TOV limit but still in the mass range the game generates freely, `danger`
     * for a white dwarf past the Chandrasekhar limit, which should not be a white dwarf at
     * all, or a neutron star past the mass where the game's own population drops off.
     */
    readonly severity: 'warning' | 'danger';
}

/**
 * How a neutron star's spin classes it, in the scheme the Canonn tooling uses.
 *
 * @remarks
 * The bands are cut at 10 ms, 5 s, 30 s and 1 hour of rotation period. `anomalous-mass-`
 * marks a star above {@link TOV_LIMIT_SOLAR_MASSES}, and the two ultra-long-period bands
 * are split by absolute magnitude rather than mass: brighter than 10 reads as a magnetar.
 */
export type NeutronStarClass =
    | 'millisecond-pulsar'
    | 'hyper-massive-millisecond-pulsar'
    | 'standard-pulsar'
    | 'anomalous-mass-pulsar'
    | 'slow-period-pulsar'
    | 'anomalous-mass-slow-period-pulsar'
    | 'ultra-long-period-magnetar'
    | 'ultra-long-period-pulsar'
    | 'anomalous-slow-rotator';

/** Rotation period, in seconds, below which a neutron star is a millisecond pulsar. */
const MILLISECOND_PULSAR_PERIOD = 0.01;
/** Rotation period, in seconds, below which a neutron star is an ordinary pulsar. */
const STANDARD_PULSAR_PERIOD = 5;
/** Rotation period, in seconds, below which a neutron star is a slow-period pulsar. */
const SLOW_PERIOD_PULSAR_PERIOD = 30;
/** Rotation period, in seconds, above which a neutron star is barely rotating at all. */
const ULTRA_LONG_PERIOD_LIMIT = 3600;
/** Absolute magnitude below which an ultra-long-period neutron star reads as a magnetar. */
const MAGNETAR_MAX_ABSOLUTE_MAGNITUDE = 10;
/** Mass, in solar masses, above which a pulsar is classed as anomalously heavy. */
const ANOMALOUS_PULSAR_MASS = 2.1;

/**
 * How long a star of a given mass spends on the main sequence, in millions of years.
 *
 * @remarks
 * The standard scaling `t ≈ 10 Gyr · (M/M☉)^−2.5`, anchored so that the Sun reads 10 Gyr.
 * Mass is what sets a star's whole life: doubling it cuts the lifetime more than fivefold,
 * because the star burns its larger fuel supply very much faster.
 *
 * Compare it against {@link BodyProperties.Age_MY | Age_MY} to judge a generated star. An
 * ordinary star older than its own main-sequence lifetime should already have left it, and
 * a giant younger than one should not yet have arrived.
 *
 * @param body - The star. Needs {@link BodyProperties.StellarMass | StellarMass}.
 * @returns The lifetime in millions of years, or `null` when no usable stellar mass is
 * written — which is the case for every planet, and for a scan that resolved nothing.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { mainSequenceLifetime } from '@elite-dangerous-almanac/core/astro/star-physics';
 *
 * mainSequenceLifetime({ StellarMass: 1 }); // -> 10000
 *
 * // A heavy blue star lives a few million years.
 * mainSequenceLifetime({ StellarMass: 20 }); // -> 5.5…
 *
 * // A red dwarf outlives the universe many times over.
 * mainSequenceLifetime({ StellarMass: 0.2 }); // -> 559016.9…
 *
 * mainSequenceLifetime({ MassEM: 1 }); // -> null
 * ```
 */
export function mainSequenceLifetime(body: BodyProperties): number | null {
    requireObject(body, 'mainSequenceLifetime: body');
    const solarMasses = positiveQuantity(body.StellarMass);
    if (solarMasses === null) return null;
    return SOLAR_MAIN_SEQUENCE_LIFETIME_MY * Math.pow(solarMasses, -2.5);
}

/**
 * A star's absolute bolometric magnitude, worked out from how big and how hot it is.
 *
 * @remarks
 * Stefan–Boltzmann gives the luminosity — `L/L☉ = (R/R☉)² · (T/T☉)⁴` — and the magnitude
 * follows as `M☉ − 2.5 log₁₀(L/L☉)`.
 *
 * The reason to compute one when the scan usually reports
 * {@link BodyProperties.AbsoluteMagnitude | AbsoluteMagnitude} directly is that some stars
 * carry no magnitude at all: a white dwarf is written with a radius and a temperature and
 * nothing else to place it by. The two figures are not interchangeable — this is
 * bolometric, over all wavelengths, while a reported magnitude is closer to visual — so
 * expect them to differ by a magnitude or so on a very hot or very cool star, and use this
 * as the fallback rather than the correction.
 *
 * @param body - The star. Needs {@link BodyProperties.Radius | Radius} in metres and
 * {@link BodyProperties.SurfaceTemperature | SurfaceTemperature} in kelvin.
 * @returns The absolute bolometric magnitude — smaller is brighter, and a luminous star is
 * negative — or `null` when either field is missing.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { absoluteBolometricMagnitude } from '@elite-dangerous-almanac/core/astro/star-physics';
 *
 * // A star the size and temperature of the Sun is the Sun's magnitude.
 * absoluteBolometricMagnitude({ Radius: 695_700_000, SurfaceTemperature: 5772 }); // -> 4.74
 *
 * // An Earth-sized white dwarf at 15 000 K: faint despite being fiercely hot.
 * absoluteBolometricMagnitude({ Radius: 6_371_000, SurfaceTemperature: 15_000 }); // -> 10.78…
 * ```
 */
export function absoluteBolometricMagnitude(body: BodyProperties): number | null {
    requireObject(body, 'absoluteBolometricMagnitude: body');
    const radiusM = positiveQuantity(body.Radius);
    const temperatureK = positiveQuantity(body.SurfaceTemperature);
    if (radiusM === null || temperatureK === null) return null;

    const solarRadii = radiusM / SOLAR_RADIUS;
    const luminosity =
        solarRadii * solarRadii * Math.pow(temperatureK / SOLAR_EFFECTIVE_TEMPERATURE, 4);
    return SOLAR_ABSOLUTE_BOLOMETRIC_MAGNITUDE - 2.5 * Math.log10(luminosity);
}

/**
 * The Schwarzschild radius for a body's mass, in metres.
 *
 * @remarks
 * `r_s = 2GM/c²`. For a black hole this is the event horizon itself, and the game reports
 * no radius for one; for anything else it is how small that mass would have to be squeezed
 * to become one, which is what makes it worth comparing against a neutron star's actual
 * radius — the ratio is how close the star sits to collapse.
 *
 * @param body - The body. Needs a mass — see `bodyMass` in `./body-physics`. Stars are the
 * bodies this is asked about, but the relation is general and a planet's mass answers too.
 * @returns The radius in metres, or `null` when no usable mass is written.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { schwarzschildRadius } from '@elite-dangerous-almanac/core/astro/star-physics';
 *
 * // The Sun would have to fit inside about 3 km.
 * schwarzschildRadius({ StellarMass: 1 }); // -> 2954.1…
 *
 * // A neutron star of two solar masses sits a few times outside its own horizon.
 * schwarzschildRadius({ StellarMass: 2 }); // -> 5908.2…
 * ```
 */
export function schwarzschildRadius(body: BodyProperties): number | null {
    requireObject(body, 'schwarzschildRadius: body');
    const massKg = bodyMass(body);
    if (massKg === null) return null;
    return (2 * GRAVITATIONAL_CONSTANT * massKg) / SPEED_OF_LIGHT ** 2;
}

/**
 * Whether a degenerate star's mass exceeds what its kind can hold up.
 *
 * @remarks
 * A white dwarf is supported by electron degeneracy pressure and a neutron star by neutron
 * degeneracy pressure, and each gives out at a mass: past the Chandrasekhar limit a white
 * dwarf should collapse or detonate, past the TOV limit a neutron star should become a
 * black hole. Elite Dangerous generates stars that sometimes sit beyond both, and this is
 * what says so.
 *
 * The kind is read from {@link BodyProperties.StarType | StarType}, which the journal
 * writes as `"N"` for a neutron star and `"D"`-prefixed for the white-dwarf classes
 * (`"D"`, `"DA"`, `"DAB"`, …). Black holes are outside this: `"H"` has already collapsed,
 * so no ceiling is left for it to breach.
 *
 * @param body - The star. Needs {@link BodyProperties.StarType | StarType} and
 * {@link BodyProperties.StellarMass | StellarMass}.
 * @returns The limit passed and how far outside expectation that puts the star, or `null`
 * when the star is within its limits, is not a degenerate object, or carries no mass.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { assessMassStability } from '@elite-dangerous-almanac/core/astro/star-physics';
 *
 * // An ordinary neutron star is unremarkable.
 * assessMassStability({ StarType: 'N', StellarMass: 1.8 }); // -> null
 *
 * // Past the theoretical ceiling, but in the range the game generates freely.
 * assessMassStability({ StarType: 'N', StellarMass: 2.3 })?.severity; // -> 'warning'
 *
 * // A white dwarf this heavy should not be a white dwarf.
 * assessMassStability({ StarType: 'DA', StellarMass: 1.6 })?.limit; // -> 'chandrasekhar'
 * ```
 */
export function assessMassStability(body: BodyProperties): MassStabilityAssessment | null {
    requireObject(body, 'assessMassStability: body');
    const solarMasses = positiveQuantity(body.StellarMass);
    const starType = body.StarType;
    if (solarMasses === null || typeof starType !== 'string') return null;

    // "H" is a black hole and "N" a neutron star; every other "D…" is a white-dwarf class.
    if (starType.startsWith('D') && solarMasses > CHANDRASEKHAR_LIMIT_SOLAR_MASSES) {
        return {
            limit: 'chandrasekhar',
            limitSolarMasses: CHANDRASEKHAR_LIMIT_SOLAR_MASSES,
            severity: 'danger',
        };
    }
    if (starType === 'N') {
        if (solarMasses > NEUTRON_STAR_MASS_DROP_OFF_SOLAR_MASSES) {
            return {
                limit: 'neutron-star-mass-drop-off',
                limitSolarMasses: NEUTRON_STAR_MASS_DROP_OFF_SOLAR_MASSES,
                severity: 'danger',
            };
        }
        if (solarMasses > TOV_LIMIT_SOLAR_MASSES) {
            return {
                limit: 'tolman-oppenheimer-volkoff',
                limitSolarMasses: TOV_LIMIT_SOLAR_MASSES,
                severity: 'warning',
            };
        }
    }
    return null;
}

/**
 * What kind of pulsar a neutron star's spin makes it.
 *
 * @remarks
 * A neutron star is classed by how fast it turns, from a millisecond pulsar whipping round
 * a hundred times a second to a slow rotator barely turning at all. Rotation is a
 * magnitude here: the journal writes retrograde rotation as a negative
 * {@link BodyProperties.RotationPeriod | RotationPeriod}, and which way a pulsar spins does
 * not change what it is.
 *
 * The scheme is Canonn's, not astronomy's — it exists to give the game's generated neutron
 * stars useful names, and the `anomalous-mass-` bands mark stars the game produced above
 * the theoretical mass ceiling.
 *
 * @param body - The star. Needs {@link BodyProperties.StellarMass | StellarMass},
 * {@link BodyProperties.RotationPeriod | RotationPeriod} and
 * {@link BodyProperties.AbsoluteMagnitude | AbsoluteMagnitude} — the magnitude only to
 * separate a magnetar from a pulsar at the slow end, but it is required throughout so the
 * answer never depends on which band the star happened to land in.
 * @returns The class, or `null` when any of the three is missing. This does not check
 * {@link BodyProperties.StarType | StarType}: hand it a neutron star, since the bands mean
 * nothing for anything else.
 * @throws {TypeError} If `body` is not an object.
 * @example
 * ```ts
 * import { classifyNeutronStar } from '@elite-dangerous-almanac/core/astro/star-physics';
 *
 * // Twenty turns a second.
 * classifyNeutronStar({ StellarMass: 1.5, RotationPeriod: 0.05, AbsoluteMagnitude: 12 });
 * // -> 'standard-pulsar'
 *
 * // The same spin, but heavier than the TOV limit allows.
 * classifyNeutronStar({ StellarMass: 2.4, RotationPeriod: 0.05, AbsoluteMagnitude: 12 });
 * // -> 'anomalous-mass-pulsar'
 *
 * // Half an hour per turn, and bright with it.
 * classifyNeutronStar({ StellarMass: 1.5, RotationPeriod: 1800, AbsoluteMagnitude: 8 });
 * // -> 'ultra-long-period-magnetar'
 * ```
 */
export function classifyNeutronStar(body: BodyProperties): NeutronStarClass | null {
    requireObject(body, 'classifyNeutronStar: body');
    const solarMasses = positiveQuantity(body.StellarMass);
    const rotationPeriod = finiteQuantity(body.RotationPeriod);
    const absoluteMagnitude = finiteQuantity(body.AbsoluteMagnitude);
    if (solarMasses === null || rotationPeriod === null || absoluteMagnitude === null) return null;

    const period = Math.abs(rotationPeriod);
    const heavy = solarMasses > ANOMALOUS_PULSAR_MASS;

    if (period < MILLISECOND_PULSAR_PERIOD) {
        return heavy ? 'hyper-massive-millisecond-pulsar' : 'millisecond-pulsar';
    }
    if (period < STANDARD_PULSAR_PERIOD) {
        return heavy ? 'anomalous-mass-pulsar' : 'standard-pulsar';
    }
    if (period < SLOW_PERIOD_PULSAR_PERIOD) {
        return heavy ? 'anomalous-mass-slow-period-pulsar' : 'slow-period-pulsar';
    }
    if (period < ULTRA_LONG_PERIOD_LIMIT) {
        return absoluteMagnitude < MAGNETAR_MAX_ABSOLUTE_MAGNITUDE
            ? 'ultra-long-period-magnetar'
            : 'ultra-long-period-pulsar';
    }
    return 'anomalous-slow-rotator';
}
