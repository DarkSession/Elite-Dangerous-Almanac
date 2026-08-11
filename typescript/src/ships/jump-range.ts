/**
 * Frame-shift-drive **jump-range and fuel** calculations — the data-free core of
 * the ship-build maths.
 *
 * These are the pure functions; they take the drive's constants and the ship's
 * mass and hand back light-years and tonnes. {@link ShipLoadout} (`./ship-loadout`)
 * is the convenient front end that pulls the constants out of a SLEF build for you.
 *
 * The model is the community-standard one used by EDSY and Coriolis, itself derived
 * from Frontier's "mass effect on hyperspace range" description
 * (<https://forums.frontier.co.uk/threads/510879/>). The port is validated against
 * EDSY: for the sample "Deep Black" build these functions reproduce EDSY's exported
 * `MaxJumpRange` of 89.414678 LY.
 *
 * @remarks
 * Reference implementation: EDSY by taleden (CC BY-NC 4.0),
 * <https://github.com/taleden/EDSY> — the algorithm is ported as fact, not code.
 *
 * @packageDocumentation
 */

/**
 * The frame shift drive constants a jump calculation needs — all post-engineering.
 *
 * @remarks
 * `optMass` and `maxFuel` are what engineering changes (Long Range raises `optMass`;
 * some effects change `maxFuel`); `fuelMul` and `fuelPower` are intrinsic to the
 * drive and never modified. Read these off the drive's module record from
 * `./modules-core` (and, for a Guardian FSD Booster's `jumpBoost`,
 * `./modules-internal`), whose records carry their stats.
 */
export interface FrameShiftDriveParams {
    /** Optimised mass, in tonnes — finite and positive. */
    readonly optMass: number;
    /** Maximum fuel drawn for a single jump, in tonnes — finite and non-negative. */
    readonly maxFuel: number;
    /** The drive's finite, positive rating (linear) fuel constant. */
    readonly fuelMul: number;
    /** The drive's finite, positive size (power) fuel constant. */
    readonly fuelPower: number;
    /**
     * Flat bonus added to every jump, in light-years, from a Guardian FSD Booster.
     * Finite and non-negative. Defaults to `0` (no booster).
     */
    readonly jumpBoost?: number;
}

/** Maximum work accepted by {@link totalRange} in one call. */
const MAX_TOTAL_RANGE_JUMPS = 100_000;

/** Reject a quantity that cannot represent a physical non-negative input. */
function requireNonNegative(scope: string, name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${scope}: ${name} must be a finite non-negative number`);
    }
}

/** Reject a drive constant that would make the jump equation undefined. */
function requirePositive(scope: string, name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${scope}: fsd.${name} must be a finite positive number`);
    }
}

/** Validate the common drive-parameter contract. */
function validateFsd(scope: string, fsd: FrameShiftDriveParams): void {
    requirePositive(scope, 'optMass', fsd.optMass);
    requireNonNegative(scope, 'fsd.maxFuel', fsd.maxFuel);
    requirePositive(scope, 'fuelMul', fsd.fuelMul);
    requirePositive(scope, 'fuelPower', fsd.fuelPower);
    if (fsd.jumpBoost !== undefined) {
        requireNonNegative(scope, 'fsd.jumpBoost', fsd.jumpBoost);
    }
}

/** The jump equation after its public caller has validated every input. */
function singleJumpRangeUnchecked(
    mass: number,
    fuel: number,
    fsd: FrameShiftDriveParams,
    scope: string,
): number {
    const burn = Math.min(fuel, fsd.maxFuel);
    if (burn <= 0 || mass + fuel <= 0) return 0;
    const base = Math.pow(burn / fsd.fuelMul, 1 / fsd.fuelPower) * (fsd.optMass / (mass + fuel));
    const range = base + (fsd.jumpBoost ?? 0);
    if (!Number.isFinite(range)) {
        throw new RangeError(`${scope}: parameters produce a non-finite range`);
    }
    return range;
}

/**
 * The range of a single jump, in light-years.
 *
 * @param mass - Total ship mass **excluding** the fuel being modelled, in tonnes
 * (hull + modules + cargo — i.e. unladen mass plus cargo).
 * @param fuel - Fuel in the tank for this jump, in tonnes. Only up to the drive's
 * `maxFuel` is burned, but the full amount still adds to the mass being moved.
 * @param fsd - The drive constants.
 * @returns The jump distance in light-years, including any `jumpBoost`. `0` if the
 * drive cannot jump (`maxFuel` or `fuel` = 0).
 * @remarks
 * Lighter ships and larger `optMass` jump farther; carrying more fuel than one jump
 * needs only weighs you down, which is why {@link ShipLoadout.maxJumpRange} loads
 * exactly one jump's worth.
 * @throws {RangeError} If a quantity is negative or non-finite, or a required drive
 * constant is not positive.
 * @example
 * ```ts
 * import { singleJumpRange } from '@elite-dangerous-almanac/core/ships/jump-range';
 *
 * singleJumpRange(1237.3, 6.8, { optMass: 7528.04, maxFuel: 6.8, fuelMul: 0.011,
 *   fuelPower: 2.5025, jumpBoost: 10.5 }); // -> 89.414678
 * ```
 */
