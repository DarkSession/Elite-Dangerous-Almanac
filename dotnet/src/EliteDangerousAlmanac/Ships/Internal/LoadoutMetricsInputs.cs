using System;
using System.Collections.Generic;
using System.Globalization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The gatherers that read a build into one calculation's input.</summary>
/// <remarks>
/// Each one answers a complete input, or the one finding that says why the build cannot supply
/// it. A finding names the mount and the article wherever the build fits one, so a consumer can
/// point at what to change.
/// </remarks>
internal static partial class LoadoutMetrics
{
    /// <summary>The mount a finding names where the build fits no module to name.</summary>
    private static readonly Dictionary<CalculationField, string> DefaultSlot = new()
    {
        [CalculationField.PowerCapacity] = "PowerPlant",
        [CalculationField.HeatEfficiency] = "PowerPlant",
        [CalculationField.Thrusters] = "MainEngines",
        [CalculationField.PowerDistributor] = "PowerDistributor",
    };

    /// <summary>What an unresolved finding says the metric could not read.</summary>
    private static readonly Dictionary<CalculationField, string> UnresolvedFact = new()
    {
        [CalculationField.Thrusters] = "the thruster stats",
        [CalculationField.ShieldGenerator] = "the shield generator stats",
        [CalculationField.PowerCapacity] = "the power capacity",
        [CalculationField.HeatEfficiency] = "the heat efficiency",
        [CalculationField.PowerDistributor] = "the power distributor stats",
    };

    /// <summary>What a missing finding calls the article the build does not fit.</summary>
    private static readonly Dictionary<CalculationField, string> NothingFitted = new()
    {
        [CalculationField.PowerCapacity] = "power plant",
        [CalculationField.HeatEfficiency] = "power plant",
        [CalculationField.Thrusters] = "thrusters",
        [CalculationField.PowerDistributor] = "power distributor",
    };

    /// <summary>One stable finding for a metric dependency the build cannot supply.</summary>
    private static CalculationIssue MetricIssue(
        CalculationField field,
        CalculationIssueReason reason,
        LoadoutModule? module = null)
    {
        string? slot = module?.Slot ?? (DefaultSlot.TryGetValue(field, out string? mount) ? mount : null);
        string? symbol = module?.Item;
        string named = TextPreview.Truncate(slot ?? field.ToString());
        string article = TextPreview.Truncate(symbol ?? field.ToString());

        string message = reason switch
        {
            CalculationIssueReason.Missing => string.Format(
                CultureInfo.InvariantCulture,
                "The build fits no {0}.",
                NothingFitted.TryGetValue(field, out string? what) ? what : "shield generator"),
            CalculationIssueReason.Unresolved => string.Format(
                CultureInfo.InvariantCulture,
                "{0}: {1} of {2} is unavailable.",
                named,
                UnresolvedFact.TryGetValue(field, out string? fact) ? fact : field.ToString(),
                article),
            CalculationIssueReason.Disabled => string.Format(
                CultureInfo.InvariantCulture, "{0}: {1} is switched off.", named, article),
            CalculationIssueReason.Invalid => string.Format(
                CultureInfo.InvariantCulture,
                "{0}: {1} states an invalid {2}.",
                named,
                article,
                field),
            _ => string.Format(
                CultureInfo.InvariantCulture,
                "{0}: {1} is not powered with the hardpoints retracted.",
                named,
                article),
        };

        return LoadoutCalculations.ModuleIssue(field, reason, message, slot, symbol);
    }

    /// <summary>Why the build cannot establish its retracted power supply, where it cannot.</summary>
    private static CalculationIssue? PowerPlantIssueFor(
        IReadOnlyList<LoadoutModule> modules,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = statsFor(module);
            if (!IsPowerPlant(module, stats)) continue;
            if (!IsEnabled(module))
            {
                return MetricIssue(CalculationField.PowerCapacity, CalculationIssueReason.Disabled, module);
            }

            if (EffectiveStat(module, ModuleStat.PowerCapacity, stats) is not double capacity)
            {
                return MetricIssue(CalculationField.PowerCapacity, CalculationIssueReason.Unresolved, module);
            }

            return double.IsNaN(capacity) || double.IsInfinity(capacity) || capacity <= 0
                ? MetricIssue(CalculationField.PowerCapacity, CalculationIssueReason.Invalid, module)
                : null;
        }

