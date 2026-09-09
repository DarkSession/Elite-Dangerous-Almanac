using System;
using EliteDangerousAlmanac.Ships;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Shield strength, its parts, and the resistances behind it.</summary>
public class ShieldsTests
{
    /// <summary>The precision a curve reading is stated to.</summary>
    private const double Tolerance = 1e-6;

    /// <summary>A 6A shield generator. A catalogue record is a valid generator input as it comes.</summary>
    private static readonly ShieldGeneratorParams Generator = ShieldGeneratorParams.FromStats(
        ModuleCatalogue.FindBySymbol("Int_ShieldGenerator_Size6_Class5")!.Stats);

    /// <summary>The same curve written out, for the cases that move one value at a time.</summary>
    private static readonly ShieldGeneratorParams Physical = new(
        MinMass: 270,
        OptMass: 540,
        MaxMass: 1350,
        MinMultiplier: 0.7,
        OptMultiplier: 1.2,
        MaxMultiplier: 1.7);

    [Fact]
    public void TheMassCurvePassesThroughTheGeneratorsThreeDeclaredPoints()
    {
        Assert.Equal(
            Generator.OptMultiplier!.Value,
            Shields.MassCurveMultiplier(Generator.OptMass!.Value, Generator),
            Tolerance);
        Assert.Equal(
            Generator.MinMultiplier!.Value,
            Shields.MassCurveMultiplier(Generator.MaxMass!.Value, Generator),
            Tolerance);
        Assert.Equal(
            Generator.MaxMultiplier!.Value,
            Shields.MassCurveMultiplier(Generator.MinMass!.Value, Generator),
            Tolerance);
    }

    [Fact]
    public void TheCurveFallsAsTheHullGetsHeavierAndStopsAtTheMaximumMass()
    {
        Assert.True(
            Shields.MassCurveMultiplier(300, Generator) > Shields.MassCurveMultiplier(900, Generator));
        // A hull past the generator's maximum mass gets no shield at all.
        Assert.Equal(0, Shields.MassCurveMultiplier(Generator.MaxMass!.Value + 1, Generator));
        // A featherweight hull is capped at the generator's best multiplier.
        Assert.Equal(
            Generator.MaxMultiplier!.Value, Shields.MassCurveMultiplier(1, Generator), Tolerance);
    }

    [Fact]
    public void StrengthIsTheHullsBaseTimesTheCurveTimesTheBoosters()
    {
        Ship anaconda = ShipCatalogue.FindBySymbol("Anaconda")!;
        double curve = Shields.MassCurveMultiplier(anaconda.HullMass, Generator);

        Assert.Equal(
            anaconda.BaseShieldStrength * curve,
            Shields.Strength(anaconda.HullMass, anaconda.BaseShieldStrength, Generator),
            Tolerance);
        Assert.Equal(
            anaconda.BaseShieldStrength * curve * 1.4,
            Shields.Strength(anaconda.HullMass, anaconda.BaseShieldStrength, Generator, 1.4),
            Tolerance);
    }

    [Fact]
    public void TheStrengthSplitsBetweenGeneratorBoostersAndReinforcement()
    {
        ShieldMetrics metrics = Shields.Metrics(new ShieldInput(400, 350)
        {
            Generator = Generator,
            Boosters = [new ShieldBoosterParams(0.2), new ShieldBoosterParams(0.2)],
            Reinforcement = 64,
        });

        Assert.Equal(1.4, metrics.BoostMultiplier, Tolerance);
        Assert.Equal(metrics.Generator * 0.4, metrics.Boosters, Tolerance);
        Assert.Equal(64, metrics.Reinforcement);
        Assert.Equal(metrics.Generator + metrics.Boosters + 64, metrics.Strength, Tolerance);
    }

    [Fact]
    public void ABuildWithNoGeneratorReportsNoShieldAndStillWellDefinedFigures()
    {
        ShieldMetrics metrics = Shields.Metrics(new ShieldInput(400, 350)
        {
            Boosters = [new ShieldBoosterParams(0.2)],
            Reinforcement = 64,
        });

        Assert.Equal(0, metrics.Strength);
        Assert.Equal(0, metrics.Generator);
        Assert.Equal(0, metrics.Boosters);
        // A Guardian package has no shield to reinforce, so the addition is dropped.
        Assert.Equal(0, metrics.Reinforcement);
        Assert.Equal(0, metrics.MassCurveMultiplier);
        Assert.Equal(1, metrics.BoostMultiplier);
        Assert.Equal(DamageTypeValues.None, metrics.Resistances);
        // An empty pool soaks nothing, and must report neither infinity nor a nonsense figure.
        Assert.Equal(DamageTypeValues.None, metrics.EffectiveHitPoints);
    }

