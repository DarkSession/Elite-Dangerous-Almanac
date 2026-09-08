using System;
using EliteDangerousAlmanac.Ships;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What pips to SYS buy a raised shield.</summary>
public class ShieldCapacitorTests
{
    /// <summary>The precision a resistance and a recharge rate are stated to.</summary>
    private const double Tolerance = 1e-12;

    private static readonly ShieldGeneratorParams Generator = new(
        MinMass: 270,
        OptMass: 540,
        MaxMass: 1350,
        MinMultiplier: 0.7,
        OptMultiplier: 1.2,
        MaxMultiplier: 1.7)
    {
        Resistances = new DamageTypeValues(Kinetic: 0.4, Thermal: -0.2, Explosive: 0.5),
    };

    private static readonly ShieldMetrics Shield =
        Shields.Metrics(new ShieldInput(400, 350) { Generator = Generator });

    private static ShieldCapacitorInput Input() => ShieldCapacitorInput.For(Shield, 41, 3.9);

    [Fact]
    public void AShieldMetricsResultIsTheCapacitorInputWithNoAdapter()
    {
        ShieldCapacitorMetrics sys = ShieldCapacitor.Metrics(Input());

        Assert.Equal(4, sys.SystemsPips);
        Assert.Equal(41, sys.Capacity);
        Assert.Equal(0.6, sys.SystemsResistance, Tolerance);
    }

    [Fact]
    public void NoPipsLeaveTheBareShieldExactlyAsItCameIn()
    {
        ShieldCapacitorMetrics none = ShieldCapacitor.Metrics(Input(), 0);

        Assert.Equal(0, none.SystemsResistance);
        Assert.Equal(0, none.RechargeRate);
        // Bit for bit, not merely close: the split must not move a headline number.
        Assert.Equal(Shield.Resistances, none.EffectiveResistances);
        Assert.Equal(Shield.EffectiveHitPoints, none.EffectiveHitPoints);
    }

    [Fact]
    public void PipsMultiplyWithTheShieldStackRatherThanAddingToIt()
    {
        ShieldCapacitorMetrics four = ShieldCapacitor.Metrics(Input(), 4);

        Assert.Equal(1 - (0.6 * 0.4), four.EffectiveResistances.Kinetic, Tolerance);
        // Caustic is the pips alone: no stock generator carries a caustic resistance.
        Assert.Equal(0.6, four.EffectiveResistances.Caustic, Tolerance);
        Assert.Equal(1 - (1.2 * 0.4), four.EffectiveResistances.Thermal, Tolerance);
        // The effective hit points are derived from exactly those effective resistances.
        Assert.Equal(
            Shield.Strength / (1 - four.EffectiveResistances.Kinetic),
            four.EffectiveHitPoints.Kinetic,
            Tolerance);
        Assert.True(four.EffectiveHitPoints.Kinetic > Shield.EffectiveHitPoints.Kinetic);
    }

    [Fact]
    public void TheRechargeFollowsTheSamePipCurveAsTheOtherCapacitors()
    {
        Assert.Equal(3.9, ShieldCapacitor.Metrics(Input(), 4).RechargeRate);

        ShieldCapacitorMetrics half = ShieldCapacitor.Metrics(Input(), 2);

        Assert.Equal(3.9 * Math.Pow(0.5, 1.1), half.RechargeRate, Tolerance);
        // Half the pips buy less than half the recharge, and more than half the resistance.
        Assert.True(half.RechargeRate < 3.9 / 2);
        Assert.True(half.SystemsResistance > 0.6 / 2);
        Assert.Equal(Resistances.SystemsResistance(2), half.SystemsResistance);
    }

    [Fact]
    public void AWholeResistanceReportsAnInfinitePoolRatherThanANegativeOne()
    {
        ShieldCapacitorMetrics sealedShield = ShieldCapacitor.Metrics(
            Input() with { Resistances = new DamageTypeValues(Kinetic: 1) });

        Assert.Equal(double.PositiveInfinity, sealedShield.EffectiveHitPoints.Kinetic);
        Assert.True(double.IsFinite(sealedShield.EffectiveHitPoints.Thermal));
    }

    [Fact]
    public void FractionalPipsAreLegal()
    {
        ShieldCapacitorMetrics fractional = ShieldCapacitor.Metrics(Input(), 2.5);

        Assert.True(fractional.SystemsResistance > 0);
        Assert.Equal(2.5, fractional.SystemsPips);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void TheAllocationIsCheckedBeforeTheShield(double systemsPips)
    {
        var broken = new ShieldCapacitorInput(-1, DamageTypeValues.None, -1, -1);

        Assert.Throws<ArgumentOutOfRangeException>(() => ShieldCapacitor.Metrics(Input(), systemsPips));
        Assert.Throws<ArgumentOutOfRangeException>(() => ShieldCapacitor.Metrics(broken, systemsPips));
    }

    public static TheoryData<ShieldCapacitorInput> NonPhysicalShields() =>
    [
        Input() with { Strength = -1 },
        Input() with { SystemsCapacity = double.NaN },
        Input() with { SystemsRecharge = double.PositiveInfinity },
        Input() with { Resistances = Shield.Resistances with { Caustic = double.NaN } },
        Input() with { Resistances = Shield.Resistances with { Kinetic = double.NegativeInfinity } },
    ];

    [Theory]
    [MemberData(nameof(NonPhysicalShields))]
    public void AShieldFigureThatIsNotANumberIsRefused(ShieldCapacitorInput input) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => ShieldCapacitor.Metrics(input));

    [Fact]
    public void AMissingInputIsRefused()
    {
        Assert.Throws<ArgumentNullException>(() => ShieldCapacitor.Metrics(null!));
        Assert.Throws<ArgumentNullException>(() => ShieldCapacitorInput.For(null!, 41, 3.9));
        Assert.Throws<ArgumentNullException>(
            () => ShieldCapacitor.Metrics(Input() with { Resistances = null! }));
    }
}
