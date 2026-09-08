using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The part of <c>fixtures/ships/operations.jsonc</c> the data-free calculators read.</summary>
internal sealed class OperationsFixture
{
    /// <summary>The speed and handling of one loaded ship.</summary>
    public MobilityFixture Mobility { get; set; } = new();

    /// <summary>The three capacitors of one power distributor.</summary>
    public DistributorFixture Distributor { get; set; } = new();

    /// <summary>The time a collapsed shield takes to come back.</summary>
    public ShieldRecoveryFixture ShieldRecovery { get; set; } = new();

    /// <summary>The fitted shield cell banks and the pool they make.</summary>
    public CellBanksFixture CellBanks { get; set; } = new();
}

/// <summary>One shield and SYS capacitor at four pips, and the same at a part allocation.</summary>
internal sealed class ShieldRecoveryFixture
{
    public ShieldRecoveryInputFixture Input { get; set; } = new();

    public ShieldRecoveryExpectedFixture Expected { get; set; } = new();

    /// <summary>The same arithmetic at a part allocation.</summary>
    public ShieldRecoveryCaseFixture PipAllocation { get; set; } = new();

    /// <summary>A shield strength the calculation must refuse.</summary>
    public ShieldRecoveryCaseFixture InvalidStrength { get; set; } = new();
}

/// <summary>One recovery case and what it answers, or the failure it is expected to raise.</summary>
internal sealed class ShieldRecoveryCaseFixture
{
    public ShieldRecoveryInputFixture Input { get; set; } = new();

    public ShieldRecoveryExpectedFixture Expected { get; set; } = new();

    public string? ExpectedError { get; set; }
}

/// <summary>The shield strength, generator rates and distributor figures one case states.</summary>
internal sealed class ShieldRecoveryInputFixture
{
    public double Strength { get; set; }

    public double RegenRate { get; set; }

    public double BrokenRegenRate { get; set; }

    public double DistributorDraw { get; set; }

    public double SystemsCapacity { get; set; }

    public double SystemsRecharge { get; set; }

    /// <summary>The pips assigned to SYS, where the case states one.</summary>
    public double? SystemsPips { get; set; }

    /// <summary>The stated figures as the calculator's own input record.</summary>
    internal ShieldRecoveryInput ToInput() => new(
        Strength, RegenRate, BrokenRegenRate, DistributorDraw, SystemsCapacity, SystemsRecharge);
}

/// <summary>The rates and the seconds one recovery case expects.</summary>
internal sealed class ShieldRecoveryExpectedFixture
{
    public double RegenRate { get; set; }

    public double BrokenRegenRate { get; set; }

    public double RecoveryTime { get; set; }

    public double RegenTime { get; set; }
}

/// <summary>The fitted cell banks and the totals the powered ones make.</summary>
internal sealed class CellBanksFixture
{
    public List<CellBankInputFixture> Input { get; set; } = [];

    public CellBanksExpectedFixture Expected { get; set; } = new();
}

/// <summary>One fitted shield cell bank.</summary>
internal sealed class CellBankInputFixture
{
    public string Slot { get; set; } = string.Empty;

    public string Symbol { get; set; } = string.Empty;

    public double ReinforcementRate { get; set; }

    public double Cells { get; set; }

    public double SpinUp { get; set; }

    public double Duration { get; set; }

    public double Heat { get; set; }

    public bool Powered { get; set; }

    /// <summary>The stated bank as the calculator's own input record.</summary>
    internal CellBankInput ToInput() =>
        new(Slot, Symbol, ReinforcementRate, Cells, SpinUp, Duration, Heat, Powered);
}

/// <summary>The pool the powered banks make between them.</summary>
internal sealed class CellBanksExpectedFixture
{
    public double TotalRestorable { get; set; }

    public double TotalCells { get; set; }

    /// <summary>Each bank's power state, in slot order.</summary>
    public List<bool> Powered { get; set; } = [];
}

/// <summary>One loaded ship at full ENG, and the same hull at two other allocations.</summary>
internal sealed class MobilityFixture
{
    public MobilityInputFixture Input { get; set; } = new();

    public MobilityExpectedFixture Expected { get; set; } = new();

    /// <summary>A hull whose rotation rates do not move with the allocation.</summary>
    public MobilityCaseFixture ZeroPipRotation { get; set; } = new();

    /// <summary>A hull at a part allocation, whose every figure moves with it.</summary>
    public MobilityCaseFixture PipAllocation { get; set; } = new();
}

/// <summary>One hull, loaded mass, thruster curve and ENG allocation, with its metrics.</summary>
internal sealed class MobilityCaseFixture
{
    public MobilityInputFixture Input { get; set; } = new();

