using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>The catalogue adapters a build reads engineering through.</summary>
public class LoadoutEngineeringTests
{
    private const string Multicannon = "Hpt_MultiCannon_Fixed_Medium";
    private const string BeamLaser = "Hpt_BeamLaser_Fixed_Medium";
    private const string LifeSupport = "Int_LifeSupport_Size3_Class3";
    private const string GuardianGauss = "Hpt_Guardian_GaussCannon_Fixed_Small";
    private const string SurfaceScanner = "Int_DetailedSurfaceScanner_Tiny";

    private static OutfittingModule Module(string symbol) =>
        ModuleCatalogue.FindBySymbol(symbol)!;

    [Fact]
    public void ARecipeLegOnAStatTheModuleLacksEntirelyIsMissing()
    {
        OutfittingModule beam = Module(BeamLaser);
        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(beam);

        List<string> missing = LoadoutEngineering.MissingBaseLabels(
            beam,
            baseStats,
            [new BlueprintFeature("NotAStatAnyModuleHas", ModifierMethod.Multiplicative, 0.1, 0.2)]);

        Assert.Equal(["NotAStatAnyModuleHas"], missing);
    }

    [Fact]
    public void ARecipeLegOnAStatTheModuleModelsIsPresentEvenWithNoBaseValue()
    {
        OutfittingModule beam = Module(BeamLaser);
        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(beam);

        // Long Range scales a projectile's shot speed. A beam laser carries the stat and no
        // value for it, so the leg is inert rather than unanswerable.
        Assert.DoesNotContain("ShotSpeed", baseStats.Keys);
        Assert.Empty(LoadoutEngineering.MissingBaseLabels(
            beam,
            baseStats,
            [new BlueprintFeature("ShotSpeed", ModifierMethod.Multiplicative, 0.1, 0.2)]));
    }

    [Fact]
    public void AMissingLabelIsReportedOnceHoweverManyLegsNameIt()
    {
        OutfittingModule beam = Module(BeamLaser);
        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(beam);

        List<string> missing = LoadoutEngineering.MissingBaseLabels(
            beam,
            baseStats,
            [
                new BlueprintFeature("NotAStat", ModifierMethod.Multiplicative, 0.1, 0.2),
                new BlueprintFeature("NotAStat", ModifierMethod.Multiplicative, 0.3, 0.4),
            ],
            [new ExperimentalContribution("NotAStat", ModifierMethod.Multiplicative, 0.5)]);

        Assert.Equal(["NotAStat"], missing);
    }

    [Fact]
    public void AnExperimentalLegIsCheckedBesideTheRecipesOwn()
    {
        OutfittingModule beam = Module(BeamLaser);
        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(beam);

        Assert.Equal(
            ["OnlyTheEffectNamesThis"],
            LoadoutEngineering.MissingBaseLabels(
                beam,
                baseStats,
                [],
                [new ExperimentalContribution("OnlyTheEffectNamesThis", ModifierMethod.Multiplicative, 0.5)]));
    }

    [Fact]
    public void TheOrdinaryMenuComesBeforeAMercenaryRecipe()
    {
        List<KeyValuePair<string, BlueprintRoute>> routes =
            LoadoutEngineering.BlueprintRoutesFor(Multicannon);

        Assert.NotEmpty(routes);

        int firstMercenary = routes.FindIndex(route => route.Value == BlueprintRoute.Mercenary);
        int lastOrdinary = routes.FindLastIndex(route => route.Value == BlueprintRoute.Ordinary);
        Assert.True(firstMercenary > lastOrdinary, "A Mercenary recipe comes after every menu one.");

        // The Merc-Coin shop sells this weapon carrying a recipe no engineer lists.
        Assert.Contains(
            routes,
            route => route.Key == "MultiCannon_Rapid" && route.Value == BlueprintRoute.Mercenary);
    }

    [Fact]
    public void AModuleWithNoMercenaryFormOffersItsMenuAlone()
    {
        Assert.All(
            LoadoutEngineering.BlueprintRoutesFor(LifeSupport),
            route => Assert.Equal(BlueprintRoute.Ordinary, route.Value));
    }

    [Fact]
    public void ARouteIsNamedOnceHoweverManyWaysItArrives()
    {
        List<KeyValuePair<string, BlueprintRoute>> routes =
            LoadoutEngineering.BlueprintRoutesFor(Multicannon);

        Assert.Equal(routes.Count, routes.Select(route => route.Key).Distinct().Count());
    }

    [Fact]
    public void TheMenusOwnRecipeIsAvailable()
    {
        Assert.True(LoadoutEngineering.BlueprintAvailableFor(Multicannon, "Weapon_LongRange"));
        Assert.False(LoadoutEngineering.BlueprintAvailableFor(Multicannon, "FSD_LongRange"));
    }

