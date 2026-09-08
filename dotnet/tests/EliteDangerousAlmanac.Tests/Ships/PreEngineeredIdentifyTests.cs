using System.Collections.Generic;
using System.Linq;
using EliteDangerousAlmanac.Ships;
using EliteDangerousAlmanac.Ships.Internal;
using Xunit;

namespace EliteDangerousAlmanac.Tests.Ships;

/// <summary>Reading a captured module back to the fixed article it describes.</summary>
public class PreEngineeredIdentifyTests
{
    private static readonly PreEngineeredVariant[] Articles =
        PreEngineeredCatalogue.All.Where(variant => variant.Modifiers is { Count: > 0 }).ToArray();

    public static TheoryData<int> ArticlePositions()
    {
        TheoryData<int> positions = [];
        for (int index = 0; index < Articles.Length; index++) positions.Add(index);
        return positions;
    }

    /// <summary>A capture the way a journal writes one for a fixed article.</summary>
    private static LoadoutModule Captured(PreEngineeredVariant variant, bool stateModifiers = true)
    {
        ModuleEngineering engineering = new(variant.BlueprintSymbol, variant.Grade, 1)
        {
            ExperimentalEffect = variant.ExperimentalEffectSymbol,
            Modifiers = stateModifiers ? PreEngineeredStats.JournalModifiers(variant) : null,
        };

        return new LoadoutModule("TinyHardpoint1", variant.Symbol) { Engineering = engineering };
    }

    [Theory]
    [MemberData(nameof(ArticlePositions))]
    public void AnArticlesOwnJournalBlockIdentifiesIt(int position)
    {
        PreEngineeredVariant variant = Articles[position];

        PreEngineeredVariant? found = PreEngineeredStats.Identify(Captured(variant));

        Assert.NotNull(found);
        Assert.Equal(variant.Symbol, found.Symbol);
        Assert.Equal(variant.BlueprintSymbol, found.BlueprintSymbol);
        Assert.Equal(variant.Grade, found.Grade);
        Assert.Equal(variant.ExperimentalEffectSymbol, found.ExperimentalEffectSymbol);
    }

    [Fact]
    public void AJournalBlockReportsTheSameChangesAsTheStatBlock()
    {
        PreEngineeredVariant variant = Articles[0];

        IReadOnlyList<EngineeringModifier> journal = PreEngineeredStats.JournalModifiers(variant);
        IReadOnlyList<EngineeringModifier> stats = PreEngineeredStats.Modifiers(variant);

        Assert.NotEmpty(journal);
        Assert.NotEmpty(stats);
        Assert.All(journal, modifier => Assert.NotEmpty(modifier.Label));
    }

    [Fact]
    public void AWeaponArticleReportsItsDamagePerSecond()
    {
        PreEngineeredVariant gauss = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_Guardian_GaussCannon_Fixed_Small"),
            variant => variant.EngineeringLocked);

