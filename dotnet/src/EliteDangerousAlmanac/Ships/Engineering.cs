using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Text.Json.Serialization;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>How a modifier value is applied to a base stat.</summary>
public enum ModifierMethod
{
    /// <summary>The values compound: the result is the base times the product of one plus each value.</summary>
    Multiplicative,

    /// <summary>The values add: the result is the base plus the sum of the values.</summary>
    Additive,

    /// <summary>The value replaces the base outright.</summary>
    Overwrite,
}

/// <summary>One stat a blueprint grade modifies, bounded by the quality roll.</summary>
/// <param name="Label">
/// The journal modifier label the stat is known by, such as <c>FSDOptimalMass</c>. These are
/// the journal's own labels, with one deliberate exception: the recipes that shorten a weapon's
/// fire interval carry <c>BurstInterval</c>, the stat they change, where a journal reports the
/// resulting rate of fire instead. <c>GuardianModuleResistance</c> is the other non-scalar
/// case: it grants a capability, and its stated bounds are not arithmetic.
/// </param>
/// <param name="Method">How the value applies.</param>
/// <param name="Min">The modifier value at quality zero, the worst roll.</param>
/// <param name="Max">The modifier value at quality one, the best roll.</param>
public sealed record BlueprintFeature(string Label, ModifierMethod Method, double Min, double Max);

/// <summary>One stat an experimental effect modifies, as a fixed contribution.</summary>
/// <param name="Label">The journal modifier label.</param>
/// <param name="Method">How the value applies.</param>
/// <param name="Value">The contribution value, a fraction for a percentage modifier.</param>
public sealed record ExperimentalContribution(string Label, ModifierMethod Method, double Value);

/// <summary>One material an engineering step consumes.</summary>
/// <param name="Symbol">
/// The material's Frontier symbol, such as <c>ChemicalManipulators</c>. It is the key into the
/// material catalogue for the material's own grade and category.
/// </param>
/// <param name="Name">The display name, such as <c>Chemical Manipulators</c>.</param>
/// <param name="Count">How many of this material the step consumes.</param>
public sealed record EngineeringMaterial(string Symbol, string Name, int Count);

/// <summary>One grade of a blueprint: the modifiers it applies to a module.</summary>
/// <param name="Features">The stat modifiers this grade applies.</param>
/// <param name="DamageDistribution">
/// The fixed damage-type split produced at this grade, when the blueprint converts a weapon's
/// damage. Shares are fractions; an absent type deals no damage after conversion.
/// </param>
public sealed record BlueprintGrade(
    IReadOnlyList<BlueprintFeature> Features,
    DamageDistribution? DamageDistribution = null);

/// <summary>
/// One experimental effect: the stat modifiers and the behaviour it applies. An experimental
/// effect is applied in one step, unlike a blueprint whose grades are rolled up to.
/// </summary>
/// <param name="Name">The in-game display name, such as <c>Mass Manager</c>.</param>
/// <param name="Modifiers">
/// The stat contributions this effect applies. The list is empty for a purely qualitative
/// effect, whose behaviour is a gameplay flag with no numeric magnitude the data exposes. Such
/// an effect still carries a <paramref name="Description"/>. A damage-type conversion is
/// carried by <paramref name="DamageDistribution"/> instead, because a split is a nested record
/// rather than a scalar contribution.
/// </param>
/// <param name="DamageDistribution">
/// The fixed damage-type split the effect produces, when it converts a weapon's damage.
/// </param>
/// <param name="Description">
/// A short note on what the effect does in game, present on the effects whose behaviour the
/// modifiers do not fully carry.
/// </param>
public sealed record ExperimentalEffect(
    string Name,
    IReadOnlyList<ExperimentalContribution> Modifiers,
    DamageDistribution? DamageDistribution = null,
    string? Description = null);

