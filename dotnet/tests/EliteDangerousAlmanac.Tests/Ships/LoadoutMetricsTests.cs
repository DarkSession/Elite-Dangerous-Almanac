using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Reading a fitted build into the inputs the calculations take.</summary>
public class LoadoutMetricsTests
{
    private const string Plant = "Int_Powerplant_Size2_Class1";
    private const string Thrusters = "Int_Engine_Size2_Class1";
    private const string Drive = "Int_Hyperdrive_Size2_Class1";
    private const string Distributor = "Int_PowerDistributor_Size1_Class1";
    private const string Generator = "Int_ShieldGenerator_Size3_Class3";
    private const string Booster = "Hpt_ShieldBooster_Size0_Class1";
    private const string CellBank = "Int_ShieldCellBank_Size3_Class3";
    private const string Multicannon = "Hpt_MultiCannon_Fixed_Medium";
    private const string BeamLaser = "Hpt_BeamLaser_Fixed_Medium";
    private const string AntiXenoCannon = "Hpt_ATMultiCannon_Fixed_Medium";
    private const string HullPackage = "Int_HullReinforcement_Size3_Class2";
    private const string ModulePackage = "Int_ModuleReinforcement_Size3_Class2";

    private static readonly Ship Sidewinder = ShipCatalogue.FindBySymbol("SideWinder")!;

    private static OutfittingModule? Catalogued(LoadoutModule module) =>
        ModuleCatalogue.FindBySymbol(module.Item);

    private static LoadoutModule Fit(string slot, string symbol) => new(slot, symbol);

    private static LoadoutModule Engineered(
        string slot,
        string symbol,
        params EngineeringModifier[] modifiers) =>
        new(slot, symbol)
        {
            Engineering = new ModuleEngineering("Recipe", 5, 1) { Modifiers = modifiers },
        };

    private static PowerBudget Budget(IReadOnlyList<LoadoutModule> modules)
    {
        List<PowerConsumer> consumers = [];
        foreach (LoadoutModule module in modules)
        {
            if (LoadoutMetrics.PowerConsumerFor(module, Catalogued(module)) is PowerConsumer draw)
            {
                consumers.Add(draw);
            }
        }

        return Power.Budget(LoadoutMetrics.PowerAvailable(modules, Catalogued), consumers);
    }

    /// <summary>A build that powers and feeds everything the metrics need.</summary>
    private static List<LoadoutModule> Running(params LoadoutModule[] extra)
    {
        List<LoadoutModule> modules =
        [
            Fit("PowerPlant", "Int_Powerplant_Size8_Class5"),
            Fit("MainEngines", Thrusters),
            Fit("FrameShiftDrive", Drive),
            Fit("PowerDistributor", Distributor),
        ];
        modules.AddRange(extra);
        return modules;
    }