export function singleJumpRange(mass: number, fuel: number, fsd: FrameShiftDriveParams): number {
    const scope = 'singleJumpRange';
    requireNonNegative(scope, 'mass', mass);
    requireNonNegative(scope, 'fuel', fuel);
    validateFsd(scope, fsd);
    return singleJumpRangeUnchecked(mass, fuel, fsd, scope);
}

/**
 * The fuel a single jump of a given distance costs, in tonnes.
 *
 * @param distance - The jump distance, in light-years. Distances beyond the current
 * {@link singleJumpRange} cost more than the tank holds — the result is capped at
 * the drive's `maxFuel`.
 * @param mass - Total ship mass excluding fuel, in tonnes (see
 * {@link singleJumpRange}).
 * @param fuel - Fuel in the tank, in tonnes — sets the mass moved and caps the burn.
 * @param fsd - The drive constants.
 * @returns Fuel used, in tonnes, in `[0, min(fuel, maxFuel)]`.
 * @remarks
 * This is EDSY's model: the cost scales as `(distance / maxRange)^fuelPower` of the
 * tank's per-jump fuel, where `maxRange` is {@link singleJumpRange} for the same
 * mass and fuel. It round-trips at the maximum jump —
 * `fuelPerJump(singleJumpRange(m, f), m, f)` returns `min(f, maxFuel)` — and, with no
 * Guardian FSD Booster, is the exact inverse of {@link singleJumpRange} at every
 * distance. With a booster fitted, the booster's flat `jumpBoost` is treated
 * proportionally (as EDSY does) rather than subtracted, so interior distances are a
 * close approximation rather than the exact inverse. It matches the fuel figures
 * EDSY reports.
 * @throws {RangeError} If a quantity is negative or non-finite, or a required drive
 * constant is not positive.
 */
export function fuelPerJump(
    distance: number,
    mass: number,
    fuel: number,
    fsd: FrameShiftDriveParams,
): number {
    const scope = 'fuelPerJump';
    requireNonNegative(scope, 'distance', distance);
    requireNonNegative(scope, 'mass', mass);
    requireNonNegative(scope, 'fuel', fuel);
    validateFsd(scope, fsd);
    if (distance <= 0) return 0;
    const burn = Math.min(fuel, fsd.maxFuel);
    const maxDistance = singleJumpRangeUnchecked(mass, fuel, fsd, scope);
    if (maxDistance <= 0) return 0;
    const cost = Math.pow(distance / maxDistance, fsd.fuelPower) * burn;
    return Math.min(cost, burn);
}

/**
 * The total multi-jump range on a full tank, in light-years.
 *
 * @param mass - Total ship mass excluding fuel, in tonnes (unladen mass plus cargo).
 * @param fuel - Fuel available to spend, in tonnes — normally the main tank's
 * capacity.
 * @param fsd - The drive constants.
 * @returns The sum of successive jumps as the tank drains, in light-years.
 * @remarks
 * Each jump burns up to `maxFuel`; the sum runs until the tank is empty. `mass`
 * (hull + modules + cargo) stays fixed, while the decreasing `remaining` fuel is
 * included by {@link singleJumpRange}, so the ship becomes lighter after each jump.
 * At most 100,000 jumps are evaluated; larger workloads throw instead of returning a
 * silently truncated range.
 * @throws {RangeError} If a quantity is negative or non-finite, a required drive
 * constant is not positive, or the tank would require more than 100,000 jumps.
 */
export function totalRange(mass: number, fuel: number, fsd: FrameShiftDriveParams): number {
    const scope = 'totalRange';
    requireNonNegative(scope, 'mass', mass);
    requireNonNegative(scope, 'fuel', fuel);
    validateFsd(scope, fsd);
    if (fsd.maxFuel <= 0) return 0;
    const jumps = fuel > 0 ? Math.max(1, Math.ceil(fuel / fsd.maxFuel)) : 0;
    if (!Number.isFinite(jumps) || jumps > MAX_TOTAL_RANGE_JUMPS) {
        throw new RangeError(
            `${scope}: fuel and fsd.maxFuel require more than ${MAX_TOTAL_RANGE_JUMPS} jumps`,
        );
    }
    let range = 0;
    let remaining = fuel;
    for (let i = 0; i < jumps; i++) {
        range += singleJumpRangeUnchecked(mass, remaining, fsd, scope);
        if (!Number.isFinite(range)) {
            throw new RangeError(`${scope}: parameters produce a non-finite total range`);
        }
        remaining = Math.max(0, remaining - fsd.maxFuel);
    }
    return range;
}
