using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <content>What the fitted systems do with the power, the heat and the shots.</content>
public sealed partial class BuildMetrics
{
    /// <summary>The build's power budget.</summary>
    /// <returns>
    /// What the plant makes, what the modules draw with the hardpoints retracted and deployed,
    /// and which power bands stay lit. The consumers are the modules that draw something, so a
    /// passive or a zero-draw fitting is absent.
    /// </returns>
    /// <remarks>
    /// Draws are post-engineering, a module switched off in the capture is skipped, and a weapon
    /// — with the utility fittings that are not always powered — counts towards the deployed
    /// total alone.
    /// </remarks>
    /// <exception cref="ArgumentOutOfRangeException">
    /// A power capacity or a module draw is negative or not a finite figure.
    /// </exception>
    public PowerBudget PowerBudget()
    {
        IReadOnlyList<LoadoutModule> modules = build.Modules;
        List<PowerConsumer> consumers = [];
        foreach (LoadoutModule module in modules)
        {
            if (LoadoutMetrics.PowerConsumerFor(module, build.StatsFor(module))
                is PowerConsumer consumer)
            {
                consumers.Add(consumer);
            }
        }

        return Power.Budget(LoadoutMetrics.PowerAvailable(modules, build.StatsFor), consumers);
    }

    /// <summary>The build's heat.</summary>
    /// <returns>
    /// The heat figures, or the state of the fitted power plant that stopped them: missing when
    /// none is fitted, disabled when it is switched off, and unresolved when its record states no
    /// heat efficiency.
    /// </returns>
    public CalculationResult<HeatMetrics> HeatMetricsResult()
    {
        CalculationResult<HeatInput> input = LoadoutMetrics.HeatInputResultFor(
            build.Hull, build.ModulesForEffectiveStats(), PowerBudget(), build.StatsFor);
        return input.Complete
            ? CalculationResult.Of(Heat.Metrics(input.Value))
            : CalculationResult.Unavailable<HeatMetrics>(input.Issues);
    }

    /// <summary>The build's speed and handling at one load.</summary>
    /// <param name="load">The fuel and the cargo. Omit it for a full tank and an empty hold.</param>
    /// <returns>
    /// The mobility figures, or the input or fitted-module state that stopped them.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The fuel or the cargo is not a finite figure of zero or more.
    /// </exception>
    public CalculationResult<MobilityMetrics> MobilityMetricsResult(BuildLoad? load = null)
    {
        CalculationResult<MobilityInput> input = MobilityInput(load);
        return input.Complete
            ? CalculationResult.Of(Mobility.Metrics(input.Value)!)
            : CalculationResult.Unavailable<MobilityMetrics>(input.Issues);
    }

    /// <summary>The build's engines capacitor at one load and one allocation.</summary>
    /// <param name="load">The fuel and the cargo. Omit it for a full tank and an empty hold.</param>
    /// <param name="enginesPips">
    /// The pips fed to the engines capacitor, from zero through four. Four reproduces the
    /// mobility figures exactly.
    /// </param>
    /// <returns>
    /// The capacitor figures, or the same states the mobility figures report, the two reading one
    /// build.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The fuel or the cargo is not a finite figure of zero or more, or the allocation is outside
    /// zero through four.
    /// </exception>
    public CalculationResult<MobilityCapacitorMetrics> MobilityCapacitorMetricsResult(
        BuildLoad? load = null,
        double enginesPips = 4)
    {
        RangeGuards.RequirePips(enginesPips, nameof(enginesPips));
        CalculationResult<MobilityInput> input = MobilityInput(load);
        return input.Complete
            ? CalculationResult.Of(MobilityCapacitor.Metrics(input.Value, enginesPips)!)
            : CalculationResult.Unavailable<MobilityCapacitorMetrics>(input.Issues);
    }