        return MetricIssue(CalculationField.PowerCapacity, CalculationIssueReason.Missing);
    }

    /// <summary>The first consumer draw the power budget would refuse.</summary>
    private static CalculationIssue? PowerDrawIssueFor(
        IReadOnlyList<LoadoutModule> modules,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        foreach (LoadoutModule module in modules)
        {
            PowerConsumer? consumer = PowerConsumerFor(module, statsFor(module));
            if (consumer is null) continue;
            if (double.IsNaN(consumer.Draw) || double.IsInfinity(consumer.Draw) || consumer.Draw < 0)
            {
                return MetricIssue(CalculationField.PowerDraw, CalculationIssueReason.Invalid, module);
            }
        }

        return null;
    }

    /// <summary>Why one fitted metric module is unavailable with the hardpoints retracted.</summary>
    private static CalculationResult<PowerBudget> PoweredMetricBudgetFor(
        CalculationField field,
        LoadoutModule module,
        OutfittingModule? stats,
        IReadOnlyList<LoadoutModule> modules,
        Func<PowerBudget> getBudget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        if (!IsEnabled(module))
        {
            return CalculationResult.Unavailable<PowerBudget>(
                MetricIssue(field, CalculationIssueReason.Disabled, module));
        }

        if (PowerPlantIssueFor(modules, statsFor) is CalculationIssue plant)
        {
            return CalculationResult.Unavailable<PowerBudget>(plant);
        }

        if (PowerDrawIssueFor(modules, statsFor) is CalculationIssue draw)
        {
            return CalculationResult.Unavailable<PowerBudget>(draw);
        }

        PowerBudget budget = getBudget();
        return budget.Available > 0 && PoweredStates(module, stats, budget).Retracted
            ? CalculationResult.Of(budget)
            : CalculationResult.Unavailable<PowerBudget>(
                MetricIssue(field, CalculationIssueReason.Shed, module));
    }

    /// <summary>One fitted shield generator and the retracted budget that feeds it.</summary>
    private sealed record PoweredGenerator(LoadoutModule Module, PowerBudget Budget);

    private static CalculationResult<PoweredGenerator> PoweredShieldGeneratorFor(
        IReadOnlyList<LoadoutModule> modules,
        Func<PowerBudget> getBudget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        foreach (LoadoutModule module in modules)
        {
            if (!StartsWithAny(module.Item, ShieldGeneratorPrefixes)) continue;

            OutfittingModule? stats = statsFor(module);
            CalculationResult<PowerBudget> powered = PoweredMetricBudgetFor(
                CalculationField.ShieldGenerator, module, stats, modules, getBudget, statsFor);
            if (!powered.Complete)
            {
                return CalculationResult.Unavailable<PoweredGenerator>(powered.Issues);
            }

            return stats is null
                ? CalculationResult.Unavailable<PoweredGenerator>(MetricIssue(
                    CalculationField.ShieldGenerator, CalculationIssueReason.Unresolved, module))
                : CalculationResult.Of(new PoweredGenerator(module, powered.Value));
        }

        return CalculationResult.Unavailable<PoweredGenerator>(
            MetricIssue(CalculationField.ShieldGenerator, CalculationIssueReason.Missing));
    }

    /// <summary>The build's shield generator, boosters and Guardian reinforcement.</summary>
    private static ShieldInput ShieldInputFor(
        Ship ship,
        IReadOnlyList<LoadoutModule> modules,
        PowerBudget budget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        ShieldGeneratorParams? generator = null;
        List<ShieldBoosterParams> boosters = [];
        double reinforcement = 0;

        foreach (LoadoutModule module in modules)
        {
            if (!IsEnabled(module)) continue;
            OutfittingModule? stats = statsFor(module);
            if (!(budget.Available > 0 && PoweredStates(module, stats, budget).Retracted)) continue;

            if (generator is null && StartsWithAny(module.Item, ShieldGeneratorPrefixes))
            {
                // The curve comes off the post-engineering record, the same one a fitted module
                // publishes. Reading it here rather than rebuilding it keeps the published curve
                // and this strength in step. A generator whose record states part of its curve
                // still counts as fitted, and the curve then resolves to nothing rather than the
                // build reading as having no shield generator at all.
                ModuleStats curve = Effective(module, stats)?.Stats ?? ModuleStats.Empty;
                generator = new ShieldGeneratorParams(
                    MinMass: curve[ModuleStat.MinMass],
                    OptMass: curve[ModuleStat.OptMass],
                    MaxMass: curve[ModuleStat.MaxMass],
                    MinMultiplier: curve[ModuleStat.MinMultiplier],
                    OptMultiplier: curve[ModuleStat.OptMultiplier],
                    MaxMultiplier: curve[ModuleStat.MaxMultiplier])
                {
                    Resistances = ResistancesOf(module, stats),
                };
            }
            else if (StartsWithAny(module.Item, ShieldBoosterPrefixes))
            {
                boosters.Add(new ShieldBoosterParams(
                    EffectiveStat(module, ModuleStat.ShieldBoost, stats) ?? 0)
                {
                    Resistances = ResistancesOf(module, stats),
                });
            }
            else if (StartsWithAny(module.Item, ShieldReinforcementPrefixes))
            {
                reinforcement += EffectiveStat(module, ModuleStat.ShieldAddition, stats) ?? 0;
            }
        }

        return new ShieldInput(ship.HullMass, ship.BaseShieldStrength)
        {
            Generator = generator,
            Boosters = boosters,
            Reinforcement = reinforcement,
        };
    }

    /// <summary>The powered shield inputs, or the finding that says why the build has none.</summary>
    internal static CalculationResult<ShieldInput> ShieldInputResultFor(
        Ship ship,
        IReadOnlyList<LoadoutModule> modules,
        Func<PowerBudget> getBudget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        CalculationResult<PoweredGenerator> fitted =
            PoweredShieldGeneratorFor(modules, getBudget, statsFor);
        return fitted.Complete
            ? CalculationResult.Of(ShieldInputFor(ship, modules, fitted.Value.Budget, statsFor))
            : CalculationResult.Unavailable<ShieldInput>(fitted.Issues);
    }

    /// <summary>The SYS capacitor behind a powered shield.</summary>
    /// <remarks>
    /// The bare shield comes first: the figures the SYS pips buy are built on a strength and a
    /// resistance stack, so a build whose generator is missing, switched off, shed or unresolved
    /// has no capacitor story either.
    /// </remarks>
    internal static CalculationResult<ShieldCapacitorInput> ShieldCapacitorInputResultFor(
        Ship ship,
        IReadOnlyList<LoadoutModule> modules,
        Func<PowerBudget> getBudget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        CalculationResult<PoweredGenerator> fitted =
            PoweredShieldGeneratorFor(modules, getBudget, statsFor);
        if (!fitted.Complete)
        {
            return CalculationResult.Unavailable<ShieldCapacitorInput>(fitted.Issues);
        }

        PowerBudget budget = fitted.Value.Budget;
        CalculationResult<SystemsCapacitor> capacitor =
            SystemsCapacitorFor(modules, budget, statsFor);
        if (!capacitor.Complete)
        {
            return CalculationResult.Unavailable<ShieldCapacitorInput>(capacitor.Issues);
        }

        ShieldMetrics shields = Shields.Metrics(ShieldInputFor(ship, modules, budget, statsFor));
        return CalculationResult.Of(ShieldCapacitorInput.For(
            shields, capacitor.Value.SystemsCapacity, capacitor.Value.SystemsRecharge));
    }

    /// <summary>The SYS half of the powered distributor.</summary>
    private sealed record SystemsCapacitor(double SystemsCapacity, double SystemsRecharge);

    /// <remarks>
    /// No distributor fitted is no SYS capacitor at all, which is modelled truth rather than an
    /// invention. A distributor that is fitted and does not state its SYS figures is unresolved
    /// instead, not a capacitor of no capacity.
    /// </remarks>
    private static CalculationResult<SystemsCapacitor> SystemsCapacitorFor(
        IReadOnlyList<LoadoutModule> modules,
        PowerBudget budget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        LoadoutModule? distributor = null;
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = statsFor(module);
            if (IsPowerDistributor(module, stats)
                && IsEnabled(module)
                && budget.Available > 0
                && PoweredStates(module, stats, budget).Retracted)
            {
                distributor = module;
            }
        }

        if (distributor is null) return CalculationResult.Of(new SystemsCapacitor(0, 0));

        OutfittingModule? fitted = statsFor(distributor);
        double? capacity = EffectiveStat(distributor, ModuleStat.SystemsCapacity, fitted);
        double? recharge = EffectiveStat(distributor, ModuleStat.SystemsRecharge, fitted);
        return capacity is double stored && recharge is double rate
            ? CalculationResult.Of(new SystemsCapacitor(stored, rate))
            : CalculationResult.Unavailable<SystemsCapacitor>(MetricIssue(
                CalculationField.PowerDistributor, CalculationIssueReason.Unresolved, distributor));
    }

    /// <summary>One fitted thruster's post-engineering mass curves.</summary>
    /// <remarks>
    /// A speed or rotation curve is published only where the article has one of its own. It
    /// refines the multipliers over the same three masses, which is the whole of the difference.
    /// </remarks>
    private static ThrusterParams? ThrusterCurveFor(LoadoutModule module, OutfittingModule? stats)
    {
        ModuleStats curve = Effective(module, stats)?.Stats ?? ModuleStats.Empty;
        if (curve[ModuleStat.MinMass] is not double minMass
            || curve[ModuleStat.OptMass] is not double optMass
            || curve[ModuleStat.MaxMass] is not double maxMass
            || curve[ModuleStat.MinMultiplier] is not double minMultiplier
            || curve[ModuleStat.OptMultiplier] is not double optMultiplier
            || curve[ModuleStat.MaxMultiplier] is not double maxMultiplier)
        {
            return null;
        }

        return new ThrusterParams(
            minMass, optMass, maxMass, minMultiplier, optMultiplier, maxMultiplier)
        {
            SpeedCurve = curve[ModuleStat.OptSpeedMultiplier] is double optSpeed
                ? new ThrusterCurveParams(
                    minMass,
                    optMass,
                    maxMass,
                    curve[ModuleStat.MinSpeedMultiplier] ?? minMultiplier,
                    optSpeed,
                    curve[ModuleStat.MaxSpeedMultiplier] ?? maxMultiplier)
                : null,
            RotationCurve = curve[ModuleStat.OptRotationMultiplier] is double optRotation
                ? new ThrusterCurveParams(
                    minMass,
                    optMass,
                    maxMass,
                    curve[ModuleStat.MinRotationMultiplier] ?? minMultiplier,
                    optRotation,
                    curve[ModuleStat.MaxRotationMultiplier] ?? maxMultiplier)
                : null,
        };
    }

    /// <summary>The fitted thrusters' post-engineering curve, whatever their power state.</summary>
    /// <remarks>
    /// The curve is a property of the article, so a switched-off or shed thruster still has one.
    /// Whether the build can use it is what the mobility gatherer decides.
    /// </remarks>
    internal static ThrusterParams? FittedThrusterParamsFor(
        IReadOnlyList<LoadoutModule> modules,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = statsFor(module);
            if (IsThruster(module, stats)) return ThrusterCurveFor(module, stats);
        }

        return null;
    }

    /// <summary>The loaded hull and the powered thruster curve.</summary>
    internal static CalculationResult<MobilityInput> MobilityInputResultFor(
        Ship ship,
        IReadOnlyList<LoadoutModule> modules,
        Func<PowerBudget> getBudget,
        Func<double> mass,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        ThrusterParams? thrusters = null;
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = statsFor(module);
            if (!IsThruster(module, stats)) continue;

            CalculationResult<PowerBudget> powered = PoweredMetricBudgetFor(
                CalculationField.Thrusters, module, stats, modules, getBudget, statsFor);
            if (!powered.Complete)
            {
                return CalculationResult.Unavailable<MobilityInput>(powered.Issues);
            }

            thrusters = ThrusterCurveFor(module, stats);
            if (thrusters is null)
            {
                return CalculationResult.Unavailable<MobilityInput>(MetricIssue(
                    CalculationField.Thrusters, CalculationIssueReason.Unresolved, module));
            }

            break;
        }

        if (thrusters is null)
        {
            return CalculationResult.Unavailable<MobilityInput>(
                MetricIssue(CalculationField.Thrusters, CalculationIssueReason.Missing));
        }

        return CalculationResult.Of(new MobilityInput(
            ship.MinimumSpeed,
            ship.MaximumSpeed,
            ship.Boost,
            ship.MinPitch,
            ship.Pitch,
            ship.MinRoll,
            ship.Roll,
            ship.MinYaw,
            ship.Yaw,
            mass())
        {
            Thrusters = thrusters,
        });
    }

    /// <summary>The shield recovery inputs.</summary>
    /// <remarks>
    /// An absent figure is not a zero and not a guessed constant. Every catalogued generator
    /// states its draw and both regeneration rates, so only a caller-supplied record can leave
    /// one out, and a recovery time computed from an invented rate cannot be told from a real
    /// one.
    /// </remarks>
    internal static CalculationResult<ShieldRecoveryInput> ShieldRecoveryInputResultFor(
        Ship ship,
        IReadOnlyList<LoadoutModule> modules,
        Func<PowerBudget> getBudget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        CalculationResult<PoweredGenerator> fitted =
            PoweredShieldGeneratorFor(modules, getBudget, statsFor);
        if (!fitted.Complete)
        {
            return CalculationResult.Unavailable<ShieldRecoveryInput>(fitted.Issues);
        }

        LoadoutModule generator = fitted.Value.Module;
        PowerBudget budget = fitted.Value.Budget;
        OutfittingModule? stats = statsFor(generator);

        double? draw = EffectiveStat(generator, ModuleStat.DistributorDraw, stats);
        double? regen = EffectiveStat(generator, ModuleStat.ShieldRegenRate, stats);
        double? broken = EffectiveStat(generator, ModuleStat.ShieldBrokenRegenRate, stats);
        if (draw is not double distributorDraw
            || regen is not double regenRate
            || broken is not double brokenRegenRate)
        {
            return CalculationResult.Unavailable<ShieldRecoveryInput>(MetricIssue(
                CalculationField.ShieldGenerator, CalculationIssueReason.Unresolved, generator));
        }

        CalculationResult<SystemsCapacitor> capacitor =
            SystemsCapacitorFor(modules, budget, statsFor);
        if (!capacitor.Complete)
        {
            return CalculationResult.Unavailable<ShieldRecoveryInput>(capacitor.Issues);
        }

        double strength = Shields.Metrics(ShieldInputFor(ship, modules, budget, statsFor)).Strength;
        return CalculationResult.Of(new ShieldRecoveryInput(
            strength,
            regenRate,
            brokenRegenRate,
            distributorDraw,
            capacitor.Value.SystemsCapacity,
            capacitor.Value.SystemsRecharge));
    }

    /// <summary>The WEP capacitor and the weapons under the deployed power budget.</summary>
    internal static WeaponsCapacitorInput WeaponsCapacitorInputFor(
        IReadOnlyList<LoadoutModule> modules,
        PowerBudget budget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        double weaponsCapacity = 0;
        double weaponsRecharge = 0;
        double sustainedEnergyPerSecond = 0;

        foreach (LoadoutModule module in modules)
        {
            if (!IsEnabled(module)) continue;
            OutfittingModule? stats = statsFor(module);
            if (!PoweredStates(module, stats, budget).Deployed) continue;

            if (IsPowerDistributor(module, stats))
            {
                weaponsCapacity = EffectiveStat(module, ModuleStat.WeaponsCapacity, stats) ?? 0;
                weaponsRecharge = EffectiveStat(module, ModuleStat.WeaponsRecharge, stats) ?? 0;
            }

            if (WeaponStatsFor(module, stats) is WeaponStats weapon)
            {
                sustainedEnergyPerSecond += Weapons.Metrics(weapon).SustainedEnergyPerSecond;
            }
        }

        return new WeaponsCapacitorInput(
            weaponsCapacity, weaponsRecharge, sustainedEnergyPerSecond);
    }

    /// <summary>All three capacitors from the powered distributor, hardpoints retracted.</summary>
    /// <remarks>
    /// A switched-off distributor is reported rather than skipped: not fitted, switched off,
    /// unpowered and unresolved are four different things for a consumer to show. A build
    /// carrying a disabled distributor and an enabled one still reads the enabled one, so the
    /// fitted set decides before the finding does.
    /// </remarks>
    internal static CalculationResult<DistributorInput> DistributorInputResultFor(
        IReadOnlyList<LoadoutModule> modules,
        DistributorPips pips,
        PowerBudget budget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        LoadoutModule? disabled = null;
        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = statsFor(module);
            if (!IsPowerDistributor(module, stats)) continue;
            if (!IsEnabled(module))
            {
                disabled ??= module;
                continue;
            }

            if (!PoweredStates(module, stats, budget).Retracted)
            {
                return CalculationResult.Unavailable<DistributorInput>(MetricIssue(
                    CalculationField.PowerDistributor, CalculationIssueReason.Shed, module));
            }

            double? systemsCapacity = EffectiveStat(module, ModuleStat.SystemsCapacity, stats);
            double? systemsRecharge = EffectiveStat(module, ModuleStat.SystemsRecharge, stats);
            double? enginesCapacity = EffectiveStat(module, ModuleStat.EnginesCapacity, stats);
            double? enginesRecharge = EffectiveStat(module, ModuleStat.EnginesRecharge, stats);
            double? weaponsCapacity = EffectiveStat(module, ModuleStat.WeaponsCapacity, stats);
            double? weaponsRecharge = EffectiveStat(module, ModuleStat.WeaponsRecharge, stats);
            if (systemsCapacity is not double sysCapacity
                || systemsRecharge is not double sysRecharge
                || enginesCapacity is not double engCapacity
                || enginesRecharge is not double engRecharge
                || weaponsCapacity is not double wepCapacity
                || weaponsRecharge is not double wepRecharge)
            {
                return CalculationResult.Unavailable<DistributorInput>(MetricIssue(
                    CalculationField.PowerDistributor, CalculationIssueReason.Unresolved, module));
            }

            return CalculationResult.Of(new DistributorInput(
                sysCapacity, sysRecharge, engCapacity, engRecharge, wepCapacity, wepRecharge)
            {
                SystemsPips = pips.Systems,
                EnginesPips = pips.Engines,
                WeaponsPips = pips.Weapons,
            });
        }

        return CalculationResult.Unavailable<DistributorInput>(disabled is null
            ? MetricIssue(CalculationField.PowerDistributor, CalculationIssueReason.Missing)
            : MetricIssue(
                CalculationField.PowerDistributor, CalculationIssueReason.Disabled, disabled));
    }

    /// <summary>The hull's heat stats, the plant's efficiency and everything that makes heat.</summary>
    /// <remarks>
    /// Nothing here is read from the fitted module alone: every heat source is checked against
    /// the build's own power budget first, because a module the plant cannot feed is not running
    /// and so makes no heat. That check depends on the state, the thrusters possibly sitting in
    /// a group the plant keeps lit with the hardpoints stowed and sheds once they are out, so
    /// the thrusters are gathered twice and the weapons against the deployed state they fire in.
    /// </remarks>
    internal static CalculationResult<HeatInput> HeatInputResultFor(
        Ship ship,
        IReadOnlyList<LoadoutModule> modules,
        PowerBudget budget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        LoadoutModule? plant = null;
        double? heatEfficiency = null;
        double thrusterHeatRate = 0;
        double deployedThrusterHeatRate = 0;
        double fsdHeatRate = 0;
        double weaponsCapacity = 0;
        List<HeatWeapon> weapons = [];

        foreach (LoadoutModule module in modules)
        {
            OutfittingModule? stats = statsFor(module);
            if (IsPowerPlant(module, stats))
            {
                // A plant that is switched off feeds nothing, so there is no build to model.
                if (!IsEnabled(module))
                {
                    return CalculationResult.Unavailable<HeatInput>(MetricIssue(
                        CalculationField.PowerCapacity, CalculationIssueReason.Disabled, module));
                }

                plant = module;
                heatEfficiency = EffectiveStat(module, ModuleStat.HeatEfficiency, stats);
                continue;
            }

            if (!IsEnabled(module)) continue;
            RunningStates running = PoweredStates(module, stats, budget);

            if (IsThruster(module, stats))
            {
                double heat = EffectiveStat(module, ModuleStat.EngineHeatRate, stats) ?? 0;
                if (running.Retracted) thrusterHeatRate += heat;
                if (running.Deployed) deployedThrusterHeatRate += heat;
            }
            else if (IsFrameShiftDrive(module, stats))
            {
                // Charging a jump is something a ship does with its hardpoints stowed.
                if (running.Retracted)
                {
                    fsdHeatRate += EffectiveStat(module, ModuleStat.FsdHeatRate, stats) ?? 0;
                }
            }
            else if (IsPowerDistributor(module, stats))
            {
                // An unfed distributor holds no charge, so its weapons all fire on empty.
                if (running.Deployed)
                {
                    weaponsCapacity = EffectiveStat(module, ModuleStat.WeaponsCapacity, stats) ?? 0;
                }
            }

            // A weapon in a group the plant sheds once the hardpoints are out cannot fire.
            if (!running.Deployed) continue;
            if (WeaponStatsFor(module, stats) is not WeaponStats weapon) continue;

            weapons.Add(new HeatWeapon(
                Weapons.Metrics(weapon).SustainedHeatPerSecond, weapon.DistributorDraw));
        }

        if (heatEfficiency is not double efficiency)
        {
            return CalculationResult.Unavailable<HeatInput>(plant is null
                ? MetricIssue(CalculationField.PowerCapacity, CalculationIssueReason.Missing)
                : MetricIssue(
                    CalculationField.HeatEfficiency, CalculationIssueReason.Unresolved, plant));
        }

        return CalculationResult.Of(
            new HeatInput(ship.HeatCapacity, ship.HeatDissipation, efficiency)
            {
                RetractedPowerDraw = PoweredDraw(budget, retracted: true),
                DeployedPowerDraw = PoweredDraw(budget, retracted: false),
                ThrusterHeatRate = thrusterHeatRate,
                DeployedThrusterHeatRate = deployedThrusterHeatRate,
                FsdHeatRate = fsdHeatRate,
                WeaponsCapacity = weaponsCapacity,
                Weapons = weapons,
            });
    }

    /// <summary>The fitted cell banks, a normal powered-off state not read as absence.</summary>
    internal static List<CellBankInput> CellBankInputsFor(
        IReadOnlyList<LoadoutModule> modules,
        PowerBudget budget,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        List<CellBankInput> banks = [];
        foreach (LoadoutModule module in modules)
        {
            if (!StartsWithAny(module.Item, ShieldCellBankPrefixes)) continue;

            OutfittingModule? effective = Effective(module, statsFor(module));
            AmmunitionCapacity? ammunition =
                effective is null ? null : Ammunition.Capacity(effective);
            ModuleStats carried = effective?.Stats ?? ModuleStats.Empty;

            banks.Add(new CellBankInput(
                Slot: module.Slot,
                Symbol: module.Item,
                ReinforcementRate: carried[ModuleStat.ShieldBankReinforcement] ?? 0,
                Cells: ammunition?.Total ?? 0,
                SpinUp: carried[ModuleStat.ShieldBankSpinUp] ?? 0,
                Duration: carried[ModuleStat.ShieldBankDuration] ?? 0,
                Heat: carried[ModuleStat.ShieldBankHeat] ?? 0,
                Powered: budget.Available > 0
                    && IsEnabled(module)
                    && PoweredStates(module, statsFor(module), budget).Deployed));
        }

        return banks;
    }

    /// <summary>
    /// The armour a hull flies with where no bulkhead is fitted, which is the stock lightweight
    /// alloy every hull leaves the shipyard with.
    /// </summary>
    private static OutfittingModule? StockBulkhead(Ship ship)
    {
        IReadOnlyList<OutfittingModule> variants =
            ModuleCatalogue.BulkheadsForShip(ship.Name, ModuleCatalogue.Core);

        // One hull's stock alloy is spelled with a trailing default; every other hull's is the
        // zero-mass first entry.
        foreach (OutfittingModule variant in variants)
        {
            if (variant.Symbol.EndsWith("_default", StringComparison.OrdinalIgnoreCase))
            {
                return variant;
            }
        }

        foreach (OutfittingModule variant in variants)
        {
            if (variant.Stats[ModuleStat.Mass] == 0) return variant;
        }

        return variants.Count > 0 ? variants[0] : null;
    }

    /// <summary>The build's bulkhead and reinforcement packages.</summary>
    internal static ArmourInput ArmourInputFor(
        Ship ship,
        IReadOnlyList<LoadoutModule> modules,
        Func<LoadoutModule, OutfittingModule?> statsFor)
    {
        List<HullReinforcementParams> reinforcements = [];
        List<ModuleReinforcementParams> moduleReinforcements = [];
        BulkheadParams? bulkhead = null;

        foreach (LoadoutModule module in modules)
        {
            if (!IsEnabled(module)) continue;
            OutfittingModule? stats = statsFor(module);

            // A producer may write the mount key either way, and a bulkhead missed here would
            // silently be reported as the hull's stock alloy.
            if (string.Equals(module.Slot, "Armour", StringComparison.OrdinalIgnoreCase))
            {
                bulkhead = new BulkheadParams(
                    EffectiveStat(module, ModuleStat.HullBoost, stats) ?? 0,
                    ResistancesOf(module, stats));
            }
            else if (StartsWithAny(module.Item, HullReinforcementPrefixes))
            {
                // A stock package has no hull boost; only an engineered one does, and then the
                // journal modifier is the whole bonus, reported as a percentage.
                double? boost = Slef.FindModifier(module, "DefenceModifierHealthMultiplier");
                reinforcements.Add(new HullReinforcementParams(
                    EffectiveStat(module, ModuleStat.HullReinforcement, stats) ?? 0,
                    boost is double stated
                        ? stated / ModuleStatLabels.ScaleFor("DefenceModifierHealthMultiplier")
                        : 0,
                    ResistancesOf(module, stats)));
            }
            else if (StartsWithAny(module.Item, ModuleReinforcementPrefixes))
            {
                moduleReinforcements.Add(new ModuleReinforcementParams(
                    EffectiveStat(module, ModuleStat.ModuleProtection, stats) ?? 0,
                    EffectiveStat(module, ModuleStat.Integrity, stats) ?? 0));
            }
        }

        if (bulkhead is null && StockBulkhead(ship) is OutfittingModule stock)
        {
            bulkhead = new BulkheadParams(
                stock.Stats[ModuleStat.HullBoost] ?? 0,
                new DamageTypeValues(
                    Kinetic: stock.Stats[ModuleStat.KineticResistance] ?? 0,
                    Thermal: stock.Stats[ModuleStat.ThermalResistance] ?? 0,
                    Explosive: stock.Stats[ModuleStat.ExplosiveResistance] ?? 0,
                    Caustic: stock.Stats[ModuleStat.CausticResistance] ?? 0));
        }

        return new ArmourInput(ship.BaseArmour, bulkhead, reinforcements, moduleReinforcements);
    }
}
