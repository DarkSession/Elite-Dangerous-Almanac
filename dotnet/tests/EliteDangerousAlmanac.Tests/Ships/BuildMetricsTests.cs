using System;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Every figure a fitted build can be asked for.</summary>
public class BuildMetricsTests
{
    private static readonly OperationsFixture Fixture =
        SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc");

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static BuildMetrics Read(JsonElement capture) => BuildMetrics.Of(
        ShipLoadout.FromLoadout(capture.Deserialize<LoadoutEvent>(JournalOptions)!));

    private static BuildLoad Load(BuildLoadFixture options) =>
        new(options.Fuel, options.Cargo);

    private static void Close(double expected, double actual, string what) =>
        Assert.True(Math.Abs(actual - expected) < 1e-9, $"{what}: got {actual}, expected {expected}");

    [Fact]
    public void AViewReadsTheBuildItWasGivenAndSeesEveryLaterEdit()
    {
        ShipLoadout build = ShipLoadout.Default("Anaconda");
        BuildMetrics metrics = BuildMetrics.Of(build);
        double fitted = metrics.BuildMass().Modules;

        build.RemoveModule("Slot03_Size6");

        Assert.Same(build, metrics.Loadout);
        Assert.True(metrics.BuildMass().Modules < fitted);
    }

    [Fact]
    public void NoViewAttachesToNothing() =>
        Assert.Throws<ArgumentNullException>(() => BuildMetrics.Of(null!));

    [Fact]
    public void AStockHullCostsWhatTheCatalogueAsksForIt()
    {
        BuildCreditsCaseFixture expected = Fixture.BuildCost.Credits;

        BuildCredits credits =
            BuildMetrics.Of(ShipLoadout.Default(expected.Ship)).BuildCost().Credits;

        Assert.Equal(expected.Expected.Hull, credits.Hull);
        Assert.Equal(expected.Expected.Modules, credits.Modules);
        Assert.Equal(expected.Expected.Total, credits.Total);
        Assert.Equal(expected.Expected.Rebuy, credits.Rebuy);
        Assert.Empty(credits.Unpriced);
    }

    [Fact]
    public void AnOrdinaryRecipeBillsTheMercCoinAndTheMaterialsItCosts()
    {
        OrdinaryEngineeringCostFixture expected = Fixture.BuildCost.OrdinaryEngineering;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);
        build.SetModule(expected.Slot, ModuleCatalogue.FindBySymbol(expected.Symbol)!);

        BuildCost stock = BuildMetrics.Of(build).BuildCost();
        build.ApplyBlueprint(
            expected.Slot, expected.Blueprint, new ApplyBlueprintOptions(expected.Grade));
        BuildCost rolled = BuildMetrics.Of(build).BuildCost();

        Assert.Equal(0, stock.MercCoins);
        Assert.Empty(stock.Materials);
        Assert.Equal(expected.MercCoins, rolled.MercCoins);
        Assert.NotEmpty(rolled.Materials);

