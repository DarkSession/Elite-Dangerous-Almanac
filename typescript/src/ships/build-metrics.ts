/**
 * {@link BuildMetrics} — everything a fitted build can be **asked**, over a
 * {@link ships!ShipLoadout | ShipLoadout} that does the fitting.
 *
 * `ShipLoadout` constructs, inspects and edits a fit. This entry point is the other
 * half: jump range, mass, cost, power, heat, mobility, shields, armour and firepower.
 * They are split so an outfitting editor can import the editing surface without pulling
 * in the analysis surface, and a build viewer can import the analysis without the
 * editors.
 *
 * A view holds the build itself, not a snapshot of it. `ShipLoadout` is mutable, so a
 * view made once keeps answering for the build as it stands — fit a module and ask
 * again.
 *
 * @remarks
 * Every calculation here is also available data-free: `./jump-range`, `./power`,
 * `./heat`, `./mobility`, `./shields`, `./shield-recovery`, `./armour`, `./weapons`,
 * `./weapons-capacitor` and `./distributor` each take a plain input object and import no
 * catalogue. This class is the convenience that reads those inputs off a build.
 *
 * **Unavailable metrics come in pairs.** Six metrics depend on build state that may not
 * be there — no module fitted, a record that does not state a number, a switch turned
 * off, a priority group the plant sheds. Each is offered twice: a nullable method that
 * is the convenience, and a `…Result` companion carrying the same value plus the reason
 * it is unavailable. `standardLoad` / `standardLoadResult` is the same pair for a load
 * condition the fitted drive may not support.
 *
 * @example
 * ```ts
 * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));
 * metrics.powerBudget().withinBudget; // -> true
 * metrics.armourMetrics().hitPoints; // -> 945
 * ```
 *
 * @packageDocumentation
 */

import {
    frameShiftDriveMassFactor,
    singleJumpRange,
    fuelPerJump,
    totalRange,
    type FrameShiftDriveParams,
    type TotalRangeDetails,
} from './jump-range.js';
import { getBlueprintCost } from './blueprint-costs.js';
import { getExperimentalEffectCost } from './experimental-effect-costs.js';
import { sumMaterials, type EngineeringMaterial } from './engineering.js';
import { identifyPreEngineeredVariant } from './pre-engineered-stats.js';
import type { ProjectileRangeBoundaries } from './modules.js';
import {
    isBuiltInHullModule,
    isNonOutfittingSlot,
    orderBySlotLayout,
} from './internal/loadout-state.js';
import {
    armourInputFor,
    cellBankInputsFor,
    distributorInputResultFor,
    fittedThrusterParamsFor,
    heatInputResultFor,
    mobilityInputResultFor,
    powerAvailable,
    powerConsumerFor,
    shieldInputResultFor,
    shieldRecoveryInputResultFor,
    weaponsCapacitorInputFor,
    weaponStatsFor,
} from './internal/loadout-metrics.js';
import { loadoutInternals, type LoadoutInternals } from './internal/loadout-internals.js';
import { completeResult, incompleteResult } from './internal/calculation-result.js';
import { powerBudget, type PowerBudget, type PowerConsumer } from './power.js';
import { heatMetrics, type HeatMetrics } from './heat.js';
import { shieldMetrics, type ShieldMetrics } from './shields.js';
import { armourMetrics, type ArmourMetrics } from './armour.js';
import {
    sumWeaponMetrics,
    weaponMetrics,
    type WeaponMetrics,
    type WeaponTotals,
} from './weapons.js';
import { ammunitionCapacity, type AmmunitionCapacity } from './ammunition.js';
import { weaponsCapacitorMetrics, type WeaponsCapacitorMetrics } from './weapons-capacitor.js';
import { distributorMetrics, type DistributorMetrics } from './distributor.js';
import { mobilityMetrics, type MobilityMetrics, type ThrusterParams } from './mobility.js';
import {
    cellBankSummary,
    shieldRecovery,
    type CellBankSummary,
    type ShieldRecovery,
} from './shield-recovery.js';
import {
    calculateUnladenMass,
    type CalculationIssue,
    type CalculationResult,
} from './loadout-calculations.js';
import type { ShipLoadout } from './ship-loadout.js';
import { deepFreeze } from '../internal/deep-freeze.js';

/**
 * The public name every diagnostic from this module wears.
 *
 * @remarks
 * The error facade rule is that a message names the function the consumer called, so
 * each guard is told the method name it is guarding for. Written once here so the two
 * halves of a metric pair cannot drift into two spellings of one option's rule.
 */
const FACADE = 'BuildMetrics';

/** Optional mass overrides for a single calculation. */
export interface JumpOptions {
    /** Finite non-negative fuel load, in tonnes. Defaults to the full main tank. */
    readonly fuel?: number;
    /** Finite non-negative cargo load, in tonnes. Defaults to `0` (unladen). */
    readonly cargo?: number;
}

/**
 * Optional SYS allocation for {@link BuildMetrics.shieldMetrics}.
 *
 * @remarks
 * Its own type, rather than one shared with {@link ShieldRecoveryOptions}, because the
 * two defaults deliberately differ and a shared type could only document one of them.
 * Strength and resistances are quoted with **no** pips, which is what an outfitting
 * screen shows; recovery is quoted at **four**, which is what the game reports. Pass
 * `systemsPips` explicitly on both whenever the two figures appear side by side.
 */
export interface ShieldOptions {
    /**
     * Pips to the systems capacitor, `0`–`4`, folded into the shield resistances.
     * Defaults to `0` — the unpiped figure an outfitting screen shows.
     */
    readonly systemsPips?: number;
}

/**
 * Optional SYS allocation for {@link BuildMetrics.shieldRecovery}.
 *
 * @remarks
 * See {@link ShieldOptions} for why recovery has an options type of its own.
 */
export interface ShieldRecoveryOptions {
    /**
     * Pips to the systems capacitor, `0`–`4`, which feed the recovery. Defaults to `4`
     * — a full SYS capacitor, which is the condition the game quotes recovery at.
     */
    readonly systemsPips?: number;
}

/** Optional load and ENG allocation for {@link BuildMetrics.mobilityMetrics}. */
export interface MobilityOptions extends JumpOptions {
    /** Pips assigned to the engines capacitor, `0`–`4`. Defaults to `4`. */
    readonly enginesPips?: number;
}

/** A standard fuel-and-cargo condition shared by jump and mobility views. */
export type StandardLoad = 'maximum' | 'unladen' | 'laden';

