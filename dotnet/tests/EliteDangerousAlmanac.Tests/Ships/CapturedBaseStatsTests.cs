using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>
/// What Frontier's own captures say about the base stats the catalogues carry.
/// </summary>
/// <remarks>
/// <para>
/// A <c>Loadout</c> event states every engineered module's unmodified value beside its
/// modified one. That reaches stats no other evidence covers: a hardpoint's reserve ammo,
/// its projectile speed, a shield generator's resistances, an armour module's hull boost.
/// A capture is Frontier's own reading, so where one contradicts a base stat the catalogue
/// is wrong until a second capture says otherwise.
/// </para>
/// <para>
/// The join runs through the library's own label to stat mapping rather than a
/// hand-written one, so it is the mapping the engineering path itself resolves through.
/// </para>
/// </remarks>
public class CapturedBaseStatsTests
{
    /// <summary>The gap between one and the next double, which JavaScript calls its epsilon.</summary>
    private const double BinaryRounding = 2.2204460492503131E-16;

    private static readonly CapturedBaseStatsFixture Fixture =
        SharedFixtures.Load<ModuleStatsFixture>("fixtures/ships/module-stats.jsonc")
            .CapturedBaseStats;

    private static readonly JsonSerializerOptions JournalOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>Every stored capture, whatever container it arrived in.</summary>
    private static readonly IReadOnlyList<Capture> Captures = ReadCaptures();

    public static TheoryData<string> CaptureFiles()
    {
        TheoryData<string> files = [];
        foreach (Capture capture in Captures) files.Add(capture.File);
        return files;
    }

    /// <summary>Every base value a capture states agrees with the catalogue.</summary>
    [Theory]
    [MemberData(nameof(CaptureFiles))]
    public void EveryBaseValueACaptureStatesAgreesWithTheCatalogue(string file)
    {
        Capture capture = Named(file);
        int mapped = 0;
        int exact = 0;
        int noise = 0;
        List<UnmappedLabelFixture> unmapped = [];

        foreach (StatedBase stated in StatedBases(capture))
        {
            Dictionary<string, double> ours = ModuleStatLabels.BaseStats(stated.Record);
            if (!ours.TryGetValue(stated.Label, out double carried))
            {
                unmapped.Add(new UnmappedLabelFixture
                {
                    Symbol = stated.Record.Symbol,
                    Label = stated.Label,
                });
                continue;
            }

            mapped++;
            if (carried == stated.Captured)
            {
                exact++;
                continue;
            }

            Assert.True(
                WithinFloatNoise(carried, stated.Captured),
                $"{stated.Record.Symbol} {stated.Label}: catalogue {carried}, "
                    + $"capture {stated.Captured}");
            noise++;
        }

        CapturedBaseFixture? pinned = Pinned(file);
        if (pinned is null)
        {
            // A capture with nothing to say states no base value at all, and must keep
            // saying nothing rather than quietly stopping being read.
            Assert.Equal(0, mapped + unmapped.Count);
            return;
        }

        Assert.Equal(pinned.Stated, mapped + unmapped.Count);
        Assert.Equal(pinned.Mapped, mapped);
        Assert.Equal(pinned.Exact, exact);
        Assert.Equal(pinned.WithinFloatNoise, noise);

        // Sorted, because the fixture is a set of labels the catalogue models no stat for
        // rather than a record of where in the build they were found.
        Assert.Equal(
            Spellings(pinned.Unmapped),
            Spellings(unmapped).OrderBy(entry => entry, StringComparer.Ordinal));
    }

    /// <summary>The pinned captures are the ones that state a base value, and only those.</summary>
    /// <remarks>
    /// The captures are swept off the fixtures rather than listed, so a capture added to the
    /// repository is read the day it lands. This says the fixture names the same set: an
    /// entry naming a file that states nothing would pin nothing, and a capture the fixture
    /// forgot would be stored evidence that nothing counts.
    /// </remarks>
    [Fact]
    public void ThePinnedCapturesAreTheOnesThatStateBaseValues()
    {
        List<string> stating = [];
        foreach (Capture capture in Captures)
        {
            if (StatedBases(capture).Count > 0) stating.Add(capture.File);
        }

        stating.Sort(StringComparer.Ordinal);
        Assert.Equal(
            Fixture.Captures.Select(capture => capture.File)
                .OrderBy(file => file, StringComparer.Ordinal),
            stating);
    }

