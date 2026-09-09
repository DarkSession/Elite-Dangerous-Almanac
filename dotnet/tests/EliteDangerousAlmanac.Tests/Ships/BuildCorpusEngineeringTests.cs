using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>
/// The engineering the shared community corpus declares, applied through the public API.
/// </summary>
/// <remarks>
/// <para>
/// The corpus is what real build tools wrote, so a recipe this library refuses here is this
/// library disagreeing with the game. The pinned figures of <see cref="BuildCorpusTests"/>
/// are read off unengineered builds, which leaves the declarations themselves unread. This
/// reads them.
/// </para>
/// <para>
/// Some declarations name no recipe a player may roll. A final pre-engineered Guardian
/// weapon, an Expanded Cargo Rack and a Long Range Abrasion Blaster state in their
/// Engineering block which article was acquired. The fixture names each of those, and how
/// many entries carry it, so a refusal that spreads beyond them fails.
/// </para>
/// </remarks>
public class BuildCorpusEngineeringTests
{
    private static readonly BuildCorpusIndex Index =
        SharedFixtures.Load<BuildCorpusIndex>("fixtures/ships/builds/index.jsonc");

    private static readonly CorpusOptionsFixture Corpus =
        SharedFixtures.Load<EngineeringOptionsFixture>(
            "fixtures/ships/engineering-options.jsonc").Corpus;

    private static readonly IReadOnlyList<BuildCorpusBuild> Builds = ReadBuilds();

    private static readonly IReadOnlyList<CorpusDeclaration> Declarations = ReadDeclarations();

    [Fact]
    public void TheCorpusDeclaresTheEngineeringBothFixturesCount()
    {
        Assert.Equal(Index.DeclaredEngineering, Corpus.DeclaredEngineering);
        Assert.Equal(Corpus.DeclaredEngineering, Declarations.Count);
    }

    /// <summary>
    /// Every declared recipe folds legs onto stats the fitted module carries.
    /// </summary>
    /// <remarks>
    /// Which recipe an identifier names can depend on the module. A wake scanner's
    /// <c>Sensor_LongRange</c> is the scanner's recipe, whose legs are not the sensor suite's.
    /// Resolving against the fitted module checks the legs the build would fold rather than
    /// another family's, which happen to land on stats the scanner also carries and would
    /// therefore pass while proving nothing.
    /// </remarks>
    [Fact]
    public void EveryDeclaredRecipeFoldsOntoStatsItsModuleCarries()
    {
        List<string> unfoldable = [];
        foreach (CorpusDeclaration declaration in Declarations)
        {
            OutfittingModule stats = ModuleCatalogue.FindBySymbol(declaration.Symbol)
                ?? throw new InvalidOperationException(
                    $"{declaration.Build}: no catalogue carries {declaration.Symbol}.");

            string recipe = BlueprintJournal.ResolveForModule(declaration.Symbol, declaration.Blueprint);
            BlueprintGrade grade = BlueprintCatalogue.FindGrade(recipe, declaration.Grade)
                ?? throw new InvalidOperationException(
                    $"{declaration.Build}: {recipe} has no grade {declaration.Grade}.");
            ExperimentalEffect? effect = declaration.Experimental is null
                ? null
                : ExperimentalEffectCatalogue.Find(declaration.Experimental)
                    ?? throw new InvalidOperationException(
                        $"{declaration.Build}: no catalogue carries {declaration.Experimental}.");

            List<string> missing = LoadoutEngineering.MissingBaseLabels(
                stats, ModuleStatLabels.BaseStats(stats), grade.Features, effect?.Modifiers);
            if (missing.Count > 0)
            {
                unfoldable.Add(
                    $"{declaration.Build}: {declaration.Symbol} + {declaration.Blueprint} "
                        + $"[{string.Join(", ", missing)}]");
            }
        }

        Assert.Empty(unfoldable);
    }

    /// <summary>
    /// A declaration on a module with no ordinary menu is one the fixture classifies.
    /// </summary>
    /// <remarks>
    /// A module outside every engineering group can carry a declaration only where the entry
    /// records a bought article rather than a roll. Leaving that implicit would let a module
    /// silently fall out of its group and read as an acquisition.
    /// </remarks>
    [Fact]
    public void EveryDeclarationWithoutAMenuIsOneTheFixtureClassifies()
    {
        List<string> ungrouped = [];
        SortedSet<string> symbols = new(StringComparer.Ordinal);
        foreach (CorpusDeclaration declaration in Declarations)
        {
            if (EngineeringOptions.GroupFor(declaration.Symbol) is not null) continue;
            ungrouped.Add(declaration.Symbol);
            symbols.Add(declaration.Symbol);
        }

        SortedSet<string> classified = new(StringComparer.Ordinal);
        foreach (CorpusEngineeringRowFixture row in Corpus.NotEngineerable) classified.Add(row.Symbol);
        foreach (CorpusEngineeringRowFixture row in Corpus.FinalPreEngineered)
        {
            if (EngineeringOptions.GroupFor(row.Symbol) is null) classified.Add(row.Symbol);
        }

        Assert.Equal(classified, symbols);
        Assert.Equal(Corpus.UngroupedEntries, ungrouped.Count);

        foreach (CorpusEngineeringRowFixture row in Corpus.NotEngineerable)
        {
            int entries = 0;
            foreach (CorpusDeclaration declaration in Declarations)
            {
                if (declaration.Symbol != row.Symbol) continue;
                Assert.Equal(row.Blueprint, declaration.Blueprint);
                entries++;
            }

            Assert.Equal(row.Entries, entries);
        }
    }