/** What a {@link StandardLoad} carries, and what the ship weighs carrying it. */
export interface StandardLoadInputs {
    /** Main-tank fuel carried, in tonnes. */
    readonly fuel: number;
    /** Cargo carried, in tonnes. */
    readonly cargo: number;
    /**
     * What the ship weighs at this load, in tonnes:
     * {@link ships!ShipLoadout.unladenMass | unladenMass} plus `fuel` plus
     * `cargo`.
     *
     * @remarks
     * This is the mass the jump and mobility calculations run on, so it is the figure
     * to show beside them rather than one reassembled by the caller. The reserve tank
     * is **not** in it: the game's statistics panel counts the reserve in the current
     * mass it displays, and neither calculation here does — see
     * {@link BuildMetrics.mobilityMetrics}. Add
     * {@link ships!FuelCapacity.reserve | FuelCapacity.reserve} to
     * match the panel.
     *
     * The extra `fuel` and `cargo` are the load a screen labels; the mass is what they
     * add up to, and passing the whole value back into {@link BuildMetrics.jumpRange} or
     * {@link BuildMetrics.mobilityMetrics} is unaffected by its presence.
     */
    readonly mass: number;
}

/** Optional WEP allocation for {@link BuildMetrics.weaponsCapacitorMetrics}. */
export interface WeaponsOptions {
    /** Pips assigned to the weapons capacitor, `0`–`4`. Defaults to `4`. */
    readonly weaponsPips?: number;
}

/** Optional SYS, ENG and WEP allocations for {@link BuildMetrics.distributorMetrics}. */
export interface DistributorOptions {
    /** Pips assigned to the systems capacitor, `0`–`4`. Defaults to `4`. */
    readonly systemsPips?: number;
    /** Pips assigned to the engines capacitor, `0`–`4`. Defaults to `4`. */
    readonly enginesPips?: number;
    /** Pips assigned to the weapons capacitor, `0`–`4`. Defaults to `4`. */
    readonly weaponsPips?: number;
}

/** Retail catalogue credits for an assembled build, as {@link BuildMetrics.buildCost} prices it. */
export interface BuildCredits {
    /**
     * Priced hull and modules together, in credits.
     *
     * A Mercenary article is bought with Merc Coin and has no credit price at all, but it
     * is counted here at the catalogue list price of the stock module it is built on, and
     * again in {@link BuildCost.mercCoins} at what it actually cost. Subtract the stock
     * module's price to quote credits a shop would really ask.
     */
    readonly total: number;
    /** Bare hull list price in credits. */
    readonly hull: number;
    /** Sum of every priced fitted module, in credits. A lower bound when `unpriced` is non-empty. */
    readonly modules: number;
    /**
     * Five percent of `total`, truncated to credits: what insurance bills to rebuild the
     * fit at catalogue prices. For what a capture said its own rebuy was, read
     * {@link ships!ShipLoadout.rebuy | ShipLoadout.rebuy}.
     */
    readonly rebuy: number;
    /** Fitted modules that could not be priced from the catalogue. */
    readonly unpriced: readonly { readonly slot: string; readonly symbol: string }[];
}

/**
 * What an assembled build costs to own, in all three currencies the game charges for it.
 *
 * Every figure prices the **current fit** from the catalogues rather than reporting what a
 * capture said was paid; for the latter read
 * {@link ships!ShipLoadout.sourcePurchase | ShipLoadout.sourcePurchase}.
 */
export interface BuildCost {
    /** Shop credits for the hull and its fitted modules. */
    readonly credits: BuildCredits;
    /**
     * Merc Coin billed by the build: every Mercenary article's shop price plus every
     * blueprint's currency cost, including ordinary engineering-menu recipes that charge it.
     * A Mercenary article's blueprint is charged only above the grade it was sold at.
     */
    readonly mercCoins: number;
    /**
     * What the build's blueprints and experimental effects consume, one entry per distinct
     * material, counts summed across modules.
     *
     * Pre-engineered articles arrive engineered, so only what a player still has to roll on
     * top of one is charged. A fixed reward carries no craft recipe at all and contributes
     * nothing, and so does a modification whose recipe the catalogues do not price — a
     * capture may name a blueprint or effect no registry lists, and an unpriceable
     * modification is silently absent rather than reported the way
     * {@link BuildCredits.unpriced} reports an unpriceable module.
     */
    readonly materials: readonly EngineeringMaterial[];
}

/**
 * What an assembled build weighs, broken down the way {@link BuildMetrics.buildMass}
 * weighs it. Every figure is in tonnes.
 *
 * @remarks
 * The mass counterpart of {@link BuildCredits}, and the same split: what the bare hull
 * contributes, what the fit adds, and the total. `fuel` and `cargo` are the chosen load
 * on top of that, so `total` is the mass the jump and mobility calculations run on.
 */
export interface BuildMass {
    /** Bare hull mass — the {@link ships!Ship.hullMass | hullMass} of the hull being flown. */
    readonly hull: number;
    /**
     * Every fitted module's post-engineering mass, summed.
     *
     * @remarks
     * Lightweight blueprints are already folded in, and the cargo hatch weighs nothing.
     * A fitted record with no mass at all contributes `0` rather than making the total
     * unavailable — mass is the one figure no article can be missing (see
     * {@link ships!ShipLoadout.unladenMass | ShipLoadout.unladenMass}),
     * which is why there is no `unpriced` counterpart to {@link BuildCredits.unpriced}
     * here.
     */
    readonly modules: number;
    /**
     * The ship with an empty tank and no cargo —
     * {@link ships!ShipLoadout.unladenMass | ShipLoadout.unladenMass}.
     *
     * @remarks
     * `hull` and `modules` are always computed from the hull record and the current
     * fit, while this is the build's own unladen mass, which for an unedited import is
     * the figure the **capture** stated. The two agree on anything assembled here; where
     * a capture disagrees with the catalogues, this is the one the jump and mobility
     * calculations use and the decomposition is what the catalogues say it is made of.
     */
    readonly unladen: number;
    /** Main-tank fuel counted, in tonnes. Defaults to a full main tank. */
    readonly fuel: number;
    /** Cargo counted, in tonnes. Defaults to an empty hold. */
    readonly cargo: number;
    /** `unladen + fuel + cargo`: what the ship weighs at the chosen load. */
    readonly total: number;
}

/** One fitted weapon and what it does, as {@link BuildMetrics.weaponMetrics} reports it. */
export interface FittedWeaponMetrics {
    /** The hardpoint's slot key, e.g. `"LargeHardpoint1"`. */
    readonly slot: string;
    /** The weapon's internal symbol. */
    readonly symbol: string;
    /** The weapon's display name, e.g. `"Multi-Cannon"`. */
    readonly name: string;
    /** Whether the weapon is switched on — a disabled weapon is excluded from the totals. */
    readonly enabled: boolean;
    /** What this weapon does per second, post-engineering. */
    readonly metrics: WeaponMetrics;
    /**
     * How many rounds it holds when fully rearmed, post-engineering — `null` for a laser,
     * which carries none. A capacity, not a rearm state: see
     * {@link ships!FittedModule.ammunition | FittedModule.ammunition}.
     */
    readonly ammunition: AmmunitionCapacity | null;
    /** Maximum effective range in metres, absent when the fitted weapon does not state one. */
    readonly maximumRange?: number;
    /** Damage-falloff start in metres, absent when the fitted weapon does not state one. */
    readonly falloffRange?: number;
    /**
     * Exact projectile boundary metadata, absent when unavailable. These are not
     * effective distances and remain separate from {@link maximumRange} and
     * {@link falloffRange}.
     */
    readonly projectileRange?: ProjectileRangeBoundaries;
    /** Armour-piercing rating, absent when unavailable. */
    readonly armourPiercing?: number;
}

