using System;
using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The pre-engineered catalogue and its resolver, measured against the shared fixture.</summary>
public class PreEngineeredTests
{
    private static readonly PreEngineeredFixture Fixture =
        SharedFixtures.Load<PreEngineeredFixture>("fixtures/ships/pre-engineered.jsonc");

    public static TheoryData<int> PinnedRecords() => Positions(Fixture.Records.Count);

    public static TheoryData<string> ResolvedVariants()
    {
        TheoryData<string> data = [];
        foreach (string name in Fixture.Resolved.Keys) data.Add(name);
        return data;
    }

    public static TheoryData<int> BurstIntervalVariants() =>
        Positions(Fixture.BurstIntervalVariants.Variants.Count);

    public static TheoryData<int> BakedEffects() =>
        Positions(Fixture.MercenaryBakedEffects.Variants.Count);

    [Fact]
    public void TheCatalogueHoldsTheFixturesCounts()
    {
        Assert.Equal(Fixture.Count, PreEngineeredCatalogue.All.Count);
        foreach (KeyValuePair<string, int> route in Fixture.Counts)
        {
            Assert.True(
                EnumParsing.TryParse(route.Key, out PreEngineeredAcquisition acquisition),
                $"'{route.Key}' names no acquisition route.");
            Assert.Equal(
                route.Value,
                PreEngineeredCatalogue.All.Count(variant => variant.Acquisition == acquisition));
        }

        Assert.Equal(
            Fixture.ModifierCounts["withModifiers"],
            PreEngineeredCatalogue.All.Count(variant => variant.Modifiers is { Count: > 0 }));
        Assert.Equal(
            Fixture.ModifierCounts["withoutModifiers"],
            PreEngineeredCatalogue.All.Count(variant => variant.Modifiers is null or { Count: 0 }));
        Assert.Equal(
            Fixture.ModifierCounts["withMercCoinCost"],
            PreEngineeredCatalogue.All.Count(variant => variant.MercCoinCost is not null));
    }

    [Fact]
    public void AFinalArticleAcceptsNoFurtherEngineering()
    {
        IReadOnlyList<PreEngineeredVariant> locked =
            PreEngineeredCatalogue.All.Where(variant => variant.EngineeringLocked).ToList();

        Assert.Equal(Fixture.EngineeringLocked.Count, locked.Count);
        Assert.Equal(
            Fixture.EngineeringLocked.Symbols,
            locked.Select(variant => variant.Symbol).Distinct(StringComparer.Ordinal)
                .OrderBy(symbol => symbol, StringComparer.Ordinal));

        // The lock travels with the resolved article, so fitting one keeps the restriction.
        foreach (PreEngineeredVariant variant in locked)
        {
            Assert.True(PreEngineeredStats.Resolve(variant)!.EngineeringLocked);
        }
    }

    [Fact]
    public void EveryStatBlockUsesTheFixturesLabels()
    {
        Assert.Equal(
            Fixture.ModifierLabels,
            PreEngineeredCatalogue.All
                .SelectMany(variant => variant.Modifiers ?? [])
                .Select(modifier => modifier.Label)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(label => label, StringComparer.Ordinal));

        Assert.Equal(
            Fixture.MaxModifierDecimalPlaces,
            PreEngineeredCatalogue.All
                .SelectMany(variant => variant.Modifiers ?? [])
                .Max(modifier => DecimalPlaces(modifier.Value)));

        Assert.Equal(
            Fixture.AuthoredStats.Count,
            PreEngineeredCatalogue.All
                .SelectMany(variant => variant.Modifiers ?? [])
                .Count(modifier => modifier.Method == ModifierMethod.Overwrite));
    }

    [Fact]
    public void AnAuthoredStatResolvesToExactlyTheValueItStates()
    {
        foreach (PreEngineeredVariant variant in PreEngineeredCatalogue.All)
        {
            IReadOnlyList<EngineeringModifier> applied = PreEngineeredStats.Modifiers(variant);
            foreach (PreEngineeredModifier authored in variant.Modifiers ?? [])
            {
                if (authored.Method != ModifierMethod.Overwrite) continue;
                EngineeringModifier? resolved =
                    applied.FirstOrDefault(modifier => modifier.Label == authored.Label);
                if (resolved is null) continue;
                Assert.Equal(authored.Value, resolved.Value!.Value, 6);
            }
        }
    }

