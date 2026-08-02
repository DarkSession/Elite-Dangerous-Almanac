/**
 * The bridge between journal Modifier Labels and the catalogue fields that hold their
 * base values — including the **unit and algebra** each label uses, which are not
 * always the catalogue's.
 *
 * Its own module so that code needing only the mapping — resolving a pre-engineered
 * variant's stats, say — does not pull in the blueprint and experimental-effect
 * catalogues alongside it.
 *
 * @internal
 */

import type { OutfittingModule } from './modules.js';

/** One journal modifier label and how it relates to the catalogue field behind it. */
export interface StatLabel {
    /**
     * The Modifier Label, e.g. `"FSDOptimalMass"` — a journal's own spelling, except for
     * `"BurstInterval"`, which blueprint recipes use for the stat a journal reports as
     * the resulting `"RateOfFire"`.
     */
    readonly label: string;
    /** The catalogue field holding the base value. */
    readonly field: keyof OutfittingModule;
    /**
     * Journal value ÷ catalogue value. `1` for the stats both express the same way
     * (mass in tonnes, power in MW); `100` for the ones the journal reports as a
     * percentage while the catalogue stores a fraction (a 40% resistance is `40` in a
     * journal and `0.4` here).
     */
    readonly scale?: number;
    /**
     * For a stat that is really a **percentage of a multiplier**, the base the game
     * divides by before compounding — Frontier's `modmod`, `100` or `-100`.
     *
     * @remarks
     * These stats do not scale like an ordinary number. A bulkhead's `+80%` hull boost
     * engineered by a `+32%` blueprint becomes `137.6%`, not `105.6%`, because the
     * multiplier `1.8` is what gets multiplied by `1.32`. A resistance works the same
     * way on its *damage multiplier*, so the base is negative: a `-20%` kinetic
     * resistance (a ×1.2 damage multiplier) with a `+5%` blueprint becomes `-14%`
     * (×1.14). Both are folded by {@link computeModifiers}, whatever method the
     * blueprint declares.
     */
    readonly multiplierBase?: number;
    /**
     * The value the game assumes when a module does not carry this stat at all — a
     * weapon with no `roundsPerShot` fires one round per shot, and one with no burst
     * fires a single shot per burst. A recipe can modify a defaulted stat (Double Shot
     * gives a plain multi-cannon a two-round burst), so the default belongs in the base
     * values {@link computeModifiers} folds.
     */
    readonly defaultBase?: number;
}

const percent = 100;

/**
 * Journal modifier label → catalogue field holding its base value.
 *
 * Not injective in either direction by design: a module carries one optimal mass, and
 * which label names it depends on the module's kind, so several labels share `optMass`.
 *
 * @internal
 */