/** A build's firepower: every fitted weapon, and the totals across the enabled ones. */
export interface BuildWeaponMetrics {
    /**
     * Every fitted weapon in hull slot order. Weapons in unknown or unmapped slots
     * follow the known slots in their original source order.
     */
    readonly weapons: readonly FittedWeaponMetrics[];
    /** The additive totals across the **enabled** weapons. */
    readonly total: WeaponTotals;
}

/**
 * A build's jump ranges at the loads that matter. The three single-jump values and
 * each total result's `range` are in light-years.
 */
export interface JumpRangeSummary {
    /**
     * Best single jump: no cargo, and only one jump's fuel aboard — the figure the game
     * and EDSY label "maximum jump range".
     */
    readonly max: number;
    /** Single jump on a full tank with an empty hold. */
    readonly unladen: number;
    /** Single jump on a full tank with a full hold. */
    readonly laden: number;
    /** Summed range and jump count on one jump's fuel, empty hold. */
    readonly totalMax: TotalRangeDetails;
    /** Summed range and jump count on one full tank, empty hold. */
    readonly totalUnladen: TotalRangeDetails;
    /** Summed range and jump count on one full tank, full hold. */
    readonly totalLaden: TotalRangeDetails;
}

/** The stats every load option is held to, named for the method the consumer called. */
function requireLoadOptions(scope: string, options: JumpOptions): void {
    for (const field of ['fuel', 'cargo'] as const) {
        const value = options[field];
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
            throw new RangeError(`${scope}: ${field} must be a finite non-negative number`);
        }
    }
}

/** Validate one named pip allocation, naming the method the consumer called. */
function requirePipAllocation(scope: string, name: string, value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 4) {
        throw new RangeError(`${scope}: ${name} must be a finite number from 0 to 4`);
    }
    return value;
}

/**
 * Every figure a fitted build can be asked for.
 *
 * ## Member index
 *
 * - **Attach** — {@link of}.
 * - **Jump** — {@link frameShiftDrive}, {@link frameShiftDriveMassFactor},
 *   {@link maxJumpRange}, {@link jumpRange}, {@link ladenJumpRange}, {@link fuelPerJump},
 *   {@link totalRange}, {@link jumpRangeSummary}, {@link standardLoad},
 *   {@link standardLoadResult}.
 * - **Mass and cost** — {@link buildMass}, {@link buildCost}.
 * - **Power and heat** — {@link powerBudget}, {@link heatMetrics},
 *   {@link heatMetricsResult}.
 * - **Mobility** — {@link thrusters}, {@link mobilityMetrics},
 *   {@link mobilityMetricsResult}.
 * - **Defence** — {@link armourMetrics}, {@link shieldMetrics},
 *   {@link shieldMetricsResult}, {@link shieldRecovery}, {@link shieldRecoveryResult},
 *   {@link cellBanks}.
 * - **Offence** — {@link weaponMetrics}, {@link weaponsCapacitorMetrics},
 *   {@link distributorMetrics}, {@link distributorMetricsResult}.
 *
 * Every member is a method. Nothing here is a fact the fit already carries — each one
 * computes from build state — so there are no properties to confuse with them.
 */
export class BuildMetrics {
    readonly #build: ShipLoadout;
    readonly #state: LoadoutInternals;

    private constructor(build: ShipLoadout, state: LoadoutInternals) {
        this.#build = build;
        this.#state = state;
    }

    /**
     * Attach a metrics view to a build.
     *
     * @param build - The build to read. The view holds it rather than copying it, so
     * later edits are visible to every subsequent call.
     * @returns The view.
     * @throws {TypeError} If `build` is not a {@link ships!ShipLoadout | ShipLoadout}.
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const build = ShipLoadout.default('Anaconda');
     * const metrics = BuildMetrics.of(build);
     * metrics.buildMass().modules; // -> 664
     * build.removeModule('Slot03_Size6'); // unfit the 40 t shield generator
     * metrics.buildMass().modules; // -> 624, the same view reading the edited build
     * ```
     */
    static of(build: ShipLoadout): BuildMetrics {
        return new BuildMetrics(build, loadoutInternals(build, `${FACADE}.of: build`));
    }

    /**
     * The build this view reads.
     *
     * @returns The same {@link ships!ShipLoadout | ShipLoadout} that was
     * passed to {@link of} — the aggregate figures, the slots and the editors are all on
     * it.
     */
    loadout(): ShipLoadout {
        return this.#build;
    }

    /**
     * The resolved frame-shift-drive constants for this build — post-engineering,
     * with any Guardian FSD Booster folded into `jumpBoost`.
     *
     * @returns The drive's constants.
     * @throws {TypeError} If no frame shift drive is fitted, or the fitted drive's
     * record is missing any of its required jump constants.
     */
    frameShiftDrive(): FrameShiftDriveParams {
        const drive = this.#state.resolveDrive();
        if (drive === null) {
            throw new TypeError(`${FACADE}: build has no frame shift drive`);
        }
        return drive;
    }