    [Fact]
    public void ResistancesComeFromTheGeneratorAndTheBoostersAndNothingElse()
    {
        ShieldMetrics bare = Shields.Metrics(new ShieldInput(400, 350) { Generator = Generator });

        // A stock generator resists kinetic and explosive damage and is weak to thermal.
        Assert.Equal(0.4, bare.Resistances.Kinetic, Tolerance);
        Assert.Equal(-0.2, bare.Resistances.Thermal, Tolerance);
        Assert.Equal(0.5, bare.Resistances.Explosive, Tolerance);
        // Nothing the generator does not carry appears. The SYS pips belong to the capacitor.
        Assert.Equal(0, bare.Resistances.Caustic);

        ShieldMetrics boosted = Shields.Metrics(new ShieldInput(400, 350)
        {
            Generator = Generator,
            Boosters =
            [
                new ShieldBoosterParams { Resistances = new DamageTypeValues(Kinetic: 0.2) },
                new ShieldBoosterParams { Resistances = new DamageTypeValues(Kinetic: 0.2) },
            ],
        });

        Assert.True(boosted.Resistances.Kinetic > bare.Resistances.Kinetic);
    }

    [Fact]
    public void EffectiveHitPointsScaleTheStrengthByEachResistance()
    {
        ShieldMetrics metrics = Shields.Metrics(new ShieldInput(400, 350) { Generator = Generator });

        Assert.Equal(
            metrics.Strength / (1 - metrics.Resistances.Kinetic),
            metrics.EffectiveHitPoints.Kinetic,
            Tolerance);
        // A thermal weakness means fewer effective hit points than the raw strength.
        Assert.True(metrics.EffectiveHitPoints.Thermal < metrics.Strength);
    }

    [Fact]
    public void AGeneratorWithNoCurveAtAllRaisesNoShield()
    {
        var empty = new ShieldGeneratorParams();

        Assert.Equal(0, Shields.MassCurveMultiplier(400, empty));
        Assert.Equal(0, Shields.Metrics(new ShieldInput(400, 350) { Generator = empty }).Strength);
    }

    [Fact]
    public void AnIncompleteRecordIsStillZeroRatherThanAFailure()
    {
        var partial = new ShieldGeneratorParams(OptMass: 540, OptMultiplier: 1.2);

        // Missing curve data is missing data, and the hull mass is never even read.
        Assert.Equal(0, Shields.MassCurveMultiplier(double.NaN, partial));
        Assert.Equal(0, Shields.Strength(double.NaN, 350, partial));
        Assert.Equal(
            0,
            Shields.Metrics(new ShieldInput(double.NaN, 350) { Generator = partial })
                .MassCurveMultiplier);
    }

    [Fact]
    public void AConstantCurveAnswersItsOneMultiplier()
    {
        var spread = new ShieldGeneratorParams(100, 200, 300, 1, 1, 1);
        var point = new ShieldGeneratorParams(100, 100, 100, 1.2, 1.2, 1.2);

        Assert.Equal(1, Shields.MassCurveMultiplier(150, spread));
        // Three equal masses are a curve only when the multipliers agree too.
        Assert.Equal(1.2, Shields.MassCurveMultiplier(100, point));
    }

    public static TheoryData<ShieldGeneratorParams> NonPhysicalCurves() =>
    [
        Physical with { OptMass = 1350 },
        Physical with { MinMass = -1 },
        Physical with { OptMultiplier = double.NaN },
        Physical with { MaxMultiplier = 0.1 },
        new ShieldGeneratorParams(100, 100, 100, 1, 1.2, 1.4),
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalCurves))]
    public void ACurveThatIsNotPhysicalIsRefusedRatherThanFabricated(ShieldGeneratorParams curve) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Shields.MassCurveMultiplier(400, curve));

    [Theory]
    [InlineData(double.NaN)]
    [InlineData(-1)]
    public void TheHullMassIsHeldToTheSameStandardAsTheCurve(double hullMass) =>
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Shields.MassCurveMultiplier(hullMass, Physical));

    [Fact]
    public void AMissingGeneratorOrInputIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => Shields.MassCurveMultiplier(400, null!));
        Assert.Throws<ArgumentNullException>(() => Shields.Strength(400, 350, null!));
        Assert.Throws<ArgumentNullException>(() => Shields.Metrics(null!));
        Assert.Throws<ArgumentNullException>(() => ShieldGeneratorParams.FromStats(null!));
        Assert.Throws<ArgumentNullException>(() => ShieldBoosterParams.FromStats(null!));
    }

    [Fact]
    public void ABoosterRecordCarriesItsBonusAndItsResistances()
    {
        OutfittingModule booster = ModuleCatalogue.FindBySymbol("Hpt_ShieldBooster_Size0_Class5")!;

        ShieldBoosterParams read = ShieldBoosterParams.FromStats(booster.Stats);

        Assert.Equal(booster.Stats[ModuleStat.ShieldBoost], read.ShieldBoost);
        Assert.Equal(
            booster.Stats[ModuleStat.KineticResistance] ?? 0, read.Resistances.Kinetic);
    }
}