export const STAT_LABELS: readonly StatLabel[] = [
    { label: 'Mass', field: 'mass' },
    { label: 'Integrity', field: 'integrity' },
    { label: 'PowerDraw', field: 'powerDraw' },
    { label: 'BootTime', field: 'bootTime' },

    // ── Core performance ────────────────────────────────────────────────────
    { label: 'FSDOptimalMass', field: 'optMass' },
    { label: 'EngineOptimalMass', field: 'optMass' },
    { label: 'EngineMinimumMass', field: 'minMass' },
    { label: 'MaximumMass', field: 'maxMass' },
    { label: 'ShieldGenOptimalMass', field: 'optMass' },
    { label: 'ShieldGenMinimumMass', field: 'minMass' },
    { label: 'ShieldGenMaximumMass', field: 'maxMass' },
    { label: 'EngineOptPerformance', field: 'optMultiplier', scale: percent },
    { label: 'EngineMinPerformance', field: 'minMultiplier', scale: percent },
    { label: 'EngineMaxPerformance', field: 'maxMultiplier', scale: percent },
    { label: 'ShieldGenStrength', field: 'optMultiplier', scale: percent },
    { label: 'ShieldGenMinStrength', field: 'minMultiplier', scale: percent },
    { label: 'ShieldGenMaxStrength', field: 'maxMultiplier', scale: percent },
    { label: 'MaxFuelPerJump', field: 'maxFuel' },
    { label: 'PowerCapacity', field: 'powerCapacity' },
    { label: 'HeatEfficiency', field: 'heatEfficiency' },
    { label: 'EnginesCapacity', field: 'enginesCapacity' },
    { label: 'EnginesRecharge', field: 'enginesRecharge' },
    { label: 'SystemsCapacity', field: 'systemsCapacity' },
    { label: 'SystemsRecharge', field: 'systemsRecharge' },
    { label: 'WeaponsCapacity', field: 'weaponsCapacity' },
    { label: 'WeaponsRecharge', field: 'weaponsRecharge' },
    { label: 'FuelCapacity', field: 'fuelCapacity' },
    { label: 'CargoCapacity', field: 'cargoCapacity' },
    { label: 'RegenRate', field: 'shieldRegenRate' },
    { label: 'BrokenRegenRate', field: 'shieldBrokenRegenRate' },

    // ── Defence ─────────────────────────────────────────────────────────────
    {
        label: 'DefenceModifierShieldMultiplier',
        field: 'shieldBoost',
        scale: percent,
        multiplierBase: percent,
    },
    // On an armour module this scales the bulkhead's own hull boost, which the
    // catalogue carries. A hull reinforcement package has no base hull boost — the
    // game's modifier *is* the bonus — so nothing resolves for it and the label stays
    // uncomputable there rather than silently resolving to zero.
    {
        label: 'DefenceModifierHealthMultiplier',
        field: 'hullBoost',
        scale: percent,
        multiplierBase: percent,
    },
    { label: 'DefenceModifierHealthAddition', field: 'hullReinforcement' },
    { label: 'DefenceModifierShieldAddition', field: 'shieldAddition' },
    {
        label: 'KineticResistance',
        field: 'kineticResistance',
        scale: percent,
        multiplierBase: -percent,
    },
    // The journal spells thermal resistance "Thermic" — the one thermal stat that
    // does not read "Thermal".
    {
        label: 'ThermicResistance',
        field: 'thermalResistance',
        scale: percent,
        multiplierBase: -percent,
    },
    {
        label: 'ExplosiveResistance',
        field: 'explosiveResistance',
        scale: percent,
        multiplierBase: -percent,
    },
    {
        label: 'CausticResistance',
        field: 'causticResistance',
        scale: percent,
        multiplierBase: -percent,
    },
    { label: 'DamageProtection', field: 'moduleProtection', scale: percent },
    { label: 'ModuleDefenceAbsorption', field: 'moduleProtection', scale: percent },

    // ── Weapons ─────────────────────────────────────────────────────────────
    { label: 'Damage', field: 'damage' },
    { label: 'Rounds', field: 'roundsPerShot', defaultBase: 1 },
    { label: 'RoundsPerShot', field: 'roundsPerShot', defaultBase: 1 },
    { label: 'RateOfFire', field: 'rateOfFire' },
    { label: 'BurstInterval', field: 'burstInterval' },
    { label: 'BurstSize', field: 'burstRounds', defaultBase: 1 },
    { label: 'BurstRateOfFire', field: 'burstRateOfFire', defaultBase: 1 },
    { label: 'AmmoClipSize', field: 'clipSize' },
    { label: 'AmmoMaximum', field: 'ammoMaximum' },
    { label: 'ReloadTime', field: 'reloadTime' },
    { label: 'DistributorDraw', field: 'distributorDraw' },
    { label: 'ThermalLoad', field: 'thermalLoad' },
    { label: 'ArmourPenetration', field: 'armourPiercing' },
    { label: 'Range', field: 'maximumRange' },
    { label: 'MaximumRange', field: 'maximumRange' },
    { label: 'FalloffRange', field: 'falloffRange' },
    { label: 'ShotSpeed', field: 'shotSpeed' },
    { label: 'Jitter', field: 'jitter' },
];

const BY_LABEL = new Map(STAT_LABELS.map((entry) => [entry.label, entry]));

/**
 * Convert catalogue stats to base values keyed by journal Modifier Label, **in the
 * journal's own units** — so the modifiers {@link computeModifiers} returns are
 * journal-shaped and can be written straight onto a fitted module.
 *
 * @internal
 */
export function baseStats(stats: OutfittingModule): Record<string, number> {
    const base: Record<string, number> = {};
    for (const { label, field, scale, defaultBase } of STAT_LABELS) {
        const value = stats[field];
        if (typeof value === 'number') base[label] = value * (scale ?? 1);
        // A stat the module leaves out but the game still assumes a value for can be
        // engineered from that assumed value.
        else if (defaultBase !== undefined && isWeapon(stats)) base[label] = defaultBase;
    }
    return base;
}

/** Whether a record is a weapon — the only modules the defaulted stats apply to. */
function isWeapon(stats: OutfittingModule): boolean {
    return stats.damage !== undefined;
}

/**
 * The catalogue field a journal modifier label writes back to, or `null` when the
 * catalogue carries no base value for that label (a scanner's probe radius, say).
 *
 * @internal
 */
export function fieldForLabel(label: string): keyof OutfittingModule | null {
    return BY_LABEL.get(label)?.field ?? null;
}

/**
 * Journal value ÷ catalogue value for a label — `100` for the stats a journal reports
 * as a percentage, `1` for everything else (and for unknown labels).
 *
 * @internal
 */
export function scaleForLabel(label: string): number {
    return BY_LABEL.get(label)?.scale ?? 1;
}

/**
 * The `modmod` base a label compounds through, or `null` for the ordinary stats that
 * scale directly. See {@link StatLabel.multiplierBase}.
 *
 * @internal
 */
export function multiplierBaseForLabel(label: string): number | null {
    return BY_LABEL.get(label)?.multiplierBase ?? null;
}

/**
 * Every journal modifier label that writes to a catalogue field — the inverse of
 * {@link fieldForLabel}, and not single-valued: a shield generator's optimal mass is
 * `ShieldGenOptimalMass` while a drive's is `FSDOptimalMass`, and both land on
 * `optMass`.
 *
 * @internal
 */
export function labelsForField(field: keyof OutfittingModule): string[] {
    return STAT_LABELS.filter((entry) => entry.field === field).map((entry) => entry.label);
}