    [Fact]
    public void EveryVariantResolvesAtLeastOneStatItMoves()
    {
        IReadOnlyList<PreEngineeredVariant> unresolved = PreEngineeredCatalogue.All
            .Where(variant => variant.Modifiers is { Count: > 0 })
            .Where(variant => PreEngineeredStats.Modifiers(variant).Count == 0)
            .ToList();

        Assert.Equal(Fixture.FullyUnresolved.Count, unresolved.Count);
        Assert.Equal(Fixture.FullyUnresolved.Symbols, unresolved.Select(variant => variant.Symbol));

        // Every label a catalogued variant moves resolves against its base module.
        foreach (PreEngineeredVariant variant in PreEngineeredCatalogue.All)
        {
            Assert.Empty(PreEngineeredStats.UnresolvedLabels(variant));
        }
    }

    [Fact]
    public void TheShopRowsCarryTheFixturesPrices()
    {
        IReadOnlyList<int> prices = PreEngineeredCatalogue.All
            .Where(variant => variant.MercCoinCost is not null)
            .Select(variant => variant.MercCoinCost!.Value)
            .ToList();

        Assert.Equal(Fixture.MercCoin.Total, prices.Sum());
        Assert.Equal(Fixture.MercCoin.Cheapest, prices.Min());
        Assert.Equal(Fixture.MercCoin.Dearest, prices.Max());

        // Merc Coin is the shop's own currency, so only a bought article carries a price.
        foreach (PreEngineeredVariant variant in PreEngineeredCatalogue.All)
        {
            Assert.Equal(
                variant.Acquisition == PreEngineeredAcquisition.Mercenary,
                variant.MercCoinCost is not null);
        }
    }

    [Theory]
    [MemberData(nameof(PinnedRecords))]
    public void APinnedRecordIsCarriedFieldForField(int position)
    {
        PreEngineeredRecordFixture expected = Fixture.Records[position];
        PreEngineeredVariant variant = Assert.Single(PreEngineeredCatalogue.All, candidate =>
            candidate.Symbol == expected.Symbol
            && candidate.BlueprintSymbol == expected.BlueprintSymbol
            && candidate.Grade == expected.Grade
            && candidate.ExperimentalEffectSymbol == expected.ExperimentalEffectSymbol);

        Assert.Equal(expected.Name, variant.Name);
        Assert.Equal(Acquisition(expected.Acquisition), variant.Acquisition);
        Assert.Equal(expected.EngineeringLocked, variant.EngineeringLocked);
        Assert.Equal(expected.MercCoinCost, variant.MercCoinCost);

        if (expected.Modifiers is null)
        {
            Assert.Null(variant.Modifiers);
            return;
        }

        Assert.Equal(expected.Modifiers.Count, variant.Modifiers!.Count);
        for (int at = 0; at < variant.Modifiers.Count; at++)
        {
            Assert.Equal(expected.Modifiers[at].Label, variant.Modifiers[at].Label);
            Assert.Equal(Method(expected.Modifiers[at].Method), variant.Modifiers[at].Method);
            Assert.Equal(expected.Modifiers[at].Value, variant.Modifiers[at].Value, 9);
        }
    }

