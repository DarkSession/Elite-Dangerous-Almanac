using System;
using System.Globalization;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The jump-range arithmetic, measured against the shared fixture.</summary>
public class JumpRangeTests
{
    private static readonly JumpRangeFixture Fixture =
        SharedFixtures.Load<JumpRangeFixture>("fixtures/ships/jump-range.jsonc");

    /// <summary>The precision the fixture states a range to.</summary>
    private const double Tolerance = 5e-7;

    public static TheoryData<string> Builds()
    {
        TheoryData<string> data = [];
        foreach (string name in Fixture.Builds.Keys) data.Add(name);
        return data;
    }

    public static TheoryData<int> InvalidInputs()
    {
        TheoryData<int> data = [];
        for (int position = 0; position < Fixture.InvalidInputs.Count; position++) data.Add(position);
        return data;
    }

    [Fact]
    public void TheAnchorDriveReachesTheFixturesRanges()
    {
        FrameShiftDriveParams drive = Drive(Fixture.FrameShiftDrive);

        // The longest jump carries exactly one jump's fuel: more only weighs the ship down.
        Assert.Equal(
            Fixture.MaxJumpRange,
            JumpRange.SingleJump(Fixture.UnladenMass, drive.MaxFuel, drive),
            Tolerance);
        Assert.Equal(
            Fixture.UnladenJumpRange,
            JumpRange.SingleJump(Fixture.UnladenMass, Fixture.MainFuel, drive),
            Tolerance);
        Assert.Equal(
            Fixture.LadenJumpRange,
            JumpRange.SingleJump(Fixture.UnladenMass + Fixture.CargoCapacity, Fixture.MainFuel, drive),
            Tolerance);
        Assert.Equal(
            Fixture.MassFactor,
            JumpRange.MassFactor(Fixture.UnladenMass, Fixture.MainFuel, drive.OptMass),
            1e-9);
        Assert.Equal(
            Fixture.FuelPerJump50Ly,
            JumpRange.FuelPerJump(50, Fixture.UnladenMass, Fixture.MainFuel, drive),
            1e-4);
    }

    [Fact]
    public void TheAnchorDriveEmptiesItsTankOverTheFixturesJumps()
    {
        FrameShiftDriveParams drive = Drive(Fixture.FrameShiftDrive);

        TotalRangeDetails whole = JumpRange.Total(Fixture.UnladenMass, Fixture.MainFuel, drive);
        Assert.Equal(Fixture.TotalJumps, whole.Jumps);
        Assert.Equal(Fixture.TotalRange, whole.Range, 1e-3);

        // One jump's fuel is one jump, and it is the longest one.
        TotalRangeDetails single = JumpRange.Total(Fixture.UnladenMass, drive.MaxFuel, drive);
        Assert.Equal(Fixture.TotalMaxJumps, single.Jumps);
        Assert.Equal(Fixture.TotalMaxRange, single.Range, Tolerance);
    }

    [Theory]
    [MemberData(nameof(Builds))]
    public void ABuildReachesTheRangeItsCaptureStates(string name)
    {
        JumpRangeBuildFixture build = Fixture.Builds[name];
        FrameShiftDriveParams drive = Drive(build.FrameShiftDrive);

        // The capture's own figure is the game's, so agreement is a parity check on the model
        // rather than on this port alone.
        Assert.Equal(build.SourceMaxJumpRange, build.MaxJumpRange, 1e-5);
        Assert.Equal(
            build.MaxJumpRange,
            JumpRange.SingleJump(build.UnladenMass, drive.MaxFuel, drive),
            Tolerance);
        Assert.Equal(
            build.UnladenJumpRange,
            JumpRange.SingleJump(build.UnladenMass, build.MainFuel, drive),
            Tolerance);
        Assert.Equal(
            build.LadenJumpRange,
            JumpRange.SingleJump(build.UnladenMass + build.CargoCapacity, build.MainFuel, drive),
            Tolerance);

        TotalRangeDetails unladen = JumpRange.Total(build.UnladenMass, build.MainFuel, drive);
        Assert.Equal(build.TotalJumps, unladen.Jumps);
        Assert.Equal(build.TotalUnladenRange, unladen.Range, Tolerance);
        Assert.Equal(
            build.TotalLadenRange,
            JumpRange.Total(build.UnladenMass + build.CargoCapacity, build.MainFuel, drive).Range,
            Tolerance);
    }

    [Fact]
    public void TheFuelACostedJumpDrawsRoundTripsAtTheLongestJump()
    {
        FrameShiftDriveParams drive = Drive(Fixture.FrameShiftDrive);
        double longest = JumpRange.SingleJump(Fixture.UnladenMass, drive.MaxFuel, drive);

        Assert.Equal(
            drive.MaxFuel,
            JumpRange.FuelPerJump(longest, Fixture.UnladenMass, drive.MaxFuel, drive),
            1e-9);

        // A jump beyond the drive's reach costs no more than the tank can give it.
        Assert.Equal(
            drive.MaxFuel,
            JumpRange.FuelPerJump(longest * 2, Fixture.UnladenMass, drive.MaxFuel, drive),
            1e-9);
        Assert.Equal(0, JumpRange.FuelPerJump(0, Fixture.UnladenMass, drive.MaxFuel, drive));
    }

