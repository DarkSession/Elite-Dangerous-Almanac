using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What a weapon does per second, measured against the shared fixture.</summary>
public class WeaponsTests
{
    private static readonly BuildMetricsFixture Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc");

    /// <summary>The precision the fixture states a per-second figure to.</summary>
    private const double Tolerance = 5e-7;

    public static TheoryData<string> CatalogueWeapons()
    {
        TheoryData<string> symbols = [];
        foreach (CatalogueWeaponFixture weapon in Fixture.Weapons) symbols.Add(weapon.Symbol);
        return symbols;
    }

    public static TheoryData<int> Falloffs() => Positions(Fixture.Functions.DamageFalloff.Count);

    public static TheoryData<int> Piercings() =>
        Positions(Fixture.Functions.ArmourPiercingFactor.Count);

    [Theory]
    [MemberData(nameof(CatalogueWeapons))]
    public void ACatalogueWeaponMatchesTheFixturesPerSecondFigures(string symbol)
    {
        CatalogueWeaponFixture stated = Fixture.Weapons.Find(weapon => weapon.Symbol == symbol)!;
        WeaponStats weapon = WeaponStats.FromModule(ModuleCatalogue.FindBySymbol(symbol)!);

        WeaponMetrics metrics = Weapons.Metrics(weapon);

        Assert.Equal(stated.DamagePerSecond, metrics.DamagePerSecond, Tolerance);
        Assert.Equal(stated.SustainedDamagePerSecond, metrics.SustainedDamagePerSecond, Tolerance);
        Assert.Equal(stated.SustainedFireFactor, Weapons.SustainedFireFactor(weapon), Tolerance);
        Assert.Equal(stated.EnergyPerSecond, metrics.EnergyPerSecond, Tolerance);
        Assert.Equal(stated.HeatPerSecond, metrics.HeatPerSecond, Tolerance);
        Assert.Equal(stated.Continuous, metrics.Continuous);
    }

    [Theory]
    [MemberData(nameof(Falloffs))]
    public void DamageTapersToNothingAtTheFixturesRange(int position)
    {
        DamageFalloffCaseFixture stated = Fixture.Functions.DamageFalloff[position];
        var weapon = new WeaponStats
        {
            MaximumRange = stated.MaximumRange,
            FalloffRange = stated.FalloffRange,
        };

        Assert.Equal(stated.Expected, Weapons.DamageFalloff(weapon, stated.Metres), Tolerance);
    }

    [Theory]
    [MemberData(nameof(Piercings))]
    public void HardnessLetsTheFixturesShareThrough(int position)
    {
        ArmourPiercingCaseFixture stated = Fixture.Functions.ArmourPiercingFactor[position];

        Assert.Equal(
            stated.Expected,
            Weapons.ArmourPiercingFactor(stated.ArmourPiercing, stated.Hardness),
            Tolerance);
    }

    [Fact]
    public void AContinuousWeaponReportsItsStatsAsTheyStand()
    {
        WeaponStats beam = WeaponStats.FromModule(
            ModuleCatalogue.FindBySymbol("Hpt_BeamLaser_Fixed_Small")!);

        WeaponMetrics metrics = Weapons.Metrics(beam);

        Assert.True(metrics.Continuous);
        Assert.Equal(1, metrics.RateOfFire);
        Assert.Equal(beam.Damage, metrics.DamagePerSecond);
        Assert.Equal(beam.ThermalLoad, metrics.HeatPerSecond);
        Assert.Equal(beam.DistributorDraw, metrics.EnergyPerSecond);
        // A beam laser draws from the capacitor, so it never stops to reload.
        Assert.Equal(1, Weapons.SustainedFireFactor(beam));
    }

    [Fact]
    public void ABurstWeaponRebuildsTheRateOfFireTheJournalStates()
    {
        // Three shots at fifteen a second, then half a second's wait.
        var burst = new WeaponStats
        {
            BurstInterval = 0.5,
            BurstRounds = 3,
            BurstRateOfFire = 15,
        };

        Assert.Equal(4.736842, Weapons.CombinedRateOfFire(burst));
    }

    [Fact]
    public void AContinuousWeaponHasNoFiringCycleToRebuild() =>
        Assert.Null(Weapons.CombinedRateOfFire(new WeaponStats()));

    [Fact]
    public void EveryCatalogueBurstWeaponAlreadyCarriesItsCombinedRate()
    {
        int checkedWeapons = 0;
        foreach (OutfittingModule module in ModuleCatalogue.Hardpoint)
        {
            WeaponStats weapon = WeaponStats.FromModule(module);
            if (Weapons.CombinedRateOfFire(weapon) is not double rebuilt) continue;
            if (weapon.RateOfFire is not double stated) continue;

            Assert.Equal(stated, rebuilt, 1e-6);
            checkedWeapons++;
        }

        Assert.True(checkedWeapons > 0);
    }