    [Fact]
    public void OneModuleCanBeSoldOrAwardedInSeveralFlavours()
    {
        Assert.Equal(
            Fixture.MultiVariant.Blueprints,
            PreEngineeredCatalogue.VariantsFor(Fixture.MultiVariant.Symbol)
                .Select(variant => variant.BlueprintSymbol));

        // The journal writes a module symbol lower-cased, and whitespace survives an export.
        Assert.Equal(
            Fixture.MultiVariant.Blueprints.Count,
            PreEngineeredCatalogue.VariantsFor($"  {Fixture.MultiVariant.Symbol.ToLowerInvariant()} ").Count);

        SameBlueprintFixture twice = Fixture.SameBlueprintTwice;
        Assert.Equal(
            twice.Experimentals,
            PreEngineeredCatalogue.VariantsFor(twice.Symbol)
                .Where(variant => variant.BlueprintSymbol == twice.BlueprintSymbol)
                .Select(variant => variant.ExperimentalEffectSymbol));

        SameTripleFixture triple = Fixture.SameTripleDifferentGrade;
        IReadOnlyList<PreEngineeredVariant> awarded = PreEngineeredCatalogue.VariantsFor(triple.Symbol)
            .Where(variant => variant.BlueprintSymbol == triple.BlueprintSymbol)
            .ToList();
        Assert.Equal(triple.Grades, awarded.Select(variant => variant.Grade));
        Assert.Equal(
            triple.Acquisitions.Select(Acquisition),
            awarded.Select(variant => variant.Acquisition));
    }

    [Fact]
    public void AModuleWithNoPreEngineeredFormAnswersEmpty()
    {
        foreach (string symbol in Fixture.NotPreEngineered)
        {
            Assert.NotNull(ModuleCatalogue.FindBySymbol(symbol));
            Assert.False(PreEngineeredCatalogue.IsPreEngineered(symbol));
            Assert.Empty(PreEngineeredCatalogue.VariantsFor(symbol));
        }

        Assert.False(PreEngineeredCatalogue.IsPreEngineered(null));
        Assert.Empty(PreEngineeredCatalogue.VariantsFor("not_a_module"));
    }

    [Fact]
    public void EveryVariantJoinsToTheCataloguesItNames()
    {
        Assert.True(Fixture.Joins["everySymbolIsAKnownModule"]);
        Assert.True(Fixture.Joins["everyBlueprintIsAKnownBlueprint"]);
        Assert.True(Fixture.Joins["everyExperimentalIsAKnownEffect"]);
        Assert.True(Fixture.Joins["everyMercenaryBlueprintStartsAtGradeTwo"]);
        Assert.True(Fixture.Joins["everyRewardGradeIsARealGrade"]);

        foreach (PreEngineeredVariant variant in PreEngineeredCatalogue.All)
        {
            Assert.NotNull(ModuleCatalogue.FindBySymbol(variant.Symbol));
            Assert.InRange(variant.Grade, 1, 5);

            Blueprint? blueprint = BlueprintCatalogue.Find(variant.BlueprintSymbol);
            if (variant.Acquisition == PreEngineeredAcquisition.EventReward)
            {
                // A festive identity names a fixed article rather than a recipe to apply.
                Assert.Null(blueprint);
            }
            else
            {
                Assert.NotNull(blueprint);
            }

            if (variant.Acquisition == PreEngineeredAcquisition.Mercenary)
            {
                // The article is bought at grade 1, so its recipe starts at grade 2.
                Assert.DoesNotContain(1, blueprint!.Grades.Keys);
            }

            if (variant.ExperimentalEffectSymbol is not null)
            {
                Assert.NotNull(ExperimentalEffectCatalogue.Find(variant.ExperimentalEffectSymbol));
            }
        }
    }

    [Fact]
    public void TheFestiveLaunchersShareOneStatBlock()
    {
        FestiveFixture festive = Fixture.Festive;
        IReadOnlyList<PreEngineeredVariant> variants =
            PreEngineeredCatalogue.VariantsFor(festive.Symbol);

        Assert.Equal(festive.Blueprints, variants.Select(variant => variant.BlueprintSymbol));
        foreach (PreEngineeredVariant variant in variants)
        {
            Assert.Equal(festive.Grade, variant.Grade);
            Assert.Equal(PreEngineeredAcquisition.EventReward, variant.Acquisition);
            PreEngineeredModifier modifier = Assert.Single(variant.Modifiers!);
            Assert.Equal(festive.Modifier.Label, modifier.Label);
            Assert.Equal(Method(festive.Modifier.Method), modifier.Method);
            Assert.Equal(festive.Modifier.Value, modifier.Value, 9);

            Assert.Equal(
                festive.Resolved.BaseDamage,
                ModuleCatalogue.FindBySymbol(festive.Symbol)!.Stats[ModuleStat.Damage]!.Value,
                6);
            Assert.Equal(
                festive.Resolved.Damage,
                PreEngineeredStats.Resolve(variant)!.Stats[ModuleStat.Damage]!.Value,
                6);
        }
    }

