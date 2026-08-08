/**
 * **Ammunition capacity** — how many rounds a module holds when fully rearmed: the
 * magazine, the reserve behind it, and the two together.
 *
 * A journal reports what is *loaded* right now (`AmmoInClip`, `AmmoInHopper`); this
 * module reports what the module *can* hold, which is a property of the build rather
 * than of the moment it was captured. The two catalogue stats behind it are
 * {@link OutfittingModule.clipSize} and {@link OutfittingModule.ammoMaximum}.
 *
 * It is not only weapons: chaff, heat-sink and caustic-sink launchers, point defence,
 * shield cell banks and AFMUs all carry a reserve, and are answered here on the same
 * terms.
 *
 * @example
 * ```ts
 * import { ammunitionCapacity } from '@elite-dangerous-almanac/core/ships/ammunition';
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
 *
 * const mc = getModuleBySymbol('Hpt_MultiCannon_Fixed_Small', HARDPOINT_MODULES)!;
 * ammunitionCapacity(mc); // -> { clipSize: 100, hopper: 2100, total: 2200, unlimited: false }
 * ```
 *
 * @packageDocumentation
 */

/**
 * The two stats an ammunition capacity is read from.
 *
 * @remarks
 * An {@link OutfittingModule} record satisfies this as-is, so a catalogue entry — or a
 * post-engineering record from `FittedModule.effectiveStats` — can be passed straight in.
 */
export interface AmmunitionStats {
    /** Rounds a full magazine holds. Absent on a module that never reloads. */
    readonly clipSize?: number;
    /** Reserve rounds behind the magazine. Absent means nothing limits them. */
    readonly ammoMaximum?: number;
}

/** What a module holds when fully rearmed, as {@link ammunitionCapacity} reports it. */
export interface AmmunitionCapacity {
    /**
     * Rounds a full magazine holds — the catalogue's `clipSize`, and the largest
     * `AmmoInClip` a journal can report for this module.
     */
    readonly clipSize: number;
    /**
     * Reserve rounds behind the magazine — the catalogue's `ammoMaximum`, and the largest
     * `AmmoInHopper` a journal can report. It does **not** include the magazine, exactly
     * as the journal's own field does not. `Infinity` when nothing limits it (see
     * {@link unlimited}).
     */
    readonly hopper: number;
    /** Rounds carried when fully rearmed — `clipSize + hopper`. `Infinity` when {@link unlimited}. */
    readonly total: number;
    /**
     * Whether the reserve is unlimited — the record states a magazine but no reserve to
     * refill it from, which in the catalogues is the mining Abrasion Blaster.
     */
    readonly unlimited: boolean;
}

/**
 * What a module holds when fully rearmed.
 *
 * @param stats - The module's stats. A catalogue record works as-is; pass a
 * post-engineering record (`FittedModule.effectiveStats`, `effectiveModule`) to get the
 * capacity a build actually flies with: fifteen blueprints move one figure or both, High
 * Capacity and the three launcher-capacity recipes among them. No experimental effect does.
 * @returns The {@link AmmunitionCapacity}, or `null` for a module that carries no
 * ammunition at all — the lasers, which state neither figure because they draw from the
 * weapons capacitor instead.
 * @remarks
 * **Figures are reported as the stats give them.** Every recipe that moves ammunition is
 * multiplicative, so a roll that is not a whole multiple leaves a fraction — a small
 * cannon under High Capacity at grade 3 holds `10.08` — and the game loads whole rounds.
 * Nothing here rounds, because no source pins which way the game does:
 * <https://github.com/DarkSession/Elite-Dangerous-Almanac/issues/57>. `sustainedFireFactor`
 * in `./weapons` has to pick, and rounds the clip **up**.
 * @example
 * ```ts
 * ammunitionCapacity(getModuleBySymbol('Hpt_ChaffLauncher_Tiny', UTILITY_MODULES)!);
 * // -> { clipSize: 1, hopper: 10, total: 11, unlimited: false }
 *
 * ammunitionCapacity(getModuleBySymbol('Hpt_BeamLaser_Fixed_Small', HARDPOINT_MODULES)!);
 * // -> null — a beam laser has no ammunition to count
 * ```
 */
export function ammunitionCapacity(
    stats: AmmunitionStats | null | undefined,
): AmmunitionCapacity | null {
    if (!stats) return null;
    const { clipSize, ammoMaximum } = stats;
    if (clipSize === undefined && ammoMaximum === undefined) return null;
    const clip = clipSize ?? 0;
    // A magazine with no reserve stated is one nothing stops refilling; a reserve with no
    // magazine stated (an AFMU) is drawn from directly.
    const unlimited = clipSize !== undefined && ammoMaximum === undefined;
    const hopper = unlimited ? Number.POSITIVE_INFINITY : (ammoMaximum ?? 0);
    return { clipSize: clip, hopper, total: clip + hopper, unlimited };
}