    /// <summary>Every applicable declaration names a recipe its own module offers.</summary>
    /// <remarks>
    /// <para>
    /// A recipe that several module families take is stored under each family's own journal
    /// identifier. The catalogue lists the family-specific spelling, so a build stating the
    /// generic one declares the same thing, provided the alias belongs to this module's own
    /// family rather than merely to some family.
    /// </para>
    /// <para>
    /// The colliding journal names are the other kind: one spelling, two different recipes,
    /// which only the module's own menu settles. Counting each route separately stops one
    /// route quietly widening to cover the other's cases.
    /// </para>
    /// </remarks>
    [Fact]
    public void EveryApplicableDeclarationNamesARecipeItsModuleOffers()
    {
        int viaAlias = 0;
        int viaJournalSpelling = 0;
        int final = 0;

        foreach (CorpusDeclaration declaration in Declarations)
        {
            if (IsFinal(declaration))
            {
                final++;
                continue;
            }

            // The entries with no menu at all are classified by the test above.
            if (EngineeringOptions.GroupFor(declaration.Symbol) is null) continue;

            IReadOnlyList<string> offered = EngineeringOptions.BlueprintsFor(declaration.Symbol);
            if (!Contains(offered, declaration.Blueprint))
            {
                string resolved = BlueprintJournal.ResolveForModule(
                    declaration.Symbol, declaration.Blueprint);
                List<string> matching = OfferedAliases(offered, declaration.Blueprint);

                if (resolved != declaration.Blueprint)
                {
                    Assert.True(
                        Contains(offered, resolved),
                        $"{declaration.Symbol}: {resolved} is not offered.");
                    Assert.Empty(matching);
                    viaJournalSpelling++;
                }
                else
                {
                    Assert.True(
                        matching.Count == 1,
                        $"{declaration.Symbol}: {declaration.Blueprint} names "
                            + $"{matching.Count} offered recipes.");
                    viaAlias++;
                }
            }

            if (declaration.Experimental is string experimental)
            {
                Assert.Contains(
                    experimental, EngineeringOptions.ExperimentalsFor(declaration.Symbol));
            }
        }

        Assert.Equal(Corpus.AliasSpellingsAccepted, viaAlias);
        Assert.Equal(Corpus.JournalSpellingsAccepted, viaJournalSpelling);
        Assert.Equal(Corpus.FinalPreEngineeredEntries, final);
    }

    /// <summary>Each final pre-engineered row covers the entries it claims, and is final.</summary>
    [Fact]
    public void EveryFinalPreEngineeredRowNamesAnArticleRatherThanARecipe()
    {
        int total = 0;
        foreach (CorpusEngineeringRowFixture row in Corpus.FinalPreEngineered)
        {
            int entries = 0;
            foreach (CorpusDeclaration declaration in Declarations)
            {
                if (Matches(declaration, row)) entries++;
            }

            Assert.Equal(row.Entries, entries);
            total += row.Entries;

            // A Guardian weapon keeps one menu row, the hull reinforcement recipe every
            // Guardian article takes. Anything else offering the declared recipe would make
            // the entry an ordinary roll.
            if (LoadoutEngineering.IsFinalGuardianWeaponEngineering(row.Symbol, row.Blueprint))
            {
                Assert.Equal(["GuardianModule_Sturdy"], EngineeringOptions.BlueprintsFor(row.Symbol));
            }
            else
            {
                Assert.DoesNotContain(row.Blueprint, EngineeringOptions.BlueprintsFor(row.Symbol));
                Assert.Contains(
                    PreEngineeredCatalogue.VariantsFor(row.Symbol),
                    variant => variant.BlueprintSymbol == row.Blueprint
                        && variant.Acquisition != PreEngineeredAcquisition.Mercenary);
            }

            Assert.Empty(EngineeringOptions.ExperimentalsFor(row.Symbol));
        }

        Assert.Equal(Corpus.FinalPreEngineeredEntries, total);
    }