    /// <summary>The pinned damage-per-second readings are the ones the captures state.</summary>
    /// <remarks>
    /// The fixture is a pinned list rather than a hand transcription. A row deleted from it,
    /// or a figure edited to agree with a broken calculation, has to disagree with the
    /// captures themselves to survive here.
    /// </remarks>
    [Fact]
    public void ThePinnedDamagePerSecondReadingsAreTheOnesTheCapturesState()
    {
        SortedDictionary<string, double> stated = new(StringComparer.Ordinal);
        foreach (Capture capture in Captures)
        {
            foreach (StatedBase entry in StatedBases(capture))
            {
                if (entry.Label == "DamagePerSecond") stated[entry.Record.Symbol] = entry.Captured;
            }
        }

        Assert.Equal(
            Fixture.Weapons.Select(weapon => $"{weapon.Symbol}={weapon.DamagePerSecond}"),
            stated.Select(entry => $"{entry.Key}={entry.Value}"));
    }

    /// <summary>The captures reproduce this library's damage per second, weapon for weapon.</summary>
    /// <remarks>
    /// The figure is Frontier's own arithmetic over damage, rate of fire, rounds per shot
    /// and burst structure, stated for the weapon before its recipe. These are the only
    /// outside readings of an unmodified weapon's folded figure, and on the huge and medium
    /// gimballed beam lasers the only check the damage stat has at all.
    /// </remarks>
    [Fact]
    public void TheCapturesReproduceTheLibrarysDamagePerSecond()
    {
        foreach (CapturedWeaponFixture expected in Fixture.Weapons)
        {
            OutfittingModule weapon = ModuleCatalogue.FindBySymbol(expected.Symbol)!;
            double computed = Weapons.DamagePerSecond(WeaponStats.FromModule(weapon));
            Assert.True(
                WithinFloatNoise(computed, expected.DamagePerSecond),
                $"{expected.Symbol}: computed {computed}, capture {expected.DamagePerSecond}");
        }
    }

    [Fact]
    public void TheFittedWeaponFixturePinsDerivedDamageAndBoundedFalloff()
    {
        foreach (EffectiveWeaponFixture expected in Fixture.EffectiveWeapons)
        {
            LoadoutEvent loadout = Named(expected.File).Loadouts[0];
            LoadoutModule raw = loadout.Modules.Single(module => module.Slot == expected.Slot);
            OutfittingModule stock = ModuleCatalogue.FindBySymbol(raw.Item)!;
            Assert.Equal(expected.Symbol, stock.Symbol, ignoreCase: true);

            OutfittingModule effective = LoadoutMetrics.Effective(raw, stock)!;

            Assert.Equal(expected.Damage, effective.Stats[ModuleStat.Damage]);
            if (expected.MaximumRange is double range)
            {
                Assert.Equal(range, effective.Stats[ModuleStat.MaximumRange]);
            }

            if (expected.FalloffRange is double falloff)
            {
                Assert.Equal(falloff, effective.Stats[ModuleStat.FalloffRange]);
            }
        }
    }

