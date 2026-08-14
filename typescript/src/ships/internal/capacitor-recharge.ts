/**
 * Scale a distributor's rated four-pip recharge to one pip allocation.
 *
 * Reference model: EDCD/Coriolis. Credit and licence terms are in
 * [ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md).
 *
 * @param ratedRecharge - Recharge at four pips, in energy per second.
 * @param pips - Validated capacitor allocation in `[0, 4]`.
 * @returns Recharge at `pips`, in the same units as `ratedRecharge`.
 * @internal
 */
export function capacitorRechargeAtPips(ratedRecharge: number, pips: number): number {
    return ratedRecharge * Math.pow(pips / 4, 1.1);
}