    [Fact]
    public void ADriveThatCannotJumpReachesNowhere()
    {
        FrameShiftDriveParams drive = Drive(Fixture.FrameShiftDrive) with { MaxFuel = 0 };

        Assert.Equal(0, JumpRange.SingleJump(Fixture.UnladenMass, Fixture.MainFuel, drive));
        Assert.Equal(0, JumpRange.FuelPerJump(10, Fixture.UnladenMass, Fixture.MainFuel, drive));

        TotalRangeDetails nowhere = JumpRange.Total(Fixture.UnladenMass, Fixture.MainFuel, drive);
        Assert.Equal(0, nowhere.Range);
        Assert.Equal(0, nowhere.Jumps);

        // An empty tank is no jump at all, even on a drive that could make one.
        Assert.Equal(0, JumpRange.Total(Fixture.UnladenMass, 0, Drive(Fixture.FrameShiftDrive)).Jumps);
    }

    [Fact]
    public void TheLeastFuelStillMakesAJump()
    {
        TinyFuelFixture tiny = Fixture.TinyFuel;
        double range = JumpRange.SingleJump(tiny.Mass, tiny.Fuel, Drive(Fixture.FrameShiftDrive));

        // The drive booster's flat bonus is the whole of such a jump.
        Assert.True(range >= tiny.MinimumRange, $"{range} is shorter than {tiny.MinimumRange}.");
        Assert.Equal(tiny.MinimumRange, range, 1e-6);
    }

    [Fact]
    public void AWorkloadNoCallEvaluatesIsRefused()
    {
        ExcessiveJumpsFixture excessive = Fixture.ExcessiveJumpCount;
        FrameShiftDriveParams drive =
            Drive(Fixture.FrameShiftDrive) with { MaxFuel = excessive.MaxFuel };

        Assert.Throws<ArgumentOutOfRangeException>(
            () => JumpRange.Total(excessive.Mass, excessive.Fuel, drive));
    }

    [Fact]
    public void ATotalThatLeavesTheRangeOfANumberIsRefused()
    {
        OverflowingTotalFixture overflowing = Fixture.OverflowingTotal;

        Assert.Throws<ArgumentOutOfRangeException>(() => JumpRange.Total(
            overflowing.Mass, overflowing.Fuel, Drive(overflowing.FrameShiftDrive)));
    }

    [Theory]
    [MemberData(nameof(InvalidInputs))]
    public void AnArgumentNoCalculationAcceptsIsRefused(int position)
    {
        InvalidInputFixture invalid = Fixture.InvalidInputs[position];
        double value = Value(invalid.Value);
        FrameShiftDriveParams drive = Drive(Fixture.FrameShiftDrive);

        Assert.Throws<ArgumentOutOfRangeException>(() => invalid.Function switch
        {
            "singleJumpRange" => JumpRange.SingleJump(
                invalid.Field == "mass" ? value : 100,
                invalid.Field == "fuel" ? value : 5,
                Corrupt(drive, invalid.Field, value)),
            "fuelPerJump" => JumpRange.FuelPerJump(
                invalid.Field == "distance" ? value : 10,
                invalid.Field == "mass" ? value : 100,
                invalid.Field == "fuel" ? value : 5,
                Corrupt(drive, invalid.Field, value)),
            "totalRange" => JumpRange.Total(
                invalid.Field == "mass" ? value : 100,
                invalid.Field == "fuel" ? value : 5,
                Corrupt(drive, invalid.Field, value)).Range,
            _ => throw new InvalidOperationException($"'{invalid.Function}' names no calculation."),
        });
    }

    [Fact]
    public void AMassFactorNeedsAShipToWeigh()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => JumpRange.MassFactor(0, 0, 1000));
        Assert.Throws<ArgumentOutOfRangeException>(() => JumpRange.MassFactor(-1, 0, 1000));
        Assert.Throws<ArgumentOutOfRangeException>(() => JumpRange.MassFactor(100, 0, 0));

        // The factor is one at the drive's own optimised mass.
        Assert.Equal(1, JumpRange.MassFactor(990, 10, 1000));
    }

    [Fact]
    public void ADriveIsNeverRead()
    {
        Assert.Throws<ArgumentNullException>(() => JumpRange.SingleJump(100, 5, null!));
        Assert.Throws<ArgumentNullException>(() => JumpRange.FuelPerJump(10, 100, 5, null!));
        Assert.Throws<ArgumentNullException>(() => JumpRange.Total(100, 5, null!));
    }

    private static FrameShiftDriveParams Drive(FrameShiftDriveFixture drive) => new(
        drive.OptMass, drive.MaxFuel, drive.FuelMul, drive.FuelPower, drive.JumpBoost);

    private static FrameShiftDriveParams Corrupt(
        FrameShiftDriveParams drive,
        string field,
        double value) => field switch
        {
            "optMass" => drive with { OptMass = value },
            "maxFuel" => drive with { MaxFuel = value },
            "fuelMul" => drive with { FuelMul = value },
            "fuelPower" => drive with { FuelPower = value },
            "jumpBoost" => drive with { JumpBoost = value },
            _ => drive,
        };

    private static double Value(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Number => value.GetDouble(),
        JsonValueKind.String => value.GetString() switch
        {
            "NaN" => double.NaN,
            "Infinity" => double.PositiveInfinity,
            "-Infinity" => double.NegativeInfinity,
            _ => throw new InvalidOperationException(
                string.Format(CultureInfo.InvariantCulture, "'{0}' names no number.", value.GetString())),
        },
        _ => throw new InvalidOperationException("The fixture states no value."),
    };
}