    /// <summary>Every captured hardpoint has one post-engineering view of its stats.</summary>
    /// <remarks>
    /// The effective record and the weapon stats are two readings of one fitted weapon. They
    /// are computed separately, so a change to either alone would let a consumer see two
    /// different weapons in one mount.
    /// </remarks>
    [Fact]
    public void EveryCapturedHardpointHasOneConsistentStatView()
    {
        int checked_ = 0;
        foreach (Capture capture in Captures)
        {
            foreach (LoadoutEvent loadout in capture.Loadouts)
            {
                foreach (LoadoutModule raw in loadout.Modules)
                {
                    OutfittingModule? stock = ModuleCatalogue.FindBySymbol(raw.Item);
                    if (stock?.Category != ModuleCategory.Hardpoint) continue;

                    OutfittingModule effective = LoadoutMetrics.Effective(raw, stock)!;
                    WeaponStats weapon = LoadoutMetrics.WeaponStatsFor(raw, stock)!;

                    Assert.Equal(weapon.Damage, effective.Stats[ModuleStat.Damage]);
                    Assert.Equal(weapon.FalloffRange, effective.Stats[ModuleStat.FalloffRange]);
                    checked_++;
                }
            }
        }

        Assert.True(checked_ > 0);
    }

    /// <summary>Every capture rebuilds to the mass and the jump range it states.</summary>
    /// <remarks>
    /// This is what says a stored capture is faithful. Both totals are dropped before the
    /// rebuild, so every module mass, every engineered mass modifier and the drive's whole
    /// fuel curve have to be right for the two figures to land. What remains is the game's
    /// own single-precision arithmetic rather than a disagreement.
    /// </remarks>
    [Fact]
    public void EveryCaptureRebuildsToTheMassAndJumpRangeItStates()
    {
        foreach (RebuildFixture expected in Fixture.Rebuilds)
        {
            LoadoutEvent loadout = Named(expected.File).Loadouts[0];
            Assert.Equal(expected.UnladenMass, loadout.UnladenMass);
            Assert.Equal(expected.MaxJumpRange, loadout.MaxJumpRange);

            ShipLoadout built = ShipLoadout.FromLoadout(
                loadout with { UnladenMass = null, MaxJumpRange = null });

            Assert.Equal(expected.UnladenMass, built.UnladenMass, Fixture.RebuildTolerance);
            Assert.Equal(
                expected.MaxJumpRange,
                BuildMetrics.Of(built).MaxJumpRange(),
                Fixture.RebuildTolerance);
        }
    }

    /// <summary>Every journal capture that states both totals is pinned for rebuild.</summary>
    /// <remarks>
    /// A journal capture that states both totals is evidence about the stored text, so none
    /// may sit unchecked. The one export that states both, an EDSY re-export, is out of
    /// scope: its totals are the producing application's arithmetic and say nothing about
    /// whether the stored text is faithful.
    /// </remarks>
    [Fact]
    public void EveryJournalCaptureIsPinnedForRebuild()
    {
        List<string> stating = [];
        foreach (Capture capture in Captures)
        {
            if (!capture.File.StartsWith("journal-", StringComparison.Ordinal)) continue;
            foreach (LoadoutEvent loadout in capture.Loadouts)
            {
                if (loadout.UnladenMass is null || loadout.MaxJumpRange is null) continue;
                stating.Add(capture.File);
                break;
            }
        }

        stating.Sort(StringComparer.Ordinal);
        Assert.Equal(
            Fixture.Rebuilds.Select(rebuild => rebuild.File).OrderBy(f => f, StringComparer.Ordinal),
            stating);
    }

