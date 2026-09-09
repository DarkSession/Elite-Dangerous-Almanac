using System;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The capability checks a sparse outfitting record is held to.</summary>
/// <remarks>
/// An outfitting module represents every family, so the stats it carries are sparse. Each check
/// here asks only whether one calculation's stat group is complete. None of them infers identity
/// from a symbol or requires an unrelated family label, so a hand-built record satisfies a check
/// the same way a catalogue record does.
/// </remarks>
public static class ModuleCapabilities
{
    /// <summary>Whether the stats carry complete frame shift drive jump constants.</summary>
    /// <param name="stats">The module's stats, or <see langword="null"/> for no module at all.</param>
    /// <returns><see langword="true"/> where the optimised mass, maximum fuel and both fuel constants are all stated.</returns>
    public static bool HasFrameShiftDriveJumpStats(ModuleStats? stats) => Has(
        stats,
        ModuleStat.OptMass,
        ModuleStat.MaxFuel,
        ModuleStat.FuelMul,
        ModuleStat.FuelPower);

    /// <summary>Whether the stats carry a complete power plant output and heat efficiency.</summary>
    /// <param name="stats">The module's stats, or <see langword="null"/> for no module at all.</param>
    /// <returns><see langword="true"/> where both the power capacity and the heat efficiency are stated.</returns>
    public static bool HasPowerGenerationStats(ModuleStats? stats) =>
        Has(stats, ModuleStat.PowerCapacity, ModuleStat.HeatEfficiency);

    /// <summary>Whether the stats carry all three distributor capacitor pairs.</summary>
    /// <param name="stats">The module's stats, or <see langword="null"/> for no module at all.</param>
    /// <returns><see langword="true"/> where every capacity and recharge rate is stated.</returns>
    public static bool HasPowerDistributorStats(ModuleStats? stats) => Has(
        stats,
        ModuleStat.WeaponsCapacity,
        ModuleStat.WeaponsRecharge,
        ModuleStat.EnginesCapacity,
        ModuleStat.EnginesRecharge,
        ModuleStat.SystemsCapacity,
        ModuleStat.SystemsRecharge);

    /// <summary>Whether the stats carry a complete three-point mass curve.</summary>
    /// <param name="stats">The module's stats, or <see langword="null"/> for no module at all.</param>
    /// <returns>
    /// <see langword="true"/> where all three masses and all three multipliers are stated. Both
    /// thrusters and shield generators satisfy this.
    /// </returns>
    public static bool HasMassCurveStats(ModuleStats? stats) => Has(
        stats,
        ModuleStat.OptMass,
        ModuleStat.MinMass,
        ModuleStat.MaxMass,
        ModuleStat.OptMultiplier,
        ModuleStat.MinMultiplier,
        ModuleStat.MaxMultiplier);

    /// <summary>Whether the stats carry both shield regeneration rates.</summary>
    /// <param name="stats">The module's stats, or <see langword="null"/> for no module at all.</param>
    /// <returns><see langword="true"/> where both the raised and the broken rate are stated.</returns>
    public static bool HasShieldRegenerationStats(ModuleStats? stats) =>
        Has(stats, ModuleStat.ShieldRegenRate, ModuleStat.ShieldBrokenRegenRate);

    /// <summary>Whether the stats carry a damage figure.</summary>
    /// <param name="stats">The module's stats, or <see langword="null"/> for no module at all.</param>
    /// <returns><see langword="true"/> where the damage is stated.</returns>
    /// <remarks>
    /// The other firing stats stay optional, because continuous-fire and ammunition-free weapons
    /// legitimately leave out different ones.
    /// </remarks>
    public static bool HasWeaponDamageStats(ModuleStats? stats) => Has(stats, ModuleStat.Damage);

    /// <summary>Whether the module carries a complete stat group.</summary>
    /// <param name="module">The module, or <see langword="null"/> for no module at all.</param>
    /// <param name="capability">The check to apply.</param>
    /// <returns>What the check answers for the module's stats.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="capability"/> is <see langword="null"/>.</exception>
    public static bool Has(OutfittingModule? module, Func<ModuleStats?, bool> capability)
    {
        if (capability is null) throw new ArgumentNullException(nameof(capability));

        return capability(module?.Stats);
    }

    private static bool Has(ModuleStats? stats, params ModuleStat[] wanted)
    {
        if (stats is null) return false;

        foreach (ModuleStat stat in wanted)
        {
            if (!stats.Has(stat)) return false;
        }

        return true;
    }
}
