using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>Where a pre-engineered variant is obtained.</summary>
public enum PreEngineeredAcquisition
{
    /// <summary>
    /// Bought from the Merc-Coin shop. Every such article arrives at grade 1, some of them with
    /// an experimental effect already applied beside that grade-1 blueprint.
    /// </summary>
    Mercenary,

    /// <summary>
    /// Awarded for taking part in a community goal. Most are grade 5, and a minority carry an
    /// experimental effect.
    /// </summary>
    CommunityGoal,

    /// <summary>Unlocked at a tech broker. It records the route the source states.</summary>
    TechBroker,

    /// <summary>Awarded already transformed by an event. The festive articles are grade 5.</summary>
    EventReward,
}

/// <summary>One hand-set stat change a pre-engineered variant arrives with.</summary>
/// <param name="Label">The journal modifier label, such as <c>PowerDraw</c>.</param>
/// <param name="Method">How the value applies to the base stat.</param>
/// <param name="Value">
/// The modifier value: a fraction for a multiplicative change, an absolute delta for an additive
/// one, and the replacement value for an overwrite.
/// </param>
/// <remarks>
/// It has the vocabulary of a blueprint feature, without the bounds: a pre-engineered variant is
/// a fixed article rather than a roll.
/// </remarks>
public sealed record PreEngineeredModifier(string Label, ModifierMethod Method, double Value);

/// <summary>
/// One pre-engineered module variant: a pairing of a stock module with the engineering identity
/// it ships with, rather than a module in its own right.
/// </summary>
/// <param name="Symbol">The base module's symbol, which joins to the outfitting registry.</param>
/// <param name="Name">
/// The variant's display name. A festive row includes its colour, so variants of the same
/// launcher stay distinct.
/// </param>
/// <param name="BlueprintSymbol">
/// The identifier the game writes in a loadout event's blueprint field. Most join to
/// <see cref="BlueprintCatalogue"/>. A festive decorative identifier does not, because it names a
/// fixed reward article rather than a recipe a player can apply. On any reward variant the
/// identifier names the article rather than reproducing it: alongside its blueprint and effect,
/// a reward carries hand-set modifiers no blueprint grants, so rolling that recipe to that grade
/// does not arrive at the same module.
/// </param>
/// <param name="Grade">The engineering grade already applied, from 1 through 5.</param>
/// <param name="Acquisition">Where the variant comes from.</param>
/// <param name="ExperimentalEffectSymbol">
/// The experimental effect the article arrives with, which joins to
/// <see cref="ExperimentalEffectCatalogue"/>. It is absent when the variant carries none.
/// </param>
/// <param name="EngineeringLocked">
/// <see langword="true"/> when the article is final and accepts no further engineering. It marks
/// the pre-engineered Guardian weapons and the fixed Enzyme and anti-xeno rewards. Neither a
/// blueprint nor an experimental effect may be applied to these articles, and their baked
/// engineering cannot be removed.
/// </param>
/// <param name="MercCoinCost">
/// The shop price in Merc Coin, present on a Mercenary row alone: the other routes are not
/// bought with a currency. It is the purchase alone, and engineering the article above the grade
/// it is sold at costs further Merc Coin per roll.
/// </param>
/// <param name="Modifiers">
/// The hand-set stat block the variant arrives with, sorted by label. It is absent on every
/// Mercenary row, because no registry publishes the grade-1 pre-engineering those arrive with,
/// and present on every community-goal, tech-broker and event-reward row.
/// </param>
public sealed record PreEngineeredVariant(
    string Symbol,
    string Name,
    string BlueprintSymbol,
    int Grade,
    PreEngineeredAcquisition Acquisition,
    string? ExperimentalEffectSymbol = null,
    bool EngineeringLocked = false,
    int? MercCoinCost = null,
    IReadOnlyList<PreEngineeredModifier>? Modifiers = null);

/// <summary>
/// The pre-engineered module catalogue: the outfitting rows bought or received already modified,
/// each paired with the base module it fits as and the engineering identity baked in.
/// </summary>
/// <remarks>
/// <para>
/// A pre-engineered module has no symbol of its own. The game sells an ordinary module with
/// engineering already applied, so a journal loadout reports the base symbol plus an engineering
/// block. This catalogue supplies the link that would otherwise be missing: which stock modules
/// exist in a pre-engineered form, and with what fixed engineering state.
/// </para>
/// <para>
/// One base module can appear more than once, because the medium Seeker Missile Rack is sold or
/// awarded in several flavours. Look variants up with <see cref="VariantsFor"/> rather than
/// assuming there is one.
/// </para>
/// <para>
/// A Mercenary article is bought at grade 1 and its bespoke recipe starts at grade 2; price the
/// remaining upgrade with <see cref="BlueprintCosts.FindClimbCost"/>. A community-goal or
/// tech-broker article instead names a fixed reward, and its blueprint identifier grants no
/// recipe to the stock module.
/// </para>
/// </remarks>
public static class PreEngineeredCatalogue
{
    private static readonly Lazy<IReadOnlyList<PreEngineeredVariant>> Variants = new(Load);

    /// <summary>Every pre-engineered module variant, whether purchased, unlocked or awarded.</summary>
    /// <remarks>
    /// It omits the pre-engineered Guardian module rewards whose variant details have no
    /// traceable source.
    /// </remarks>
    public static IReadOnlyList<PreEngineeredVariant> All => Variants.Value;

    /// <summary>Every pre-engineered variant of one base module.</summary>
    /// <param name="symbol">
    /// A module symbol, such as <c>Hpt_BasicMissileRack_Fixed_Medium</c>. Leading and trailing
    /// whitespace and case are ignored, so a raw journal value passes straight in.
    /// </param>
    /// <returns>
    /// Every variant of that module, in catalogue order. It is empty rather than
    /// <see langword="null"/> when the module has no known pre-engineered form.
    /// </returns>
    public static IReadOnlyList<PreEngineeredVariant> VariantsFor(string? symbol) =>
        RegistryIndex.FilterByKey(All, variant => variant.Symbol, symbol);

    /// <summary>Whether a module has at least one known pre-engineered form.</summary>
    /// <param name="symbol">A module symbol. Whitespace and case are ignored.</param>
    /// <returns><see langword="true"/> when <see cref="VariantsFor"/> answers anything.</returns>
    public static bool IsPreEngineered(string? symbol) => VariantsFor(symbol).Count > 0;

    private static ReadOnlyCollection<PreEngineeredVariant> Load()
    {
        IReadOnlyList<PreEngineeredVariant> variants =
            SharedData.LoadList<PreEngineeredVariant>("data/ships/pre-engineered.jsonc");
        List<PreEngineeredVariant> frozen = new(variants.Count);
        foreach (PreEngineeredVariant variant in variants)
        {
            frozen.Add(variant.Modifiers is null
                ? variant
                : variant with { Modifiers = ReadOnlyLists.Freeze(variant.Modifiers) });
        }

        return new ReadOnlyCollection<PreEngineeredVariant>(frozen);
    }
}
