using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The engineering calculator and its catalogues, measured against the shared fixture.</summary>
public class EngineeringTests
{
    private static readonly EngineeringFixture Fixture =
        SharedFixtures.Load<EngineeringFixture>("fixtures/ships/engineering.jsonc");

    private static readonly CultureInfo Culture = CultureInfo.InvariantCulture;

    public static TheoryData<int> ScannerCollisions() => Positions(Fixture.ScannerIdCollision.Cases.Count);

    public static TheoryData<int> OverchargedCollisions() =>
        Positions(Fixture.OverchargedIdCollision.Cases.Count);

    public static TheoryData<int> ClipRoundings() => Positions(Fixture.ClipRounding.Cases.Count);

    public static TheoryData<string, string> JournalSpellings()
    {
        TheoryData<string, string> data = [];
        foreach (ModuleBlueprintFixture spelling in Fixture.JournalSpellings.Cases)
        {
            data.Add(spelling.Symbol, spelling.Blueprint);
        }

        return data;
    }

    public static TheoryData<int> MercCoinClimbs() => Positions(Fixture.MercCoinCosts.Climbs.Count);

    [Fact]
    public void TheAnchorRecipeFoldsToItsPinnedValues()
    {
        RolledRecipeFixture anchor = Fixture.Anchor;
        BlueprintGrade grade = Grade(anchor.Blueprint, anchor.Grade);
        ExperimentalEffect? effect = ExperimentalEffectCatalogue.Find(anchor.Experimental);
        Assert.NotNull(effect);

        IReadOnlyList<EngineeringModifier> modifiers =
            Engineering.ComputeModifiers(anchor.Base, grade, anchor.Quality, effect);

        // The anchor states its results to the six places a journal serializes.
        AssertValues(anchor.Expected, modifiers, 5e-7);
    }

    [Fact]
    public void AnArticleSoldEngineeredClimbsFromTheGradeItArrivesAt()
    {
        RolledRecipeFixture climb = Fixture.PreEngineeredClimb;

        // The article is sold carrying the recipe, at the grade the sale gives it.
        PreEngineeredVariant sold =
            Assert.Single(PreEngineeredCatalogue.VariantsFor(climb.Symbol));
        Assert.Equal(climb.Blueprint, sold.BlueprintSymbol, ignoreCase: true);
        Assert.Equal(climb.SoldAtGrade, sold.Grade);

        // The article arrives at that grade, so its recipe defines the grades above it only.
        // Asking for the sale grade is asking to recreate the purchase, which no recipe can do.
        Assert.Equal(climb.SoldAtGrade, climb.GradeUnavailable);
        Assert.Null(BlueprintCatalogue.FindGrade(climb.Blueprint, climb.GradeUnavailable!.Value));

        IReadOnlyList<EngineeringModifier> modifiers = Engineering.ComputeModifiers(
            climb.Base, Grade(climb.Blueprint, climb.Grade), climb.Quality);

        // The climb states its results to three places.
        AssertValues(climb.Expected, modifiers, 1e-3);
    }

    [Theory]
    [MemberData(nameof(ScannerCollisions))]
    public void AScannerNameResolvesAgainstTheFittedModule(int position) =>
        AssertCollision(Fixture.ScannerIdCollision, position);

    [Theory]
    [MemberData(nameof(OverchargedCollisions))]
    public void AnOverchargedNameResolvesAgainstTheFittedModule(int position) =>
        AssertCollision(Fixture.OverchargedIdCollision, position);

    [Fact]
    public void AMenuNeverGainsTheOtherRecipeOfAPair()
    {
        foreach (CollisionFixture collision in new[] { Fixture.ScannerIdCollision, Fixture.OverchargedIdCollision })
        {
            foreach (ModuleBlueprintFixture refused in collision.Refused)
            {
                Assert.DoesNotContain(
                    EngineeringOptions.BlueprintsFor(refused.Symbol),
                    offered => string.Equals(offered, refused.Blueprint, StringComparison.OrdinalIgnoreCase));
                Assert.Equal(
                    refused.Blueprint,
                    BlueprintJournal.ResolveForModule(refused.Symbol, refused.Blueprint));
            }
        }
    }