    /**
     * The fitted thrusters' post-engineering mass curve, or `null` when the build has
     * none — the thruster counterpart of {@link frameShiftDrive}.
     *
     * @remarks
     * A {@link ships!ThrusterParams | ThrusterParams} carries the three masses the
     * curve is defined over and the multiplier at each, plus the separate `speedCurve`
     * and `rotationCurve` an enhanced-performance thruster refines them with. Pass it
     * straight to
     * {@link ships!thrusterMassCurveMultiplier | thrusterMassCurveMultiplier} for the
     * multiplier at a mass of your own, or read `optMass` and `maxMass` against
     * {@link ships!MobilityMetrics.loadedMass | loadedMass} for where this build sits
     * on the curve.
     *
     * This is the fitted article's curve, so a switched-off or shed thruster still has
     * one; {@link mobilityMetricsResult} is what judges whether the build can use it.
     * It answers `null` rather than throwing — unlike {@link frameShiftDrive}, which the
     * jump equation cannot do without — when no thrusters are fitted or the fitted
     * record carries no complete curve.
     *
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));
     * metrics.thrusters()?.optMass; // -> 1440, tonnes
     * metrics.thrusters()?.maxMass; // -> 2160, past which the ship does not move at all
     * ```
     */
    thrusters(): ThrusterParams | null {
        return fittedThrusterParamsFor(this.#state.modules(), this.#state.statsFor);
    }

    /**
     * The fitted frame shift drive's dimensionless mass factor at a chosen load.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank and
     * `cargo` to `0`.
     * @returns `optMass / loadedMass`: `1` at the drive's optimised mass, below `1`
     * above it and above `1` below it.
     * @remarks
     * This is the mass term used by the jump equation, not the three-point performance
     * curve used by thrusters and shield generators. Main-tank fuel contributes to the
     * loaded mass; the Guardian FSD Booster's additive range does not contribute to the
     * factor.
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or loaded
     * mass is zero.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * metrics.frameShiftDriveMassFactor({ fuel: 8, cargo: 32 }); // dimensionless
     * ```
     */
    frameShiftDriveMassFactor(options: JumpOptions = {}): number {
        requireLoadOptions(`${FACADE}.frameShiftDriveMassFactor`, options);
        return frameShiftDriveMassFactor(
            this.#loadedMass(options.cargo ?? 0),
            options.fuel ?? this.#build.fuelCapacity.main,
            this.frameShiftDrive(),
        );
    }

    /**
     * Best single-jump range, in light-years — no cargo, and exactly one jump's fuel
     * aboard (the lightest the ship jumps). This is the figure the game and EDSY label
     * "maximum jump range".
     *
     * @returns The best single jump, in light-years, or `0` for a capture that states a
     * main tank of `0`.
     * @throws {TypeError} If the build has no usable frame shift drive.
     */
    maxJumpRange(): number {
        const fsd = this.frameShiftDrive();
        return singleJumpRange(this.#loadedMass(0), this.#maxJumpFuel(fsd), fsd);
    }

    /**
     * The range of a single jump for a chosen fuel and cargo load, in light-years.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns The jump's range, in light-years.
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative.
     */
    jumpRange(options: JumpOptions = {}): number {
        requireLoadOptions(`${FACADE}.jumpRange`, options);
        return singleJumpRange(
            this.#loadedMass(options.cargo ?? 0),
            options.fuel ?? this.#build.fuelCapacity.main,
            this.frameShiftDrive(),
        );
    }

    /**
     * Single-jump range on a full tank with a full cargo hold, in light-years.
     *
     * @returns The jump's range, in light-years.
     * @throws {TypeError} If the build has no usable frame shift drive.
     */
    ladenJumpRange(): number {
        return this.jumpRange({ cargo: this.#build.cargoCapacity });
    }

    /**
     * The fuel a single jump of a given distance costs, in tonnes.
     *
     * @param distance - The jump distance, in light-years.
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns Fuel used, in tonnes (capped at the drive's max fuel per jump).
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative.
     */
    fuelPerJump(distance: number, options: JumpOptions = {}): number {
        requireLoadOptions(`${FACADE}.fuelPerJump`, options);
        return fuelPerJump(
            distance,
            this.#loadedMass(options.cargo ?? 0),
            options.fuel ?? this.#build.fuelCapacity.main,
            this.frameShiftDrive(),
        );
    }

    /**
     * Total range and jump count for a chosen fuel and cargo load.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank,
     * `cargo` to `0`.
     * @returns Summed range in light-years and the jumps made before the tank is empty.
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or the
     * fuel load would require more than 100,000 jumps.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * metrics.totalRange().jumps; // jumps available from one full main tank
     * metrics.totalRange({ fuel: 8, cargo: 32 }).range; // range for that partial load
     * ```
     */
    totalRange(options: JumpOptions = {}): TotalRangeDetails {
        requireLoadOptions(`${FACADE}.totalRange`, options);
        return totalRange(
            this.#loadedMass(options.cargo ?? 0),
            options.fuel ?? this.#build.fuelCapacity.main,
            this.frameShiftDrive(),
        );
    }

    /**
     * One of the package's standard load conditions, or `null` when the fitted drive
     * cannot support it.
     *
     * @param load - `'maximum'` for one jump's fuel and no cargo, `'unladen'` for a
     * full main tank and no cargo, or `'laden'` for a full main tank and full hold.
     * @returns The fuel and cargo carried and the {@link StandardLoadInputs.mass}, or
     * `null`. Only `'maximum'` can answer `null`: it validates the whole fitted drive,
     * jump booster included, so a non-null one can be passed straight to
     * {@link jumpRange}. Use {@link standardLoadResult} to learn why it is unavailable.
     * @throws {RangeError} If `load` is not a recognised standard load.
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const metrics = BuildMetrics.of(ShipLoadout.default('Anaconda'));
     * metrics.standardLoad('laden')?.mass; // -> 1210, tonnes with a full tank and hold
     * ```
     */
    standardLoad(load: StandardLoad): StandardLoadInputs | null {
        return this.#standardLoad('standardLoad', load).value;
    }

    /**
     * Resolve one of the package's standard load conditions for jump and mobility views.
     *
     * @param load - `'maximum'` for one jump's fuel and no cargo, `'unladen'` for a
     * full main tank and no cargo, or `'laden'` for a full main tank and full hold.
     * @returns The fuel and cargo carried, and the {@link StandardLoadInputs.mass} the
     * ship weighs carrying them, all in tonnes. Only `'maximum'` can come back
     * incomplete: it validates the whole fitted drive, jump booster included, so a
     * complete one can be passed straight to {@link jumpRange}.
     * @throws {RangeError} If `load` is not a recognised standard load.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * const load = metrics.standardLoadResult('maximum');
     * if (load.complete) metrics.mobilityMetrics({ ...load.value, enginesPips: 2 });
     * ```
     */
    standardLoadResult(load: StandardLoad): CalculationResult<StandardLoadInputs> {
        return this.#standardLoad('standardLoadResult', load);
    }

    /**
     * Every jump figure at once — best, unladen, laden, and each load's total.
     *
     * @returns The {@link JumpRangeSummary}. Single-jump figures and each total's
     * `range` are in light-years. For a partial load, call {@link jumpRange} for one
     * jump or {@link totalRange} for every jump with the `fuel` and `cargo` you
     * actually have.
     * @throws {TypeError} If the build has no usable frame shift drive.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     *
     * const jumps = metrics.jumpRangeSummary();
     * jumps.max; // -> 89.41  (one jump's fuel, empty hold)
     * jumps.laden; // -> the range with the hold full
     * jumps.totalMax.jumps; // the best jump expressed as a total
     * ```
     */
    jumpRangeSummary(): JumpRangeSummary {
        const maximum = this.#require(this.standardLoadResult('maximum'), 'maximum load');
        const unladen = this.#require(this.standardLoadResult('unladen'), 'unladen load');
        const laden = this.#require(this.standardLoadResult('laden'), 'laden load');
        return {
            max: this.jumpRange(maximum),
            unladen: this.jumpRange(unladen),
            laden: this.jumpRange(laden),
            totalMax: this.totalRange(maximum),
            totalUnladen: this.totalRange(unladen),
            totalLaden: this.totalRange(laden),
        };
    }

    /**
     * Weigh the whole build: the hull, the fitted modules, and the load on top of them.
     *
     * @remarks
     * The mass companion to {@link buildCost}, answering the same question in tonnes
     * that that one answers in credits. Every module's mass is post-engineering, so a
     * Lightweight roll is already in `modules`.
     *
     * The reserve tank is **not** counted. The main tank is the fuel the drive and the
     * flight model see, and it is what {@link jumpRange} and {@link mobilityMetrics}
     * weigh; the game's statistics panel additionally counts the reserve in the current
     * mass it displays, so add
     * {@link ships!ShipLoadout.fuelCapacity | fuelCapacity}`.reserve` to
     * reproduce that reading.
     *
     * @param options - {@link JumpOptions}. `fuel` defaults to a full main tank and
     * `cargo` to `0`, matching {@link jumpRange} and {@link mobilityMetrics}. Pass
     * {@link standardLoad} to weigh one of the standard loads.
     * @returns A frozen {@link BuildMass}, every figure in tonnes.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative.
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const build = ShipLoadout.default('Anaconda');
     * const mass = BuildMetrics.of(build).buildMass();
     * mass.hull; // -> 400
     * mass.modules; // -> 664
     * mass.total; // -> 1096, a full main tank and an empty hold
     * BuildMetrics.of(build).buildMass({ cargo: build.cargoCapacity }).total; // -> 1210
     * ```
     */
    buildMass(options: JumpOptions = {}): BuildMass {
        requireLoadOptions(`${FACADE}.buildMass`, options);
        const unladen = this.#build.unladenMass;
        const fuel = options.fuel ?? this.#build.fuelCapacity.main;
        const cargo = options.cargo ?? 0;
        return Object.freeze({
            hull: this.#state.ship.hullMass,
            modules: calculateUnladenMass(0, this.#state.calculationModules()),
            unladen,
            fuel,
            cargo,
            total: unladen + fuel + cargo,
        });
    }

    /**
     * Price the whole build from the catalogues: shop credits, Merc Coin and the
     * engineering materials its modifications consume.
     *
     * No modification is charged twice. A Mercenary article arrives at the grade it was sold at,
     * so only the climb above that grade bills materials and further Merc Coin, and an
     * experimental effect the article came with is free while one added on top is not. A
     * fixed reward article — festive, Guardian, community-goal — identifies a recipe it
     * was never rolled from, so it contributes no materials at all.
     *
     * @returns A frozen {@link BuildCost}. `credits.modules`, `credits.total` and
     * `credits.rebuy` are lower bounds while {@link BuildCredits.unpriced} is non-empty;
     * built-in hull fittings are free rather than unpriced.
     * @remarks
     * This is the one place the build metrics read the material and Merc Coin cost
     * catalogues; import
     * {@link ships/blueprint-costs!getBlueprintCost | getBlueprintCost} and
     * {@link ships/experimental-effect-costs!getExperimentalEffectCost | getExperimentalEffectCost}
     * directly to price one recipe without a build.
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const build = ShipLoadout.default('Anaconda');
     * BuildMetrics.of(build).buildCost().credits.hull; // -> 142456440
     * build.applyBlueprint('FrameShiftDrive', 'FSD_LongRange', { grade: 5 });
     * BuildMetrics.of(build)
     *     .buildCost()
     *     .materials.find((material) => material.symbol === 'Arsenic')?.count; // -> 5
     * ```
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     * import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const variant = getPreEngineeredVariants('Hpt_Railgun_Fixed_Medium')
     *     .find((candidate) => candidate.acquisition === 'mercenary')!;
     * const build = ShipLoadout.default('Python')
     *     .setPreEngineeredVariant('MediumHardpoint1', variant);
     * BuildMetrics.of(build).buildCost().mercCoins; // -> 950
     * ```
     */
    buildCost(): BuildCost {
        const hull = this.#state.ship.hullCost;
        let modules = 0;
        let mercCoins = 0;
        const unpriced: { slot: string; symbol: string }[] = [];
        const materials: (readonly EngineeringMaterial[])[] = [];
        for (const module of this.#state.modules()) {
            const stats = this.#state.statsFor(module);
            if (stats?.cost !== undefined) {
                modules += stats.cost;
            } else if (
                stats !== null ||
                (!isNonOutfittingSlot(module.Slot) && !isBuiltInHullModule(module))
            ) {
                unpriced.push({ slot: module.Slot, symbol: module.Item });
            }
            const variant = identifyPreEngineeredVariant(module);
            mercCoins += variant?.mercCoinCost ?? 0;
            const engineering = module.Engineering;
            if (!engineering) continue;
            const grade = engineering.Level;
            const bought = variant?.grade ?? 0;
            // A capture states its own grade, so a value outside the catalogued range is
            // priced as no climb rather than thrown at the consumer reading a total.
            if (Number.isInteger(grade) && grade > bought && grade <= 5) {
                const climb = getBlueprintCost(engineering.BlueprintName, grade, bought);
                if (climb) {
                    materials.push(climb.materials);
                    mercCoins += climb.mercCoins;
                }
            }
            const experimental = engineering.ExperimentalEffect;
            if (
                experimental !== undefined &&
                experimental.toLowerCase() !== variant?.experimental?.toLowerCase()
            ) {
                const cost = getExperimentalEffectCost(experimental);
                if (cost) materials.push(cost);
            }
        }
        return deepFreeze({
            credits: {
                total: hull + modules,
                hull,
                modules,
                rebuy: Math.trunc((hull + modules) * 0.05),
                unpriced,
            },
            mercCoins,
            materials: sumMaterials(...materials),
        });
    }

    /**
     * The build's power budget: what the plant makes, what the modules draw with
     * hardpoints retracted and deployed, and which priority groups stay lit.
     *
     * Draws are post-engineering, modules switched off in the journal are skipped, and
     * weapons (plus the utility fittings that are not always powered) count only
     * towards the deployed total.
     *
     * @returns The {@link PowerBudget}. `consumers` includes modules with positive
     * draw; passive and zero-draw fittings are absent.
     * @throws {RangeError} If a power capacity or module draw is negative or not finite.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     *
     * const power = metrics.powerBudget();
     * power.available; // -> 20.4 MW generated
     * power.deployed; // -> 19.02 MW drawn, hardpoints out
     * power.withinBudget; // -> true
     * power.bands[4]?.poweredDeployed; // -> is priority group 5 still lit?
     * ```
     */
    powerBudget(): PowerBudget {
        const modules = this.#state.modules();
        const consumers: PowerConsumer[] = [];
        for (const module of modules) {
            const consumer = powerConsumerFor(module, this.#state.statsFor(module));
            if (consumer) consumers.push(consumer);
        }
        return powerBudget(powerAvailable(modules, this.#state.statsFor), consumers);
    }

    /**
     * The build's heat: what it idles at, what it runs at flying and jumping, and
     * whether firing everything cooks it.
     *
     * Every figure is post-engineering. The heat a build makes follows what the plant
     * actually feeds, so a module switched off — or one in a priority group the plant
     * cannot keep lit — contributes nothing.
     *
     * @returns The {@link HeatMetrics}, or `null` when the build has no powered power
     * plant whose heat efficiency it can read. Use {@link heatMetricsResult} to
     * distinguish the unavailable conditions.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     *
     * const heat = metrics.heatMetrics();
     * heat?.idle.gauge; // -> 0.23, i.e. the gauge reads 23%
     * heat?.firingSustained.overheats; // -> false: the guns run cool enough to hold
     * heat?.firingDrained.secondsToOverheat; // -> how long an alpha strike has on an empty WEP
     * ```
     */
    heatMetrics(): HeatMetrics | null {
        return this.heatMetricsResult().value;
    }

    /**
     * The build's heat with a diagnostic when its power plant is unavailable.
     *
     * @returns A complete {@link HeatMetrics} value, otherwise `null` plus the fitted
     * power plant's state: `missing` when none is fitted, `disabled` when it is
     * switched off, and `unresolved` when its record does not state a heat efficiency.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * const result = metrics.heatMetricsResult();
     * if (result.complete) result.value.idle.gauge; // 0 to 1
     * else result.issues[0].reason; // unavailable-state discriminator
     * ```
     */
    heatMetricsResult(): CalculationResult<HeatMetrics> {
        const input = heatInputResultFor(
            this.#state.ship,
            this.#state.effectiveModules(),
            this.powerBudget(),
            this.#state.statsFor,
        );
        return input.complete ? completeResult(heatMetrics(input.value)) : input;
    }

    /**
     * The build's speed, boost and rotation rates at a chosen load and ENG allocation.
     *
     * @remarks
     * Main-tank fuel contributes to the flight model's loaded mass. Reserve-tank fuel
     * does not: although the statistics panel includes it in the displayed current
     * mass, ten observed builds reproduce their angular rates only when the reserve is
     * excluded from the thruster mass curve.
     *
     * @param options - Fuel defaults to a full main tank, cargo to `0`, and ENG pips to `4`.
     * @returns Loaded {@link MobilityMetrics}, or `null` when no fully described
     * thrusters are powered with hardpoints retracted. Use
     * {@link mobilityMetricsResult} to distinguish the unavailable conditions.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or
     * `enginesPips` is outside `[0, 4]`.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * metrics.mobilityMetrics({ cargo: 32, fuel: 8, enginesPips: 2 })?.speed; // -> m/s
     * ```
     */
    mobilityMetrics(options: MobilityOptions = {}): MobilityMetrics | null {
        return this.#mobility('mobilityMetrics', options).value;
    }

    /**
     * The build's mobility with a diagnostic when its thrusters or retracted power
     * supply is unavailable.
     *
     * @param options - Fuel defaults to a full main tank, cargo to `0`, and ENG pips to `4`.
     * @returns A complete {@link MobilityMetrics} value, otherwise `null` plus the input
     * or fitted-module state that prevented the calculation.
     * @throws {RangeError} If fuel or cargo is not finite and non-negative, or
     * `enginesPips` is outside `[0, 4]`.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * const result = metrics.mobilityMetricsResult({ enginesPips: 2 });
     * if (result.complete) result.value.speed; // metres per second
     * else result.issues[0].reason; // unavailable-state discriminator
     * ```
     */
    mobilityMetricsResult(options: MobilityOptions = {}): CalculationResult<MobilityMetrics> {
        return this.#mobility('mobilityMetricsResult', options);
    }

    /**
     * The build's shields: strength in megajoules, where it comes from, and the
     * effective resistances.
     *
     * Shield strength scales with the **hull's** mass, not the build's, so fitting
     * more modules never weakens it. Boosters, Guardian shield reinforcement and any
     * engineering are all folded in; switched-off or shed boosters and reinforcement
     * are ignored, while a switched-off or shed generator makes the metric unavailable.
     *
     * @param options - {@link ShieldOptions}. `systemsPips` (0–4) folds the SYS
     * capacitor's own resistance into the reported figures; it defaults to `0`, which
     * is what an outfitting screen shows.
     * @returns The {@link ShieldMetrics}, or `null` when the build has no shield
     * generator powered with hardpoints retracted. Use
     * {@link shieldMetricsResult} to distinguish the unavailable conditions.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     *
     * const shields = metrics.shieldMetrics();
     * shields?.strength; // -> MJ
     * shields?.resistances.thermal; // -> negative on a stock generator
     * metrics.shieldMetrics({ systemsPips: 4 })?.resistances.thermal; // -> with 4 pips to SYS
     * ```
     */
    shieldMetrics(options: ShieldOptions = {}): ShieldMetrics | null {
        return this.#shields('shieldMetrics', options).value;
    }

    /**
     * The build's shields with a diagnostic when its hull, generator or retracted
     * power supply is unavailable.
     *
     * @param options - {@link ShieldOptions}. `systemsPips` defaults to `0`.
     * @returns A complete {@link ShieldMetrics} value, otherwise `null` plus the input
     * or fitted-module state that prevented the calculation.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * const result = metrics.shieldMetricsResult();
     * if (result.complete) result.value.strength; // megajoules
     * else result.issues[0].reason; // unavailable-state discriminator
     * ```
     */
    shieldMetricsResult(options: ShieldOptions = {}): CalculationResult<ShieldMetrics> {
        return this.#shields('shieldMetricsResult', options);
    }

    /**
     * Time for this build's shield to rise after collapse and then regenerate to full.
     *
     * @param options - {@link ShieldRecoveryOptions}. SYS pips in `[0, 4]`, defaulting
     * to `4` — **not** the `0` {@link shieldMetrics} defaults to.
     * @returns Recovery rates and seconds, or `null` when no shield generator is powered
     * with hardpoints retracted. Use
     * {@link shieldRecoveryResult} to distinguish the unavailable conditions.
     * Insufficient zero-pip recharge produces `Infinity`.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * metrics.shieldRecovery({ systemsPips: 4 })?.recoveryTime; // -> seconds from collapse to 50%
     * ```
     */
    shieldRecovery(options: ShieldRecoveryOptions = {}): ShieldRecovery | null {
        return this.#recovery('shieldRecovery', options).value;
    }

    /**
     * The build's shield recovery with a diagnostic when its hull, generator or
     * retracted power supply is unavailable.
     *
     * @param options - {@link ShieldRecoveryOptions}. SYS pips in `[0, 4]`, defaulting
     * to `4`.
     * @returns A complete {@link ShieldRecovery} value, otherwise `null` plus the input
     * or fitted-module state that prevented the calculation.
     * @throws {RangeError} If `systemsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * const result = metrics.shieldRecoveryResult();
     * if (result.complete) result.value.recoveryTime; // seconds
     * else result.issues[0].reason; // unavailable-state discriminator
     * ```
     */
    shieldRecoveryResult(options: ShieldRecoveryOptions = {}): CalculationResult<ShieldRecovery> {
        return this.#recovery('shieldRecoveryResult', options);
    }

    /**
     * Every fitted shield cell bank and the usable rearmed reinforcement pool.
     *
     * Every fitted bank remains in `banks`, where `powered` says whether it is switched
     * on and its priority group is fed with hardpoints deployed. The totals include only
     * those powered banks, so a build whose plant is switched off or outdrawn reports
     * every bank unpowered and zero totals.
     *
     * @returns A frozen {@link CellBankSummary}; no banks is an empty list and zero totals.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * metrics.cellBanks().totalRestorable; // -> MJ across every powered fitted cell
     * ```
     */
    cellBanks(): CellBankSummary {
        return cellBankSummary(
            orderBySlotLayout(
                cellBankInputsFor(this.#state.modules(), this.powerBudget(), this.#state.statsFor),
                this.#state.layout(),
                (bank) => bank.slot,
            ),
        );
    }

    /**
     * The build's armour: hull hit points, the bulkhead and reinforcement each
     * contribute, and the effective resistances.
     *
     * @returns The {@link ArmourMetrics}, read off the fitted bulkhead.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     *
     * const hull = metrics.armourMetrics();
     * hull.hitPoints; // -> total hull points
     * hull.resistances.explosive; // -> lightweight alloy is explosively weak
     * hull.effectiveHitPoints.thermal; // -> thermal damage the hull can soak
     * ```
     */
    armourMetrics(): ArmourMetrics {
        return armourMetrics(
            armourInputFor(this.#state.ship, this.#state.modules(), this.#state.statsFor),
        );
    }

    /**
     * The build's firepower: DPS, sustained DPS, weapons-capacitor draw, heat and power
     * draw for every fitted weapon, plus the totals.
     *
     * Every figure is post-engineering. A weapon switched off in the journal is still
     * listed — with its own metrics — but left out of the totals.
     *
     * @returns The {@link BuildWeaponMetrics}.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     *
     * const guns = metrics.weaponMetrics();
     * guns.total.damagePerSecond; // -> burst DPS across the hardpoints
     * guns.total.sustainedDamagePerSecond; // -> with reloads folded in
     * guns.total.energyPerSecond; // -> MW asked of the WEP capacitor
     * guns.total.powerDraw; // -> MW asked of the power plant when deployed
     * guns.weapons[0]?.metrics.damageByType.thermal;
     * guns.weapons[0]?.maximumRange; // post-engineering metres, when known
     * guns.weapons[0]?.armourPiercing; // post-engineering rating, when known
     * guns.weapons[0]?.ammunition?.total; // -> rounds aboard when fully rearmed
     * ```
     */
    weaponMetrics(): BuildWeaponMetrics {
        const weapons: FittedWeaponMetrics[] = [];
        for (const module of this.#state.modules()) {
            const record = this.#state.statsFor(module);
            const stats = weaponStatsFor(this.#state.effectiveModule(module), record);
            if (!stats) continue;
            weapons.push({
                slot: module.Slot,
                symbol: module.Item,
                name: record?.name ?? module.Item,
                enabled: module.On !== false,
                metrics: weaponMetrics(stats),
                ammunition: ammunitionCapacity(stats),
                ...(stats.maximumRange === undefined ? {} : { maximumRange: stats.maximumRange }),
                ...(stats.falloffRange === undefined ? {} : { falloffRange: stats.falloffRange }),
                ...(stats.projectileRange === undefined
                    ? {}
                    : { projectileRange: { ...stats.projectileRange } }),
                ...(stats.armourPiercing === undefined
                    ? {}
                    : { armourPiercing: stats.armourPiercing }),
            });
        }
        const orderedWeapons = orderBySlotLayout(
            weapons,
            this.#state.layout(),
            (weapon) => weapon.slot,
        );
        return {
            weapons: orderedWeapons,
            total: sumWeaponMetrics(
                orderedWeapons.filter((weapon) => weapon.enabled).map((weapon) => weapon.metrics),
            ),
        };
    }

    /**
     * WEP-capacitor recharge and endurance while every powered weapon fires.
     *
     * @param options - WEP pips in `[0, 4]`, defaulting to `4`.
     * @returns Actual recharge, sustained draw, net drain and seconds from full to
     * empty. The deployed power budget is applied to the distributor and weapons, so a
     * module the plant sheds contributes nothing. With no powered distributor, capacity
     * and recharge are zero. A load that draws no more than recharge reports
     * `Infinity` for `timeToDrain`.
     * @throws {RangeError} If `weaponsPips` is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * metrics.weaponsCapacitorMetrics({ weaponsPips: 2 }).timeToDrain; // seconds
     * ```
     */
    weaponsCapacitorMetrics(options: WeaponsOptions = {}): WeaponsCapacitorMetrics {
        const weaponsPips = requirePipAllocation(
            `${FACADE}.weaponsCapacitorMetrics`,
            'weaponsPips',
            options.weaponsPips ?? 4,
        );
        return weaponsCapacitorMetrics(
            weaponsCapacitorInputFor(
                this.#state.effectiveModules(),
                weaponsPips,
                this.powerBudget(),
                this.#state.statsFor,
            ),
        );
    }

    /**
     * All three power-distributor capacitors at selected pip allocations.
     *
     * @param options - SYS, ENG and WEP pips in `[0, 4]`, each defaulting
     * independently to `4`. The allocations need not sum to six, which permits
     * independent comparisons of the three maxima.
     * @returns Capacity, rated four-pip recharge and actual pip-scaled recharge for
     * SYS, ENG and WEP, or `null` when the distributor is not fitted, switched off,
     * shed by the retracted power budget, or its six capacitor stats cannot be
     * resolved. Use {@link distributorMetricsResult} to distinguish those four. That
     * retracted state represents the distributor itself; firing endurance in
     * {@link weaponsCapacitorMetrics} separately applies the deployed state.
     * @throws {RangeError} If any pip allocation is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import type { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     *
     * declare const metrics: BuildMetrics;
     * const distributor = metrics.distributorMetrics({
     *     systemsPips: 2,
     *     enginesPips: 2,
     *     weaponsPips: 2,
     * });
     * distributor?.engines.rechargeRate; // MJ/s
     * ```
     */
    distributorMetrics(options: DistributorOptions = {}): DistributorMetrics | null {
        return this.#distributor('distributorMetrics', options).value;
    }

    /**
     * The build's distributor with a diagnostic when it is unavailable.
     *
     * @param options - SYS, ENG and WEP pips in `[0, 4]`, each defaulting to `4`.
     * @returns A complete {@link DistributorMetrics} value, otherwise `null` plus the
     * fitted distributor's state: `missing` when none is fitted, `disabled` when it is
     * switched off, `shed` when the retracted power budget does not feed it, and
     * `unresolved` when its record does not state all six capacitor figures.
     * @throws {RangeError} If any pip allocation is outside `[0, 4]` or not finite.
     * @example
     * ```ts
     * import { BuildMetrics } from '@elite-dangerous-almanac/core/ships/build-metrics';
     * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
     *
     * const build = ShipLoadout.default('Anaconda').setModuleEnabled('PowerDistributor', false);
     * const result = BuildMetrics.of(build).distributorMetricsResult();
     * result.complete; // -> false
     * result.issues[0]?.reason; // -> 'disabled'
     * ```
     */
    distributorMetricsResult(
        options: DistributorOptions = {},
    ): CalculationResult<DistributorMetrics> {
        return this.#distributor('distributorMetricsResult', options);
    }

    /**
     * The one implementation of the mobility metric, told which public method wants it.
     *
     * @remarks
     * Each pair of a nullable metric and its `…Result` companion validates once, here,
     * with the caller's own name. The two used to guard separately so the thrown
     * message could name the method the consumer called, which meant every option's
     * rule was written twice and free to drift apart.
     */
    #mobility(method: string, options: MobilityOptions): CalculationResult<MobilityMetrics> {
        const scope = `${FACADE}.${method}`;
        const enginesPips = requirePipAllocation(scope, 'enginesPips', options.enginesPips ?? 4);
        requireLoadOptions(scope, options);
        const input = mobilityInputResultFor(
            this.#state.ship,
            this.#state.modules(),
            () => this.powerBudget(),
            () =>
                this.#loadedMass(options.cargo ?? 0) +
                (options.fuel ?? this.#state.statedMainFuel() ?? this.#build.fuelCapacity.main),
            enginesPips,
            this.#state.statsFor,
        );
        return input.complete ? completeResult(mobilityMetrics(input.value)!) : input;
    }

    /** The one implementation of the shield metric — see {@link BuildMetrics.#mobility}. */
    #shields(method: string, options: ShieldOptions): CalculationResult<ShieldMetrics> {
        const systemsPips = requirePipAllocation(
            `${FACADE}.${method}`,
            'systemsPips',
            options.systemsPips ?? 0,
        );
        const input = shieldInputResultFor(
            this.#state.ship,
            this.#state.modules(),
            () => this.powerBudget(),
            systemsPips,
            this.#state.statsFor,
        );
        return input.complete ? completeResult(shieldMetrics(input.value)) : input;
    }

    /** The one implementation of shield recovery — see {@link BuildMetrics.#mobility}. */
    #recovery(method: string, options: ShieldRecoveryOptions): CalculationResult<ShieldRecovery> {
        const systemsPips = requirePipAllocation(
            `${FACADE}.${method}`,
            'systemsPips',
            options.systemsPips ?? 4,
        );
        const input = shieldRecoveryInputResultFor(
            this.#state.ship,
            this.#state.modules(),
            () => this.powerBudget(),
            systemsPips,
            this.#state.statsFor,
        );
        return input.complete ? completeResult(shieldRecovery(input.value)) : input;
    }

    /** The one implementation of the distributor metric — see {@link BuildMetrics.#mobility}. */
    #distributor(
        method: string,
        options: DistributorOptions,
    ): CalculationResult<DistributorMetrics> {
        const scope = `${FACADE}.${method}`;
        const pips = {
            systemsPips: requirePipAllocation(scope, 'systemsPips', options.systemsPips ?? 4),
            enginesPips: requirePipAllocation(scope, 'enginesPips', options.enginesPips ?? 4),
            weaponsPips: requirePipAllocation(scope, 'weaponsPips', options.weaponsPips ?? 4),
        };
        const input = distributorInputResultFor(
            this.#state.effectiveModules(),
            pips,
            this.powerBudget(),
            this.#state.statsFor,
        );
        return input.complete ? completeResult(distributorMetrics(input.value)) : input;
    }

    /** The one implementation of the standard loads — see {@link BuildMetrics.#mobility}. */
    #standardLoad(method: string, load: StandardLoad): CalculationResult<StandardLoadInputs> {
        if (load !== 'maximum' && load !== 'unladen' && load !== 'laden') {
            throw new RangeError(
                `${FACADE}.${method}: load must be 'maximum', 'unladen', or 'laden'`,
            );
        }

        const fuel = this.#build.fuelCapacity;
        const cargo = load === 'laden' ? this.#build.cargoCapacity : 0;
        const mass = load === 'maximum' ? this.#build.unladenMass : 0;
        let drive: FrameShiftDriveParams | null = null;
        let maximumFuel: number | null = null;
        if (load === 'maximum') {
            const fitted = this.#state.frameShiftDriveModule();
            let driveError: Error | null = null;
            try {
                drive = this.#state.resolveDrive();
                maximumFuel = drive?.maxFuel ?? null;
            } catch (error) {
                if (!(error instanceof Error)) throw error;
                driveError = error;
            }
            if (maximumFuel === null) {
                return incompleteResult([
                    {
                        field: 'frameShiftDrive',
                        reason: fitted ? 'unresolved' : 'missing',
                        slot: fitted?.Slot ?? 'FrameShiftDrive',
                        ...(fitted ? { symbol: fitted.Item } : {}),
                        message:
                            driveError?.message ??
                            'FrameShiftDrive: no frame shift drive is fitted',
                        params: fitted
                            ? {
                                  field: 'frameShiftDrive',
                                  reason: 'unresolved',
                                  slot: fitted.Slot,
                                  symbol: fitted.Item,
                              }
                            : {
                                  field: 'frameShiftDrive',
                                  reason: 'missing',
                                  slot: 'FrameShiftDrive',
                              },
                    },
                ]);
            }
        }
        const carriedFuel = load === 'maximum' ? Math.min(fuel.main, maximumFuel!) : fuel.main;
        const value = Object.freeze({
            fuel: carriedFuel,
            cargo,
            mass: this.#build.unladenMass + carriedFuel + cargo,
        });
        if (load === 'maximum') {
            try {
                this.jumpRange(value);
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                const fitted = this.#state.frameShiftDriveModule();
                const field: CalculationIssue['field'] =
                    drive !== null && (!Number.isFinite(drive.maxFuel) || drive.maxFuel < 0)
                        ? 'frameShiftDrive'
                        : !Number.isFinite(value.fuel) || value.fuel < 0
                          ? 'fuelCapacity'
                          : !Number.isFinite(mass) || mass < 0
                            ? 'mass'
                            : 'frameShiftDrive';
                const driveParams =
                    field === 'frameShiftDrive' && fitted
                        ? { slot: fitted.Slot, symbol: fitted.Item }
                        : {};
                return incompleteResult([
                    {
                        field,
                        reason: 'invalid',
                        ...driveParams,
                        message: error.message,
                        params: { field, reason: 'invalid', ...driveParams },
                    },
                ]);
            }
        }
        return completeResult(value);
    }

    /** Unwrap a calculation result required by a public convenience calculation. */
    #require<T>(result: CalculationResult<T>, what: string): T {
        if (result.value === null) {
            throw new TypeError(
                `${FACADE}: cannot determine ${what} (${result.issues.map((issue) => issue.message).join('; ')})`,
            );
        }
        return result.value;
    }

    /** Unladen mass plus the given cargo. */
    #loadedMass(cargo: number): number {
        return this.#build.unladenMass + cargo;
    }

    /** The fuel one jump can burn: the whole main tank, or the drive limit if lower. */
    #maxJumpFuel(fsd: FrameShiftDriveParams): number {
        return Math.min(this.#build.fuelCapacity.main, fsd.maxFuel);
    }
}
