using System;
using EliteDangerousAlmanac.Ships;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The capability checks a sparse outfitting record is held to.</summary>
public class ModuleCapabilitiesTests
{
    [Fact]
    public void AFrameShiftDriveCarriesItsCompleteJumpConstants()
    {
        ModuleStats drive = ModuleCatalogue.FindBySymbol("Int_Hyperdrive_Size5_Class5")!.Stats;

        Assert.True(ModuleCapabilities.HasFrameShiftDriveJumpStats(drive));
        // A power plant carries none of them.
        Assert.False(ModuleCapabilities.HasFrameShiftDriveJumpStats(
            ModuleCatalogue.FindBySymbol("Int_PowerPlant_Size5_Class5")!.Stats));
    }

    [Fact]
    public void APowerPlantCarriesItsOutputAndItsHeatEfficiency()
    {
        Assert.True(ModuleCapabilities.HasPowerGenerationStats(
            ModuleCatalogue.FindBySymbol("Int_PowerPlant_Size5_Class5")!.Stats));
        Assert.False(ModuleCapabilities.HasPowerGenerationStats(
            ModuleCatalogue.FindBySymbol("Int_Hyperdrive_Size5_Class5")!.Stats));
    }

    [Fact]
    public void ADistributorCarriesAllThreeCapacitorPairs()
    {
        Assert.True(ModuleCapabilities.HasPowerDistributorStats(
            ModuleCatalogue.FindBySymbol("Int_PowerDistributor_Size5_Class5")!.Stats));
        Assert.False(ModuleCapabilities.HasPowerDistributorStats(
            ModuleCatalogue.FindBySymbol("Int_PowerPlant_Size5_Class5")!.Stats));
    }

    [Fact]
    public void BothAThrusterAndAShieldGeneratorSitOnAMassCurve()
    {
        Assert.True(ModuleCapabilities.HasMassCurveStats(
            ModuleCatalogue.FindBySymbol("Int_Engine_Size5_Class5")!.Stats));
        Assert.True(ModuleCapabilities.HasMassCurveStats(
            ModuleCatalogue.FindBySymbol("Int_ShieldGenerator_Size6_Class5")!.Stats));
        Assert.False(ModuleCapabilities.HasMassCurveStats(
            ModuleCatalogue.FindBySymbol("Int_PowerPlant_Size5_Class5")!.Stats));
    }

    [Fact]
    public void AShieldGeneratorCarriesBothRegenerationRates()
    {
        Assert.True(ModuleCapabilities.HasShieldRegenerationStats(
            ModuleCatalogue.FindBySymbol("Int_ShieldGenerator_Size6_Class5")!.Stats));
        Assert.False(ModuleCapabilities.HasShieldRegenerationStats(
            ModuleCatalogue.FindBySymbol("Int_Engine_Size5_Class5")!.Stats));
    }

    [Fact]
    public void AWeaponCarriesADamageFigureAndALaserStillDoes()
    {
        Assert.True(ModuleCapabilities.HasWeaponDamageStats(
            ModuleCatalogue.FindBySymbol("Hpt_MultiCannon_Fixed_Small")!.Stats));
        Assert.True(ModuleCapabilities.HasWeaponDamageStats(
            ModuleCatalogue.FindBySymbol("Hpt_BeamLaser_Fixed_Small")!.Stats));
        Assert.False(ModuleCapabilities.HasWeaponDamageStats(
            ModuleCatalogue.FindBySymbol("Int_PowerPlant_Size5_Class5")!.Stats));
    }

    [Fact]
    public void APartRecordSatisfiesNoCheckItDoesNotComplete()
    {
        ModuleStats part = ModuleStats.From([
            new(ModuleStat.OptMass, 1050),
            new(ModuleStat.MaxFuel, 5),
            new(ModuleStat.FuelMul, 0.012),
        ]);

        Assert.False(ModuleCapabilities.HasFrameShiftDriveJumpStats(part));
        Assert.True(ModuleCapabilities.HasFrameShiftDriveJumpStats(
            part.With(ModuleStat.FuelPower, 2.45)));
    }

    [Fact]
    public void NoModuleAtAllSatisfiesNoCheck()
    {
        Assert.False(ModuleCapabilities.HasFrameShiftDriveJumpStats(null));
        Assert.False(ModuleCapabilities.HasPowerGenerationStats(null));
        Assert.False(ModuleCapabilities.HasPowerDistributorStats(null));
        Assert.False(ModuleCapabilities.HasMassCurveStats(null));
        Assert.False(ModuleCapabilities.HasShieldRegenerationStats(null));
        Assert.False(ModuleCapabilities.HasWeaponDamageStats(null));
        Assert.False(ModuleCapabilities.Has(null, ModuleCapabilities.HasMassCurveStats));
    }

    [Fact]
    public void ACatalogueRecordIsCheckedThroughItsOwnStats()
    {
        OutfittingModule thruster = ModuleCatalogue.FindBySymbol("Int_Engine_Size5_Class5")!;

        Assert.True(ModuleCapabilities.Has(thruster, ModuleCapabilities.HasMassCurveStats));
        Assert.False(ModuleCapabilities.Has(thruster, ModuleCapabilities.HasWeaponDamageStats));
    }

    [Fact]
    public void AMissingCheckIsRefused() =>
        Assert.Throws<ArgumentNullException>(() => ModuleCapabilities.Has(null, null!));
}
