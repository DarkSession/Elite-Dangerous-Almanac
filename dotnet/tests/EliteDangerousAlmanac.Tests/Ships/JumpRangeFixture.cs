using System.Collections.Generic;
using System.Text.Json;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The shape of <c>fixtures/ships/jump-range.jsonc</c>.</summary>
internal sealed class JumpRangeFixture
{
    public FrameShiftDriveFixture FrameShiftDrive { get; set; } = new();

    public double UnladenMass { get; set; }

    public double MainFuel { get; set; }

    public double CargoCapacity { get; set; }

    /// <summary>The range of one jump carrying exactly one jump's fuel.</summary>
    public double MaxJumpRange { get; set; }

    public double TotalMaxRange { get; set; }

    public int TotalMaxJumps { get; set; }

    /// <summary>The range of one jump on a full tank.</summary>
    public double UnladenJumpRange { get; set; }

    /// <summary>The range of one jump on a full tank with a full hold.</summary>
    public double LadenJumpRange { get; set; }

    public double MassFactor { get; set; }

    public double TotalRange { get; set; }

    public int TotalJumps { get; set; }

    /// <summary>The fuel a fifty light-year jump costs on a full tank.</summary>
    public double FuelPerJump50Ly { get; set; }

    /// <summary>Arguments no calculation accepts.</summary>
    public List<InvalidInputFixture> InvalidInputs { get; set; } = [];

    /// <summary>A tank that would need more jumps than one call evaluates.</summary>
    public ExcessiveJumpsFixture ExcessiveJumpCount { get; set; } = new();

    /// <summary>The least fuel that still makes a jump.</summary>
    public TinyFuelFixture TinyFuel { get; set; } = new();

    /// <summary>Constants whose total range overflows.</summary>
    public OverflowingTotalFixture OverflowingTotal { get; set; } = new();

    /// <summary>Whole builds, each pinned against the figure its source states.</summary>
    public Dictionary<string, JumpRangeBuildFixture> Builds { get; set; } = [];
}

/// <summary>One drive's post-engineering constants.</summary>
internal sealed class FrameShiftDriveFixture
{
    public double OptMass { get; set; }

    public double MaxFuel { get; set; }

    public double FuelMul { get; set; }

    public double FuelPower { get; set; }

    public double JumpBoost { get; set; }
}

/// <summary>One argument a calculation refuses.</summary>
internal sealed class InvalidInputFixture
{
    public string Function { get; set; } = string.Empty;

    public string Field { get; set; } = string.Empty;

    /// <summary>The refused value, which the fixture spells as a number or as a name.</summary>
    public JsonElement Value { get; set; }
}

/// <summary>A tank too large to evaluate in one call.</summary>
internal sealed class ExcessiveJumpsFixture
{
    public double Mass { get; set; }

    public double Fuel { get; set; }

    public double MaxFuel { get; set; }
}

/// <summary>The least fuel that still makes a jump.</summary>
internal sealed class TinyFuelFixture
{
    public double Mass { get; set; }

    public double Fuel { get; set; }

    /// <summary>The range such a jump reaches, which the drive booster's bonus alone sets.</summary>
    public double MinimumRange { get; set; }
}

/// <summary>Constants whose summed range leaves the range of a number.</summary>
internal sealed class OverflowingTotalFixture
{
    public double Mass { get; set; }

    public double Fuel { get; set; }

    public FrameShiftDriveFixture FrameShiftDrive { get; set; } = new();
}

/// <summary>One whole build's jumps.</summary>
internal sealed class JumpRangeBuildFixture
{
    public FrameShiftDriveFixture FrameShiftDrive { get; set; } = new();

    public double UnladenMass { get; set; }

    public double MainFuel { get; set; }

    public double CargoCapacity { get; set; }

    /// <summary>The figure the capture's own source states.</summary>
    public double SourceMaxJumpRange { get; set; }

    public double MaxJumpRange { get; set; }

    public double UnladenJumpRange { get; set; }

    public double LadenJumpRange { get; set; }

    public double TotalUnladenRange { get; set; }

    public double TotalLadenRange { get; set; }

    public int TotalJumps { get; set; }
}