    [Fact]
    public void ARecipeIdentifierIsReadWithoutRegardToCaseOrSpacing()
    {
        Assert.True(LoadoutEngineering.BlueprintAvailableFor(Multicannon, "  weapon_longrange  "));
    }

    [Fact]
    public void AGenericSpellingStandsInForTheFamilysOwn()
    {
        // The menu lists the life support's own lightweight recipe. A build authored elsewhere
        // writes the family-agnostic identifier for the same modification.
        Assert.True(LoadoutEngineering.BlueprintAvailableFor(LifeSupport, "Misc_LightWeight"));
    }

    [Fact]
    public void AGenericSpellingDoesNotStandInForAnUnrelatedModification()
    {
        Assert.False(LoadoutEngineering.BlueprintAvailableFor(LifeSupport, "Misc_ChaffCapacity"));
    }

    [Fact]
    public void AMercenaryRecipeIsAvailableOnTheModuleItIsSoldOn()
    {
        Assert.True(LoadoutEngineering.BlueprintAvailableFor(Multicannon, "MultiCannon_Rapid"));
        Assert.False(LoadoutEngineering.BlueprintAvailableFor(BeamLaser, "MultiCannon_Rapid"));
    }

    [Fact]
    public void AnUnknownRecipeIsAvailableNowhere()
    {
        Assert.False(LoadoutEngineering.BlueprintAvailableFor(Multicannon, "Not_A_Blueprint"));
        Assert.False(LoadoutEngineering.BlueprintAvailableFor("Not_A_Module", "Weapon_LongRange"));
    }

    [Fact]
    public void TheMenusOwnExperimentalEffectIsAvailable()
    {
        string offered = EngineeringOptions.ExperimentalsFor(Multicannon)[0];

        Assert.True(LoadoutEngineering.ExperimentalAvailableFor(Multicannon, "  " + offered + "  "));
        Assert.False(LoadoutEngineering.ExperimentalAvailableFor(Multicannon, "Not_An_Effect"));
    }

    [Fact]
    public void AJournalAliasIsPutIntoItsRecipeSpelling()
    {
        OutfittingModule scanner = Module(SurfaceScanner);
        BlueprintGrade stated = new(
            [new BlueprintFeature("DSS_PatchRadius", ModifierMethod.Multiplicative, 0.1, 0.2)]);

        (BlueprintGrade canonical, ExperimentalEffect? experimental) =
            LoadoutEngineering.PrimitiveInputsFor(scanner, stated, null);

        Assert.Equal("ProbeRadius", Assert.Single(canonical.Features).Label);
        Assert.Null(experimental);
    }

    [Fact]
    public void AnEffectsLabelIsNormalizedBesideTheRecipesOwn()
    {
        OutfittingModule scanner = Module(SurfaceScanner);
        BlueprintGrade stated = new([]);
        ExperimentalEffect effect = new(
            "Probe Reach",
            [new ExperimentalContribution("DSS_PatchRadius", ModifierMethod.Multiplicative, 0.1)]);

        (BlueprintGrade canonical, ExperimentalEffect? normalized) =
            LoadoutEngineering.PrimitiveInputsFor(scanner, stated, effect);

        Assert.Empty(canonical.Features);
        Assert.Equal("ProbeRadius", Assert.Single(normalized!.Modifiers).Label);
    }

    [Fact]
    public void ALabelThatNeedsNoTranslationIsLeftAlone()
    {
        OutfittingModule multicannon = Module(Multicannon);
        BlueprintFeature feature = new("Damage", ModifierMethod.Multiplicative, 0.1, 0.2);
        BlueprintGrade stated = new([feature]);

        (BlueprintGrade canonical, _) =
            LoadoutEngineering.PrimitiveInputsFor(multicannon, stated, null);

        Assert.Same(feature, Assert.Single(canonical.Features));
    }

    [Fact]
    public void AGuardianWeaponCarryingARealRecipeIsAFinalArticle()
    {
        Assert.True(
            LoadoutEngineering.IsFinalGuardianWeaponEngineering(GuardianGauss, "Weapon_RapidFire"));
    }

    [Fact]
    public void AGuardianWeaponsOwnMenuRecipeLeavesItOrdinary()
    {
        string offered = EngineeringOptions.BlueprintsFor(GuardianGauss)[0];

        Assert.False(LoadoutEngineering.IsFinalGuardianWeaponEngineering(GuardianGauss, offered));
    }

