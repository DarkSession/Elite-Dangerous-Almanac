using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The stats every outfitting module carries, measured against the shared fixture.</summary>
public class ModuleStatsTests
{
    private static readonly ModuleStatsFixture Fixture =
        SharedFixtures.Load<ModuleStatsFixture>("fixtures/ships/module-stats.jsonc");

    // A fixture may pin one module more than once, each entry naming different fields, so
    // the theories address an entry by its position rather than by its symbol.
    public static TheoryData<int> SpotChecks() => Positions(Fixture.Spot.Count);

    public static TheoryData<int> VerifiedRecords() => Positions(Fixture.InGameVerifiedValues.Count);

    private static TheoryData<int> Positions(int count)
    {
        TheoryData<int> data = [];
        for (int index = 0; index < count; index++) data.Add(index);
        return data;
    }

    [Fact]
    public void EveryRecordCarriesAtLeastOneStat()
    {
        foreach (KeyValuePair<string, int> entry in Fixture.Counts)
        {
            IReadOnlyList<OutfittingModule> catalogue = CatalogueNamed(entry.Key);
            Assert.Equal(entry.Value, catalogue.Count);
            Assert.All(catalogue, module => Assert.NotEqual(0, module.Stats.Count));
        }
    }

    [Fact]
    public void EachCataloguePricesAsManyRecordsAsTheFixtureSays()
    {
        foreach (KeyValuePair<string, int> entry in Fixture.PriceCounts)
        {
            Assert.Equal(entry.Value, CatalogueNamed(entry.Key).Count(module => module.Cost is not null));
        }
    }

    [Fact]
    public void PinnedPricesMatchAndTheUnpricedCarryNoPrice()
    {
        foreach (ModuleStatSpot price in Fixture.Prices)
        {
            Assert.Equal(
                price.Fields["cost"].GetInt64(),
                ModuleCatalogue.FindBySymbol(price.Symbol)!.Cost);
        }

        foreach (string symbol in Fixture.Unpriced)
        {
            Assert.Null(ModuleCatalogue.FindBySymbol(symbol)!.Cost);
        }

        foreach (string symbol in Fixture.FreeModules.Symbols)
        {
            Assert.Equal(0, ModuleCatalogue.FindBySymbol(symbol)!.Cost);
        }
    }

    [Fact]
    public void EveryGrantedArticleIsFlaggedAndHasASoldTwin()
    {
        List<string> flagged = [.. ModuleCatalogue.All.Where(m => m.GrantOnly).Select(m => m.Symbol)];
        Assert.Equal(Fixture.GrantOnly.Modules.Count, flagged.Count);
        foreach (GrantOnlyModule granted in Fixture.GrantOnly.Modules)
        {
            Assert.Contains(granted.Symbol, flagged);
            OutfittingModule twin = ModuleCatalogue.FindBySymbol(granted.SoldTwin)!;
            Assert.False(twin.GrantOnly);
        }
    }

    [Theory]
    [MemberData(nameof(SpotChecks))]
    public void PinnedStatsMatchTheFixture(int index)
    {
        ModuleStatSpot expected = Fixture.Spot[index];
        AssertFields(expected, ModuleCatalogue.FindBySymbol(expected.Symbol)!);
    }

    [Theory]
    [MemberData(nameof(VerifiedRecords))]
    public void InGameVerifiedValuesWonOverTheDerivedSource(int index)
    {
        ModuleStatSpot expected = Fixture.InGameVerifiedValues[index];
        AssertFields(expected, ModuleCatalogue.FindBySymbol(expected.Symbol)!);
    }

    [Fact]
    public void InGameVerificationRemovedTheFieldsItShowedAbsent()
    {
        foreach (AbsentFieldsFixture absent in Fixture.InGameVerifiedAbsentFields)
        {
            OutfittingModule module = ModuleCatalogue.FindBySymbol(absent.Symbol)!;
            foreach (string field in absent.Fields)
            {
                Assert.True(Enum.TryParse(field, ignoreCase: true, out ModuleStat stat));
                Assert.False(module.Stats.Has(stat), $"{absent.Symbol} still carries {field}");
            }
        }
    }