    [Theory]
    [MemberData(nameof(BakedEffects))]
    public void ABoughtArticleArrivesByItsBakedEffectAlone(int position)
    {
        BakedEffectFixture baked = Fixture.MercenaryBakedEffects.Variants[position];
        PreEngineeredVariant variant = Variant(baked.Symbol, baked.BlueprintSymbol, baked.ExperimentalEffectSymbol);

        Assert.Equal(PreEngineeredAcquisition.Mercenary, variant.Acquisition);

        // No registry publishes the grade-1 pre-engineering a shop row arrives with, so what its
        // baked effect moves is the whole of what it reports.
        Assert.Null(variant.Modifiers);
        Assert.Equal(baked.MovedStats, MovedStats(variant));
    }

    [Fact]
    public void TheShopRowsWithABakedEffectAreTheFixturesRows()
    {
        Assert.Equal(
            Fixture.MercenaryBakedEffects.Count,
            PreEngineeredCatalogue.All.Count(variant =>
                variant.Acquisition == PreEngineeredAcquisition.Mercenary
                && variant.ExperimentalEffectSymbol is not null));
    }

    [Theory]
    [MemberData(nameof(BurstIntervalVariants))]
    public void AMovedFiringCycleMovesTheRateOfFireWithIt(int position)
    {
        BurstIntervalVariantFixture moved = Fixture.BurstIntervalVariants.Variants[position];
        PreEngineeredVariant variant = Variant(
            moved.Symbol, moved.BlueprintSymbol, moved.ExperimentalEffectSymbol, moved.Grade);
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(moved.Symbol)!;
        OutfittingModule resolved = PreEngineeredStats.Resolve(variant)!;

        Assert.Equal(moved.StockBurstInterval, stock.Stats[ModuleStat.BurstInterval]!.Value, 6);
        Assert.Equal(moved.BurstInterval, resolved.Stats[ModuleStat.BurstInterval]!.Value, 6);

        // No recipe names the rate of fire, and the article still reports the one its cycle makes.
        Assert.Equal(moved.RateOfFire, resolved.Stats[ModuleStat.RateOfFire]!.Value, 6);
    }

    [Fact]
    public void TheArticlesWhoseCycleMovesAreTheFixturesArticles() =>
        Assert.Equal(
            Fixture.BurstIntervalVariants.Count,
            PreEngineeredCatalogue.All.Count(variant =>
                PreEngineeredStats.Modifiers(variant).Any(modifier => modifier.Label == "BurstInterval")));

    [Theory]
    [MemberData(nameof(ResolvedVariants))]
    public void AVariantResolvesIntoTheArticleThatIsFitted(string name)
    {
        ResolvedVariantFixture expected = Fixture.Resolved[name];
        PreEngineeredVariant variant = Assert.Single(
            PreEngineeredCatalogue.VariantsFor(expected.Symbol),
            candidate => candidate.BlueprintSymbol == expected.BlueprintSymbol
                && (expected.Grade is null || candidate.Grade == expected.Grade));

        OutfittingModule stock = ModuleCatalogue.FindBySymbol(expected.Symbol)!;
        foreach (KeyValuePair<string, double> stat in expected.Base ?? [])
        {
            Assert.Equal(stat.Value, stock.Stats[Stat(stat.Key)]!.Value, 6);
        }

        OutfittingModule resolved = PreEngineeredStats.Resolve(variant)!;
        foreach (KeyValuePair<string, double> stat in expected.Engineered)
        {
            Assert.Equal(stat.Value, resolved.Stats[Stat(stat.Key)]!.Value, 6);
        }

        // A variant is the same article with different numbers, not a different module.
        Assert.Equal(stock.Symbol, resolved.Symbol);
        Assert.Equal(stock.Name, resolved.Name);
        Assert.Equal(stock.Class, resolved.Class);
        Assert.Equal(stock.Rating, resolved.Rating);
        Assert.Equal(stock.Cost, resolved.Cost);

        if (expected.Unresolved is not null)
        {
            Assert.Equal(expected.Unresolved, PreEngineeredStats.UnresolvedLabels(variant));
        }
    }