    [Fact]
    public void AWeaponThatIsNotGuardianIsNeverAFinalArticleByThisRoute()
    {
        Assert.False(
            LoadoutEngineering.IsFinalGuardianWeaponEngineering(Multicannon, "FSD_LongRange"));
        Assert.False(
            LoadoutEngineering.IsFinalGuardianWeaponEngineering("Not_A_Module", "Weapon_RapidFire"));
    }

    [Fact]
    public void AnUnknownRecipeOnAGuardianWeaponIdentifiesNothing()
    {
        Assert.False(
            LoadoutEngineering.IsFinalGuardianWeaponEngineering(GuardianGauss, "Not_A_Blueprint"));
    }

    [Fact]
    public void AnAvailableRecipePublishesTheGradesItCanRoll()
    {
        List<AvailableBlueprint> available = LoadoutEngineering.AvailableBlueprintsFor(Multicannon);

        AvailableBlueprint longRange = Assert.Single(
            available, entry => entry.BlueprintSymbol == "Weapon_LongRange");
        Assert.Equal([1, 2, 3, 4, 5], longRange.Grades);
        Assert.Equal(BlueprintRoute.Ordinary, longRange.Route);

        AvailableBlueprint rapid = Assert.Single(
            available, entry => entry.BlueprintSymbol == "MultiCannon_Rapid");
        Assert.Equal(BlueprintRoute.Mercenary, rapid.Route);
    }

    [Fact]
    public void AFinalArticleOffersNoRecipeAndNoEffect()
    {
        PreEngineeredVariant locked = Assert.Single(
            PreEngineeredCatalogue.VariantsFor(GuardianGauss),
            variant => variant.EngineeringLocked);
        OutfittingModule article = PreEngineeredStats.Resolve(locked)!;

        Assert.True(article.EngineeringLocked);
        Assert.Empty(LoadoutEngineering.AvailableBlueprintsFor(GuardianGauss, article));
        Assert.Empty(LoadoutEngineering.AvailableExperimentalsFor(GuardianGauss, article));
    }

    [Fact]
    public void AnUnknownModuleOffersNothing()
    {
        Assert.Empty(LoadoutEngineering.AvailableBlueprintsFor("Not_A_Module"));
        Assert.Empty(LoadoutEngineering.AvailableExperimentalsFor("Not_A_Module"));
    }

    [Fact]
    public void AnAvailableEffectIsOneTheMenuOffersAndTheModuleCanStore()
    {
        List<string> available = LoadoutEngineering.AvailableExperimentalsFor(Multicannon);

        Assert.NotEmpty(available);
        Assert.All(
            available,
            symbol => Assert.True(LoadoutEngineering.ExperimentalAvailableFor(Multicannon, symbol)));
    }

    [Fact]
    public void ABlockNamingOnlyStatsTheModuleLacksIsInert()
    {
        OutfittingModule multicannon = Module(Multicannon);

        Assert.True(LoadoutEngineering.StatesInertModifiers(multicannon, []));
        Assert.True(LoadoutEngineering.StatesInertModifiers(
            multicannon, [new EngineeringModifier("ShieldGenStrength", 1, 1)]));
    }

    [Fact]
    public void ABlockNamingOneStatTheModuleCarriesIsTheSourcesOwnAccount()
    {
        OutfittingModule multicannon = Module(Multicannon);

        Assert.False(LoadoutEngineering.StatesInertModifiers(
            multicannon,
            [
                new EngineeringModifier("ShieldGenStrength", 1, 1),
                new EngineeringModifier("Damage", 2, 1),
            ]));
    }

    [Fact]
    public void ADamageShareLabelAlwaysMovesSomething()
    {
        OutfittingModule multicannon = Module(Multicannon);

        Assert.False(LoadoutEngineering.StatesInertModifiers(
            multicannon, [new EngineeringModifier("$Thermal;", 100, 0)]));
    }

    [Fact]
    public void ADamageShareIsWrittenAsAPercentageBesideItsStockShare()
    {
        OutfittingModule multicannon = Module(Multicannon);
        List<EngineeringModifier> modifiers = [];

        LoadoutEngineering.AppendDamageShares(
            modifiers, multicannon, new DamageDistribution(0.4, 0.6, null, null));

        EngineeringModifier thermal = Assert.Single(
            modifiers, modifier => modifier.Label == "$Thermal;");
        Assert.Equal(60, thermal.Value!.Value, 6);

        EngineeringModifier kinetic = Assert.Single(
            modifiers, modifier => modifier.Label == "$Kinetic;");
        Assert.Equal(40, kinetic.Value!.Value, 6);
        Assert.Equal(100, kinetic.OriginalValue!.Value, 6);
    }

    [Fact]
    public void NoConversionWritesNoShares()
    {
        List<EngineeringModifier> modifiers = [];

        LoadoutEngineering.AppendDamageShares(modifiers, Module(Multicannon), null);

        Assert.Empty(modifiers);
    }

