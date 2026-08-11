/**
 * **Power** — what the plant makes, what the build draws, and which priority groups
 * stay lit when it draws more than it makes.
 *
 * The model is the game's own. Every powered module draws its megawatts continuously,
 * except the ones bolted to a hardpoint: weapons and most utility fittings only draw
 * while the hardpoints are **deployed**, which is why a build has two totals. Each
 * module sits in one of five **priority groups**; when the draw exceeds what the plant
 * makes, the game keeps groups powered from group 1 down and shuts off the first group
 * whose running total would go over, along with everything below it.
 *
 * This module is data-free: hand {@link powerBudget} the plant's capacity and a
 * {@link PowerConsumer} per fitted module. {@link ShipLoadout.powerBudget} (in
 * `./ship-loadout`) builds that list from a build for you, post-engineering.
 *
 * @remarks
 * Reference implementation: EDCD/Coriolis by the Coriolis contributors (MIT),
 * <https://github.com/EDCD/coriolis> — `src/app/shipyard/Ship.js`
 * (`updatePowerUsed`, `powerUsageType`, `getSlotStatus`), commit
 * `68c042ca6e3db62372cbbb2077cf972345511712`. The algorithm is ported as fact, not code.
 *
 * @example
 * ```ts
 * import { powerBudget } from '@elite-dangerous-almanac/core/ships/power';
 *
 * powerBudget(20.4, [
 *   { draw: 0.45, priority: 1 },                       // life support
 *   { draw: 5.72, priority: 1 },                       // thrusters
 *   { draw: 2.48, priority: 3, deployedOnly: true },   // a beam laser
 * ]).deployed; // -> 8.65
 * ```
 *
 * @packageDocumentation
 */

/** How many priority groups the game offers. */
const PRIORITY_GROUPS = 5;

/**
 * Floating-point slack when comparing a running total against capacity. Summed
 * two-decimal megawatts can land a whisker over an exact match; a build that draws
 * exactly what it makes is powered, so the comparison must not trip on that.
 */
const EPSILON = 1e-9;

/** One fitted module's claim on the power plant. */
export interface PowerConsumer {
    /** Power draw, in megawatts, post-engineering. Must be finite and non-negative. */
    readonly draw: number;
    /**
     * Priority group, `1`–`5`, as the outfitting panel numbers them. Defaults to `1`.
     *
     * @remarks
     * The journal's `Priority` field is **zero-based** — its `0` is this `1`. Values
     * outside `1`–`5` are clamped into range.
     */
    readonly priority?: number;
    /** Whether the module is switched on. Defaults to `true`; a module switched off draws nothing. */
    readonly enabled?: boolean;
    /**
     * `true` for a module that only draws while the hardpoints are deployed — every
     * weapon, and the utility fittings that are not
     * {@link OutfittingModule.alwaysPowered | always powered}. Defaults to `false`.
     */
    readonly deployedOnly?: boolean;
    /**
     * `true` when the caller knows the module draws power but cannot supply the value.
     * Its {@link PowerConsumer.draw | draw} is ignored and the consumer is named in
     * {@link PowerBudget.unknownDraws} instead of being counted as `0`.
     */
    readonly drawUnknown?: boolean;
    /**
     * Optional label for the module — the journal slot key when
     * {@link ShipLoadout.powerBudget} builds the consumer. Ignored by the maths, but it
     * is how a consumer reported in {@link PowerBudget.unknownDraws} names itself.
     */
    readonly label?: string;
}

/** One priority group's share of the power budget. */
export interface PowerBand {
    /** The group number, `1`–`5`. */
    readonly priority: number;
    /** This group's own draw with hardpoints retracted, in megawatts. */
    readonly retracted: number;
    /**
     * This group's own draw with hardpoints deployed, in megawatts — everything in
     * {@link PowerBand.retracted} plus the weapons, which only draw once the hardpoints
     * are out. Always ≥ `retracted`.
     */
    readonly deployed: number;
    /** Draw of this group and every higher-priority one, retracted, in megawatts. */
    readonly retractedTotal: number;
    /** Draw of this group and every higher-priority one, deployed, in megawatts. */
    readonly deployedTotal: number;
    /** Whether this group stays powered with hardpoints retracted. */
    readonly poweredRetracted: boolean;
    /** Whether this group stays powered with hardpoints deployed. */
    readonly poweredDeployed: boolean;
}