    /// <summary>Every captured purchase reproduces from the catalogue price and the rule.</summary>
    /// <remarks>
    /// <para>
    /// The game subtracts a truncated discount at each step rather than truncating the
    /// product, so two discounts are <c>ceil(ceil(list * 9/10) * 39/40)</c>. The arithmetic
    /// is integral throughout: 0.9 times 0.975 is not exactly 0.8775 in binary floating
    /// point, and the error crosses a rounding boundary.
    /// </para>
    /// <para>
    /// The capture alone cannot prove the rule, having been fitted to it. The cross-checks
    /// are what does: readings this repository already held, at their own discounts, which a
    /// wrong rule cannot reproduce from the same prices.
    /// </para>
    /// </remarks>
    [Fact]
    public void EveryCapturedPurchaseReproducesWhatWasPaid()
    {
        foreach (PurchaseReadingFixture reading in Fixture.PurchaseCapture.Readings)
        {
            OutfittingModule module = ModuleCatalogue.FindBySymbol(reading.Symbol)!;
            Assert.Equal(reading.Cost, module.Cost);
            Assert.Equal(reading.Paid, PaidFor(reading.Cost));

            // Whether the reading pins one list price on its own. Where it does not, the
            // price is settled by other evidence and a neighbouring price bills the same
            // credits, so the fixture says so rather than letting the figure drift.
            bool alone = PaidFor(reading.Cost - 1) != reading.Paid
                && PaidFor(reading.Cost + 1) != reading.Paid;
            Assert.Equal(reading.Unique, alone);
        }

        foreach (PurchaseCrossCheckFixture check in Fixture.PurchaseCapture.CrossChecks)
        {
            OutfittingModule module = ModuleCatalogue.FindBySymbol(check.Symbol)!;
            long cost = module.Cost!.Value;
            long expected = check.Discount == "2.5" ? CeilingDivide(cost * 39, 40) : PaidFor(cost);
            Assert.Equal(check.Value, expected);
        }
    }

    /// <summary>The credits a list price bills at a 10 per cent and a 2.5 per cent discount.</summary>
    private static long PaidFor(long cost) => CeilingDivide(CeilingDivide(cost * 9, 10) * 39, 40);

    private static long CeilingDivide(long numerator, long denominator) =>
        numerator % denominator == 0 ? numerator / denominator : (numerator / denominator) + 1;

    /// <summary>The audit accounts for every record, and pins every value a reading fixed.</summary>
    /// <remarks>
    /// The counts hold the audit together. A record that quietly leaves a catalogue, or a
    /// pinned value deleted from a list, moves one of them.
    /// </remarks>
    [Fact]
    public void TheVerificationAuditAccountsForEveryRecord()
    {
        InGameAuditFixture audit = Fixture.InGameAudit;

        Assert.Equal(audit.CatalogueIdentities, ModuleCatalogue.All.Count);
        Assert.Equal(
            audit.CatalogueIdentities, audit.IdentityMatches + audit.RegistryOnlyIdentities);
        Assert.Equal(
            audit.ArmourModulesOutsideNumericVerification,
            ModuleCatalogue.All.Count(module => module.Ship is not null));
        Assert.Equal(
            audit.IdentityMatches,
            audit.NumericModulesVerified + audit.ArmourModulesOutsideNumericVerification);

        HashSet<string> records = new(StringComparer.Ordinal);
        foreach (ModuleStatSpot spot in Fixture.InGameVerifiedValues) records.Add(spot.Symbol);
        foreach (AbsentFieldsFixture absent in Fixture.InGameVerifiedAbsentFields)
        {
            records.Add(absent.Symbol);
        }

        Assert.Equal(audit.VerifiedRecords, records.Count);
        Assert.Equal(
            audit.VerifiedValueFields,
            Fixture.InGameVerifiedValues.Sum(spot => spot.Fields.Count));
        Assert.Equal(
            audit.VerifiedAbsentFields,
            Fixture.InGameVerifiedAbsentFields.Sum(absent => absent.Fields.Count));
        Assert.Equal(audit.VerifiedFields, audit.VerifiedValueFields + audit.VerifiedAbsentFields);

        foreach (KeyValuePair<string, int> entry in audit.CatalogueFieldCounts)
        {
            Assert.True(Enum.TryParse(entry.Key, ignoreCase: true, out ModuleStat stat));
            Assert.Equal(entry.Value, ModuleCatalogue.All.Count(module => module.Stats.Has(stat)));
        }
    }

    [Fact]
    public void EveryStatABlueprintScalesIsCarriedByItsWholeFamily()
    {
        foreach (KeyValuePair<string, int> entry in Fixture.StatCounts.Counts)
        {
            Assert.True(Enum.TryParse(entry.Key, ignoreCase: true, out ModuleStat stat));
            Assert.Equal(entry.Value, ModuleCatalogue.All.Count(module => module.Stats.Has(stat)));
        }
    }

    [Fact]
    public void AContinuousFireWeaponCarriesNoRateOfFire()
    {
        foreach (string symbol in Fixture.ContinuousFire)
        {
            Assert.Null(ModuleCatalogue.FindBySymbol(symbol)!.Stats[ModuleStat.RateOfFire]);
        }
    }

    [Fact]
    public void TheOverchargeDriveLineIsExactlyTheFixturesSet()
    {
        List<string> flagged =
            [.. ModuleCatalogue.All.Where(m => m.SupercruiseOvercharge).Select(m => m.Symbol)];
        Assert.Equal(Fixture.SupercruiseOvercharge.Count, flagged.Count);
        Assert.Equal([.. Fixture.SupercruiseOvercharge.Symbols.OrderBy(s => s, StringComparer.Ordinal)],
            flagged.OrderBy(s => s, StringComparer.Ordinal));
    }

