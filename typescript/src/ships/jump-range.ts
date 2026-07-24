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
 * `./modules-standard` (and, for a Guardian FSD Booster's `jumpBoost`,
 * `./modules-internal`), whose records now carry their stats.
 */
export interface FrameShiftDriveParams {
    /** Optimised mass, in tonnes — the mass at which the drive performs to spec. */
    readonly optMass: number;
    /** Maximum fuel drawn for a single jump, in tonnes. */
    readonly maxFuel: number;
    /** The drive's rating (linear) fuel constant. */
    readonly fuelMul: number;
    /** The drive's size (power) fuel constant. */
    readonly fuelPower: number;
    /**
     * Flat bonus added to every jump, in light-years, from a Guardian FSD Booster.
     * Defaults to `0` (no booster).
     */
    readonly jumpBoost?: number;
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
 * drive cannot jump (`maxFuel` or `fuel` ≤ 0).
 * @remarks
 * Lighter ships and larger `optMass` jump farther; carrying more fuel than one jump
 * needs only weighs you down, which is why {@link ShipLoadout.maxJumpRange} loads
 * exactly one jump's worth.
 * @example
 * ```ts
 * singleJumpRange(1237.3, 6.8, { optMass: 7528.04, maxFuel: 6.8, fuelMul: 0.011,
 *   fuelPower: 2.5025, jumpBoost: 10.5 }); // -> 89.414678
 * ```
 */
export function singleJumpRange(mass: number, fuel: number, fsd: FrameShiftDriveParams): number {
    const burn = Math.min(fuel, fsd.maxFuel);
    if (burn <= 0 || mass + fuel <= 0) return 0;
    const base = Math.pow(burn / fsd.fuelMul, 1 / fsd.fuelPower) * (fsd.optMass / (mass + fuel));
    return base + (fsd.jumpBoost ?? 0);
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
 */
export function fuelPerJump(
    distance: number,
    mass: number,
    fuel: number,
    fsd: FrameShiftDriveParams,
): number {
    if (distance <= 0) return 0;
    const burn = Math.min(fuel, fsd.maxFuel);
    const maxDistance = singleJumpRange(mass, fuel, fsd);
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
 */
export function totalRange(mass: number, fuel: number, fsd: FrameShiftDriveParams): number {
    if (fsd.maxFuel <= 0) return 0;
    let range = 0;
    let remaining = fuel;
    // Guard against a pathological maxFuel producing a huge loop.
    for (let i = 0; remaining > 1e-6 && i < 100000; i++) {
        range += singleJumpRange(mass, remaining, fsd);
        remaining -= fsd.maxFuel;
    }
    return range;
}