/** What a build's power plant makes and what the build asks of it. */
export interface PowerBudget {
    /** Power the plant generates, in megawatts, post-engineering. */
    readonly available: number;
    /** Total draw with hardpoints retracted, in megawatts. */
    readonly retracted: number;
    /** Total draw with hardpoints deployed, in megawatts — the figure that must fit. */
    readonly deployed: number;
    /** `available − deployed`, in megawatts. Negative means the build is over budget. */
    readonly headroom: number;
    /**
     * `deployed / available`, as a fraction (`0.93` = 93% of the plant used).
     * `Infinity` when a build draws power with no plant fitted, `0` when it draws none.
     */
    readonly utilisation: number;
    /** Whether the whole build stays powered with hardpoints deployed. */
    readonly withinBudget: boolean;
    /**
     * The five priority groups, `1` first. A group is powered when its running total —
     * its own draw plus every higher-priority group's — fits in `available`.
     */
    readonly bands: readonly PowerBand[];
    /**
     * The **enabled** consumers whose draw is unknown ({@link PowerConsumer.drawUnknown}),
     * handed straight back so a caller can name them — by
     * {@link PowerConsumer.label | label}, which is the journal slot key when
     * {@link ShipLoadout.powerBudget} built the list, or by identity for a
     * hand-assembled one. A switched-off module is skipped before the flag is read, so
     * it never appears here. Normally empty.
     *
     * **While it is not empty, every other figure here is a lower bound.** The unknown
     * draws contribute nothing to `retracted`, `deployed` or the bands, so `headroom`
     * and `utilisation` read too favourably and `withinBudget` and `poweredDeployed`
     * answer only for the draws that are known. The budget is still reported rather
     * than refused — the per-band detail is worth having, and one unknown module is not
     * a reason to withhold the other twenty — but a caller showing it should say so.
     */
    readonly unknownDraws: readonly PowerConsumer[];
}

/** Clamp a priority into `1`–`5`, defaulting an absent one to `1`. */
function bandIndex(priority: number | undefined): number {
    if (priority === undefined || !Number.isFinite(priority)) return 0;
    return Math.min(PRIORITY_GROUPS, Math.max(1, Math.trunc(priority))) - 1;
}

/**
 * Work out a build's power budget: what the plant makes, what the modules draw
 * retracted and deployed, and which priority groups survive.
 *
 * @param available - Power the plant generates, in megawatts (`0` when no plant is
 * fitted — every group then reads as unpowered). Must be finite and non-negative.
 * @param consumers - One entry per fitted module. Modules with `enabled: false` are
 * skipped; the rest fall into their {@link PowerConsumer.priority | priority} group.
 * @returns The {@link PowerBudget}.
 * @throws {RangeError} If `available`, or an enabled known consumer's `draw`, is not a
 * finite non-negative number. Disabled consumers and consumers marked `drawUnknown`
 * are skipped before their placeholder draw is validated.
 * @remarks
 * A group that draws *exactly* the power available stays online, matching the game —
 * only going over shuts anything down.
 *
 * A consumer flagged {@link PowerConsumer.drawUnknown} is left out of every total and
 * listed in {@link PowerBudget.unknownDraws}, which makes the rest of the answer a
 * lower bound rather than silently adding the module up as drawing nothing.
 * @example
 * ```ts
 * import { powerBudget } from '@elite-dangerous-almanac/core/ships/power';
 *
 * const budget = powerBudget(4.8, [
 *   { draw: 3.0, priority: 1 },
 *   { draw: 2.0, priority: 4 },  // over budget: this group goes dark
 * ]);
 * budget.withinBudget;               // -> false
 * budget.bands[3]?.poweredDeployed;  // -> false
 * budget.bands[0]?.poweredDeployed;  // -> true (priority 1 keeps its power)
 * ```
 */
export function powerBudget(available: number, consumers: readonly PowerConsumer[]): PowerBudget {
    if (!Number.isFinite(available) || available < 0) {
        throw new RangeError('powerBudget: available power must be a finite non-negative number');
    }

    const retractedByBand = Array<number>(PRIORITY_GROUPS).fill(0);
    const deployedByBand = Array<number>(PRIORITY_GROUPS).fill(0);
    const unknownDraws: PowerConsumer[] = [];

    for (const consumer of consumers) {
        if (consumer.enabled === false) continue;
        if (consumer.drawUnknown) {
            // Counting an unknown draw as 0 would report headroom the build may not
            // have; it is reported instead, and left out of every total.
            unknownDraws.push(consumer);
            continue;
        }
        if (!Number.isFinite(consumer.draw) || consumer.draw < 0) {
            throw new RangeError('powerBudget: consumer draw must be a finite non-negative number');
        }
        if (consumer.draw === 0) continue;
        const index = bandIndex(consumer.priority);
        if (consumer.deployedOnly) deployedByBand[index]! += consumer.draw;
        else retractedByBand[index]! += consumer.draw;
    }

    const bands: PowerBand[] = [];
    let retractedTotal = 0;
    let deployedTotal = 0;
    for (let i = 0; i < PRIORITY_GROUPS; i++) {
        const retracted = retractedByBand[i]!;
        const deployed = deployedByBand[i]!;
        retractedTotal += retracted;
        // Deployed includes everything that draws when retracted, plus the weapons.
        deployedTotal += retracted + deployed;
        bands.push({
            priority: i + 1,
            retracted,
            // A deployed build still draws everything it drew stowed.
            deployed: retracted + deployed,
            retractedTotal,
            deployedTotal,
            poweredRetracted: retractedTotal <= available + EPSILON,
            poweredDeployed: deployedTotal <= available + EPSILON,
        });
    }

    return {
        available,
        retracted: retractedTotal,
        deployed: deployedTotal,
        headroom: available - deployedTotal,
        utilisation: available > 0 ? deployedTotal / available : deployedTotal > 0 ? Infinity : 0,
        withinBudget: deployedTotal <= available + EPSILON,
        bands,
        unknownDraws,
    };
}
