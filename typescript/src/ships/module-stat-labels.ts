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

import type { DamageDistribution, OutfittingModule } from './modules.js';

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
     * Member within {@link DamageDistribution} when `field` is `damageDistribution`.
     * Absent for ordinary scalar module stats.
     */
    readonly damageType?: keyof DamageDistribution;
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
    { label: 'EngineHeatRate', field: 'engineHeatRate' },
    { label: 'FSDHeatRate', field: 'fsdHeatRate' },
    { label: 'MaxFuelPerJump', field: 'maxFuel' },
    { label: 'PowerCapacity', field: 'powerCapacity' },
    { label: 'HeatEfficiency', field: 'heatEfficiency' },
    { label: 'EnginesCapacity', field: 'enginesCapacity' },
    { label: 'EnginesRecharge', field: 'enginesRecharge' },
    { label: 'SystemsCapacity', field: 'systemsCapacity' },
    { label: 'SystemsRecharge', field: 'systemsRecharge' },
    { label: 'WeaponsCapacity', field: 'weaponsCapacity' },
    { label: 'WeaponsRecharge', field: 'weaponsRecharge' },
    { label: 'RefuelRate', field: 'refuelRate' },
    { label: 'FuelCapacity', field: 'fuelCapacity' },
    { label: 'CargoCapacity', field: 'cargoCapacity' },
    { label: 'RegenRate', field: 'shieldRegenRate' },
    { label: 'BrokenRegenRate', field: 'shieldBrokenRegenRate' },
    // A shield generator's distributor draw is the systems-capacitor cost of one MJ per
    // second of regeneration, and the journal gives it its own label rather than reusing
    // a weapon's `DistributorDraw`. Same catalogue field, both spellings.
    { label: 'EnergyPerRegen', field: 'distributorDraw' },

    // ── Shield cell banks ───────────────────────────────────────────────────
    { label: 'ShieldBankReinforcement', field: 'shieldBankReinforcement' },
    { label: 'ShieldBankHeat', field: 'shieldBankHeat' },
    // A cell bank's heat is also the `thermalLoad` its record has always carried — the
    // same figure from the same upstream field — so a recipe that moves it moves both.
    { label: 'ShieldBankHeat', field: 'thermalLoad' },
    { label: 'ShieldBankSpinUp', field: 'shieldBankSpinUp' },
    { label: 'ShieldBankDuration', field: 'shieldBankDuration' },

    // ── Scanning, and the FSD interdictor ───────────────────────────────────
    // Utility scanners and sensor suites share one range field. The weapon range below
    // remains separate even though a journal can spell either kind `Range`.
    { label: 'ScannerRange', field: 'scannerRange' },
    { label: 'SensorTargetScanAngle', field: 'scanAngle' },
    // The utility scanners' scan cone is the same stat under the journal's other name.
    { label: 'MaxAngle', field: 'scanAngle' },
    { label: 'ScannerTimeToScan', field: 'scanTime' },
    // The blueprint recipe says `ProbeRadius`; a journal writes `DSS_PatchRadius` for
    // the same stat on the same module. Both resolve.
    { label: 'ProbeRadius', field: 'probeRadius' },
    { label: 'DSS_PatchRadius', field: 'probeRadius' },
    { label: 'FSDInterdictorFacingLimit', field: 'interdictorFacingLimit' },
    { label: 'FSDInterdictorRange', field: 'interdictorRange' },

    // ── Defence ─────────────────────────────────────────────────────────────
    {
        label: 'DefenceModifierShieldMultiplier',
        field: 'shieldBoost',
        scale: percent,
        multiplierBase: percent,
    },
    // On an armour module this scales the bulkhead's own hull boost, which the catalogue
    // carries. A hull reinforcement package carries none, and because this is a
    // percentage-of-a-multiplier stat that absence is itself a value — no hull boost is a
    // ×1 multiplier, 0% — so it resolves from zero and the recipe's bonus *is* the
    // result, which is how the game reads it and what a journal reports
    // (`OriginalValue: 0`). See `multiplierBase` and {@link computeModifiers}.
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
    // `Range` is a weapon's maximum range and the journal's alternate spelling of a
    // scanner's `ScannerRange`. A record resolves it to the field that family carries.
    { label: 'Range', field: 'maximumRange' },
    { label: 'Range', field: 'scannerRange' },
    { label: 'MaximumRange', field: 'maximumRange' },
    { label: 'FalloffRange', field: 'falloffRange' },
    // A journal spells the same stat `DamageFalloffRange`, where a blueprint recipe says
    // `FalloffRange`. Both resolve, as `ProbeRadius` / `DSS_PatchRadius` do.
    { label: 'DamageFalloffRange', field: 'falloffRange' },
    { label: 'ShotSpeed', field: 'shotSpeed' },
    // Damage-type shares are percentages in a journal and fractions in the catalogue.
    // They live one level below the module record, so `damageType` names the member the
    // otherwise-flat label mapping reads and writes.
    {
        label: '$Kinetic;',
        field: 'damageDistribution',
        damageType: 'kinetic',
        scale: percent,
        defaultBase: 0,
    },
    {
        label: '$Thermal;',
        field: 'damageDistribution',
        damageType: 'thermal',
        scale: percent,
        defaultBase: 0,
    },
    {
        label: '$Explosive;',
        field: 'damageDistribution',
        damageType: 'explosive',
        scale: percent,
        defaultBase: 0,
    },
    {
        label: '$Absolute;',
        field: 'damageDistribution',
        damageType: 'absolute',
        scale: percent,
        defaultBase: 0,
    },
    // A weapon that carries no jitter fires true, and Rapid Fire, its multi-cannon spelling
    // and Inertial Impact all give one — which a journal confirms, reporting
    // `OriginalValue: 0` for a missile rack whose record holds no such field.
    // {@link computeModifiers} already reaches the right result without this, because an
    // additive leg starts from zero on its own; the default is what makes the *base*
    // explicit, so a computed modifier states the same `OriginalValue` the game does
    // instead of omitting it.
    { label: 'Jitter', field: 'jitter', defaultBase: 0 },
];