        Assert.Contains(
            PreEngineeredStats.JournalModifiers(gauss),
            modifier => modifier.Label == "DamagePerSecond");
    }

    [Fact]
    public void AnUnknownVariantSymbolReportsNoJournalChanges()
    {
        PreEngineeredVariant invented = new(
            "Not_A_Module",
            "Invented",
            "Weapon_LongRange",
            5,
            PreEngineeredAcquisition.CommunityGoal);

        Assert.Empty(PreEngineeredStats.JournalModifiers(invented));
    }

    [Fact]
    public void AModuleWithNoEngineeringBlockIdentifiesNothing()
    {
        Assert.Null(PreEngineeredStats.Identify(
            new LoadoutModule("TinyHardpoint1", "Hpt_MultiCannon_Fixed_Medium")));
    }

    [Fact]
    public void AnUnknownModuleSymbolIdentifiesNothing()
    {
        LoadoutModule module = new("TinyHardpoint1", "Not_A_Module")
        {
            Engineering = new ModuleEngineering("Weapon_LongRange", 5, 1),
        };

        Assert.Null(PreEngineeredStats.Identify(module));
    }

    [Fact]
    public void AnOrdinaryRollOfAMenuRecipeIdentifiesNoArticle()
    {
        LoadoutModule module = new("TinyHardpoint1", "Hpt_MultiCannon_Fixed_Medium")
        {
            Engineering = new ModuleEngineering("Weapon_LongRange", 5, 1)
            {
                Modifiers = [new EngineeringModifier("Mass", 4, 4)],
            },
        };

        Assert.Null(PreEngineeredStats.Identify(module));
    }

    [Fact]
    public void AnEmptyModifierListIdentifiesNothing()
    {
        PreEngineeredVariant variant = Articles[0];
        LoadoutModule module = new("TinyHardpoint1", variant.Symbol)
        {
            Engineering = new ModuleEngineering(variant.BlueprintSymbol, variant.Grade, 1)
            {
                Modifiers = [],
            },
        };

        Assert.Null(PreEngineeredStats.Identify(module));
    }

    [Fact]
    public void ALockedArticleIsIdentifiedByItsIdentityAloneWhereNoModifiersAreStated()
    {
        PreEngineeredVariant locked = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_Guardian_GaussCannon_Fixed_Small"),
            variant => variant.EngineeringLocked);

        PreEngineeredVariant? found = PreEngineeredStats.Identify(Captured(locked, false));

        Assert.Same(locked, found);
    }

    [Fact]
    public void AMercenaryArticleIsIdentifiedAtEveryGradeItWasUpgradedTo()
    {
        PreEngineeredVariant bought = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Int_DetailedSurfaceScanner_Tiny"),
            variant => variant.Acquisition == PreEngineeredAcquisition.Mercenary);

        for (int grade = bought.Grade; grade <= 5; grade++)
        {
            LoadoutModule module = new("TinyHardpoint1", bought.Symbol)
            {
                Engineering = new ModuleEngineering(bought.BlueprintSymbol, grade, 1),
            };

            Assert.Same(bought, PreEngineeredStats.Identify(module));
        }
    }

    [Fact]
    public void AGradeBelowThePurchaseIdentifiesNoMercenaryArticle()
    {
        PreEngineeredVariant bought = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Int_DetailedSurfaceScanner_Tiny"),
            variant => variant.Acquisition == PreEngineeredAcquisition.Mercenary);
        LoadoutModule module = new("TinyHardpoint1", bought.Symbol)
        {
            Engineering = new ModuleEngineering(bought.BlueprintSymbol, bought.Grade - 1, 1),
        };

        Assert.Null(PreEngineeredStats.Identify(module));
    }

    [Fact]
    public void AnUnrollableIdentityNamesTheOneArticleItCanMean()
    {
        PreEngineeredVariant locked = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_Guardian_GaussCannon_Fixed_Small"),
            variant => variant.EngineeringLocked);
        ModuleEngineering engineering = new(locked.BlueprintSymbol, locked.Grade, 1)
        {
            ExperimentalEffect = locked.ExperimentalEffectSymbol,
        };

        Assert.Same(
            locked, LoadoutEngineering.UnrollableFixedArticle(locked.Symbol, engineering));
        Assert.Null(LoadoutEngineering.RolledOverFixedArticle(locked.Symbol, engineering));
    }

    [Fact]
    public void ABlockStatingItsModifiersNamesNoIdentityArticle()
    {
        PreEngineeredVariant locked = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_Guardian_GaussCannon_Fixed_Small"),
            variant => variant.EngineeringLocked);
        ModuleEngineering engineering = new(locked.BlueprintSymbol, locked.Grade, 1)
        {
            Modifiers = PreEngineeredStats.JournalModifiers(locked),
        };

        Assert.Null(LoadoutEngineering.UnrollableFixedArticle(locked.Symbol, engineering));
        Assert.Null(LoadoutEngineering.RolledOverFixedArticle(locked.Symbol, engineering));
    }

    [Fact]
    public void AnIdentityNoArticleAnswersToNamesNothing()
    {
        ModuleEngineering engineering = new("Weapon_LongRange", 5, 1);

        Assert.Null(LoadoutEngineering.UnrollableFixedArticle(
            "Hpt_MultiCannon_Fixed_Medium", engineering));
        Assert.Null(LoadoutEngineering.RolledOverFixedArticle(
            "Hpt_MultiCannon_Fixed_Medium", engineering));
    }

    [Fact]
    public void ARecipeNoFixedArticleSharesNeedsNoProof()
    {
        ModuleEngineering engineering = new("Weapon_LongRange", 5, 1);

        Assert.Equal(
            OrdinaryEngineeringProof.NotFixedCandidate,
            LoadoutEngineering.ProveOrdinaryEngineering(
                "Hpt_MultiCannon_Fixed_Medium", engineering, null, false));
    }

    [Fact]
    public void AFixedArticlesOwnBlockDoesNotProveAnOrdinaryRoll()
    {
        PreEngineeredVariant article = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_CausticMissile_Fixed_Medium"),
            variant => variant.Acquisition == PreEngineeredAcquisition.CommunityGoal);
        ModuleEngineering engineering = new(article.BlueprintSymbol, article.Grade, 1)
        {
            Modifiers = PreEngineeredStats.JournalModifiers(article),
        };

        Assert.Equal(
            OrdinaryEngineeringProof.Unproven,
            LoadoutEngineering.ProveOrdinaryEngineering(
                article.Symbol, engineering, null, false));
    }

    [Fact]
    public void AQualityOutsideTheUnitIntervalProvesNothing()
    {
        PreEngineeredVariant article = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_CausticMissile_Fixed_Medium"),
            variant => variant.Acquisition == PreEngineeredAcquisition.CommunityGoal);
        ModuleEngineering engineering = new(article.BlueprintSymbol, article.Grade, 2)
        {
            Modifiers = [],
        };

        Assert.Equal(
            OrdinaryEngineeringProof.Unproven,
            LoadoutEngineering.ProveOrdinaryEngineering(
                article.Symbol, engineering, null, false));
    }

    [Fact]
    public void AnUnresolvedExperimentalEffectProvesNothing()
    {
        PreEngineeredVariant article = Assert.Single(
            PreEngineeredCatalogue.VariantsFor("Hpt_CausticMissile_Fixed_Medium"),
            variant => variant.Acquisition == PreEngineeredAcquisition.CommunityGoal);
        ModuleEngineering engineering = new(article.BlueprintSymbol, article.Grade, 1)
        {
            Modifiers = [],
        };

        Assert.Equal(
            OrdinaryEngineeringProof.Unproven,
            LoadoutEngineering.ProveOrdinaryEngineering(
                article.Symbol, engineering, null, true));
    }
}