/// <summary>One engineering blueprint: its in-game display name and its per-grade data.</summary>
/// <param name="Name">
/// The in-game display name, such as <c>Increased range</c>. It is the short modifier label
/// rather than the full outfitting-panel string.
/// </param>
/// <param name="Grades">
/// The blueprint's grades, keyed by grade number, 1 through 5. A blueprint need not define
/// every grade.
/// </param>
public sealed record Blueprint(string Name, IReadOnlyDictionary<int, BlueprintGrade> Grades);

/// <summary>One stat a module's engineering changed, in the shape a journal writes it.</summary>
/// <param name="Label">The stat's journal name, such as <c>FSDOptimalMass</c>.</param>
/// <param name="Value">The modified value, when the stat is numeric.</param>
/// <param name="OriginalValue">The stock value before engineering, when the stat is numeric.</param>
/// <param name="ValueStr">A string-valued modifier's value, used for the non-numeric stats.</param>
public sealed record EngineeringModifier(
    string Label,
    double? Value = null,
    double? OriginalValue = null,
    string? ValueStr = null)
{
    /// <summary>The unrounded stored float behind <see cref="Value"/>.</summary>
    /// <remarks>
    /// A modifier this library computed carries the float behind its serialized value; one a
    /// capture wrote carries only the six decimal places it was written with, and leaves this
    /// absent. Read <see cref="PreciseValue"/> rather than this member.
    /// </remarks>
    [JsonIgnore]
    public double? StoredValue { get; init; }

    /// <summary>The most precise figure available for the stat.</summary>
    /// <remarks>
    /// A figure derived from it can land one serialized place apart depending on where the
    /// modifier came from. Both readings are the best answer available from what the producer
    /// wrote.
    /// </remarks>
    [JsonIgnore]
    public double? PreciseValue => StoredValue ?? Value;
}

/// <summary>
/// The engineering calculator: data-free arithmetic that turns a blueprint grade, a quality
/// roll and an optional experimental effect into stat modifiers.
/// </summary>
/// <remarks>
/// <para>
/// A blueprint feature bounds a modifier by the engineering quality roll, and an experimental
/// effect adds a fixed contribution. Each contribution names a journal modifier label and an
/// apply method, and <see cref="ComputeModifiers(IReadOnlyDictionary{string, double}, BlueprintGrade, double, ExperimentalEffect)"/>
/// folds every contribution to a label onto one base value.
/// </para>
/// <para>
/// A handful of stats are percentages of a multiplier and compound on that multiplier instead,
/// whatever method the recipe names: hull boost and shield boost on one plus the value, and the
/// four resistances on their damage multiplier. That is why an eighty percent bulkhead
/// engineered by a thirty-two percent blueprint reads 137.6 percent and not 105.6.
/// </para>
/// <para>
/// The primitive labels a recipe actually changes are preserved. Frontier's own Rapid Fire and
/// High Capacity recipes shorten the burst interval, for example, rather than raising the rate
/// of fire directly. Values use the game's 32-bit float arithmetic.
/// </para>
/// <para>
/// The catalogues live in <see cref="BlueprintCatalogue"/> and
/// <see cref="ExperimentalEffectCatalogue"/>; this type holds no data.
/// </para>
/// </remarks>
public static class Engineering
{
    /// <summary>Stats whose stored ratio is a 32-bit float before journal percentage scaling.</summary>
    private static readonly HashSet<string> Float32ScaledBaseLabels = new(StringComparer.Ordinal)
    {
        "EngineOptPerformance",
        "EngineMinPerformance",
        "EngineMaxPerformance",
        "ShieldGenStrength",
        "ShieldGenMinStrength",
        "ShieldGenMaxStrength",
    };