    [Fact]
    public void AnAbsentDistributionMakesTheWholeFigureAbsolute()
    {
        DamageSplit split = Weapons.SplitDamage(60, null);

        Assert.Equal(new DamageSplit(Absolute: 60), split);
    }

    [Fact]
    public void ADistributionSplitsTheFigureAndSumsBackToIt()
    {
        DamageSplit split = Weapons.SplitDamage(
            60, new DamageDistribution(Kinetic: 1 / 3d, Thermal: 2 / 3d));

        Assert.Equal(20, split.Kinetic, Tolerance);
        Assert.Equal(40, split.Thermal, Tolerance);
        Assert.Equal(60, split.Kinetic + split.Thermal + split.Explosive + split.Absolute, Tolerance);
    }

    [Fact]
    public void TheAntiXenoShareOverlaysTheConventionalOneRatherThanPartitioningIt()
    {
        DamageSplit split = Weapons.SplitDamage(
            60, new DamageDistribution(Absolute: 1, AntiXeno: 1));

        Assert.Equal(60, split.Absolute);
        Assert.Equal(60, split.AntiXeno);
    }

    [Fact]
    public void ExactDamageAmountsTakePrecedenceOverTheFractions()
    {
        var weapon = new WeaponStats
        {
            Damage = 10,
            RateOfFire = 2,
            DamageDistribution = new DamageDistribution(Absolute: 1),
            DamageComponents = new DamageComponents(Kinetic: 3, Thermal: 1),
        };

        WeaponMetrics metrics = Weapons.Metrics(weapon);

        // The amounts are scaled to the damage per second rather than read as they stand.
        Assert.Equal(15, metrics.DamageByType.Kinetic, Tolerance);
        Assert.Equal(5, metrics.DamageByType.Thermal, Tolerance);
        Assert.Equal(0, metrics.DamageByType.Absolute);
    }

    [Fact]
    public void UnclassifiedAmountsAreSummedAndScaledWithTheRest()
    {
        var weapon = new WeaponStats
        {
            Damage = 8,
            DamageComponents = new DamageComponents(
                Kinetic: 2, Unclassified: [1, 1]),
        };

        DamageSplit split = Weapons.Metrics(weapon).DamageByType;

        Assert.Equal(4, split.Kinetic, Tolerance);
        Assert.Equal(4, split.Unclassified, Tolerance);
    }

    [Fact]
    public void ExactAmountsThatSumToNothingLeaveTheFigureAbsolute()
    {
        var weapon = new WeaponStats
        {
            Damage = 8,
            DamageComponents = new DamageComponents(AntiXeno: 4),
        };

        Assert.Equal(8, Weapons.Metrics(weapon).DamageByType.Absolute);
    }

    [Fact]
    public void AWeaponThatNeverReloadsFiresAtItsFullRate()
    {
        var weapon = new WeaponStats { RateOfFire = 5, Damage = 10 };

        Assert.Equal(1, Weapons.SustainedFireFactor(weapon));
        Assert.Equal(50, Weapons.SustainedDamagePerSecond(weapon));
    }

    [Fact]
    public void APartClipIsHeldToWholeRoundsRoundingUp()
    {
        var part = new WeaponStats { RateOfFire = 5, ClipSize = 10.2, ReloadTime = 2 };
        var whole = new WeaponStats { RateOfFire = 5, ClipSize = 11, ReloadTime = 2 };

        Assert.Equal(Weapons.SustainedFireFactor(whole), Weapons.SustainedFireFactor(part));
    }

    [Fact]
    public void AClipOfNothingLeavesTheRateAlone() =>
        Assert.Equal(1, Weapons.SustainedFireFactor(
            new WeaponStats { RateOfFire = 5, ClipSize = 0, ReloadTime = 2 }));

    [Fact]
    public void AWholeClipInOneBurstWithNoReloadNeverStopsFiring() =>
        Assert.Equal(1, Weapons.SustainedFireFactor(new WeaponStats
        {
            RateOfFire = 5,
            ClipSize = 1,
            BurstRounds = 1,
            BurstRateOfFire = 1,
        }));

    [Fact]
    public void AnUnstatedRoundCountFiresOneRoundAShot()
    {
        Assert.Equal(10, Weapons.DamagePerSecond(new WeaponStats { Damage = 10 }));
        Assert.Equal(10, Weapons.DamagePerSecond(new WeaponStats { Damage = 10, RoundsPerShot = 0 }));
    }

    [Fact]
    public void ARangeCapWithNoFalloffLandsWholeDamageUpToIt()
    {
        var weapon = new WeaponStats { MaximumRange = 3000 };

        Assert.Equal(1, Weapons.DamageFalloff(weapon, 2999));
        Assert.Equal(0, Weapons.DamageFalloff(weapon, 3001));
    }