        // The recipe changes what the module does, not what the shop charged for it.
        Assert.Equal(stock.Credits.Total, rolled.Credits.Total);
    }

    [Fact]
    public void APurchasedArticleBillsItsShopPriceAndTheClimbAboveIt()
    {
        MercenaryCostFixture expected = Fixture.BuildCost.Mercenary;
        ShipLoadout build = ShipLoadout.Default(expected.Ship);
        foreach (MercenaryArticleFixture article in expected.Modules)
        {
            build.SetPreEngineeredVariant(article.Slot, Purchased(article));
        }

        BuildCost bought = BuildMetrics.Of(build).BuildCost();
        Assert.Equal(expected.Expected, bought.MercCoins);
        Assert.Empty(bought.Materials);

        MercenaryArticleFixture climbed = expected.Modules[0];
        build.ApplyBlueprint(
            climbed.Slot,
            climbed.Blueprint,
            new ApplyBlueprintOptions(expected.Climbed.Grade));

        BuildCost after = BuildMetrics.Of(build).BuildCost();
        Assert.Equal(expected.Climbed.MercCoins, after.MercCoins);
        Assert.Equal(expected.Climbed.Materials.Count, after.Materials.Count);
        foreach (EngineeringMaterial material in expected.Climbed.Materials)
        {
            EngineeringMaterial billed = Assert.Single(
                after.Materials, entry => entry.Symbol == material.Symbol);
            Assert.Equal(material.Count, billed.Count);
        }
    }

    private static PreEngineeredVariant Purchased(MercenaryArticleFixture article)
    {
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.VariantsFor(article.Symbol))
        {
            if (candidate.Acquisition == PreEngineeredAcquisition.Mercenary
                && string.Equals(
                    candidate.BlueprintSymbol,
                    article.Blueprint,
                    StringComparison.OrdinalIgnoreCase))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException($"The catalogue lists no {article.Blueprint} article.");
    }

    [Fact]
    public void AModuleNoCatalogueAnswersForIsReportedRatherThanPriced()
    {
        ShipLoadout build = ShipLoadout.FromLoadout(new LoadoutEvent(
            "SideWinder",
            [new LoadoutModule("SmallHardpoint1", "Hpt_FutureWeapon")]));

        BuildCredits credits = BuildMetrics.Of(build).BuildCost().Credits;

        Assert.Empty(credits.Unpriced);
        Assert.Equal(
            LoadoutImportAction.Emptied,
            Assert.Single(build.ImportOutcomes, outcome => outcome.Slot == "SmallHardpoint1").Action);
    }

    [Fact]
    public void AWeighedBuildAddsTheHullTheModulesAndTheLoadTogether()
    {
        ShipLoadout build = ShipLoadout.Default("Anaconda");

        BuildMass mass = BuildMetrics.Of(build).BuildMass();

        Assert.Equal(build.Hull.HullMass, mass.Hull);
        Close(build.UnladenMass, mass.Hull + mass.Modules, "unladen mass");
        Assert.Equal(build.FuelCapacity.Main, mass.Fuel);
        Assert.Equal(0, mass.Cargo);
        Assert.Equal(mass.Unladen + mass.Fuel + mass.Cargo, mass.Total);
    }

    [Fact]
    public void AWeighedBuildCountsTheCargoAsked()
    {
        ShipLoadout build = ShipLoadout.Default("Anaconda");

        BuildMass laden = BuildMetrics.Of(build).BuildMass(
            new BuildLoad(Cargo: build.CargoCapacity));

        Assert.Equal(build.CargoCapacity, laden.Cargo);
        Assert.Equal(laden.Unladen + laden.Fuel + laden.Cargo, laden.Total);
    }

    [Fact]
    public void EveryStandardLoadWeighsWhatItCarries()
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));
        ShipLoadout build = metrics.Loadout;

        StandardLoadFigures maximum = metrics.StandardLoadResult(StandardLoad.Maximum).Value;
        StandardLoadFigures unladen = metrics.StandardLoadResult(StandardLoad.Unladen).Value;
        StandardLoadFigures laden = metrics.StandardLoadResult(StandardLoad.Laden).Value;

        Assert.Equal(metrics.FrameShiftDrive().MaxFuel, maximum.Fuel);
        Assert.Equal(0, maximum.Cargo);
        Assert.Equal(build.FuelCapacity.Main, unladen.Fuel);
        Assert.Equal(0, unladen.Cargo);
        Assert.Equal(build.FuelCapacity.Main, laden.Fuel);
        Assert.Equal(build.CargoCapacity, laden.Cargo);
        Assert.Equal(build.UnladenMass + laden.Fuel + laden.Cargo, laden.Mass);
    }

    [Fact]
    public void AHullWithNoDriveWeighsNoMaximumLoad()
    {
        // Only the maximum load reads the drive, so only it can come back short.
        OutfittingModule drive = ModuleCatalogue.FindBySymbol("Int_Hyperdrive_Size6_Class1")!;
        ShipLoadout build = ShipLoadout.Default("Anaconda");
        build.SetModule(
            "FrameShiftDrive", drive with { Stats = drive.Stats.Without(ModuleStat.MaxFuel) });

        CalculationResult<StandardLoadFigures> maximum =
            BuildMetrics.Of(build).StandardLoadResult(StandardLoad.Maximum);

        Assert.False(maximum.Complete);
        CalculationIssue issue = Assert.Single(maximum.Issues);
        Assert.Equal(CalculationField.FrameShiftDrive, issue.Field);
        Assert.Equal(CalculationIssueReason.Unresolved, issue.Reason);
        Assert.True(BuildMetrics.Of(build).StandardLoadResult(StandardLoad.Unladen).Complete);
        Assert.Throws<InvalidOperationException>(() => BuildMetrics.Of(build).JumpRangeSummary());
        Assert.Throws<InvalidOperationException>(() => BuildMetrics.Of(build).MaxJumpRange());
    }

    [Fact]
    public void EveryJumpFigureAgreesWithTheStandardLoadItQuotes()
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));

        JumpRangeSummary jumps = metrics.JumpRangeSummary();

        Assert.Equal(metrics.MaxJumpRange(), jumps.Max);
        Assert.Equal(metrics.JumpRangeAt(), jumps.Unladen);
        Assert.Equal(metrics.LadenJumpRange(), jumps.Laden);
        Assert.Equal(metrics.TotalRange().Range, jumps.TotalUnladen.Range);
        Assert.True(jumps.Max > jumps.Unladen);
        Assert.True(jumps.Unladen > jumps.Laden);
        Assert.True(jumps.TotalUnladen.Jumps > 1);
    }

    [Fact]
    public void AJumpBurnsNoMoreFuelThanTheDriveTakesInOne()
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));

        double burnt = metrics.FuelPerJump(1000);

        Assert.Equal(metrics.FrameShiftDrive().MaxFuel, burnt);
        Assert.True(metrics.FuelPerJump(1) < burnt);
    }

    [Fact]
    public void TheDriveIsAtItsOptimisedMassWhenTheShipWeighsIt()
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));
        ShipLoadout build = metrics.Loadout;

        double factor = metrics.FrameShiftDriveMassFactor(new BuildLoad(0, 0));

        Close(metrics.FrameShiftDrive().OptMass / build.UnladenMass, factor, "mass factor");
        Assert.True(metrics.FrameShiftDriveMassFactor(new BuildLoad(0, 1000)) < factor);
    }

    [Theory]
    [InlineData(-1d, null)]
    [InlineData(null, -1d)]
    [InlineData(double.NaN, null)]
    public void NoCalculationRunsAtALoadThatCannotBeWeighed(double? fuel, double? cargo)
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));
        BuildLoad load = new(fuel, cargo);

        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.JumpRangeAt(load));
        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.TotalRange(load));
        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.BuildMass(load));
        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.FuelPerJump(10, load));
        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.FrameShiftDriveMassFactor(load));
        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.MobilityMetricsResult(load));
    }

    [Fact]
    public void ABuildReportsItsSpeedAndHandlingAtTheFuelItCarries()
    {
        MobilityFacadeFixture expected = Fixture.Mobility.FacadeFuelOverride;
        BuildMetrics metrics = Read(expected.Loadout);

        MobilityMetrics mobility =
            metrics.MobilityMetricsResult(Load(expected.Options)).Value;

        Close(expected.Expected.Speed, mobility.Speed, "speed");
        Close(expected.Expected.Boost, mobility.Boost, "boost");
        Close(expected.Expected.Pitch, mobility.Pitch, "pitch");
        Close(expected.Expected.Roll, mobility.Roll, "roll");
        Close(expected.Expected.Yaw, mobility.Yaw, "yaw");
        Close(
            expected.Expected.MassCurveMultiplier,
            mobility.MassCurveMultiplier,
            "mass curve multiplier");
        Close(
            expected.Expected.RotationMassCurveMultiplier,
            mobility.RotationMassCurveMultiplier,
            "rotation mass curve multiplier");
    }

    [Fact]
    public void ABuildRefusesEveryLoadItCannotWeigh()
    {
        MobilityFacadeFixture expected = Fixture.Mobility.FacadeFuelOverride;
        BuildMetrics metrics = Read(expected.Loadout);

        Assert.NotEmpty(expected.InvalidLoads);
        foreach (InvalidLoadFixture refused in expected.InvalidLoads)
        {
            Assert.Throws<ArgumentOutOfRangeException>(
                () => metrics.MobilityMetricsResult(Load(refused.Options)));
        }
    }

    [Fact]
    public void AFullEngineAllocationReproducesTheSpeedTheBuildFliesAt()
    {
        MobilityFacadeFixture expected = Fixture.Mobility.FacadeFuelOverride;
        BuildMetrics metrics = Read(expected.Loadout);
        BuildLoad load = Load(expected.Options);

        MobilityCapacitorMetrics full =
            metrics.MobilityCapacitorMetricsResult(load).Value;
        MobilityCapacitorMetrics starved =
            metrics.MobilityCapacitorMetricsResult(load, 0).Value;

        Close(expected.Expected.Speed, full.Speed, "speed at four pips");
        Assert.True(starved.Speed < full.Speed);
        Assert.Throws<ArgumentOutOfRangeException>(
            () => metrics.MobilityCapacitorMetricsResult(load, 5));
    }

    [Fact]
    public void AGroundedThrusterLeavesTheBuildWithNoMobilityFigures()
    {
        ShipLoadout build = ShipLoadout.Default("SideWinder");
        build.SetModuleEnabled("MainEngines", false);

        CalculationResult<MobilityMetrics> result =
            BuildMetrics.Of(build).MobilityMetricsResult();

        Assert.False(result.Complete);
        Assert.Equal(
            CalculationIssueReason.Disabled, Assert.Single(result.Issues).Reason);
        Assert.NotNull(BuildMetrics.Of(build).Thrusters());
    }

    [Fact]
    public void ABuildReportsItsDistributorAtTheAllocationAsked()
    {
        DistributorFacadeFixture expected = Fixture.Distributor.Facade;
        BuildMetrics metrics = Read(expected.Loadout);

        DistributorMetrics distributor = metrics.DistributorMetricsResult(new DistributorPips(
            expected.Options.SystemsPips, expected.Options.EnginesPips, expected.Options.WeaponsPips)).Value;

        AssertCapacitor(expected.Expected.Systems, distributor.Systems, "systems");
        AssertCapacitor(expected.Expected.Engines, distributor.Engines, "engines");
        AssertCapacitor(expected.Expected.Weapons, distributor.Weapons, "weapons");
        Assert.Equal(expected.Expected.Pips.Systems, distributor.Pips.Systems);
        Assert.Equal(expected.Expected.Pips.Engines, distributor.Pips.Engines);
        Assert.Equal(expected.Expected.Pips.Weapons, distributor.Pips.Weapons);
    }

    [Fact]
    public void ADistributorWithNoPowerLeavesTheBuildWithNoFigures()
    {
        DistributorFacadeFixture expected = Fixture.Distributor.Facade;

        Assert.NotEmpty(expected.NullLoadouts);
        foreach (JsonElement capture in expected.NullLoadouts)
        {
            Assert.False(Read(capture).DistributorMetricsResult().Complete);
        }
    }

    [Fact]
    public void NoDistributorFigureRunsAtAnAllocationOutsideTheFive()
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));

        Assert.Throws<ArgumentOutOfRangeException>(
            () => metrics.DistributorMetricsResult(new DistributorPips(5, 4, 4)));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => metrics.DistributorMetricsResult(new DistributorPips(4, -1, 4)));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => metrics.DistributorMetricsResult(new DistributorPips(4, 4, double.NaN)));
    }

    private static void AssertCapacitor(
        CapacitorFixture expected,
        DistributorCapacitorMetrics actual,
        string what)
    {
        Close(expected.Capacity, actual.Capacity, $"{what} capacity");
        Close(expected.RatedRecharge, actual.RatedRecharge, $"{what} rated recharge");
        Close(expected.RechargeRate, actual.RechargeRate, $"{what} recharge rate");
    }

    [Fact]
    public void AStockHullRunsCoolAndReportsItsHeat()
    {
        CalculationResult<HeatMetrics> heat =
            BuildMetrics.Of(ShipLoadout.Default("Anaconda")).HeatMetricsResult();

        Assert.True(heat.Complete);
        Assert.True(heat.Value.Idle.Gauge >= 0);
        Assert.True(heat.Value.FiringSustained.HeatLevel >= heat.Value.Idle.HeatLevel);
    }

    [Fact]
    public void AShutDownPlantLeavesTheBuildWithNoHeatFigures()
    {
        ShipLoadout build = ShipLoadout.Default("Anaconda");
        build.SetModuleEnabled("PowerPlant", false);

        CalculationResult<HeatMetrics> heat = BuildMetrics.Of(build).HeatMetricsResult();

        Assert.False(heat.Complete);
        Assert.Equal(CalculationIssueReason.Disabled, Assert.Single(heat.Issues).Reason);
    }

    [Fact]
    public void AFullSystemsAllocationBuysTheShieldTheResistanceItPays()
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));

        ShieldMetrics bare = metrics.ShieldMetricsResult().Value;
        ShieldCapacitorMetrics full = metrics.ShieldCapacitorMetricsResult().Value;
        ShieldCapacitorMetrics starved = metrics.ShieldCapacitorMetricsResult(0).Value;

        Assert.True(full.EffectiveResistances.Kinetic > bare.Resistances.Kinetic);
        Assert.Equal(bare.Resistances.Kinetic, starved.EffectiveResistances.Kinetic);
        Assert.Throws<ArgumentOutOfRangeException>(
            () => metrics.ShieldCapacitorMetricsResult(5));
    }

    [Fact]
    public void ACollapsedShieldReportsHowLongItTakesToComeBack()
    {
        BuildMetrics metrics = BuildMetrics.Of(ShipLoadout.Default("Anaconda"));

        ShieldRecoveryMetrics recovery = metrics.ShieldRecoveryResult().Value;

        Assert.True(recovery.RecoveryTime > 0);
        Assert.True(recovery.RegenTime > recovery.RecoveryTime);
        Assert.True(metrics.ShieldRecoveryResult(0).Value.RecoveryTime >= recovery.RecoveryTime);
        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.ShieldRecoveryResult(5));
    }

    [Fact]
    public void AnUnshieldedBuildReportsNoShieldFigureAtAll()
    {
        ShipLoadout build = ShipLoadout.Default("SideWinder");
        foreach (LoadoutSlot slot in build.Slots(SlotKind.Optional))
        {
            if (slot.Module?.Stats?.ExclusionGroup == ModuleExclusionGroup.ShieldGenerator)
            {
                build.RemoveModule(slot.Key);
            }
        }

        BuildMetrics metrics = BuildMetrics.Of(build);

        Assert.False(metrics.ShieldMetricsResult().Complete);
        Assert.False(metrics.ShieldCapacitorMetricsResult().Complete);
        Assert.False(metrics.ShieldRecoveryResult().Complete);
        Assert.Empty(metrics.CellBanks().Banks);
        Assert.Equal(0, metrics.CellBanks().TotalRestorable);
    }

    [Fact]
    public void EveryFittedCellBankIsListedInTheHullsOwnMountOrder()
    {
        ShipLoadout build = ShipLoadout.Default("Anaconda");
        OutfittingModule bank = ModuleCatalogue.FindBySymbol("Int_ShieldCellBank_Size4_Class3")!;
        build.SetModule("Slot04_Size6", bank);
        build.SetModule("Slot03_Size6", bank);

        CellBankSummary banks = BuildMetrics.Of(build).CellBanks();

        Assert.Equal(2, banks.Banks.Count);
        Assert.Equal("Slot03_Size6", banks.Banks[0].Slot);
        Assert.Equal("Slot04_Size6", banks.Banks[1].Slot);
        Assert.Equal(banks.Banks[0].Cells + banks.Banks[1].Cells, banks.TotalCells);
        Assert.True(banks.TotalRestorable > 0);
    }

    [Fact]
    public void EveryFittedWeaponIsListedWithWhatItHoldsAndHowFarItReaches()
    {
        ShipLoadout build = ShipLoadout.Empty("Anaconda");
        build.SetModule(
            "HugeHardpoint1", ModuleCatalogue.FindBySymbol("Hpt_MultiCannon_Fixed_Huge")!);
        build.SetModule(
            "LargeHardpoint1", ModuleCatalogue.FindBySymbol("Hpt_BeamLaser_Fixed_Large")!);
        build.SetModuleEnabled("LargeHardpoint1", false);

        BuildWeaponMetrics weapons = BuildMetrics.Of(build).WeaponMetrics();

        Assert.Equal(2, weapons.Weapons.Count);
        FittedWeaponMetrics cannon = weapons.Weapons[0];
        Assert.Equal("HugeHardpoint1", cannon.Slot);
        Assert.True(cannon.Enabled);
        Assert.NotNull(cannon.Ammunition);
        Assert.NotNull(cannon.MaximumRange);
        Assert.NotNull(cannon.ArmourPiercing);

        FittedWeaponMetrics laser = weapons.Weapons[1];
        Assert.False(laser.Enabled);
        Assert.Null(laser.Ammunition);

        // The switched-off laser is listed with its own figures and joins no total.
        Assert.Equal(cannon.Metrics.DamagePerSecond, weapons.Total.DamagePerSecond);
        Assert.True(laser.Metrics.DamagePerSecond > 0);
    }

    [Fact]
    public void TheWeaponsCapacitorDrainsFasterAsTheAllocationFalls()
    {
        ShipLoadout build = ShipLoadout.Default("Anaconda");
        build.SetModule(
            "HugeHardpoint1", ModuleCatalogue.FindBySymbol("Hpt_BeamLaser_Fixed_Huge")!);
        BuildMetrics metrics = BuildMetrics.Of(build);

        WeaponsCapacitorMetrics full = metrics.WeaponsCapacitorMetrics();
        WeaponsCapacitorMetrics starved = metrics.WeaponsCapacitorMetrics(0);

        Assert.True(full.RechargeRate > starved.RechargeRate);
        Assert.True(starved.TimeToDrain < full.TimeToDrain);
        Assert.Throws<ArgumentOutOfRangeException>(() => metrics.WeaponsCapacitorMetrics(5));
    }

    [Fact]
    public void AnUnarmedBuildDrainsNoWeaponsCapacitor()
    {
        WeaponsCapacitorMetrics capacitor =
            BuildMetrics.Of(ShipLoadout.Empty("SideWinder")).WeaponsCapacitorMetrics();

        Assert.Equal(0, capacitor.SustainedEnergyPerSecond);
        Assert.Equal(double.PositiveInfinity, capacitor.TimeToDrain);
    }
    [Fact]
    public void AnUnpoweredBoosterLeavesTheBonusToWhateverElseTheBuildCarries()
    {
        // A capture is free to state two boosters: a read fills the mounts a capture
        // names rather than enforcing the one-per-ship rule the shop applies.
        ShipLoadout build = ShipLoadout.FromLoadout(new LoadoutEvent(
            "Anaconda",
            [
                new LoadoutModule("Slot02_Size6", "Int_GuardianFSDBooster_Size5") { On = false },
                new LoadoutModule("Slot03_Size6", "Int_GuardianFSDBooster_Size5") { On = true },
            ]));

        double running = ModuleCatalogue
            .FindBySymbol("Int_GuardianFSDBooster_Size5")!.Stats[ModuleStat.JumpBoost]!.Value;

        // The booster that is switched off supplies nothing. The one that is running
        // still supplies its whole bonus.
        Assert.Equal(running, BuildMetrics.Of(build).FrameShiftDrive().JumpBoost);
    }

    [Fact]
    public void ABuildWhoseOnlyBoosterIsOffCarriesNoBonus()
    {
        ShipLoadout build = ShipLoadout.FromLoadout(new LoadoutEvent(
            "Anaconda",
            [new LoadoutModule("Slot02_Size6", "Int_GuardianFSDBooster_Size5") { On = false }]));

        Assert.Equal(0, BuildMetrics.Of(build).FrameShiftDrive().JumpBoost);
    }

}