    /// <summary>Computes the stat modifiers a blueprint grade and an effect produce.</summary>
    /// <param name="baseStats">
    /// The module's base stat values, keyed by journal modifier label. Only the labels present
    /// here can be scaled; a contribution to an absent stat is skipped unless it sets or adds
    /// to it. Two labels are also read without being modified: <c>Range</c> resolves the Long
    /// Range falloff flag, and <c>BurstSize</c> rounds an engineered clip to whole bursts.
    /// </param>
    /// <param name="grade">The blueprint grade to roll.</param>
    /// <param name="quality">
    /// The engineering system's shared quality roll, from zero through one. It defaults to one,
    /// the best roll. A legacy-engineered module advanced each attribute independently and
    /// cannot be reconstructed from its single reported quality; import its stated modifiers.
    /// </param>
    /// <param name="experimental">The experimental effect to apply, when there is one.</param>
    /// <returns>One modifier per modified label.</returns>
    /// <exception cref="ArgumentNullException">
    /// <paramref name="baseStats"/> or <paramref name="grade"/> is <see langword="null"/>.
    /// </exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// <paramref name="quality"/> is not a finite number from zero through one.
    /// </exception>
    public static IReadOnlyList<EngineeringModifier> ComputeModifiers(
        IReadOnlyDictionary<string, double> baseStats,
        BlueprintGrade grade,
        double quality = 1,
        ExperimentalEffect? experimental = null)
    {
        if (grade is null) throw new ArgumentNullException(nameof(grade));
        return ComputeModifiers(baseStats, grade.Features, quality, experimental?.Modifiers);
    }

    /// <summary>Computes the stat modifiers a feature list and a contribution list produce.</summary>
    /// <param name="baseStats">The module's base stat values, keyed by journal modifier label.</param>
    /// <param name="features">
    /// The blueprint features to roll. This overload is for a caller assembling modifiers
    /// without a catalogue record.
    /// </param>
    /// <param name="quality">The quality roll, from zero through one.</param>
    /// <param name="experimental">The experimental contributions to apply, when there are any.</param>
    /// <returns>One modifier per modified label.</returns>
    /// <exception cref="ArgumentNullException">
    /// <paramref name="baseStats"/> or <paramref name="features"/> is <see langword="null"/>.
    /// </exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// <paramref name="quality"/> is not a finite number from zero through one.
    /// </exception>
    public static IReadOnlyList<EngineeringModifier> ComputeModifiers(
        IReadOnlyDictionary<string, double> baseStats,
        IReadOnlyList<BlueprintFeature> features,
        double quality = 1,
        IReadOnlyList<ExperimentalContribution>? experimental = null)
    {
        if (baseStats is null) throw new ArgumentNullException(nameof(baseStats));
        if (features is null) throw new ArgumentNullException(nameof(features));
        if (double.IsNaN(quality) || double.IsInfinity(quality) || quality < 0 || quality > 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(quality), quality, "The quality must be a finite number from 0 through 1.");
        }

        double roll = EngineeringPrecision.Fround(quality);
        List<string> order = [];
        Dictionary<string, List<Contribution>> byLabel = new(StringComparer.Ordinal);
        foreach (BlueprintFeature feature in features)
        {
            double rolled = roll switch
            {
                0 => feature.Min,
                1 => feature.Max,
                _ => feature.Min + ((feature.Max - feature.Min) * roll),
            };
            double value = feature.Method == ModifierMethod.Overwrite
                ? rolled
                : roll is 0 or 1
                    ? EngineeringPrecision.Fround(rolled)
                    : EngineeringPrecision.Fround(
                        EngineeringPrecision.Fround(feature.Min)
                        + EngineeringPrecision.Fround(
                            EngineeringPrecision.Fround(feature.Max - feature.Min) * roll));

            // A stated contribution is one the registry publishes as a number, rather than one
            // interpolated between two of them.
            Add(order, byLabel, feature.Label, new Contribution(
                feature.Method, value, feature.Min == feature.Max || roll is 0 or 1));
        }

        foreach (ExperimentalContribution contribution in experimental ?? [])
        {
            double value = contribution.Method == ModifierMethod.Overwrite
                ? contribution.Value
                : EngineeringPrecision.Fround(contribution.Value);
            Add(order, byLabel, contribution.Label, new Contribution(contribution.Method, value, true));
        }