    [Fact]
    public void AnUnknownVariantResolvesToNothing()
    {
        PreEngineeredVariant unknown = new(
            "not_a_module", "Nothing", "FSD_LongRange", 5, PreEngineeredAcquisition.TechBroker);

        Assert.Null(PreEngineeredStats.Resolve(unknown));
        Assert.Empty(PreEngineeredStats.Modifiers(unknown));
        Assert.Empty(PreEngineeredStats.UnresolvedLabels(unknown));
    }

    [Fact]
    public void AnArticleThatMovesNothingResolvesToItsStockRecord()
    {
        PreEngineeredVariant plain = new(
            "Int_Hyperdrive_Size5_Class5",
            "Frame Shift Drive",
            "FSD_LongRange",
            5,
            PreEngineeredAcquisition.CommunityGoal);

        Assert.Equal(ModuleCatalogue.FindBySymbol(plain.Symbol), PreEngineeredStats.Resolve(plain));
        Assert.Empty(PreEngineeredStats.Modifiers(plain));
    }

    [Fact]
    public void AVariantIsNeverRead()
    {
        Assert.Throws<ArgumentNullException>(() => PreEngineeredStats.Resolve(null!));
        Assert.Throws<ArgumentNullException>(() => PreEngineeredStats.Modifiers(null!));
        Assert.Throws<ArgumentNullException>(() => PreEngineeredStats.UnresolvedLabels(null!));
    }

    private static TheoryData<int> Positions(int count)
    {
        TheoryData<int> data = [];
        for (int position = 0; position < count; position++) data.Add(position);
        return data;
    }

    /// <summary>The stats a variant moves, named as the outfitting registry names them.</summary>
    private static IReadOnlyList<string> MovedStats(PreEngineeredVariant variant)
    {
        OutfittingModule stock = ModuleCatalogue.FindBySymbol(variant.Symbol)!;
        OutfittingModule resolved = PreEngineeredStats.Resolve(variant)!;
        List<string> moved = [];
        foreach (ModuleStat stat in Enum.GetValues<ModuleStat>())
        {
            if (stock.Stats[stat] != resolved.Stats[stat]) moved.Add(StatName(stat));
        }

        moved.Sort(StringComparer.Ordinal);
        return moved;
    }

    private static string StatName(ModuleStat stat)
    {
        string name = stat.ToString();
        return char.ToLowerInvariant(name[0]) + name[1..];
    }

    private static int DecimalPlaces(double value)
    {
        for (int places = 0; places < 10; places++)
        {
            if (Math.Round(value, places) == value) return places;
        }

        return 10;
    }

    private static PreEngineeredAcquisition Acquisition(string route)
    {
        Assert.True(
            EnumParsing.TryParse(route, out PreEngineeredAcquisition acquisition),
            $"'{route}' names no acquisition route.");
        return acquisition;
    }

    private static ModifierMethod Method(string method)
    {
        Assert.True(EnumParsing.TryParse(method, out ModifierMethod parsed), $"'{method}' names no method.");
        return parsed;
    }

    private static ModuleStat Stat(string name)
    {
        Assert.True(EnumParsing.TryParse(name, out ModuleStat stat), $"'{name}' names no stat.");
        return stat;
    }

    private static PreEngineeredVariant Variant(
        string symbol,
        string blueprint,
        string? experimental,
        int? grade = null)
    {
        return Assert.Single(
            PreEngineeredCatalogue.VariantsFor(symbol),
            variant => variant.BlueprintSymbol == blueprint
                && variant.ExperimentalEffectSymbol == experimental
                && (grade is null || variant.Grade == grade));
    }
}