    /// <summary>
    /// Every applicable declaration rolls onto the build it was declared on, end to end.
    /// </summary>
    /// <remarks>
    /// The declarations are applied to the assembled build through the public editing API,
    /// which is the path a caller takes. A refusal is accepted only for a pairing the fixture
    /// names, and each such pairing must refuse exactly as many times as the fixture states.
    /// </remarks>
    [Fact]
    public void EveryApplicableDeclarationRollsThroughTheEditingApi()
    {
        Dictionary<string, int> refused = new(StringComparer.Ordinal);
        List<string> unexpected = [];
        int final = 0;

        foreach (BuildCorpusBuild build in Builds)
        {
            ShipLoadout loadout = Assemble(build);
            foreach (BuildCorpusModule entry in build.Modules)
            {
                if (entry.Engineering is not BuildCorpusEngineering engineering) continue;
                ApplyBlueprintOptions options = new(
                    engineering.Grade, ExperimentalEffectSymbol: engineering.Experimental);

                if (IsFinal(new CorpusDeclaration(
                    build.Id, entry.Item, engineering.Blueprint, engineering.Grade, engineering.Experimental)))
                {
                    Assert.ThrowsAny<ArgumentException>(
                        () => loadout.ApplyBlueprint(entry.Slot, engineering.Blueprint, options));
                    final++;
                    continue;
                }

                try
                {
                    loadout.ApplyBlueprint(entry.Slot, engineering.Blueprint, options);
                }
                catch (ArgumentException error)
                {
                    string key = $"{entry.Item}|{engineering.Blueprint}";
                    if (!IsRefusable(key))
                    {
                        unexpected.Add($"{build.Id}: {key} — {error.Message}");
                        continue;
                    }

                    refused[key] = refused.TryGetValue(key, out int seen) ? seen + 1 : 1;
                }
            }
        }

        Assert.Empty(unexpected);
        Assert.Equal(Corpus.FinalPreEngineeredEntries, final);
        foreach (CorpusEngineeringRowFixture row in Corpus.NotEngineerable)
        {
            string key = $"{row.Symbol}|{row.Blueprint}";
            Assert.Equal(row.Entries, refused.TryGetValue(key, out int seen) ? seen : 0);
        }
    }

    /// <summary>Fits the build the way the corpus records it, without its engineering.</summary>
    private static ShipLoadout Assemble(BuildCorpusBuild build)
    {
        List<LoadoutModule> modules = [];
        foreach (BuildCorpusModule entry in build.Modules)
        {
            modules.Add(new LoadoutModule(entry.Slot, entry.Item)
            {
                On = entry.On,
                Priority = entry.Priority,
            });
        }

        return ShipLoadout.FromLoadout(new LoadoutEvent(build.Ship, modules));
    }

    private static bool IsFinal(CorpusDeclaration declaration)
    {
        foreach (CorpusEngineeringRowFixture row in Corpus.FinalPreEngineered)
        {
            if (Matches(declaration, row)) return true;
        }

        return false;
    }

    private static bool Matches(CorpusDeclaration declaration, CorpusEngineeringRowFixture row) =>
        declaration.Symbol == row.Symbol
            && declaration.Blueprint == row.Blueprint
            && declaration.Experimental == row.Experimental;

    private static bool IsRefusable(string key)
    {
        foreach (CorpusEngineeringRowFixture row in Corpus.NotEngineerable)
        {
            if ($"{row.Symbol}|{row.Blueprint}" == key) return true;
        }

        return false;
    }

    /// <summary>The family-specific spellings of one generic identifier that a menu offers.</summary>
    private static List<string> OfferedAliases(IReadOnlyList<string> offered, string blueprint)
    {
        List<string> matching = [];
        if (!Corpus.BlueprintAliases.TryGetValue(blueprint, out List<string>? specific)) return matching;
        foreach (string candidate in specific)
        {
            if (Contains(offered, candidate)) matching.Add(candidate);
        }

        return matching;
    }

    private static bool Contains(IReadOnlyList<string> offered, string id)
    {
        foreach (string candidate in offered)
        {
            if (candidate == id) return true;
        }

        return false;
    }

    private static IReadOnlyList<BuildCorpusBuild> ReadBuilds()
    {
        List<BuildCorpusBuild> builds = [];
        foreach (BuildCorpusEntry entry in Index.Builds)
        {
            builds.Add(
                SharedFixtures.Load<BuildCorpusBuild>($"fixtures/ships/builds/{entry.Id}.jsonc"));
        }

        return builds;
    }

    private static IReadOnlyList<CorpusDeclaration> ReadDeclarations()
    {
        List<CorpusDeclaration> declarations = [];
        foreach (BuildCorpusBuild build in Builds)
        {
            foreach (BuildCorpusModule entry in build.Modules)
            {
                if (entry.Engineering is not BuildCorpusEngineering engineering) continue;
                declarations.Add(new CorpusDeclaration(
                    build.Id,
                    entry.Item,
                    engineering.Blueprint,
                    engineering.Grade,
                    engineering.Experimental));
            }
        }

        return declarations;
    }

    /// <summary>One engineering block a corpus build declares, and the build it is on.</summary>
    private sealed record CorpusDeclaration(
        string Build,
        string Symbol,
        string Blueprint,
        int Grade,
        string? Experimental);
}