    /// <summary>The build's bare shields, which take no pips.</summary>
    /// <returns>
    /// The shield figures, or the input or fitted-module state that stopped them.
    /// </returns>
    public CalculationResult<ShieldMetrics> ShieldMetricsResult()
    {
        CalculationResult<ShieldInput> input = LoadoutMetrics.ShieldInputResultFor(
            build.Hull, build.Modules, PowerBudget, build.StatsFor);
        return input.Complete
            ? CalculationResult.Of(Shields.Metrics(input.Value))
            : CalculationResult.Unavailable<ShieldMetrics>(input.Issues);
    }

    /// <summary>The build's systems capacitor and the resistance it buys.</summary>
    /// <param name="systemsPips">
    /// The pips fed to the systems capacitor, from zero through four. Four is a full capacitor,
    /// which is the condition the game's own panel quotes. Zero is the bare shield, whose
    /// effective figures then equal the shield figures.
    /// </param>
    /// <returns>
    /// The capacitor figures, or the shield states plus an unresolved distributor whose record
    /// states no systems capacity or recharge.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The allocation is outside zero through four.
    /// </exception>
    public CalculationResult<ShieldCapacitorMetrics> ShieldCapacitorMetricsResult(
        double systemsPips = 4)
    {
        RangeGuards.RequirePips(systemsPips, nameof(systemsPips));
        CalculationResult<ShieldCapacitorInput> input =
            LoadoutMetrics.ShieldCapacitorInputResultFor(
                build.Hull, build.Modules, PowerBudget, build.StatsFor);
        return input.Complete
            ? CalculationResult.Of(ShieldCapacitor.Metrics(input.Value, systemsPips))
            : CalculationResult.Unavailable<ShieldCapacitorMetrics>(input.Issues);
    }

    /// <summary>The time the build's collapsed shield takes to come back.</summary>
    /// <param name="systemsPips">
    /// The pips fed to the systems capacitor, from zero through four, which feed the recovery.
    /// Four is the condition the game reports a recovery at.
    /// </param>
    /// <returns>
    /// The recovery figures, or the input or fitted-module state that stopped them.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The allocation is outside zero through four.
    /// </exception>
    public CalculationResult<ShieldRecoveryMetrics> ShieldRecoveryResult(double systemsPips = 4)
    {
        RangeGuards.RequirePips(systemsPips, nameof(systemsPips));
        CalculationResult<ShieldRecoveryInput> input =
            LoadoutMetrics.ShieldRecoveryInputResultFor(
                build.Hull, build.Modules, PowerBudget, build.StatsFor);
        return input.Complete
            ? CalculationResult.Of(ShieldRecovery.Metrics(input.Value, systemsPips))
            : CalculationResult.Unavailable<ShieldRecoveryMetrics>(input.Issues);
    }

    /// <summary>Every fitted shield cell bank and the pool a rearmed set of them restores.</summary>
    /// <returns>
    /// The banks in the hull's mount order, and the totals. Every fitted bank is listed, and each
    /// says whether it is switched on and whether its power band is fed with the hardpoints
    /// deployed. The totals count the powered banks alone, so a build whose plant is off or
    /// outdrawn reports every bank unpowered and no pool at all.
    /// </returns>
    public CellBankSummary CellBanks() =>
        ShieldRecovery.SummariseCellBanks(LoadoutState.OrderByLayout(
            LoadoutMetrics.CellBankInputsFor(build.Modules, PowerBudget(), build.StatsFor),
            build.Layout(),
            bank => bank.Slot));

    /// <summary>The build's armour.</summary>
    /// <returns>
    /// The hull points, what the bulkhead and each reinforcement contribute, and the effective
    /// resistances.
    /// </returns>
    public ArmourMetrics ArmourMetrics() => Armour.Metrics(
        LoadoutMetrics.ArmourInputFor(build.Hull, build.Modules, build.StatsFor));