    [Fact]
    public void AJournalPresentationTranslatesAModuleSpecificAlias()
    {
        OutfittingModule scanner = Module(SurfaceScanner);

        List<EngineeringModifier> journal = LoadoutEngineering.JournalModifiersFor(
            scanner, [new EngineeringModifier("ProbeRadius", 1.5, 1)]);

        Assert.Equal("DSS_PatchRadius", Assert.Single(journal).Label);
    }

    [Fact]
    public void AContinuousWeaponPublishesItsDamagePerSecondAloneAndNotItsPerRoundDamage()
    {
        OutfittingModule beam = Module(BeamLaser);
        double stock = beam.Stats[ModuleStat.Damage]!.Value;

        List<EngineeringModifier> journal = LoadoutEngineering.JournalModifiersFor(
            beam, [new EngineeringModifier("Damage", stock * 1.2, stock)]);

        EngineeringModifier perSecond = Assert.Single(journal);
        Assert.Equal("DamagePerSecond", perSecond.Label);
        Assert.Equal(stock * 1.2, perSecond.Value!.Value, 4);
    }

    [Fact]
    public void ADiscreteWeaponKeepsItsPerRoundDamageAndGainsADamagePerSecond()
    {
        OutfittingModule multicannon = Module(Multicannon);
        double stock = multicannon.Stats[ModuleStat.Damage]!.Value;

        List<EngineeringModifier> journal = LoadoutEngineering.JournalModifiersFor(
            multicannon, [new EngineeringModifier("Damage", stock * 1.2, stock)]);

        Assert.Contains(journal, modifier => modifier.Label == "Damage");
        EngineeringModifier perSecond = Assert.Single(
            journal, modifier => modifier.Label == "DamagePerSecond");
        Assert.True(perSecond.Value > perSecond.OriginalValue);
    }

    [Fact]
    public void AWeaponThatMovesNeitherDamageNorRateStatesNoDamagePerSecond()
    {
        OutfittingModule multicannon = Module(Multicannon);

        List<EngineeringModifier> journal = LoadoutEngineering.JournalModifiersFor(
            multicannon, [new EngineeringModifier("Mass", 3, 4)]);

        Assert.Equal("Mass", Assert.Single(journal).Label);
    }

    [Fact]
    public void ABurstPatternIsReportedAsTheRateOfFireItProduces()
    {
        OutfittingModule burst = null!;
        foreach (OutfittingModule candidate in ModuleCatalogue.All)
        {
            if (candidate.Stats.Has(ModuleStat.BurstInterval)
                && candidate.Stats[ModuleStat.BurstRounds] > 1
                && candidate.Stats.Has(ModuleStat.Damage))
            {
                burst = candidate;
                break;
            }
        }

        Assert.NotNull(burst);
        double interval = burst.Stats[ModuleStat.BurstInterval]!.Value;

        List<EngineeringModifier> journal = LoadoutEngineering.JournalModifiersFor(
            burst, [new EngineeringModifier("BurstInterval", interval * 0.8, interval)]);

        Assert.DoesNotContain(journal, modifier => modifier.Label == "BurstInterval");
        EngineeringModifier rate = Assert.Single(
            journal, modifier => modifier.Label == "RateOfFire");
        Assert.True(rate.Value > rate.OriginalValue, "A shorter interval fires faster.");
        Assert.Contains(journal, modifier => modifier.Label == "DamagePerSecond");
    }

    [Fact]
    public void AModifierBlockIsSortedTheWayFrontierWritesIt()
    {
        OutfittingModule multicannon = Module(Multicannon);

        List<EngineeringModifier> journal = LoadoutEngineering.JournalModifiersFor(
            multicannon,
            [
                new EngineeringModifier("ThermalLoad", 1, 2),
                new EngineeringModifier("Mass", 3, 4),
                new EngineeringModifier("PowerDraw", 5, 6),
            ]);

        Assert.Equal(
            ["Mass", "PowerDraw", "ThermalLoad"],
            journal.Select(modifier => modifier.Label).ToArray());
    }

    [Fact]
    public void ALabelTheOrderDoesNotNameGoesLast()
    {
        OutfittingModule multicannon = Module(Multicannon);

        List<EngineeringModifier> journal = LoadoutEngineering.JournalModifiersFor(
            multicannon,
            [
                new EngineeringModifier("SomethingUnranked", 1, 2),
                new EngineeringModifier("Mass", 3, 4),
            ]);

        Assert.Equal(
            ["Mass", "SomethingUnranked"],
            journal.Select(modifier => modifier.Label).ToArray());
    }
}