    /// <summary>A captured damage conversion reaches the effective stats and the metrics.</summary>
    [Fact]
    public void ACapturedDamageConversionReachesTheEffectiveStatsAndTheMetrics()
    {
        foreach (ConvertedDistributionFixture expected in Fixture.ConvertedDamageDistributions)
        {
            LoadoutEvent loadout = Named(expected.File).Loadouts[0];
            OutfittingModule record = ModuleCatalogue.FindBySymbol(expected.Symbol)!;
            AssertDistribution(expected.Base, record.DamageDistribution);

            ShipLoadout build = ShipLoadout.FromLoadout(loadout);
            FittedModule fitted = build.FittedModuleAt(expected.Slot)!;
            Assert.Equal(expected.Experimental, fitted.Engineering!.ExperimentalEffect);
            AssertDistribution(expected.Effective, fitted.EffectiveStats!.DamageDistribution);

            FittedWeaponMetrics weapon = BuildMetrics.Of(build).WeaponMetrics().Weapons
                .Single(entry => entry.Slot == expected.Slot);
            double total = weapon.Metrics.DamagePerSecond;
            Assert.True(WithinFloatNoise(
                weapon.Metrics.DamageByType.Kinetic, total * expected.Effective["kinetic"]));
            Assert.True(WithinFloatNoise(
                weapon.Metrics.DamageByType.Explosive, total * expected.Effective["explosive"]));

            // An import and an export keep Frontier's own nested labels as they were written.
            IReadOnlyList<EngineeringModifier> exported = build.ToLoadoutEvent().Modules
                .Single(module => module.Slot == expected.Slot).Engineering!.Modifiers!;
            IReadOnlyList<EngineeringModifier> captured = loadout.Modules
                .Single(module => module.Slot == expected.Slot).Engineering!.Modifiers!;
            foreach (string label in (string[])["$Kinetic;", "$Explosive;"])
            {
                EngineeringModifier written = exported.Single(entry => entry.Label == label);
                EngineeringModifier read = captured.Single(entry => entry.Label == label);
                Assert.Equal(read.Value, written.Value);
                Assert.Equal(read.OriginalValue, written.OriginalValue);
                Assert.Equal(read.ValueStr, written.ValueStr);
            }
        }
    }

    /// <summary>Every engineered result whose label needs reading back is pinned.</summary>
    /// <remarks>
    /// One row for each distinct module and stat. A build fits the same weapon twice and two
    /// ships carry the same sensor suite, and a repeat says nothing new. Sweeping the
    /// captures rather than counting the fixture is what stops the list being emptied, or a
    /// new capture resolving a label this way with nothing reading the result back.
    /// </remarks>
    [Fact]
    public void EveryEngineeredResultThatNeedsReadingBackIsPinned()
    {
        SortedSet<string> stated = new(StringComparer.Ordinal);
        foreach (Capture capture in Captures)
        {
            foreach (LoadoutEvent loadout in capture.Loadouts)
            {
                foreach (LoadoutModule fitted in loadout.Modules)
                {
                    foreach (EngineeringModifier modifier in Modifiers(fitted))
                    {
                        if (modifier.Value is null) continue;
                        OutfittingModule record = ModuleCatalogue.FindBySymbol(fitted.Item)!;
                        if (!NeedsReadingBack(record, modifier.Label)) continue;
                        ModuleStat stat = ModuleStatLabels.StatFor(modifier.Label, record.Stats)!.Value;
                        stated.Add($"{record.Symbol}|{stat}");
                    }
                }
            }
        }

        SortedSet<string> pinned = new(StringComparer.Ordinal);
        foreach (EngineeredResultFixture row in Fixture.Engineered)
        {
            pinned.Add($"{row.Symbol}|{Stat(row.Field)}");
        }

        Assert.Equal(pinned, stated);
    }

    /// <summary>Every engineered result reaches a consumer at the stat the fixture names.</summary>
    /// <remarks>
    /// The effective record is what a consumer reads, and it is where a label that resolves
    /// to no stat goes missing rather than failing. The fixture writes the stat out rather
    /// than resolving it, so a mapping that sent the value elsewhere fails here. The pinned
    /// figure is Frontier's own: the capture states it beside the base value.
    /// </remarks>
    [Fact]
    public void EveryEngineeredResultReachesAConsumerAtTheStatTheFixtureNames()
    {
        foreach (EngineeredResultFixture expected in Fixture.Engineered)
        {
            LoadoutEvent loadout = Named(expected.File).Loadouts[0];
            FittedModule fitted = ShipLoadout.FromLoadout(loadout).FittedModuleAt(expected.Slot)!;

            // A journal lower-cases every item; the fixture reads as the catalogue spells it.
            Assert.Equal(expected.Symbol, fitted.Symbol, ignoreCase: true);

            ModuleStat stat = Stat(expected.Field);
            double effective = fitted.EffectiveStats!.Stats[stat]
                ?? throw new InvalidOperationException(
                    $"{expected.File} {expected.Slot}: {expected.Field} carries no value.");
            Assert.True(
                WithinBinaryRounding(effective, expected.Value),
                $"{expected.File} {expected.Slot}: effective {effective}, "
                    + $"pinned {expected.Value}");

            // Whichever of the stat's labels this capture spells it with: the falloff range
            // is FalloffRange to a recipe and DamageFalloffRange to a journal.
            List<string> labels = ModuleStatLabels.LabelsForStat(stat);
            EngineeringModifier modifier = Modifiers(
                loadout.Modules.Single(module => module.Slot == expected.Slot))
                .Single(entry => labels.Contains(entry.Label));

            // In the catalogue's own units: a journal states a shield generator's strength as
            // the percentage the panel shows, where the record holds the multiplier.
            double captured = modifier.Value!.Value / ModuleStatLabels.ScaleFor(modifier.Label);
            Assert.True(
                WithinBinaryRounding(captured, expected.Value),
                $"{expected.File} {expected.Slot}: the capture states {captured}, "
                    + $"pinned {expected.Value}");
        }
    }