        List<EngineeringModifier> modifiers = [];
        bool clipIsOverwritten = false;
        foreach (string label in order)
        {
            List<Contribution> contributions = byLabel[label];
            string? capabilityValue = ModuleStatLabels.CapabilityValueFor(label);
            if (capabilityValue is not null)
            {
                modifiers.Add(new EngineeringModifier(label, ValueStr: capabilityValue));
                continue;
            }

            Contribution? overwrite = null;
            bool adds = false;
            foreach (Contribution contribution in contributions)
            {
                if (overwrite is null && contribution.Method == ModifierMethod.Overwrite) overwrite = contribution;
                if (contribution.Method == ModifierMethod.Additive) adds = true;
            }

            double? multiplierBase = ModuleStatLabels.MultiplierBaseFor(label);
            double? original = baseStats.TryGetValue(label, out double stated)
                ? Float32JournalValue(
                    stated,
                    multiplierBase,
                    Float32ScaledBaseLabels.Contains(label) ? ModuleStatLabels.ScaleFor(label) : 1)
                : null;

            // A stat the module does not carry cannot be scaled, but it can still be set or
            // added to: an overwrite replaces it outright, and an addition starts from zero. A
            // purely multiplicative recipe has nothing to work on.
            //
            // A percentage of a multiplier is the exception, because it has no absent state. No
            // hull boost is a multiplier of one, which is zero percent and a real base to
            // compound on. That is why a hull reinforcement package can be engineered to a hull
            // boost it never had: the recipe's bonus is the whole result.
            bool baseless = original is null && (multiplierBase is not null || overwrite is not null || adds);
            if (original is null && !baseless) continue;

            double value = original ?? 0;
            if (multiplierBase is null)
            {
                // Fold in a stable order: compound the multiplicative factors, then add the
                // additive terms, then let an overwrite win last.
                foreach (Contribution contribution in contributions)
                {
                    if (contribution.Method == ModifierMethod.Multiplicative)
                    {
                        value = EngineeringPrecision.Fround(
                            value * EngineeringPrecision.Fround(1 + EngineeringPrecision.Fround(contribution.Value)));
                    }
                }

                foreach (Contribution contribution in contributions)
                {
                    if (contribution.Method == ModifierMethod.Additive)
                    {
                        value = EngineeringPrecision.Fround(
                            value + EngineeringPrecision.Fround(contribution.Value));
                    }
                }
            }
            else
            {
                double factor = EngineeringPrecision.Fround(1 + (value / multiplierBase.Value));
                foreach (Contribution contribution in contributions)
                {
                    if (contribution.Method == ModifierMethod.Overwrite) continue;
                    factor = EngineeringPrecision.Fround(factor * EngineeringPrecision.Fround(
                        1 + (EngineeringPrecision.Fround(contribution.Value) * 100 / multiplierBase.Value)));
                }

                value = EngineeringPrecision.Fround(
                    EngineeringPrecision.Fround(factor - 1) * multiplierBase.Value);
            }

            if (overwrite is not null) value = overwrite.Value;

            // Ammunition is counted in whole rounds. A computed reserve rounds to the nearest
            // round, matching the game's stated values; a computed clip rounds up to a whole
            // burst below. An overwrite is a published figure rather than a product, so it is
            // left alone.
            if (label == "AmmoClipSize")
            {
                if (overwrite is not null) clipIsOverwritten = true;
                else if (original is not null && AllStated(contributions))
                {
                    value = SnapToStatedWhole(value, original.Value);
                }
            }
            else if (label == "AmmoMaximum" && overwrite is null)
            {
                value = EngineeringPrecision.RoundHalfUp(value);
            }

            // A stat the module never carried has no original value to report, except a
            // percentage of a multiplier, whose absence is itself a value: zero percent,
            // exactly as a journal reports it.
            modifiers.Add(new EngineeringModifier(
                label,
                EngineeringPrecision.Round6(value),
                original is null && multiplierBase is null ? null : EngineeringPrecision.Round6(original ?? 0))
            {
                StoredValue = value,
            });
        }