    /// <summary>
    /// Shows the round-up does work. The recipe's own arithmetic, before anything rounds
    /// it, is the figure the fixture pins as the unrounded clip. What the rule says is
    /// stated here without reading how the library implements it: a whole number of
    /// bursts, never below the roll, and never a whole burst above it.
    /// </summary>
    private static void AssertRoundsToWholeBursts(
        ClipRoundingCaseFixture rounding, BlueprintGrade grade)
    {
        BlueprintFeature scale =
            grade.Features.First(feature => feature.Label == "AmmoClipSize");
        double roll = scale.Min + ((scale.Max - scale.Min) * rounding.Quality);
        Assert.Equal(
            rounding.UnroundedAmmoClipSize, rounding.BaseAmmoClipSize * (1 + roll), 6);

        if (rounding.AmmoClipSize == rounding.BaseAmmoClipSize)
        {
            // A roll that moves the clip nowhere leaves it where it was, whether or not
            // that is a whole number of bursts.
            Assert.Equal(rounding.BaseAmmoClipSize, rounding.UnroundedAmmoClipSize);
            return;
        }

        double bursts = rounding.AmmoClipSize / rounding.BurstSize;
        Assert.Equal(Math.Round(bursts), bursts);

        // Never below the roll, bar what the multiplier's own third decimal is worth on
        // this weapon's clip. That fraction is the only one a published figure may be out
        // by.
        Assert.True(
            rounding.AmmoClipSize
                >= rounding.UnroundedAmmoClipSize - (rounding.BaseAmmoClipSize * 5e-4),
            $"{rounding.Symbol}: the clip rounded below the roll.");
        Assert.True(
            rounding.AmmoClipSize - rounding.UnroundedAmmoClipSize < rounding.BurstSize,
            $"{rounding.Symbol}: the clip rounded up by a whole burst or more.");
    }

    [Theory]
    [MemberData(nameof(ClipRoundings))]
    public void AComputedClipHoldsWholeBursts(int position)
    {
        ClipRoundingCaseFixture rounding = Fixture.ClipRounding.Cases[position];
        OutfittingModule module = Module(rounding.Symbol);
        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(module);
        Assert.Equal(rounding.BaseAmmoClipSize, baseStats["AmmoClipSize"], 9);

        BlueprintGrade grade = Grade(rounding.Blueprint, rounding.Grade);
        IReadOnlyList<EngineeringModifier> modifiers =
            Engineering.ComputeModifiers(baseStats, grade, rounding.Quality);

        Assert.Equal(rounding.AmmoClipSize, Value(modifiers, "AmmoClipSize"), 9);
        AssertRoundsToWholeBursts(rounding, grade);
        if (rounding.AmmoMaximum.HasValue)
        {
            Assert.Equal(rounding.AmmoMaximum.Value, Value(modifiers, "AmmoMaximum"), 9);
        }

        double? rolledBurst = modifiers.FirstOrDefault(modifier => modifier.Label == "BurstSize")?.Value;
        switch (rounding.BurstFrom)
        {
            case "recipe":
                Assert.Equal(rounding.BurstSize, rolledBurst!.Value, 9);
                break;
            case "module":
                Assert.Null(rolledBurst);
                Assert.Equal(rounding.BurstSize, baseStats["BurstSize"], 9);
                break;
            default:
                Assert.Null(rolledBurst);
                Assert.Equal(1, rounding.BurstSize);
                break;
        }
    }

    [Theory]
    [MemberData(nameof(JournalSpellings))]
    public void AJournalSpellingReachesTheRecordItNames(string symbol, string blueprint)
    {
        ModuleBlueprintFixture spelling = Fixture.JournalSpellings.Cases
            .Single(candidate => candidate.Symbol == symbol && candidate.Blueprint == blueprint);
        string resolved = BlueprintJournal.ResolveForModule(symbol, blueprint);

        Assert.Equal(spelling.Resolved, resolved);
        Assert.NotNull(BlueprintCatalogue.Find(resolved));
    }