    /// <summary>
    /// Whether a label's resolution has to be read back rather than trusted.
    /// </summary>
    /// <remarks>
    /// Two places a wrong resolution hides: a label that is not the stat's own first name,
    /// because a stat with two labels can be written to whichever the mapping is asked for,
    /// and a label naming a stat the record does not carry, because a resolution to nothing
    /// goes missing in the effective record rather than failing. Both are read off the
    /// mapping and the record, so no hand-kept list decides what the sweep looks at.
    /// </remarks>
    private static bool NeedsReadingBack(OutfittingModule record, string label)
    {
        // A nested damage-share label has its own fixture and its own assertion.
        if (ModuleStatLabels.ShareFor(label) is not null) return false;
        if (ModuleStatLabels.StatFor(label, record.Stats) is not ModuleStat stat) return false;
        return ModuleStatLabels.LabelsForStat(stat)[0] != label || !record.Stats.Has(stat);
    }

    /// <summary>Every distinct base value one capture states, in the order its modules appear.</summary>
    private static List<StatedBase> StatedBases(Capture capture)
    {
        Dictionary<string, double> seen = new(StringComparer.Ordinal);
        List<StatedBase> stated = [];
        foreach (LoadoutEvent loadout in capture.Loadouts)
        {
            foreach (LoadoutModule fitted in loadout.Modules)
            {
                // The catalogue's own spelling, because a journal lower-cases every item.
                // Looked up once for the module rather than once for each modifier.
                OutfittingModule? record = null;
                foreach (EngineeringModifier modifier in Modifiers(fitted))
                {
                    if (modifier.OriginalValue is not double original) continue;
                    record ??= ModuleCatalogue.FindBySymbol(fitted.Item)
                        ?? throw new InvalidOperationException(
                            $"No catalogue record for {fitted.Item}.");

                    string key = $"{record.Symbol}|{modifier.Label}";
                    if (seen.TryGetValue(key, out double first))
                    {
                        // A build can fit the same module twice. The second copy repeats the
                        // first's base values rather than quietly winning or losing.
                        Assert.Equal(first, original);
                        continue;
                    }

                    seen[key] = original;
                    stated.Add(new StatedBase(record, modifier.Label, original));
                }
            }
        }

        return stated;
    }

    /// <summary>Whether two readings of one stat differ by no more than the game's float noise.</summary>
    private static bool WithinFloatNoise(double ours, double captured)
    {
        double scale = Math.Max(Math.Abs(ours), Math.Abs(captured));
        return scale == 0
            ? ours == captured
            : Math.Abs(ours - captured) / scale < Fixture.FloatNoiseTolerance;
    }

    /// <summary>Whether two decimals differ only in how binary floating point holds them.</summary>
    private static bool WithinBinaryRounding(double left, double right) =>
        Math.Abs(left - right)
            <= BinaryRounding * Math.Max(1, Math.Max(Math.Abs(left), Math.Abs(right)));

