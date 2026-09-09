using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>What the captures say a fitted module held, against what a build says it holds.</summary>
/// <remarks>
/// <para>
/// A journal states the rounds in the clip and in the hopper at the instant of capture.
/// That is the ship's rearm state, so it is a lower bound on a capacity and never a
/// reading of one: a partly spent launcher reports less and says nothing. What settles a
/// capacity is the magazine or reserve modifier a capture states on an engineered module,
/// which gives the stock figure and the engineered one together.
/// </para>
/// <para>
/// The library models the capacity and drops the loaded counts, so the counts are read
/// off the stored text rather than off the record the library builds from it.
/// </para>
/// </remarks>
public class AmmunitionCaptureTests
{
    private static readonly AmmunitionFixture Fixture =
        SharedFixtures.Load<BuildMetricsFixture>("fixtures/ships/build-metrics.jsonc").Ammunition;

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>Every stored journal capture, in the order the fixtures hold them.</summary>
    private static readonly IReadOnlyList<string> Journals = JournalPaths();

    public static TheoryData<int> Rolls()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.Engineered.Rolls.Count; index++) positions.Add(index);
        return positions;
    }

    public static TheoryData<int> GroundTruthCases()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Fixture.EngineeredGroundTruth.Cases.Count; index++)
        {
            positions.Add(index);
        }

        return positions;
    }

    [Fact]
    public void EveryLoadedCountACaptureStatesFitsInsideTheCapacityForThatModule()
    {
        int readings = 0;
        int atCapacity = 0;
        HashSet<string> modules = new(StringComparer.Ordinal);
        List<string> below = [];

        foreach (string path in Journals)
        {
            using JsonDocument document = SharedFixtures.LoadDocument(path);
            ShipLoadout build = ShipLoadout.FromLoadout(
                document.RootElement.Deserialize<LoadoutEvent>(JournalOptions)!);

            foreach (JsonElement fitted in document.RootElement.GetProperty("Modules").EnumerateArray())
            {
                double clip = Number(fitted, "AmmoInClip");
                double hopper = Number(fitted, "AmmoInHopper");
                if (clip == 0 && hopper == 0) continue;

                readings++;
                modules.Add(fitted.GetProperty("Item").GetString()!);

                string slot = fitted.GetProperty("Slot").GetString()!;
                AmmunitionCapacity capacity = build.FittedModuleAt(slot)!.Ammunition!;
                Assert.True(clip <= capacity.ClipSize, $"{path} {slot} clip");
                Assert.True(hopper <= capacity.Hopper, $"{path} {slot} hopper");

                if (clip == capacity.ClipSize && hopper == capacity.Hopper) atCapacity++;
                else below.Add($"{path} {slot}: {clip}/{hopper} of {capacity.ClipSize}/{capacity.Hopper}");
            }
        }

        Assert.Equal(Fixture.JournalReadings.Readings, readings);
        Assert.Equal(Fixture.JournalReadings.DistinctModules, modules.Count);
        Assert.Equal(Fixture.JournalReadings.AtCapacity, atCapacity);
        Assert.Equal(Fixture.JournalReadings.BelowCapacity.Count, below.Count);
    }

    /// <summary>Engineering loads whole rounds in the magazine and in the reserve.</summary>
    /// <remarks>
    /// An engineered magazine is rounded up to a whole burst where the roll is computed. The
    /// reserve is rounded to the nearest whole round once every contribution is applied.
    /// Each roll is made on a hull refitted for it, so nothing carries over.
    /// </remarks>
    [Theory]
    [MemberData(nameof(Rolls))]
    public void EngineeringLoadsWholeRoundsInTheMagazineAndTheReserve(int index)
    {
        EngineeredRollFixture roll = Fixture.Engineered.Rolls[index];
        ShipLoadout build = ShipLoadout.Empty("Viper");
        build.SetModule(roll.Slot, ModuleCatalogue.FindBySymbol(roll.Module)!);

        AssertCapacity(roll.Stock, build.FittedModuleAt(roll.Slot)!.Ammunition!);

        build.ApplyBlueprint(
            roll.Slot,
            roll.Blueprint,
            new ApplyBlueprintOptions(roll.Grade, 1, roll.Experimental));

        FittedModule engineered = build.FittedModuleAt(roll.Slot)!;
        Assert.Equal(roll.ClipSize, engineered.Ammunition!.ClipSize);
        Assert.Equal(roll.Hopper, engineered.Ammunition.Hopper);
        Assert.Equal(roll.Total, engineered.Ammunition.Total);
        Assert.False(engineered.Ammunition.Unlimited);

        if (roll.BurstRounds is double burst)
        {
            // A whole number of bursts rather than merely a whole number, whether the burst
            // is the recipe's own or the weapon's.
            Assert.Equal(burst, engineered.EffectiveStats!.Stats[ModuleStat.BurstRounds]);
            Assert.Equal(0, roll.ClipSize % burst);
        }
    }

    /// <summary>Every engineered magazine or reserve a capture states is pinned.</summary>
    /// <remarks>
    /// The one list here a count cannot guard. A reading dropped from it is evidence the
    /// repository holds and stops looking at, which is what makes the disagreements costly.
    /// </remarks>
    [Fact]
    public void EveryEngineeredMagazineOrReserveACaptureStatesIsPinned()
    {
        SortedSet<string> stated = new(StringComparer.Ordinal);
        foreach (string path in Journals)
        {
            using JsonDocument document = SharedFixtures.LoadDocument(path);
            foreach (JsonElement fitted in document.RootElement.GetProperty("Modules").EnumerateArray())
            {
                if (StatedModifier(fitted, "AmmoClipSize") is not null
                    || StatedModifier(fitted, "AmmoMaximum") is not null)
                {
                    stated.Add($"{Name(path)}|{fitted.GetProperty("Slot").GetString()}");
                }
            }
        }

        SortedSet<string> pinned = new(StringComparer.Ordinal);
        foreach (AmmunitionGroundTruthCaseFixture row in Fixture.EngineeredGroundTruth.Cases)
        {
            pinned.Add($"{row.Capture}|{row.Slot}");
        }

        Assert.Equal(pinned, stated);
    }

    /// <summary>One engineered magazine or reserve, as Frontier states it and as this rolls it.</summary>
    /// <remarks>
    /// A build read from the capture always agrees with the capture, because a stated
    /// modifier is used as it stands. Reproducing the roll from the catalogue is the part
    /// that can disagree, and the fixture pins whether it does.
    /// </remarks>
    [Theory]
    [MemberData(nameof(GroundTruthCases))]
    public void FrontiersOwnEngineeredAmmunitionAgainstWhatThisLibraryRolls(int index)
    {
        AmmunitionGroundTruthCaseFixture pinned = Fixture.EngineeredGroundTruth.Cases[index];
        string path = $"fixtures/ships/{pinned.Capture}";
        using JsonDocument document = SharedFixtures.LoadDocument(path);
        JsonElement fitted = Module(document.RootElement, pinned.Slot);

        // A recipe need not touch the magazine: a heat-sink launcher's only ammunition leg
        // is its reserve, so its magazine stands at the catalogue's own figure.
        double magazine = pinned.Game.ClipSize ?? pinned.Base.ClipSize!.Value;

        // The capture says what the fixture says it says.
        Assert.Equal(pinned.Symbol, fitted.GetProperty("Item").GetString());
        JsonElement engineering = fitted.GetProperty("Engineering");
        Assert.Equal(pinned.Grade, engineering.GetProperty("Level").GetInt32());
        Assert.Equal(
            pinned.ReportedQuality ?? pinned.Quality, engineering.GetProperty("Quality").GetDouble());
        Assert.Equal(pinned.Experimental, Experimental(engineering));
        Assert.Equal(pinned.Game.ClipSize, StatedModifier(fitted, "AmmoClipSize"));
        Assert.Equal(pinned.Game.AmmoMaximum, StatedModifier(fitted, "AmmoMaximum"));
        Assert.Equal(pinned.Game.LoadedClip, Number(fitted, "AmmoInClip"));
        Assert.Equal(pinned.Game.LoadedHopper, Number(fitted, "AmmoInHopper"));

        // A build read from it reports the game's own figures, engineering and all.
        ShipLoadout read = ShipLoadout.FromLoadout(
            document.RootElement.Deserialize<LoadoutEvent>(JournalOptions)!);
        AmmunitionCapacity imported = read.FittedModuleAt(pinned.Slot)!.Ammunition!;
        Assert.Equal(magazine, imported.ClipSize);
        Assert.Equal(pinned.Game.AmmoMaximum, imported.Hopper);
        Assert.Equal(magazine + pinned.Game.AmmoMaximum, imported.Total);
        Assert.False(imported.Unlimited);

        // The catalogue carries the stock figures the roll starts from.
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(pinned.Symbol)!;
        Assert.Equal(pinned.Base.ClipSize, stock.Stats[ModuleStat.ClipSize]);
        Assert.Equal(pinned.Base.AmmoMaximum, stock.Stats[ModuleStat.AmmoMaximum]);

        AmmunitionCapacity rolled = Simulate(pinned).FittedModuleAt(pinned.Slot)!.Ammunition!;
        Assert.Equal(pinned.Simulated.ClipSize ?? pinned.Base.ClipSize, rolled.ClipSize);
        Assert.Equal(pinned.Simulated.AmmoMaximum, rolled.Hopper);

        bool agrees = rolled.ClipSize == magazine && rolled.Hopper == pinned.Game.AmmoMaximum;
        Assert.Equal(pinned.Agrees, agrees);
    }

    /// <summary>The one roll a reproduction cannot reach is the one the fixture explains.</summary>
    /// <remarks>
    /// It was engineered under the legacy system, where each stat advanced on its own, so
    /// one reported quality cannot reproduce both of its legs. Sweeping for it rather than
    /// counting is what stops the list quietly shrinking instead.
    /// </remarks>
    [Fact]
    public void TheOnlyRollThisCannotReproduceIsALegacyOne()
    {
        List<AmmunitionGroundTruthCaseFixture> legacy = [];
        foreach (AmmunitionGroundTruthCaseFixture row in Fixture.EngineeredGroundTruth.Cases)
        {
            if (!row.Agrees) legacy.Add(row);
        }

        Assert.True(Assert.Single(legacy).LegacyEngineering);
    }

    /// <summary>One capture recomputes to the figures Frontier reports for it.</summary>
    /// <remarks>
    /// The capture's own aggregates are stripped first, so nothing can be echoed back. It
    /// carries an engineered overcharge drive under a grade-five Long Range with Mass
    /// Manager, so the mass and the jump range answer to Frontier and not only to
    /// themselves.
    /// </remarks>
    [Fact]
    public void TheCorsairCaptureRecomputesToTheFiguresFrontierReportsForIt()
    {
        RecomputedCaptureFixture pinned = Fixture.EngineeredGroundTruth.Recomputed;
        LoadoutEvent capture = SharedFixtures.LoadCapture<LoadoutEvent>(
            "fixtures/ships/journal-corsair.jsonc");

        ShipLoadout build = ShipLoadout.FromLoadout(
            capture with { UnladenMass = null, MaxJumpRange = null, CargoCapacity = null });

        Assert.Equal(pinned.UnladenMass, build.UnladenMass, 1e-6);
        Assert.Equal(pinned.JournalUnladenMass, build.UnladenMass, 1e-4);
        Assert.Equal(pinned.MaxJumpRange, Math.Round(BuildMetrics.Of(build).MaxJumpRange(), 6));
        Assert.Equal(pinned.JournalMaxJumpRange, BuildMetrics.Of(build).MaxJumpRange(), 1e-4);
        Assert.Equal(pinned.CargoCapacity, build.CargoCapacity);
    }

    /// <summary>Reproduces one pinned roll on an empty hull of the capture's own kind.</summary>
    private static ShipLoadout Simulate(AmmunitionGroundTruthCaseFixture pinned)
    {
        ShipLoadout build = ShipLoadout.Empty(pinned.Ship);
        if (pinned.PreEngineered)
        {
            PreEngineeredVariant variant = PreEngineeredCatalogue.VariantsFor(pinned.Symbol)
                .Single(candidate => candidate.BlueprintSymbol == pinned.Blueprint);
            build.SetModule(pinned.Slot, PreEngineeredStats.Resolve(variant)!);
            return build;
        }

        build.SetModule(pinned.Slot, ModuleCatalogue.FindBySymbol(pinned.Symbol)!);
        build.ApplyBlueprint(
            pinned.Slot,
            pinned.Blueprint,
            new ApplyBlueprintOptions(pinned.Grade, pinned.Quality, pinned.Experimental));
        return build;
    }

    private static void AssertCapacity(
        AmmunitionCapacityFixture expected,
        AmmunitionCapacity actual)
    {
        Assert.Equal(expected.ClipSize, actual.ClipSize);
        Assert.Equal(expected.Hopper, actual.Hopper);
        Assert.Equal(expected.Total, actual.Total);
        Assert.False(actual.Unlimited);
    }

    /// <summary>The value one engineering modifier states, or nothing where none does.</summary>
    private static double? StatedModifier(JsonElement fitted, string label)
    {
        if (!fitted.TryGetProperty("Engineering", out JsonElement engineering)) return null;
        if (!engineering.TryGetProperty("Modifiers", out JsonElement modifiers)) return null;

        foreach (JsonElement modifier in modifiers.EnumerateArray())
        {
            if (modifier.GetProperty("Label").GetString() != label) continue;
            if (!modifier.TryGetProperty("Value", out JsonElement value)) continue;
            return value.GetDouble();
        }

        return null;
    }

    private static string? Experimental(JsonElement engineering) =>
        engineering.TryGetProperty("ExperimentalEffect", out JsonElement effect)
            ? effect.GetString()
            : null;

    private static double Number(JsonElement module, string name) =>
        module.TryGetProperty(name, out JsonElement value) ? value.GetDouble() : 0;

    private static JsonElement Module(JsonElement capture, string slot)
    {
        foreach (JsonElement module in capture.GetProperty("Modules").EnumerateArray())
        {
            if (module.GetProperty("Slot").GetString() == slot) return module;
        }

        throw new KeyNotFoundException($"The capture holds no mount '{slot}'.");
    }

    private static string Name(string path) => path["fixtures/ships/".Length..];

    /// <summary>
    /// Every journal capture the fixtures hold. Swept rather than listed, because a capture
    /// stored and never read would be evidence this port stops looking at.
    /// </summary>
    private static IReadOnlyList<string> JournalPaths()
    {
        List<string> paths = [];
        foreach (string path in SharedFixtures.Paths())
        {
            if (path.StartsWith("fixtures/ships/journal-", StringComparison.Ordinal))
            {
                paths.Add(path);
            }
        }

        return paths;
    }
}