    [Fact]
    public void AnOperationsRecipeIsKeyedAsTheRegistryPublishesIt()
    {
        Assert.Empty(Fixture.JournalSpellings.OperationsKeys.Prefixed);
        foreach (RolledRecipeFixture observed in Fixture.JournalSpellings.OperationsKeys.Observed)
        {
            Blueprint? blueprint = BlueprintCatalogue.Find(observed.Blueprint);
            Assert.NotNull(blueprint);

            // Every lookup matches case-insensitively, so the lower-cased export spelling
            // reaches the same record.
            Assert.Same(blueprint, BlueprintCatalogue.Find(observed.Blueprint.ToLowerInvariant()));
            Assert.Contains(observed.Grade, blueprint.Grades.Keys);

            // The recipe starts above the grade the article is sold at.
            Assert.DoesNotContain(observed.SoldAtGrade!.Value, blueprint.Grades.Keys);
        }
    }

    [Fact]
    public void TheCollisionCatalogueNamesEveryClashingSpelling()
    {
        Assert.Equal(
            Fixture.JournalNames.Map.OrderBy(entry => entry.Key, StringComparer.Ordinal),
            BlueprintJournal.Names.OrderBy(entry => entry.Key, StringComparer.Ordinal));
        foreach (string key in Fixture.JournalNames.Map.Keys) Assert.NotNull(BlueprintCatalogue.Find(key));
    }