    public MobilityExpectedFixture Expected { get; set; } = new();

    /// <summary>The speed at each whole allocation, from no ENG pips through four.</summary>
    public List<double> SpeedSequence { get; set; } = [];

    /// <summary>The pitch rate at each whole allocation, from no ENG pips through four.</summary>
    public List<double> PitchSequence { get; set; } = [];
}

/// <summary>The hull figures, loaded mass, thrusters and allocation one case states.</summary>
internal sealed class MobilityInputFixture
{
    public double MinimumSpeed { get; set; }

    public double MaximumSpeed { get; set; }

    public double Boost { get; set; }

    public double MinPitch { get; set; }

    public double Pitch { get; set; }

    public double MinRoll { get; set; }

    public double Roll { get; set; }

    public double MinYaw { get; set; }

    public double Yaw { get; set; }

    public double Mass { get; set; }

    public ThrusterFixture Thrusters { get; set; } = new();

    /// <summary>The pips assigned to ENG, where the case states one.</summary>
    public double? EnginesPips { get; set; }

    /// <summary>The stated figures as the calculator's own input record.</summary>
    internal MobilityInput ToInput() => new(
        MinimumSpeed,
        MaximumSpeed,
        Boost,
        MinPitch,
        Pitch,
        MinRoll,
        Roll,
        MinYaw,
        Yaw,
        Mass)
    {
        Thrusters = Thrusters.ToThrusters(),
    };
}

/// <summary>One thruster's mass curves.</summary>
internal sealed class ThrusterFixture
{
    public double MinMass { get; set; }

    public double OptMass { get; set; }

    public double MaxMass { get; set; }

    public double MinMultiplier { get; set; }

    public double OptMultiplier { get; set; }

    public double MaxMultiplier { get; set; }

    public ThrusterFixture? SpeedCurve { get; set; }

    public ThrusterFixture? RotationCurve { get; set; }

    /// <summary>The stated curve as a fitted thruster, with its two optional curves.</summary>
    internal ThrusterParams ToThrusters() => new(
        MinMass, OptMass, MaxMass, MinMultiplier, OptMultiplier, MaxMultiplier)
    {
        SpeedCurve = SpeedCurve?.ToCurve(),
        RotationCurve = RotationCurve?.ToCurve(),
    };

    /// <summary>The stated curve on its own.</summary>
    internal ThrusterCurveParams ToCurve() => new(
        MinMass, OptMass, MaxMass, MinMultiplier, OptMultiplier, MaxMultiplier);
}

/// <summary>The speed, boost, handling and curve multipliers one case expects.</summary>
internal sealed class MobilityExpectedFixture
{
    public double Speed { get; set; }

    public double Boost { get; set; }

    public double Pitch { get; set; }

    public double Roll { get; set; }

    public double Yaw { get; set; }

    public double MassCurveMultiplier { get; set; }

    public double RotationMassCurveMultiplier { get; set; }
}

/// <summary>One distributor and the three capacitor figures it leaves.</summary>
internal sealed class DistributorFixture
{
    public DistributorInputFixture Input { get; set; } = new();

    public DistributorExpectedFixture Expected { get; set; } = new();
}

/// <summary>The three capacities, their rated recharge rates and the pips to model.</summary>
internal sealed class DistributorInputFixture
{
    public double SystemsCapacity { get; set; }

    public double SystemsRecharge { get; set; }

    public double EnginesCapacity { get; set; }

    public double EnginesRecharge { get; set; }

    public double WeaponsCapacity { get; set; }

    public double WeaponsRecharge { get; set; }

    public double SystemsPips { get; set; }

    public double EnginesPips { get; set; }

    public double WeaponsPips { get; set; }
}

/// <summary>The three capacitors and the allocation they were calculated at.</summary>
internal sealed class DistributorExpectedFixture
{
    public CapacitorFixture Systems { get; set; } = new();

    public CapacitorFixture Engines { get; set; } = new();

    public CapacitorFixture Weapons { get; set; } = new();

    public DistributorPipsFixture Pips { get; set; } = new();
}

/// <summary>One capacitor's capacity, rated recharge and recharge at the stated pips.</summary>
internal sealed class CapacitorFixture
{
    public double Capacity { get; set; }

    public double RatedRecharge { get; set; }

    public double RechargeRate { get; set; }
}

/// <summary>The pips one distributor result was calculated at.</summary>
internal sealed class DistributorPipsFixture
{
    public double Systems { get; set; }

    public double Engines { get; set; }

    public double Weapons { get; set; }
}