    [Fact]
    public void TheRecordsWithoutIntegrityAreExactlyTheFixturesSet()
    {
        List<string> without =
        [
            .. ModuleCatalogue.All
                .Where(module => module.Ship is null && !module.Stats.Has(ModuleStat.Integrity))
                .Select(module => module.Symbol),
        ];
        Assert.Equal(Fixture.WithoutIntegrity.Count, without.Count);
        Assert.Equal([.. Fixture.WithoutIntegrity.Symbols.OrderBy(s => s, StringComparer.Ordinal)],
            without.OrderBy(s => s, StringComparer.Ordinal));
    }

    [Fact]
    public void EveryPassengerCabinCarriesItsBerths()
    {
        Assert.Equal(
            Fixture.CabinCapacity.Count,
            ModuleCatalogue.All.Count(module => module.Stats.Has(ModuleStat.CabinCapacity)));
        foreach (ModuleStatSpot cabin in Fixture.CabinCapacity.Records)
        {
            AssertFields(cabin, ModuleCatalogue.FindBySymbol(cabin.Symbol)!);
        }
    }

    private static void AssertFields(ModuleStatSpot expected, OutfittingModule module)
    {
        foreach (KeyValuePair<string, JsonElement> field in expected.Fields)
        {
            switch (field.Key)
            {
                case "name":
                    Assert.Equal(field.Value.GetString(), module.Name);
                    break;
                case "ship":
                    Assert.Equal(field.Value.GetString(), module.Ship);
                    break;
                case "cost":
                    Assert.Equal(field.Value.GetInt64(), module.Cost);
                    break;
                case "alwaysPowered":
                    Assert.Equal(field.Value.GetBoolean(), module.AlwaysPowered);
                    break;
                case "guardianZoneResistance":
                    Assert.Equal(field.Value.GetBoolean(), module.GuardianZoneResistance);
                    break;
                case "supercruiseOvercharge":
                    Assert.Equal(field.Value.GetBoolean(), module.SupercruiseOvercharge);
                    break;
                case "restrictedToShips":
                    Assert.Equal(
                        field.Value.EnumerateArray().Select(item => item.GetString()),
                        module.RestrictedToShips);
                    break;
                case "damageDistribution":
                    AssertDistribution(field.Value, module.DamageDistribution);
                    break;
                case "damageComponents":
                    AssertComponents(field.Value, module.DamageComponents);
                    break;
                case "projectileRange":
                    AssertProjectileRange(field.Value, module.ProjectileRange);
                    break;
                default:
                    Assert.True(Enum.TryParse(field.Key, ignoreCase: true, out ModuleStat stat), field.Key);
                    Assert.Equal(field.Value.GetDouble(), module.Stats[stat]!.Value, 9);
                    break;
            }
        }
    }

    private static void AssertDistribution(JsonElement expected, DamageDistribution? actual)
    {
        Assert.NotNull(actual);
        foreach (JsonProperty share in expected.EnumerateObject())
        {
            Assert.Equal(share.Value.GetDouble(), Share(actual!, share.Name)!.Value, 9);
        }
    }

    private static void AssertProjectileRange(JsonElement expected, ProjectileRangeBoundaries? actual)
    {
        Assert.NotNull(actual);
        Assert.Equal(expected.GetProperty("falloffBoundary").GetDouble(), actual!.FalloffBoundary, 9);
        if (expected.TryGetProperty("maximumBoundary", out JsonElement maximum))
        {
            Assert.Equal(maximum.GetDouble(), actual.MaximumBoundary!.Value, 9);
        }
    }

    private static void AssertComponents(JsonElement expected, DamageComponents? actual)
    {
        Assert.NotNull(actual);
        foreach (JsonProperty amount in expected.EnumerateObject())
        {
            if (amount.Name == "unclassified")
            {
                Assert.Equal(
                    amount.Value.EnumerateArray().Select(item => item.GetDouble()),
                    actual!.Unclassified);
                continue;
            }

            Assert.Equal(amount.Value.GetDouble(), Component(actual!, amount.Name)!.Value, 9);
        }
    }

    private static double? Share(DamageDistribution distribution, string name) => name switch
    {
        "kinetic" => distribution.Kinetic,
        "thermal" => distribution.Thermal,
        "explosive" => distribution.Explosive,
        "absolute" => distribution.Absolute,
        "unclassified" => distribution.Unclassified,
        "antiXeno" => distribution.AntiXeno,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, "Not a damage share."),
    };

    private static double? Component(DamageComponents components, string name) => name switch
    {
        "kinetic" => components.Kinetic,
        "thermal" => components.Thermal,
        "explosive" => components.Explosive,
        "absolute" => components.Absolute,
        "antiXeno" => components.AntiXeno,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, "Not a damage component."),
    };

    private static IReadOnlyList<OutfittingModule> CatalogueNamed(string name) => name switch
    {
        "core" => ModuleCatalogue.Core,
        "internal" => ModuleCatalogue.Internal,
        "hardpoint" => ModuleCatalogue.Hardpoint,
        "utility" => ModuleCatalogue.Utility,
        _ => ModuleCatalogue.All,
    };
}