    /// <summary>The build's firepower.</summary>
    /// <returns>
    /// Every fitted weapon with its own figures, and the totals across the enabled ones. Every
    /// figure is post-engineering. A weapon switched off in the capture is still listed, with its
    /// own figures, and joins no total.
    /// </returns>
    public BuildWeaponMetrics WeaponMetrics()
    {
        List<FittedWeaponMetrics> weapons = [];
        foreach (LoadoutModule module in build.Modules)
        {
            OutfittingModule? record = build.StatsFor(module);
            WeaponStats? stats = LoadoutMetrics.WeaponStatsFor(
                build.ModuleForEffectiveStats(module), record);
            if (stats is null) continue;

            weapons.Add(new FittedWeaponMetrics(
                module.Slot,
                module.Item,
                record?.Name ?? module.Item,
                module.On != false,
                Weapons.Metrics(stats),
                Ammunition.Capacity(stats))
            {
                MaximumRange = stats.MaximumRange,
                FalloffRange = stats.FalloffRange,
                ProjectileRange = stats.ProjectileRange,
                ArmourPiercing = stats.ArmourPiercing,
            });
        }

        List<FittedWeaponMetrics> ordered =
            LoadoutState.OrderByLayout(weapons, build.Layout(), weapon => weapon.Slot);
        List<WeaponMetrics> enabled = [];
        foreach (FittedWeaponMetrics weapon in ordered)
        {
            if (weapon.Enabled) enabled.Add(weapon.Metrics);
        }

        return new BuildWeaponMetrics(
            new ReadOnlyCollection<FittedWeaponMetrics>(ordered), Weapons.Sum(enabled));
    }

    /// <summary>The weapons capacitor while every powered weapon fires.</summary>
    /// <param name="weaponsPips">
    /// The pips fed to the weapons capacitor, from zero through four.
    /// </param>
    /// <returns>
    /// The recharge, the sustained draw, the net drain and the seconds from full to empty. The
    /// deployed power budget reaches the distributor and the weapons, so a module the plant sheds
    /// contributes nothing. With no powered distributor the capacity and the recharge are zero,
    /// and a load that draws no more than the recharge never empties.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The allocation is outside zero through four.
    /// </exception>
    public WeaponsCapacitorMetrics WeaponsCapacitorMetrics(double weaponsPips = 4)
    {
        RangeGuards.RequirePips(weaponsPips, nameof(weaponsPips));
        return WeaponsCapacitor.Metrics(
            LoadoutMetrics.WeaponsCapacitorInputFor(
                build.ModulesForEffectiveStats(), PowerBudget(), build.StatsFor),
            weaponsPips);
    }

    /// <summary>The build's power distributor at one allocation.</summary>
    /// <param name="pips">
    /// The pips fed to each of the three capacitors. Omit it for a full allocation to each.
    /// </param>
    /// <returns>
    /// The distributor figures, or the fitted distributor's state: missing when none is fitted,
    /// disabled when it is switched off, shed when the retracted budget does not feed it, and
    /// unresolved when its record states less than all six capacitor figures.
    /// </returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// An allocation is outside zero through four.
    /// </exception>
    public CalculationResult<DistributorMetrics> DistributorMetricsResult(
        DistributorPips? pips = null)
    {
        DistributorPips chosen = pips ?? new DistributorPips(4, 4, 4);
        RangeGuards.RequirePips(chosen.Systems, "pips.Systems");
        RangeGuards.RequirePips(chosen.Engines, "pips.Engines");
        RangeGuards.RequirePips(chosen.Weapons, "pips.Weapons");

        CalculationResult<DistributorInput> input = LoadoutMetrics.DistributorInputResultFor(
            build.ModulesForEffectiveStats(), chosen, PowerBudget(), build.StatsFor);
        return input.Complete
            ? CalculationResult.Of(Distributor.Metrics(input.Value))
            : CalculationResult.Unavailable<DistributorMetrics>(input.Issues);
    }

    /// <summary>The loaded hull and the powered thruster curve both mobility views read.</summary>
    private CalculationResult<MobilityInput> MobilityInput(BuildLoad? load)
    {
        BuildLoad chosen = Guarded(load);
        return LoadoutMetrics.MobilityInputResultFor(
            build.Hull,
            build.Modules,
            PowerBudget,
            () => LoadedMass(chosen.Cargo ?? 0)
                + (chosen.Fuel ?? build.StatedMainFuel ?? build.FuelCapacity.Main),
            build.StatsFor);
    }
}