    private static void AssertDistribution(
        Dictionary<string, double> expected,
        DamageDistribution? actual)
    {
        Assert.NotNull(actual);
        Assert.Equal(Share(expected, "kinetic"), actual.Kinetic);
        Assert.Equal(Share(expected, "thermal"), actual.Thermal);
        Assert.Equal(Share(expected, "explosive"), actual.Explosive);
        Assert.Equal(Share(expected, "absolute"), actual.Absolute);
        Assert.Equal(Share(expected, "antiXeno"), actual.AntiXeno);
        Assert.Equal(Share(expected, "unclassified"), actual.Unclassified);
    }

    private static double? Share(Dictionary<string, double> shares, string name) =>
        shares.TryGetValue(name, out double share) ? share : null;

    private static ModuleStat Stat(string field)
    {
        Assert.True(Enum.TryParse(field, ignoreCase: true, out ModuleStat stat), field);
        return stat;
    }

    private static IReadOnlyList<EngineeringModifier> Modifiers(LoadoutModule fitted) =>
        fitted.Engineering?.Modifiers ?? [];

    private static IEnumerable<string> Spellings(IEnumerable<UnmappedLabelFixture> labels) =>
        labels.Select(entry => $"{entry.Symbol}|{entry.Label}");

    private static Capture Named(string file)
    {
        foreach (Capture capture in Captures)
        {
            if (capture.File == file) return capture;
        }

        throw new KeyNotFoundException($"The fixtures hold no capture '{file}'.");
    }

    private static CapturedBaseFixture? Pinned(string file)
    {
        foreach (CapturedBaseFixture capture in Fixture.Captures)
        {
            if (capture.File == file) return capture;
        }

        return null;
    }

    /// <summary>
    /// Every stored capture in the ships fixtures, read straight off the embedded resources.
    /// </summary>
    /// <remarks>
    /// Swept rather than listed, so a capture added to the fixtures is read the day it
    /// lands. A file that holds no loadout event at all yields nothing.
    /// </remarks>
    private static IReadOnlyList<Capture> ReadCaptures()
    {
        const string directory = "fixtures/ships/";
        List<Capture> captures = [];
        foreach (string path in SharedFixtures.Paths())
        {
            if (!path.StartsWith(directory, StringComparison.Ordinal)) continue;
            string file = path[directory.Length..];

            // The build corpus lives in a folder of its own and records builds rather than
            // captures.
            if (file.Contains('/')) continue;

            List<LoadoutEvent> loadouts = EventsIn(path);
            if (loadouts.Count > 0) captures.Add(new Capture(file, loadouts));
        }

        return captures;
    }

    /// <summary>Every loadout event one fixture holds, bare or wrapped in an export.</summary>
    private static List<LoadoutEvent> EventsIn(string path)
    {
        using JsonDocument document = SharedFixtures.LoadDocument(path);
        JsonElement root = document.RootElement;
        List<LoadoutEvent> events = [];

        if (root.ValueKind == JsonValueKind.Array)
        {
            foreach (JsonElement entry in root.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object) return [];
                if (!entry.TryGetProperty("data", out JsonElement data)) return [];
                if (!HoldsModules(data)) return [];
                events.Add(Read(data));
            }

            return events;
        }

        if (root.ValueKind != JsonValueKind.Object || !HoldsModules(root)) return [];
        events.Add(Read(root));
        return events;
    }

    private static bool HoldsModules(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object
            && element.TryGetProperty("Modules", out JsonElement modules)
            && modules.ValueKind == JsonValueKind.Array;

    private static LoadoutEvent Read(JsonElement element) =>
        JsonSerializer.Deserialize<LoadoutEvent>(element.GetRawText(), JournalOptions)!;

    /// <summary>One stored capture and every loadout event it holds.</summary>
    private sealed record Capture(string File, IReadOnlyList<LoadoutEvent> Loadouts);

    /// <summary>One module and label pair a capture states a base value for.</summary>
    private sealed record StatedBase(OutfittingModule Record, string Label, double Captured);
}