        ResolveFalloffFromRange(modifiers, baseStats);
        if (!clipIsOverwritten) RoundClipToWholeBursts(modifiers, baseStats);
        return new ReadOnlyCollection<EngineeringModifier>(modifiers);
    }

    /// <summary>Combines several material lists into one, summing the shared counts.</summary>
    /// <param name="lists">
    /// The material lists to merge, each of which may be empty. Materials match on their symbol,
    /// case-insensitively.
    /// </param>
    /// <returns>One entry per distinct material, in first-seen order, with summed counts.</returns>
    /// <remarks>
    /// Use it to fold a blueprint's cost together with an experimental effect's. The two
    /// catalogues stay decoupled, so pass in whichever lists you have.
    /// </remarks>
    /// <exception cref="ArgumentNullException"><paramref name="lists"/> is <see langword="null"/>.</exception>
    public static IReadOnlyList<EngineeringMaterial> SumMaterials(
        params IReadOnlyList<EngineeringMaterial>[] lists)
    {
        if (lists is null) throw new ArgumentNullException(nameof(lists));

        List<string> order = [];
        Dictionary<string, EngineeringMaterial> totals = new(StringComparer.OrdinalIgnoreCase);
        foreach (IReadOnlyList<EngineeringMaterial> list in lists)
        {
            foreach (EngineeringMaterial material in list)
            {
                // Keep the first-seen symbol and name; only the counts accumulate.
                if (totals.TryGetValue(material.Symbol, out EngineeringMaterial? previous))
                {
                    totals[material.Symbol] = previous with { Count = previous.Count + material.Count };
                }
                else
                {
                    totals[material.Symbol] = material;
                    order.Add(material.Symbol);
                }
            }
        }

        List<EngineeringMaterial> summed = new(order.Count);
        foreach (string symbol in order) summed.Add(totals[symbol]);
        return new ReadOnlyCollection<EngineeringMaterial>(summed);
    }

    private static void Add(
        List<string> order,
        Dictionary<string, List<Contribution>> byLabel,
        string label,
        Contribution contribution)
    {
        if (!byLabel.TryGetValue(label, out List<Contribution>? contributions))
        {
            contributions = [];
            byLabel[label] = contributions;
            order.Add(label);
        }

        contributions.Add(contribution);
    }

    private static bool AllStated(List<Contribution> contributions)
    {
        foreach (Contribution contribution in contributions)
        {
            if (!contribution.Stated) return false;
        }

        return true;
    }

    /// <summary>Recreates the float behind a journal percentage-of-a-multiplier value.</summary>
    private static double Float32JournalValue(double value, double? multiplierBase, double scale)
    {
        if (multiplierBase is null)
        {
            return EngineeringPrecision.Fround(EngineeringPrecision.Fround(value / scale) * scale);
        }

        double factor = EngineeringPrecision.Fround(1 + (value / multiplierBase.Value));
        return EngineeringPrecision.Fround(EngineeringPrecision.Fround(factor - 1) * multiplierBase.Value);
    }

    /// <summary>
    /// Rounds an engineered clip up to a multiple of the burst size: a recipe scales the clip
    /// by an arbitrary factor, and a part round is not something a ship can load.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The burst size is the recipe's own where it sets one, and otherwise the weapon's. Double
    /// Shot gives a fragment cannon a two-round burst and scales the clip in the same roll, so
    /// its three rounds become six rather than the five a bare round-up gives, while a Concord
    /// Cannon's own three-round burst takes High Capacity's 12.24 to 15 rather than 13.
    /// </para>
    /// <para>
    /// Only a computed clip is rounded, and only in the direction the roll already moved it. A
    /// stock clip is untouched, and so is a clip a recipe overwrites or a journal states, since
    /// either figure is published rather than computed.
    /// </para>
    /// </remarks>
    private static void RoundClipToWholeBursts(
        List<EngineeringModifier> modifiers,
        IReadOnlyDictionary<string, double> baseStats)
    {
        int clipAt = IndexOf(modifiers, "AmmoClipSize");

        // Nothing to round, and nothing to round for: a recipe leg that leaves the clip where it
        // was is not a reason to move it.
        if (clipAt < 0) return;
        EngineeringModifier clip = modifiers[clipAt];
        if (clip.Value is null or 0 || clip.Value == clip.OriginalValue) return;

        int burstAt = IndexOf(modifiers, "BurstSize");
        double burst = 1;
        if (burstAt >= 0 && modifiers[burstAt].Value is double rolled && rolled > 0) burst = rolled;
        else if (baseStats.TryGetValue("BurstSize", out double stock) && stock > 0) burst = stock;
        double rounded = Math.Ceiling(clip.Value.Value / burst) * burst;
        if (rounded != clip.Value.Value) modifiers[clipAt] = clip with { Value = rounded };
    }

    /// <summary>
    /// Recovers the whole magazine a published multiplier means, where its stated precision is
    /// all that stands between the two.
    /// </summary>
    /// <remarks>
    /// <para>
    /// A registry states a multiplier to three or four decimals, so a leg meant to add two
    /// thirds is written as 0.667: a six-round missile rack under Drag Munitions computes 10.002
    /// rounds, and the recipe means 10. That thousandth matters because the clip then rounds up,
    /// which would buy a whole extra round.
    /// </para>
    /// <para>
    /// The tolerance is what the data's precision is worth: half a unit in the third decimal of
    /// the multiplier, scaled by the base clip it applies to. Only a stated multiplier is
    /// snapped, because a quality roll between two published legs is a real number with no whole
    /// magazine behind it. Snapping is not rounding: it recovers what the registry published.
    /// </para>
    /// </remarks>
    private static double SnapToStatedWhole(double value, double stock)
    {
        double whole = EngineeringPrecision.RoundHalfUp(value);
        return Math.Abs(value - whole) <= Math.Abs(stock) * 5e-4 ? whole : value;
    }

    /// <summary>
    /// Resolves the Long Range falloff flag to the weapon's modified maximum range, and holds
    /// every falloff to that ceiling.
    /// </summary>
    /// <remarks>
    /// The flag is stored upstream as an overwrite between zero and one, so a literal reading
    /// would put the falloff a metre from the muzzle. A weapon with no maximum range at all has
    /// nothing for the flag to resolve against, so the leg is dropped rather than shipped as the
    /// raw sentinel. Most such weapons carry no falloff either, but the few that do keep the
    /// stock distance: only the flag is dropped, never a real value.
    /// </remarks>
    private static void ResolveFalloffFromRange(
        List<EngineeringModifier> modifiers,
        IReadOnlyDictionary<string, double> baseStats)
    {
        int falloffAt = IndexOf(modifiers, "FalloffRange");
        if (falloffAt < 0) return;
        EngineeringModifier falloff = modifiers[falloffAt];
        if (falloff.Value is null) return;

        int rangeAt = IndexOf(modifiers, "Range");
        if (rangeAt < 0) rangeAt = IndexOf(modifiers, "MaximumRange");
        double? range = rangeAt >= 0 ? modifiers[rangeAt].Value : null;
        range ??= baseStats.TryGetValue("Range", out double stated) ? stated
            : baseStats.TryGetValue("MaximumRange", out double maximum) ? maximum
            : null;

        if (range is null)
        {
            // Still a flag, and nothing to turn it into: drop it. A falloff the weapon really
            // carries has a distance of its own and survives.
            if (falloff.Value <= 1) modifiers.RemoveAt(falloffAt);
            return;
        }

        if (falloff.Value <= 1 || falloff.Value > range)
        {
            modifiers[falloffAt] = falloff with { Value = EngineeringPrecision.Round6(range.Value) };
        }
    }

    private static int IndexOf(List<EngineeringModifier> modifiers, string label)
    {
        for (int at = 0; at < modifiers.Count; at++)
        {
            if (string.Equals(modifiers[at].Label, label, StringComparison.Ordinal)) return at;
        }

        return -1;
    }

    private sealed record Contribution(ModifierMethod Method, double Value, bool Stated);
}