    [Fact]
    public void AFalloffAtTheRangeCapTapersNothing() =>
        Assert.Equal(1, Weapons.DamageFalloff(
            new WeaponStats { MaximumRange = 3000, FalloffRange = 3000 }, 2000));

    [Fact]
    public void AWeaponWithNoRangeDataLandsWholeDamageEverywhere() =>
        Assert.Equal(1, Weapons.DamageFalloff(new WeaponStats(), 100000));

    [Fact]
    public void NoHardnessDisablesTheScalingAndNoPiercingStopsEverything()
    {
        Assert.Equal(1, Weapons.ArmourPiercingFactor(0, 0));
        Assert.Equal(0, Weapons.ArmourPiercingFactor(0, 65));
    }

    [Theory]
    [InlineData(-1, 65)]
    [InlineData(22, -1)]
    [InlineData(double.NaN, 65)]
    [InlineData(22, double.PositiveInfinity)]
    public void APiercingOrHardnessThatIsNotPhysicalIsRefused(double piercing, double hardness) =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Weapons.ArmourPiercingFactor(piercing, hardness));

    [Fact]
    public void SeveralWeaponsSumToTheirCombinedFirepower()
    {
        List<WeaponMetrics> metrics =
        [
            Weapons.Metrics(new WeaponStats
            {
                Damage = 10,
                RateOfFire = 2,
                ThermalLoad = 4,
                DistributorDraw = 1,
                PowerDraw = 0.5,
                DamageDistribution = new DamageDistribution(Kinetic: 1),
            }),
            Weapons.Metrics(new WeaponStats
            {
                Damage = 6,
                ThermalLoad = 3.5,
                DistributorDraw = 2,
                PowerDraw = 0.6,
                DamageDistribution = new DamageDistribution(Thermal: 1),
            }),
        ];

        WeaponTotals totals = Weapons.Sum(metrics);

        Assert.Equal(26, totals.DamagePerSecond, Tolerance);
        Assert.Equal(26, totals.SustainedDamagePerSecond, Tolerance);
        Assert.Equal(4, totals.EnergyPerSecond, Tolerance);
        Assert.Equal(11.5, totals.HeatPerSecond, Tolerance);
        Assert.Equal(7.5, totals.ThermalLoad, Tolerance);
        Assert.Equal(1.1, totals.PowerDraw, Tolerance);
        Assert.Equal(20, totals.DamageByType.Kinetic, Tolerance);
        Assert.Equal(6, totals.DamageByType.Thermal, Tolerance);
    }

    [Fact]
    public void NoWeaponsAtAllSumToNoFirepower()
    {
        WeaponTotals totals = Weapons.Sum([]);

        Assert.Equal(0, totals.DamagePerSecond);
        Assert.Equal(new DamageSplit(), totals.DamageByType);
        Assert.Equal(new DamageSplit(), totals.SustainedDamageByType);
    }

    [Fact]
    public void TheThermalLoadOfSeveralWeaponsIsTheSharedFixturesTotal()
    {
        WeaponsFixture stated =
            SharedFixtures.Load<OperationsFixture>("fixtures/ships/operations.jsonc").Weapons;
        List<WeaponMetrics> metrics = [];
        foreach (WeaponThermalLoadFixture weapon in stated.Input)
        {
            metrics.Add(Weapons.Metrics(new WeaponStats { ThermalLoad = weapon.ThermalLoad }));
        }

        Assert.Equal(stated.ExpectedThermalLoad, Weapons.Sum(metrics).ThermalLoad, Tolerance);
    }

    [Fact]
    public void AMissingWeaponIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => Weapons.Metrics(null!));
        Assert.Throws<ArgumentNullException>(() => Weapons.DamagePerSecond(null!));
        Assert.Throws<ArgumentNullException>(() => Weapons.SustainedFireFactor(null!));
        Assert.Throws<ArgumentNullException>(() => Weapons.EnergyPerSecond(null!));
        Assert.Throws<ArgumentNullException>(() => Weapons.HeatPerSecond(null!));
        Assert.Throws<ArgumentNullException>(() => Weapons.CombinedRateOfFire(null!));
        Assert.Throws<ArgumentNullException>(() => Weapons.DamageFalloff(null!, 100));
        Assert.Throws<ArgumentNullException>(() => Weapons.Sum(null!));
        Assert.Throws<ArgumentNullException>(() => WeaponStats.FromModule(null!));
    }

    private static TheoryData<int> Positions(int count)
    {
        TheoryData<int> positions = [];
        for (int position = 0; position < count; position++) positions.Add(position);
        return positions;
    }
}