/**
 * Every entry for a label, in declaration order. Usually one; `Range` and
 * `ShieldBankHeat` have two each, because the modules that carry those stats keep them
 * in different catalogue fields. The first entry is the label's own answer for
 * everything that does not depend on which module is being asked about.
 */
const BY_LABEL: ReadonlyMap<string, readonly StatLabel[]> = (() => {
    const entries = new Map<string, StatLabel[]>();
    for (const entry of STAT_LABELS) {
        const forLabel = entries.get(entry.label) ?? [];
        forLabel.push(entry);
        entries.set(entry.label, forLabel);
    }
    return entries;
})();

const LABELS_BY_FIELD: ReadonlyMap<keyof OutfittingModule, readonly string[]> = (() => {
    const labels = new Map<keyof OutfittingModule, string[]>();
    for (const entry of STAT_LABELS) {
        // Nested damage shares are read together by `damageDistributionFor`; exposing
        // them as scalar field labels would make `effectiveStat` return one share where
        // callers expect the whole record.
        if (entry.damageType !== undefined) continue;
        const fieldLabels = labels.get(entry.field) ?? [];
        fieldLabels.push(entry.label);
        labels.set(entry.field, fieldLabels);
    }
    return labels;
})();

/**
 * Convert catalogue stats to base values keyed by journal Modifier Label, **in the
 * journal's own units** — so the modifiers {@link computeModifiers} returns are
 * journal-shaped and can be written straight onto a fitted module.
 *
 * @internal
 */
export function baseStats(stats: OutfittingModule): Record<string, number> {
    const base: Record<string, number> = {};
    for (const { label, field, damageType, scale, defaultBase } of STAT_LABELS) {
        if (base[label] !== undefined) continue; // an earlier entry already answered
        const value =
            damageType === undefined ? stats[field] : stats.damageDistribution?.[damageType];
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
 * catalogue models no field for that label at all.
 *
 * @param label - The journal Modifier Label.
 * @param stats - The record the label is being resolved against, when there is one.
 * A label that maps to two fields — `Range` or `ShieldBankHeat` — answers with whichever
 * of them the record carries; without a record it answers with the first.
 *
 * @internal
 */
export function fieldForLabel(
    label: string,
    stats?: OutfittingModule,
): keyof OutfittingModule | null {
    const entries = BY_LABEL.get(label);
    if (!entries || entries.length === 0) return null;
    if (stats && entries.length > 1) {
        const carried = entries.find((entry) => typeof stats[entry.field] === 'number');
        if (carried) return carried.field;
    }
    return entries[0]!.field;
}

/**
 * The damage-distribution member a journal modifier label names, or `null` for an
 * ordinary scalar stat or an unknown label.
 *
 * @internal
 */
export function damageTypeForLabel(label: string): keyof DamageDistribution | null {
    return BY_LABEL.get(label)?.[0]?.damageType ?? null;
}

/**
 * Journal labels that name one damage-distribution member, in declaration order.
 *
 * @internal
 */
export function labelsForDamageType(type: keyof DamageDistribution): readonly string[] {
    return STAT_LABELS.filter((entry) => entry.damageType === type).map((entry) => entry.label);
}

/**
 * Journal value ÷ catalogue value for a label — `100` for the stats a journal reports
 * as a percentage, `1` for everything else (and for unknown labels).
 *
 * @internal
 */
export function scaleForLabel(label: string): number {
    return BY_LABEL.get(label)?.[0]?.scale ?? 1;
}

/**
 * The `modmod` base a label compounds through, or `null` for the ordinary stats that
 * scale directly. See {@link StatLabel.multiplierBase}.
 *
 * @internal
 */
export function multiplierBaseForLabel(label: string): number | null {
    return BY_LABEL.get(label)?.[0]?.multiplierBase ?? null;
}

/**
 * Every journal modifier label that writes to a catalogue field — the inverse of
 * {@link fieldForLabel}, and not single-valued: a shield generator's optimal mass is
 * `ShieldGenOptimalMass` while a drive's is `FSDOptimalMass`, and both land on
 * `optMass`.
 *
 * @internal
 */
export function labelsForField(field: keyof OutfittingModule): readonly string[] {
    return LABELS_BY_FIELD.get(field) ?? [];
}