    [Fact]
    public void AntiGuardianZoneResistanceGrantsACapabilityRatherThanANumber()
    {
        CapabilityFixture capability = Fixture.GuardianZoneResistanceCapability;
        foreach (ModuleBlueprintFixture granted in capability.Cases)
        {
            Assert.Contains(
                EngineeringOptions.BlueprintsFor(granted.Symbol),
                offered => string.Equals(offered, capability.OfferedAs, StringComparison.OrdinalIgnoreCase));

            OutfittingModule module = Module(granted.Symbol);
            IReadOnlyList<EngineeringModifier> modifiers = Engineering.ComputeModifiers(
                ModuleStatLabels.BaseStats(module), Grade(granted.Blueprint, capability.Grade));

            EngineeringModifier modifier = Assert.Single(modifiers);
            Assert.Equal(capability.Modifier.Label, modifier.Label);
            Assert.Equal(capability.Modifier.ValueStr, modifier.ValueStr);
            Assert.Null(modifier.Value);
            Assert.Null(modifier.OriginalValue);
        }

        Assert.DoesNotContain(
            EngineeringOptions.BlueprintsFor(capability.Refused.Symbol),
            offered => string.Equals(offered, capability.Refused.Blueprint, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void AModificationFamilyThatIsABlueprintIsNoExperimentalEffect()
    {
        foreach (KeyValuePair<string, ExcludedExperimentalFixture> excluded
            in Fixture.BlueprintOnlyModifications.ExcludedExperimentalIds)
        {
            Assert.Null(ExperimentalEffectCatalogue.Find(excluded.Key));
            foreach (KeyValuePair<string, string> blueprint in excluded.Value.Blueprints)
            {
                Assert.Equal(blueprint.Value, BlueprintCatalogue.Find(blueprint.Key)?.Name);
            }
        }
    }

    [Fact]
    public void AnEffectCarriesItsInGameName()
    {
        foreach (KeyValuePair<string, string> named in Fixture.ExperimentalNames.Map)
        {
            Assert.Equal(named.Value, ExperimentalEffectCatalogue.Find(named.Key)?.Name);
        }
    }

    [Fact]
    public void AConvertingEffectStatesItsFixedSplit()
    {
        foreach (KeyValuePair<string, Dictionary<string, double>> split
            in Fixture.ExperimentalDamageDistributions.Map)
        {
            ExperimentalEffect? effect = ExperimentalEffectCatalogue.Find(split.Key);
            AssertDistribution(split.Value, effect?.DamageDistribution);
        }
    }

    [Fact]
    public void ThePlasmaConversionRecipesShareOneSplitPerGrade()
    {
        ThermalPlasmaFixture conversions = Fixture.ThermalPlasmaConversions;
        foreach (KeyValuePair<string, string> conversion in conversions.Blueprints)
        {
            Assert.Contains(
                EngineeringOptions.BlueprintsFor(conversion.Value),
                offered => string.Equals(offered, conversion.Key, StringComparison.OrdinalIgnoreCase));
            foreach (KeyValuePair<string, Dictionary<string, double>> grade in conversions.Grades)
            {
                BlueprintGrade rolled = Grade(conversion.Key, int.Parse(grade.Key, Culture));
                AssertDistribution(grade.Value, rolled.DamageDistribution);
            }
        }
    }

    [Fact]
    public void TheCataloguesCarryEveryRecipeAndEffect()
    {
        Assert.Equal(Fixture.BlueprintCount, BlueprintCatalogue.All.Count);
        Assert.Equal(Fixture.ExperimentalCount, ExperimentalEffectCatalogue.All.Count);
    }

    [Fact]
    public void MercCoinIsChargedPerRoll()
    {
        Assert.Equal(Fixture.MercCoinCosts.PerRoll.Count, BlueprintCosts.MercCoinCosts.Count);
        foreach (KeyValuePair<string, Dictionary<string, int>> recipe in Fixture.MercCoinCosts.PerRoll)
        {
            IReadOnlyDictionary<int, int> charged = BlueprintCosts.MercCoinCosts[recipe.Key];
            Assert.Equal(recipe.Value.Count, charged.Count);
            foreach (KeyValuePair<string, int> grade in recipe.Value)
            {
                int number = int.Parse(grade.Key, Culture);
                Assert.Equal(grade.Value, charged[number]);
                Assert.Equal(grade.Value, BlueprintCosts.FindGradeCost(recipe.Key, number)!.MercCoins);
            }
        }
    }

    [Theory]
    [MemberData(nameof(MercCoinClimbs))]
    public void AClimbWeightsEachGradeByItsRolls(int position)
    {
        MercCoinClimbFixture climb = Fixture.MercCoinCosts.Climbs[position];
        BlueprintCost? cost = BlueprintCosts.FindClimbCost(climb.Blueprint, climb.Grade, climb.CurrentGrade);

        Assert.NotNull(cost);
        Assert.Equal(climb.MercCoin, cost.MercCoins);
    }

    [Fact]
    public void ARecipeThatChargesNoCurrencyStillReportsBothHalvesOfItsCost()
    {
        BlueprintCost? roll = BlueprintCosts.FindGradeCost("FSD_LongRange", 5);

        Assert.NotNull(roll);
        Assert.NotEmpty(roll.Materials);
        Assert.Equal(0, roll.MercCoins);
        Assert.DoesNotContain("FSD_LongRange", BlueprintCosts.MercCoinCosts.Keys);
    }

    [Fact]
    public void AClimbSumsTheMaterialsOfEveryGradeItCovers()
    {
        BlueprintCost whole = BlueprintCosts.FindClimbCost("FSD_LongRange", 5)!;
        BlueprintCost remaining = BlueprintCosts.FindClimbCost("FSD_LongRange", 5, 4)!;
        IReadOnlyList<EngineeringMaterial> grade5 = BlueprintCosts.Find("FSD_LongRange")![5];

        // Grade 5 takes five rolls, and the whole climb covers every grade below it as well.
        foreach (EngineeringMaterial material in grade5)
        {
            EngineeringMaterial charged = remaining.Materials.Single(
                entry => entry.Symbol == material.Symbol);
            Assert.Equal(material.Count * 5, charged.Count);
        }

        Assert.True(Total(whole.Materials) > Total(remaining.Materials));
        Assert.Empty(BlueprintCosts.FindClimbCost("FSD_LongRange", 5, 5)!.Materials);
    }

    [Fact]
    public void EveryPricedRecipeIsARecipeTheMechanicsCatalogueCarries()
    {
        foreach (KeyValuePair<string, IReadOnlyDictionary<int, IReadOnlyList<EngineeringMaterial>>> priced
            in BlueprintCosts.All)
        {
            Blueprint? blueprint = BlueprintCatalogue.Find(priced.Key);
            Assert.NotNull(blueprint);
            Assert.Equal(
                blueprint.Grades.Keys.OrderBy(grade => grade),
                priced.Value.Keys.OrderBy(grade => grade));
        }

        foreach (string charging in BlueprintCosts.MercCoinCosts.Keys)
        {
            Assert.NotNull(BlueprintCosts.Find(charging));
        }
    }

    [Fact]
    public void EveryEffectIsPricedAndEveryPriceNamesAnEffect()
    {
        Assert.Equal(ExperimentalEffectCatalogue.All.Count, ExperimentalEffectCosts.All.Count);
        foreach (string effect in ExperimentalEffectCatalogue.All.Keys)
        {
            Assert.NotEmpty(ExperimentalEffectCosts.Find(effect)!);
        }
    }

    [Fact]
    public void MaterialsFoldTogetherBySymbol()
    {
        IReadOnlyList<EngineeringMaterial> summed = Engineering.SumMaterials(
            BlueprintCosts.FindClimbCost("FSD_LongRange", 5)!.Materials,
            ExperimentalEffectCosts.Find("special_fsd_heavy")!,
            []);

        Assert.Equal(
            summed.Select(material => material.Symbol.ToLowerInvariant()).Distinct().Count(),
            summed.Count);
        Assert.Equal(
            Total(BlueprintCosts.FindClimbCost("FSD_LongRange", 5)!.Materials)
                + Total(ExperimentalEffectCosts.Find("special_fsd_heavy")!),
            Total(summed));
    }

    [Fact]
    public void AnUnknownRecipeOrGradeIsAMissRatherThanAFailure()
    {
        Assert.Null(BlueprintCatalogue.Find("not_a_blueprint"));
        Assert.Null(BlueprintCatalogue.Find(null));
        Assert.Null(ExperimentalEffectCatalogue.Find("not_an_effect"));
        Assert.Null(ExperimentalEffectCosts.Find("not_an_effect"));

        // A fixed reward identity has mechanics and no ordinary craft route.
        Assert.NotNull(BlueprintCatalogue.Find("CargoRack_IncreasedCapacity"));
        Assert.Null(BlueprintCosts.Find("CargoRack_IncreasedCapacity"));
        Assert.Null(BlueprintCosts.FindClimbCost("not_a_blueprint", 5));

        // An article sold at grade 1 has no grade 1 recipe to recreate the purchase with.
        Assert.Null(BlueprintCosts.FindGradeCost("ModuleReinforcement_HeavyDuty", 1));
        Assert.Null(BlueprintCosts.FindClimbCost("ModuleReinforcement_HeavyDuty", 1));
    }

    [Fact]
    public void AGradeOutsideTheRangeIsRefused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => BlueprintCatalogue.FindGrade("FSD_LongRange", 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => BlueprintCatalogue.FindGrade("FSD_LongRange", 6));
        Assert.Throws<ArgumentOutOfRangeException>(() => BlueprintCosts.FindGradeCost("FSD_LongRange", 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => BlueprintCosts.FindClimbCost("FSD_LongRange", 6));
        Assert.Throws<ArgumentOutOfRangeException>(() => BlueprintCosts.FindClimbCost("FSD_LongRange", 5, 6));
    }

    [Fact]
    public void AQualityOutsideTheRollIsRefused()
    {
        BlueprintGrade grade = Grade("FSD_LongRange", 5);
        Dictionary<string, double> baseStats = new() { ["FSDOptimalMass"] = 4670 };

        Assert.Throws<ArgumentOutOfRangeException>(
            () => Engineering.ComputeModifiers(baseStats, grade, -0.001));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Engineering.ComputeModifiers(baseStats, grade, 1.001));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Engineering.ComputeModifiers(baseStats, grade, double.NaN));
        Assert.Throws<ArgumentOutOfRangeException>(
            () => Engineering.ComputeModifiers(baseStats, grade, double.PositiveInfinity));
    }

    [Fact]
    public void AWorstRollAndABestRollAreTheStatedEndpoints()
    {
        BlueprintFeature feature = new("Mass", ModifierMethod.Multiplicative, 0.5, 1);
        Dictionary<string, double> baseStats = new() { ["Mass"] = 10 };

        Assert.Equal(15, Engineering.ComputeModifiers(baseStats, [feature], 0)[0].Value);
        Assert.Equal(20, Engineering.ComputeModifiers(baseStats, [feature], 1)[0].Value);
        Assert.Equal(17.5, Engineering.ComputeModifiers(baseStats, [feature], 0.5)[0].Value);
    }

    [Fact]
    public void AStatTheModuleLacksIsSetOrAddedToButNeverScaled()
    {
        Dictionary<string, double> nothing = [];

        Assert.Empty(Engineering.ComputeModifiers(
            nothing, [new BlueprintFeature("Mass", ModifierMethod.Multiplicative, 0.1, 0.1)]));

        EngineeringModifier added = Assert.Single(Engineering.ComputeModifiers(
            nothing, [new BlueprintFeature("Jitter", ModifierMethod.Additive, 1.5, 1.5)]));
        Assert.Equal(1.5, added.Value);
        Assert.Null(added.OriginalValue);

        EngineeringModifier set = Assert.Single(Engineering.ComputeModifiers(
            nothing, [new BlueprintFeature("BurstSize", ModifierMethod.Overwrite, 2, 2)]));
        Assert.Equal(2, set.Value);
    }

    [Fact]
    public void APercentageOfAMultiplierCompoundsOnThatMultiplier()
    {
        // An eighty percent hull boost engineered by a thirty-two percent recipe reads 137.6
        // percent, because the multiplier 1.8 is what gets multiplied by 1.32.
        Dictionary<string, double> bulkhead = new() { ["DefenceModifierHealthMultiplier"] = 80 };
        EngineeringModifier boosted = Assert.Single(Engineering.ComputeModifiers(
            bulkhead,
            [new BlueprintFeature("DefenceModifierHealthMultiplier", ModifierMethod.Multiplicative, 0.32, 0.32)]));

        Assert.Equal(137.6, boosted.Value!.Value, 3);
        Assert.Equal(80, boosted.OriginalValue!.Value, 3);

        // A package that carries no hull boost has one all the same: no boost is a multiplier of
        // one, so the recipe's bonus is the whole result and the journal reports a zero original.
        EngineeringModifier granted = Assert.Single(Engineering.ComputeModifiers(
            new Dictionary<string, double>(),
            [new BlueprintFeature("DefenceModifierHealthMultiplier", ModifierMethod.Multiplicative, 0.24, 0.24)]));

        Assert.Equal(24, granted.Value!.Value, 4);
        Assert.Equal(0, granted.OriginalValue!.Value);
    }

    [Fact]
    public void AComputedModifierCarriesTheFloatBehindItsSerializedValue()
    {
        EngineeringModifier modifier = Assert.Single(Engineering.ComputeModifiers(
            new Dictionary<string, double> { ["Mass"] = 1.3 },
            [new BlueprintFeature("Mass", ModifierMethod.Multiplicative, 0.6, 0.6)]));

        Assert.NotNull(modifier.StoredValue);
        Assert.Equal(modifier.StoredValue, modifier.PreciseValue);

        // A modifier read off a capture carries the six decimal places it was written with.
        EngineeringModifier stated = new("Mass", 2.08);
        Assert.Equal(2.08, stated.PreciseValue);
    }

    [Fact]
    public void ALongRangeFalloffFlagResolvesToTheWeaponsRange()
    {
        BlueprintFeature flag = new("FalloffRange", ModifierMethod.Overwrite, 1, 1);
        BlueprintFeature range = new("MaximumRange", ModifierMethod.Multiplicative, 1, 1);

        // The flag is stored as a sentinel between zero and one, so it resolves to the modified
        // maximum range rather than putting the falloff a metre from the muzzle.
        IReadOnlyList<EngineeringModifier> ranged = Engineering.ComputeModifiers(
            new Dictionary<string, double> { ["MaximumRange"] = 3000, ["FalloffRange"] = 1800 },
            [range, flag]);
        Assert.Equal(6000, Value(ranged, "FalloffRange"));

        // A weapon with no maximum range has nothing to resolve the flag against, so the leg is
        // dropped rather than shipped as the raw sentinel.
        IReadOnlyList<EngineeringModifier> rangeless = Engineering.ComputeModifiers(
            new Dictionary<string, double> { ["FalloffRange"] = 1800 }, [flag]);
        Assert.Empty(rangeless);
    }

    private static TheoryData<int> Positions(int count)
    {
        TheoryData<int> data = [];
        for (int position = 0; position < count; position++) data.Add(position);
        return data;
    }

    private static void AssertCollision(CollisionFixture collision, int position)
    {
        CollisionCaseFixture rolled = collision.Cases[position];
        string resolved = BlueprintJournal.ResolveForModule(rolled.Symbol, rolled.Blueprint);

        Assert.Equal(rolled.Resolved, resolved);
        IReadOnlyList<EngineeringModifier> modifiers = Engineering.ComputeModifiers(
            rolled.Base, Grade(resolved, collision.Grade), collision.Quality);

        Assert.Equal(rolled.Modifiers.Count, modifiers.Count);
        for (int at = 0; at < modifiers.Count; at++)
        {
            Assert.Equal(rolled.Modifiers[at].Label, modifiers[at].Label);
            Assert.Equal(rolled.Modifiers[at].Value!.Value, modifiers[at].Value!.Value, 6);
            Assert.Equal(rolled.Modifiers[at].OriginalValue!.Value, modifiers[at].OriginalValue!.Value, 6);
        }
    }

    private static void AssertValues(
        Dictionary<string, double> expected,
        IReadOnlyList<EngineeringModifier> modifiers,
        double tolerance)
    {
        Assert.Equal(expected.Count, modifiers.Count);
        foreach (KeyValuePair<string, double> stat in expected)
        {
            Assert.Equal(stat.Value, Value(modifiers, stat.Key), tolerance);
        }
    }

    private static void AssertDistribution(Dictionary<string, double> expected, DamageDistribution? actual)
    {
        Assert.NotNull(actual);
        Assert.Equal(Share(expected, "kinetic"), actual.Kinetic);
        Assert.Equal(Share(expected, "thermal"), actual.Thermal);
        Assert.Equal(Share(expected, "explosive"), actual.Explosive);
        Assert.Equal(Share(expected, "absolute"), actual.Absolute);
    }

    private static double? Share(Dictionary<string, double> shares, string type) =>
        shares.TryGetValue(type, out double share) ? share : null;

    private static double Value(IReadOnlyList<EngineeringModifier> modifiers, string label) =>
        modifiers.Single(modifier => modifier.Label == label).Value!.Value;

    private static int Total(IReadOnlyList<EngineeringMaterial> materials) =>
        materials.Sum(material => material.Count);

    private static BlueprintGrade Grade(string blueprint, int grade)
    {
        BlueprintGrade? found = BlueprintCatalogue.FindGrade(blueprint, grade);
        Assert.NotNull(found);
        return found;
    }

    private static OutfittingModule Module(string symbol)
    {
        OutfittingModule? found = ModuleCatalogue.FindBySymbol(symbol);
        Assert.NotNull(found);
        return found;
    }
}