    [Fact]
    public void AModuleWithNoEngineeringPublishesItsCatalogueStats()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Plant)!;

        Assert.Same(stock, LoadoutMetrics.Effective(Fit("PowerPlant", Plant), stock));
    }

    [Fact]
    public void AnUnresolvedArticlePublishesNothing()
    {
        Assert.Null(LoadoutMetrics.Effective(Fit("PowerPlant", "Not_A_Module"), null));
    }

    [Fact]
    public void AStatedModifierReplacesTheCataloguesOwnValue()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Plant)!;
        LoadoutModule fitted = Engineered(
            "PowerPlant", Plant, new EngineeringModifier("PowerCapacity", 12, 8));

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, stock)!;

        Assert.Equal(12, effective.Stats[ModuleStat.PowerCapacity]);
        Assert.NotEqual(12, stock.Stats[ModuleStat.PowerCapacity]);
    }

    [Fact]
    public void AJournalPercentageIsScaledIntoTheCataloguesFraction()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Generator)!;
        LoadoutModule fitted = Engineered(
            "Slot01_Size3", Generator, new EngineeringModifier("KineticResistance", 40, 0));

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, stock)!;

        Assert.Equal(0.4, effective.Stats[ModuleStat.KineticResistance]!.Value, 6);
    }

    [Fact]
    public void AMovedOptimalMassCarriesTheCurvesEndpointsWithIt()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Thrusters)!;
        double optMass = stock.Stats[ModuleStat.OptMass]!.Value;
        LoadoutModule fitted = Engineered(
            "MainEngines",
            Thrusters,
            new EngineeringModifier("EngineOptimalMass", optMass * 1.2, optMass));

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, stock)!;

        Assert.Equal(stock.Stats[ModuleStat.MinMass]!.Value * 1.2, effective.Stats[ModuleStat.MinMass]!.Value, 6);
        Assert.Equal(stock.Stats[ModuleStat.MaxMass]!.Value * 1.2, effective.Stats[ModuleStat.MaxMass]!.Value, 6);
    }

    [Fact]
    public void ALightenedGeneratorKeepsTheHeaviestHullItCanCover()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Generator)!;
        double optMass = stock.Stats[ModuleStat.OptMass]!.Value;
        LoadoutModule fitted = Engineered(
            "Slot01_Size3",
            Generator,
            new EngineeringModifier("ShieldGenOptimalMass", optMass * 0.8, optMass));

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, stock)!;

        Assert.Equal(stock.Stats[ModuleStat.MinMass]!.Value * 0.8, effective.Stats[ModuleStat.MinMass]!.Value, 6);
        Assert.Equal(stock.Stats[ModuleStat.MaxMass]!.Value, effective.Stats[ModuleStat.MaxMass]!.Value, 6);
    }

    [Fact]
    public void AnExplicitEndpointModifierWinsOverTheRelatedOne()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Thrusters)!;
        double optMass = stock.Stats[ModuleStat.OptMass]!.Value;
        LoadoutModule fitted = Engineered(
            "MainEngines",
            Thrusters,
            new EngineeringModifier("EngineOptimalMass", optMass * 1.2, optMass),
            new EngineeringModifier("EngineMinimumMass", 7, 3));

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, stock)!;

        Assert.Equal(7, effective.Stats[ModuleStat.MinMass]);
    }

    [Fact]
    public void AConvertingModifierReplacesTheExactDamageComponents()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Multicannon)!;
        LoadoutModule fitted = Engineered(
            "MediumHardpoint1", Multicannon, new EngineeringModifier("$Thermal;", 60, 0));

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, stock)!;

        Assert.Null(effective.DamageComponents);
        Assert.Equal(0.6, effective.DamageDistribution!.Thermal!.Value, 6);
    }

    [Fact]
    public void OrdinaryEngineeringKeepsTheDamageComponentsInProportion()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(AntiXenoCannon)!;
        double damage = stock.Stats[ModuleStat.Damage]!.Value;
        LoadoutModule fitted = Engineered(
            "MediumHardpoint1", AntiXenoCannon, new EngineeringModifier("Damage", damage * 2, damage));

        OutfittingModule effective = LoadoutMetrics.Effective(fitted, stock)!;

        Assert.NotNull(stock.DamageComponents);
        Assert.NotNull(effective.DamageComponents);
        Assert.NotEqual(stock.DamageComponents, effective.DamageComponents);
    }

    [Fact]
    public void AWeaponPublishesTheStatsTheBuildCarries()
    {
        LoadoutModule fitted = Fit("MediumHardpoint1", Multicannon);
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Multicannon)!;

        WeaponStats weapon = LoadoutMetrics.WeaponStatsFor(fitted, stock)!;

        Assert.Equal(stock.Stats[ModuleStat.Damage], weapon.Damage);
        Assert.Equal(stock.Stats[ModuleStat.ThermalLoad], weapon.ThermalLoad);
    }

    [Fact]
    public void AModuleThatIsNotAWeaponHasNoWeaponStats()
    {
        Assert.Null(LoadoutMetrics.WeaponStatsFor(
            Fit("PowerPlant", Plant), ModuleCatalogue.FindBySymbol(Plant)));
        Assert.Null(LoadoutMetrics.WeaponStatsFor(Fit("PowerPlant", "Not_A_Module"), null));
    }

    [Fact]
    public void AContinuousWeaponReadsItsDamageFromTheStatedPerSecondFigure()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(BeamLaser)!;
        double damage = stock.Stats[ModuleStat.Damage]!.Value;
        LoadoutModule fitted = Engineered(
            "MediumHardpoint1",
            BeamLaser,
            new EngineeringModifier("DamagePerSecond", damage * 1.5, damage));

        WeaponStats weapon = LoadoutMetrics.WeaponStatsFor(fitted, stock)!;

        Assert.Equal(damage * 1.5, weapon.Damage, 4);
    }

    [Fact]
    public void AStatedDamageIsTheFigureAndNotThePerSecondCompanion()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Multicannon)!;
        double damage = stock.Stats[ModuleStat.Damage]!.Value;
        LoadoutModule fitted = Engineered(
            "MediumHardpoint1",
            Multicannon,
            new EngineeringModifier("Damage", damage * 1.2, damage),
            new EngineeringModifier("DamagePerSecond", 999, 1));

        WeaponStats weapon = LoadoutMetrics.WeaponStatsFor(fitted, stock)!;

        Assert.Equal(damage * 1.2, weapon.Damage, 6);
    }

    [Fact]
    public void AFalloffRangeIsHeldToTheWeaponsMaximumRange()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(Multicannon)!;
        LoadoutModule fitted = Engineered(
            "MediumHardpoint1", Multicannon, new EngineeringModifier("MaximumRange", 500, 4000));

        WeaponStats weapon = LoadoutMetrics.WeaponStatsFor(fitted, stock)!;

        Assert.Equal(500, weapon.MaximumRange);
        Assert.Equal(500, weapon.FalloffRange);
    }

    [Fact]
    public void AModuleThatDrawsNoPowerMakesNoClaimOnThePlant()
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol("SideWinder_Armour_Grade1")!;

        Assert.Null(stock.Stats[ModuleStat.PowerDraw]);
        Assert.Null(LoadoutMetrics.PowerConsumerFor(Fit("Armour", stock.Symbol), stock));
    }

    [Fact]
    public void AWeaponDrawsOnlyWithTheHardpointsOut()
    {
        PowerConsumer consumer = LoadoutMetrics.PowerConsumerFor(
            Fit("MediumHardpoint1", Multicannon), ModuleCatalogue.FindBySymbol(Multicannon))!;

        Assert.True(consumer.DeployedOnly);
        Assert.True(consumer.Enabled);
        Assert.Equal(1, consumer.Priority);
    }

    [Fact]
    public void AnAlwaysPoweredUtilityDrawsWhateverTheHardpointsDo()
    {
        PowerConsumer consumer = LoadoutMetrics.PowerConsumerFor(
            Fit("TinyHardpoint1", Booster), ModuleCatalogue.FindBySymbol(Booster))!;

        Assert.False(consumer.DeployedOnly);
    }

    [Fact]
    public void AJournalPriorityIsReportedAsThePanelsOwnGroup()
    {
        PowerConsumer consumer = LoadoutMetrics.PowerConsumerFor(
            new LoadoutModule("PowerPlant", Thrusters) { Priority = 2, On = false },
            ModuleCatalogue.FindBySymbol(Thrusters))!;

        Assert.Equal(3, consumer.Priority);
        Assert.False(consumer.Enabled);
    }

    [Fact]
    public void ASwitchedOffPlantPowersNothing()
    {
        List<LoadoutModule> modules =
            [new LoadoutModule("PowerPlant", Plant) { On = false }];

        Assert.Equal(0, LoadoutMetrics.PowerAvailable(modules, Catalogued));
    }

    [Fact]
    public void AFittedPlantPublishesItsCapacity()
    {
        List<LoadoutModule> modules = [Fit("PowerPlant", Plant)];

        Assert.Equal(
            ModuleCatalogue.FindBySymbol(Plant)!.Stats[ModuleStat.PowerCapacity],
            LoadoutMetrics.PowerAvailable(modules, Catalogued));
    }

    [Fact]
    public void ABuildWithNoPlantHasNoPower()
    {
        Assert.Equal(0, LoadoutMetrics.PowerAvailable([Fit("MainEngines", Thrusters)], Catalogued));
    }

    [Fact]
    public void ABuildWithNoThrustersCannotAnswerItsMobility()
    {
        List<LoadoutModule> modules = [Fit("PowerPlant", Plant)];

        CalculationResult<MobilityInput> result = LoadoutMetrics.MobilityInputResultFor(
            Sidewinder, modules, () => Budget(modules), () => 100, Catalogued);

        Assert.False(result.Complete);
        CalculationIssue issue = Assert.Single(result.Issues);
        Assert.Equal(CalculationField.Thrusters, issue.Field);
        Assert.Equal(CalculationIssueReason.Missing, issue.Reason);
        Assert.Equal("MainEngines", issue.Slot);
    }

    [Fact]
    public void ASwitchedOffThrusterCannotAnswerItsMobility()
    {
        List<LoadoutModule> modules =
        [
            Fit("PowerPlant", Plant),
            new LoadoutModule("MainEngines", Thrusters) { On = false },
        ];

        CalculationResult<MobilityInput> result = LoadoutMetrics.MobilityInputResultFor(
            Sidewinder, modules, () => Budget(modules), () => 100, Catalogued);

        Assert.False(result.Complete);
        Assert.Equal(CalculationIssueReason.Disabled, Assert.Single(result.Issues).Reason);
    }

    [Fact]
    public void APoweredThrusterAnswersTheHullsMobility()
    {
        List<LoadoutModule> modules = Running();

        CalculationResult<MobilityInput> result = LoadoutMetrics.MobilityInputResultFor(
            Sidewinder, modules, () => Budget(modules), () => 100, Catalogued);

        Assert.True(result.Complete);
        Assert.Equal(100, result.Value.Mass);
        Assert.Equal(Sidewinder.MaximumSpeed, result.Value.MaximumSpeed);
        Assert.NotNull(result.Value.Thrusters);
    }

    [Fact]
    public void AThrusterCurveIsPublishedWhateverThePowerState()
    {
        List<LoadoutModule> modules =
            [new LoadoutModule("MainEngines", Thrusters) { On = false }];

        Assert.NotNull(LoadoutMetrics.FittedThrusterParamsFor(modules, Catalogued));
        Assert.Null(LoadoutMetrics.FittedThrusterParamsFor([], Catalogued));
    }

    [Fact]
    public void ABuildWithNoShieldGeneratorCannotAnswerItsShields()
    {
        List<LoadoutModule> modules = Running();

        CalculationResult<ShieldInput> result = LoadoutMetrics.ShieldInputResultFor(
            Sidewinder, modules, () => Budget(modules), Catalogued);

        Assert.False(result.Complete);
        Assert.Equal(CalculationField.ShieldGenerator, Assert.Single(result.Issues).Field);
    }

    [Fact]
    public void APoweredGeneratorAndItsBoostersAnswerTheShields()
    {
        List<LoadoutModule> modules = Running(
            Fit("Slot01_Size3", Generator), Fit("TinyHardpoint1", Booster));

        CalculationResult<ShieldInput> result = LoadoutMetrics.ShieldInputResultFor(
            Sidewinder, modules, () => Budget(modules), Catalogued);

        Assert.True(result.Complete);
        Assert.NotNull(result.Value.Generator);
        Assert.Single(result.Value.Boosters!);
        Assert.Equal(Sidewinder.HullMass, result.Value.HullMass);
    }

    [Fact]
    public void ASwitchedOffGeneratorIsReportedRatherThanSkipped()
    {
        List<LoadoutModule> modules = Running(
            new LoadoutModule("Slot01_Size3", Generator) { On = false });

        CalculationResult<ShieldInput> result = LoadoutMetrics.ShieldInputResultFor(
            Sidewinder, modules, () => Budget(modules), Catalogued);

        Assert.False(result.Complete);
        Assert.Equal(CalculationIssueReason.Disabled, Assert.Single(result.Issues).Reason);
    }

    [Fact]
    public void APoweredGeneratorAndDistributorAnswerTheShieldCapacitor()
    {
        List<LoadoutModule> modules = Running(Fit("Slot01_Size3", Generator));

        CalculationResult<ShieldCapacitorInput> result =
            LoadoutMetrics.ShieldCapacitorInputResultFor(
                Sidewinder, modules, () => Budget(modules), Catalogued);

        Assert.True(result.Complete);
        Assert.True(result.Value.SystemsCapacity > 0);
        Assert.True(result.Value.Strength > 0);
    }

    [Fact]
    public void APoweredGeneratorAnswersTheShieldRecovery()
    {
        List<LoadoutModule> modules = Running(Fit("Slot01_Size3", Generator));

        CalculationResult<ShieldRecoveryInput> result =
            LoadoutMetrics.ShieldRecoveryInputResultFor(
                Sidewinder, modules, () => Budget(modules), Catalogued);

        Assert.True(result.Complete);
        Assert.True(result.Value.RegenRate > 0);
        Assert.True(result.Value.BrokenRegenRate > 0);
        Assert.True(result.Value.DistributorDraw > 0);
    }

    [Fact]
    public void ABuildWithNoDistributorCannotAnswerItsCapacitors()
    {
        List<LoadoutModule> modules = [Fit("PowerPlant", Plant)];

        CalculationResult<DistributorInput> result = LoadoutMetrics.DistributorInputResultFor(
            modules, new DistributorPips(4, 4, 4), Budget(modules), Catalogued);

        Assert.False(result.Complete);
        CalculationIssue issue = Assert.Single(result.Issues);
        Assert.Equal(CalculationField.PowerDistributor, issue.Field);
        Assert.Equal(CalculationIssueReason.Missing, issue.Reason);
    }

    [Fact]
    public void ASwitchedOffDistributorIsReportedRatherThanSkipped()
    {
        List<LoadoutModule> modules =
        [
            Fit("PowerPlant", Plant),
            new LoadoutModule("PowerDistributor", Distributor) { On = false },
        ];

        CalculationResult<DistributorInput> result = LoadoutMetrics.DistributorInputResultFor(
            modules, new DistributorPips(4, 4, 4), Budget(modules), Catalogued);

        Assert.False(result.Complete);
        Assert.Equal(CalculationIssueReason.Disabled, Assert.Single(result.Issues).Reason);
    }

    [Fact]
    public void APoweredDistributorAnswersAllThreeCapacitors()
    {
        List<LoadoutModule> modules = Running();

        CalculationResult<DistributorInput> result = LoadoutMetrics.DistributorInputResultFor(
            modules, new DistributorPips(2, 3, 1), Budget(modules), Catalogued);

        Assert.True(result.Complete);
        Assert.True(result.Value.SystemsCapacity > 0);
        Assert.True(result.Value.EnginesCapacity > 0);
        Assert.True(result.Value.WeaponsCapacity > 0);
        Assert.Equal(2, result.Value.SystemsPips);
        Assert.Equal(3, result.Value.EnginesPips);
        Assert.Equal(1, result.Value.WeaponsPips);
    }

    [Fact]
    public void ABuildWithNoPlantCannotAnswerItsHeat()
    {
        List<LoadoutModule> modules = [Fit("MainEngines", Thrusters)];

        CalculationResult<HeatInput> result =
            LoadoutMetrics.HeatInputResultFor(Sidewinder, modules, Budget(modules), Catalogued);

        Assert.False(result.Complete);
        Assert.Equal(CalculationField.PowerCapacity, Assert.Single(result.Issues).Field);
    }

    [Fact]
    public void ASwitchedOffPlantCannotAnswerItsHeat()
    {
        List<LoadoutModule> modules =
            [new LoadoutModule("PowerPlant", Plant) { On = false }];

        CalculationResult<HeatInput> result =
            LoadoutMetrics.HeatInputResultFor(Sidewinder, modules, Budget(modules), Catalogued);

        Assert.False(result.Complete);
        Assert.Equal(CalculationIssueReason.Disabled, Assert.Single(result.Issues).Reason);
    }

    [Fact]
    public void ARunningBuildAnswersItsHeatSources()
    {
        List<LoadoutModule> modules = Running(Fit("MediumHardpoint1", Multicannon));

        CalculationResult<HeatInput> result =
            LoadoutMetrics.HeatInputResultFor(Sidewinder, modules, Budget(modules), Catalogued);

        Assert.True(result.Complete);
        Assert.Equal(Sidewinder.HeatCapacity, result.Value.HeatCapacity);
        Assert.True(result.Value.ThrusterHeatRate > 0);
        Assert.True(result.Value.FsdHeatRate > 0);
        Assert.True(result.Value.WeaponsCapacity > 0);
        Assert.Single(result.Value.Weapons!);
    }

    [Fact]
    public void AWeaponsCapacitorReadsTheDeployedDrawAcrossTheWeapons()
    {
        List<LoadoutModule> modules = Running(Fit("MediumHardpoint1", Multicannon));

        WeaponsCapacitorInput input =
            LoadoutMetrics.WeaponsCapacitorInputFor(modules, Budget(modules), Catalogued);

        Assert.True(input.WeaponsCapacity > 0);
        Assert.True(input.WeaponsRecharge > 0);
        Assert.True(input.SustainedEnergyPerSecond > 0);
    }

    [Fact]
    public void AFittedCellBankIsReportedWithItsCells()
    {
        List<LoadoutModule> modules = Running(Fit("Slot01_Size3", CellBank));

        CellBankInput bank = Assert.Single(
            LoadoutMetrics.CellBankInputsFor(modules, Budget(modules), Catalogued));

        Assert.Equal("Slot01_Size3", bank.Slot);
        Assert.Equal(CellBank, bank.Symbol);
        Assert.True(bank.Cells > 0);
        Assert.True(bank.ReinforcementRate > 0);
        Assert.True(bank.Powered);
    }

    [Fact]
    public void ASwitchedOffCellBankIsStillReported()
    {
        List<LoadoutModule> modules = Running(
            new LoadoutModule("Slot01_Size3", CellBank) { On = false });

        CellBankInput bank = Assert.Single(
            LoadoutMetrics.CellBankInputsFor(modules, Budget(modules), Catalogued));

        Assert.False(bank.Powered);
    }

    [Fact]
    public void AHullWithNoBulkheadFittedFliesOnItsStockAlloy()
    {
        ArmourInput input = LoadoutMetrics.ArmourInputFor(Sidewinder, [], Catalogued);

        OutfittingModule stock = ModuleCatalogue.FindBySymbol("SideWinder_Armour_Grade1")!;

        Assert.Equal(Sidewinder.BaseArmour, input.BaseArmour);
        Assert.NotNull(input.Bulkhead);
        Assert.Equal(stock.Stats[ModuleStat.HullBoost], input.Bulkhead.HullBoost);
    }

    [Fact]
    public void AFittedBulkheadReplacesTheStockAlloy()
    {
        List<LoadoutModule> modules = [Fit("Armour", "SideWinder_Armour_Grade3")];

        ArmourInput input = LoadoutMetrics.ArmourInputFor(Sidewinder, modules, Catalogued);

        Assert.Equal(
            ModuleCatalogue.FindBySymbol("SideWinder_Armour_Grade3")!.Stats[ModuleStat.HullBoost],
            input.Bulkhead!.HullBoost);
    }

    [Fact]
    public void AReinforcementPackageIsGatheredWithItsOwnKind()
    {
        List<LoadoutModule> modules =
        [
            Fit("Slot01_Size3", HullPackage),
            Fit("Slot02_Size3", ModulePackage),
        ];

        ArmourInput input = LoadoutMetrics.ArmourInputFor(Sidewinder, modules, Catalogued);

        HullReinforcementParams hull = Assert.Single(input.Reinforcements!);
        Assert.True(hull.HullReinforcement > 0);
        Assert.Equal(0, hull.HullBoost);

        ModuleReinforcementParams module = Assert.Single(input.ModuleReinforcements!);
        Assert.True(module.ModuleProtection > 0);
        Assert.True(module.Integrity > 0);
    }

    [Fact]
    public void AnEngineeredPackagesWholeHullBonusIsReadOffTheModifier()
    {
        List<LoadoutModule> modules =
        [
            Engineered(
                "Slot01_Size3",
                HullPackage,
                new EngineeringModifier("DefenceModifierHealthMultiplier", 5, 0)),
        ];

        ArmourInput input = LoadoutMetrics.ArmourInputFor(Sidewinder, modules, Catalogued);

        Assert.Equal(0.05, Assert.Single(input.Reinforcements!).HullBoost, 6);
    }

    [Fact]
    public void ASwitchedOffPackageProtectsNothing()
    {
        List<LoadoutModule> modules =
            [new LoadoutModule("Slot01_Size3", HullPackage) { On = false }];

        ArmourInput input = LoadoutMetrics.ArmourInputFor(Sidewinder, modules, Catalogued);

        Assert.Empty(input.Reinforcements!);
    }
}
