using System;
using System.Collections.Generic;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The catalogue adapters a build and its views read engineering through.</summary>
/// <remarks>
/// No blueprint arithmetic happens here. This decides which recipe a module accepts, reads a
/// stated block against the catalogues, and presents one computed result the way a journal
/// writes it. Keeping that beside the build stops a second calculator becoming another source
/// of truth.
/// </remarks>
internal static class LoadoutEngineering
{
    /// <summary>The engineering groups whose off-menu recipes identify a final bought article.</summary>
    private static readonly EngineeringGroupId[] GuardianWeaponGroups =
    [
        EngineeringGroupId.GuardianGauss,
        EngineeringGroupId.GuardianPlasma,
        EngineeringGroupId.GuardianShard,
    ];

    /// <summary>
    /// The labels a recipe changes that cannot be answered for a module, which is what makes a
    /// build refuse the recipe rather than store it half-applied.
    /// </summary>
    /// <remarks>
    /// A label with no base value is not automatically missing. A recipe leg on a stat the
    /// module does not have is inert: Long Range scales a projectile weapon's shot speed and
    /// leaves a beam laser alone. A label is missing only when the catalogue models no stat for
    /// it, so there is nowhere to store the result.
    /// </remarks>
    internal static List<string> MissingBaseLabels(
        OutfittingModule stats,
        IReadOnlyDictionary<string, double> baseStats,
        IReadOnlyList<BlueprintFeature> features,
        IReadOnlyList<ExperimentalContribution>? experimental = null)
    {
        List<string> missing = [];
        HashSet<string> seen = new(StringComparer.Ordinal);

        void Check(string label)
        {
            if (baseStats.ContainsKey(label)) return;
            if (ModuleStatLabels.StatFor(label, stats.Stats) is not null) return;
            if (seen.Add(label)) missing.Add(label);
        }

        foreach (BlueprintFeature feature in features) Check(feature.Label);
        if (experimental is not null)
        {
            foreach (ExperimentalContribution contribution in experimental) Check(contribution.Label);
        }

        return missing;
    }

    /// <summary>What a recipe changes, without the magnitudes.</summary>
    /// <remarks>
    /// Two identifiers with the same signature are one modification written twice, which is how
    /// a generic spelling is recognised as a family's own. It is deliberately blind to the
    /// minimum and maximum, because the one published divergence between such a pair is a
    /// magnitude: the shielded life-support recipe draws twelve percent more power at grade five
    /// than the generic one. Comparing what a grade touches pairs them; comparing what it rolls
    /// would not.
    /// </remarks>
    private static string? RecipeSignature(string blueprintSymbol)
    {
        Blueprint? blueprint = BlueprintCatalogue.Find(blueprintSymbol);
        if (blueprint is null) return null;

        List<string> grades = [];
        foreach (KeyValuePair<int, BlueprintGrade> entry in blueprint.Grades)
        {
            List<string> legs = [];
            foreach (BlueprintFeature feature in entry.Value.Features)
            {
                legs.Add(feature.Label + "/" + feature.Method);
            }

            legs.Sort(StringComparer.Ordinal);
            grades.Add(entry.Key.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ":" + string.Join(",", legs));
        }

        grades.Sort(StringComparer.Ordinal);
        return blueprint.Name.ToLowerInvariant() + "|" + string.Join(";", grades);
    }

    /// <summary>Whether an identifier is Frontier's family-agnostic spelling of a modification.</summary>
    private static bool IsGenericSpelling(string blueprintSymbol) =>
        blueprintSymbol.StartsWith("Misc_", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Whether a module is sold carrying this recipe in a form that can still be engineered.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The Mercenary shop's operations keys name bespoke recipes on modules bought already
    /// engineered at grade 1, so no ordinary menu lists one and the menu check alone would
    /// refuse every caller. The pre-engineered catalogue names which module each Mercenary
    /// recipe arrives on, which is the same question answered by purchase instead of by a menu,
    /// and it is narrower than a family.
    /// </para>
    /// <para>
    /// This route covers the climb, not the purchase. A Mercenary module arrives at grade 1 and
    /// its recipe publishes the grades above, so folding one is how a caller takes a bought
    /// module further. Community-goal and tech-broker records identify fixed reward articles and
    /// never open this route, and a final pre-engineered Guardian weapon accepts no further
    /// engineering at all.
    /// </para>
    /// </remarks>
    private static bool IsSoldWithBlueprint(string item, string wanted)
    {
        foreach (PreEngineeredVariant variant in PreEngineeredCatalogue.VariantsFor(item))
        {
            if (variant.Acquisition == PreEngineeredAcquisition.Mercenary
                && RegistryIndex.KeyComparer.Equals(variant.BlueprintSymbol, wanted))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// The recipe identifiers a module symbol accepts, before any alias is resolved, each with
    /// the route it arrives by. The ordinary menu comes first, then the Mercenary recipes the
    /// menu does not already list, in catalogue order.
    /// </summary>
    internal static List<KeyValuePair<string, BlueprintRoute>> BlueprintRoutesFor(string item)
    {
        List<KeyValuePair<string, BlueprintRoute>> routes = [];
        HashSet<string> named = new(RegistryIndex.KeyComparer);
        foreach (string blueprintSymbol in EngineeringOptions.BlueprintsFor(item))
        {
            if (named.Add(blueprintSymbol))
            {
                routes.Add(new KeyValuePair<string, BlueprintRoute>(
                    blueprintSymbol, BlueprintRoute.Ordinary));
            }
        }

        foreach (PreEngineeredVariant variant in PreEngineeredCatalogue.VariantsFor(item))
        {
            if (variant.Acquisition == PreEngineeredAcquisition.Mercenary
                && named.Add(variant.BlueprintSymbol))
            {
                routes.Add(new KeyValuePair<string, BlueprintRoute>(
                    variant.BlueprintSymbol, BlueprintRoute.Mercenary));
            }
        }

        return routes;
    }

    /// <summary>Whether a module's engineering menu offers a blueprint.</summary>
    /// <remarks>
    /// <para>
    /// The menu is the engineering options catalogue, so this answers what the game offers on
    /// that module, with three accommodations applied in the order below.
    /// </para>
    /// <para>
    /// The journal spelling comes first, because it is the one case where an identifier names a
    /// different recipe rather than the same one twice: the game writes one long-range name on a
    /// utility scanner as well as on a sensor suite, and the two roll different stats. The
    /// blueprint journal reader turns it into the menu's own identifier by asking which
    /// blueprint this module is offered declares that journal name.
    /// </para>
    /// <para>
    /// A Mercenary sale comes second: a module with no menu, or a menu that leaves out its
    /// bespoke recipe, still accepts the grades above the grade 1 it is sold carrying. It is
    /// asked about the identifier as written and about the resolved one, so resolution cannot
    /// hide a sale recorded under the other spelling.
    /// </para>
    /// <para>
    /// The generic spelling comes last. Where a modification applies to several module families
    /// the game writes a family-specific name and the menu lists that one, while a build
    /// authored elsewhere carries the generic spelling instead. So a generic identifier is
    /// accepted where the menu offers a family-specific identifier of the same signature. That
    /// the alias runs from the generic spelling to the menu's is what keeps it honest: a generic
    /// identifier stands in for a family's own and never for another generic.
    /// </para>
    /// </remarks>
    internal static bool BlueprintAvailableFor(string item, string blueprintSymbol)
    {
        IReadOnlyList<string> offered = EngineeringOptions.BlueprintsFor(item);
        string asWritten = blueprintSymbol.Trim();
        string resolved = BlueprintJournal.ResolveForModule(item, blueprintSymbol).Trim();

        foreach (string id in offered)
        {
            if (RegistryIndex.KeyComparer.Equals(id, resolved)) return true;
        }

        if (IsSoldWithBlueprint(item, resolved) || IsSoldWithBlueprint(item, asWritten)) return true;
        if (!IsGenericSpelling(resolved)) return false;

        string? signature = RecipeSignature(resolved);
        if (signature is null) return false;

        foreach (string id in offered)
        {
            if (!IsGenericSpelling(id)
                && string.Equals(RecipeSignature(id), signature, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>Whether a module's engineering menu offers an experimental effect.</summary>
    /// <remarks>
    /// There is no alias and no pre-engineered leg here: an effect identifier is unique to the
    /// effect, and the menu already narrows a group's list to the individual module. A fixed
    /// reward may arrive carrying an effect its stock module cannot apply, but that identifies
    /// the article rather than widening its menu.
    /// </remarks>
    internal static bool ExperimentalAvailableFor(string item, string experimentalEffectSymbol)
    {
        string wanted = experimentalEffectSymbol.Trim();
        foreach (string id in EngineeringOptions.ExperimentalsFor(item))
        {
            if (RegistryIndex.KeyComparer.Equals(id, wanted)) return true;
        }

        return false;
    }

    /// <summary>The recipe-side spelling of a module-specific journal alias.</summary>
    private static string PrimitiveLabelFor(OutfittingModule stats, string label) => label switch
    {
        "MaximumRange" when stats.Stats.Has(ModuleStat.MaximumRange) => "Range",
        "DamageFalloffRange" when stats.Stats.Has(ModuleStat.FalloffRange) => "FalloffRange",
        "Range" when stats.Stats.Has(ModuleStat.ScannerRange) => "ScannerRange",
        "DSS_PatchRadius" => "ProbeRadius",
        "FuelScoopRate" => "RefuelRate",
        "EnergyPerRegen" when stats.Stats.Has(ModuleStat.ShieldRegenRate) => "DistributorDraw",
        _ => label,
    };

    /// <summary>
    /// Puts an alias into its recipe spelling, so the one calculation compounds two
    /// contributions to the same stat.
    /// </summary>
    /// <remarks>
    /// A blueprint and an experimental effect can name one stat differently: a shield recipe
    /// says distributor draw where a shield effect says the journal's own energy per
    /// regeneration. Normalizing the labels first lets the calculator compound them as one stat,
    /// and the journal presentation translates the single result back afterwards.
    /// </remarks>
    internal static (BlueprintGrade Grade, ExperimentalEffect? Experimental) PrimitiveInputsFor(
        OutfittingModule stats,
        BlueprintGrade grade,
        ExperimentalEffect? experimental)
    {
        List<BlueprintFeature> features = new(grade.Features.Count);
        foreach (BlueprintFeature feature in grade.Features)
        {
            string label = PrimitiveLabelFor(stats, feature.Label);
            features.Add(label == feature.Label ? feature : feature with { Label = label });
        }

        BlueprintGrade canonical = grade with { Features = features };
        if (experimental is null) return (canonical, null);

        List<ExperimentalContribution> contributions = new(experimental.Modifiers.Count);
        foreach (ExperimentalContribution contribution in experimental.Modifiers)
        {
            string label = PrimitiveLabelFor(stats, contribution.Label);
            contributions.Add(
                label == contribution.Label ? contribution : contribution with { Label = label });
        }

        return (canonical, experimental with { Modifiers = contributions });
    }

    /// <summary>Whether a stated modifier block matches the calculator's ordinary result.</summary>
    private static bool MatchesCalculatedModifiers(
        IReadOnlyList<EngineeringModifier>? captured,
        List<EngineeringModifier> calculated)
    {
        if (captured is null || captured.Count != calculated.Count) return false;

        Dictionary<string, EngineeringModifier> byLabel = new(RegistryIndex.KeyComparer);
        foreach (EngineeringModifier modifier in captured) byLabel[modifier.Label.Trim()] = modifier;
        if (byLabel.Count != captured.Count) return false;

        foreach (EngineeringModifier expected in calculated)
        {
            if (!byLabel.TryGetValue(expected.Label.Trim(), out EngineeringModifier? actual))
            {
                return false;
            }

            if (expected.Value is double wanted)
            {
                if (actual.Value is not double stated) return false;
                if (Math.Abs(stated - wanted) > 1e-5 * Math.Max(1, Math.Abs(wanted))) return false;
            }
            else if (!string.Equals(actual.ValueStr, expected.ValueStr, StringComparison.Ordinal))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>Every catalogued article an engineering block naming no modifiers answers to.</summary>
    /// <remarks>
    /// A block that states its modifiers describes an article by that signature and is matched
    /// elsewhere. A bare identity is matched on the blueprint, the grade and the experimental
    /// effect it names, because nothing else tells the readings of it apart.
    /// </remarks>
    private static List<PreEngineeredVariant> IdentityArticles(
        string item,
        ModuleEngineering engineering)
    {
        List<PreEngineeredVariant> matches = [];
        if (engineering.Modifiers is not null) return matches;

        string wanted = engineering.BlueprintName.Trim();
        string? experimental = engineering.ExperimentalEffect?.Trim();
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.VariantsFor(item))
        {
            if (!RegistryIndex.KeyComparer.Equals(candidate.BlueprintSymbol.Trim(), wanted)) continue;
            if (candidate.Grade != engineering.Level) continue;

            bool effectAgrees = candidate.ExperimentalEffectSymbol is null
                ? experimental is null && engineering.ExperimentalEffectLocalised is null
                : RegistryIndex.KeyComparer.Equals(
                    candidate.ExperimentalEffectSymbol.Trim(), experimental);
            if (effectAgrees) matches.Add(candidate);
        }

        return matches;
    }

    /// <summary>The fixed article an engineering block naming no modifiers can only mean.</summary>
    /// <remarks>
    /// Such a block reads as an ordinary roll of the recipe it names wherever the module's own
    /// menu offers that recipe, which is what nearly every one of them is. Where the menu does
    /// not offer it, no roll could have written the block, so one catalogued article answering
    /// to the stated blueprint, grade and effect is what the source described.
    /// </remarks>
    internal static PreEngineeredVariant? UnrollableFixedArticle(
        string item,
        ModuleEngineering engineering)
    {
        PreEngineeredVariant? found = null;
        foreach (PreEngineeredVariant candidate in IdentityArticles(item, engineering))
        {
            if (BlueprintAvailableFor(item, candidate.BlueprintSymbol)) continue;
            if (found is not null) return null;
            found = candidate;
        }

        return found;
    }

    /// <summary>
    /// The fixed article an identity-only block answers to besides the roll it was read as.
    /// </summary>
    /// <remarks>
    /// Where the module's own menu does offer the blueprint, both readings are legitimate and
    /// the roll is taken, so this is the article that was passed over and the one a consumer may
    /// want fitted instead.
    /// </remarks>
    internal static PreEngineeredVariant? RolledOverFixedArticle(
        string item,
        ModuleEngineering engineering)
    {
        PreEngineeredVariant? found = null;
        foreach (PreEngineeredVariant candidate in IdentityArticles(item, engineering))
        {
            if (!BlueprintAvailableFor(item, candidate.BlueprintSymbol)) continue;
            if (found is not null) return null;
            found = candidate;
        }

        return found;
    }

    /// <summary>Whether a stated modifier block moves nothing this module carries.</summary>
    /// <remarks>
    /// A block whose every label names a stat this module's record has no value for, or which
    /// states no labels at all, describes some other module. It leaves this one publishing stock
    /// figures under a block that reports it is engineered, which is not a reading of the
    /// capture worth keeping. A damage-share or capability label always moves something, and one
    /// stated value landing on a stat the record does carry makes the whole block the source's
    /// own account.
    /// </remarks>
    internal static bool StatesInertModifiers(
        OutfittingModule stats,
        IReadOnlyList<EngineeringModifier> modifiers)
    {
        foreach (EngineeringModifier modifier in modifiers)
        {
            if (ModuleStatLabels.ShareFor(modifier.Label) is not null) return false;
            if (ModuleStatLabels.CapabilityValueFor(modifier.Label) is not null) return false;

            ModuleStat? stat = ModuleStatLabels.StatFor(modifier.Label, stats.Stats);
            if (stat is not null && stats.Stats.Has(stat.Value)) return false;
        }

        return true;
    }

    /// <summary>Whether an imported module that overlaps a fixed reward is an ordinary roll.</summary>
    /// <returns>
    /// <see cref="OrdinaryEngineeringProof.NotFixedCandidate"/> when no fixed article shares the
    /// recipe and so nothing needs proving; <see cref="OrdinaryEngineeringProof.Proven"/> when
    /// the stated modifiers exactly describe the ordinary roll; and
    /// <see cref="OrdinaryEngineeringProof.Unproven"/> otherwise.
    /// </returns>
    internal static OrdinaryEngineeringProof ProveOrdinaryEngineering(
        string item,
        ModuleEngineering engineering,
        ExperimentalEffect? experimental,
        bool experimentalUnresolved)
    {
        string recipe = BlueprintJournal.ResolveForModule(item, engineering.BlueprintName);
        bool fixedCandidate = false;
        foreach (PreEngineeredVariant candidate in PreEngineeredCatalogue.VariantsFor(item))
        {
            if (candidate.Acquisition != PreEngineeredAcquisition.Mercenary
                && RegistryIndex.KeyComparer.Equals(candidate.BlueprintSymbol.Trim(), recipe.Trim()))
            {
                fixedCandidate = true;
                break;
            }
        }

        if (!fixedCandidate) return OrdinaryEngineeringProof.NotFixedCandidate;

        BlueprintGrade? grade = BlueprintCatalogue.FindGrade(recipe, engineering.Level);
        double quality = engineering.Quality;
        OutfittingModule? stock = ModuleCatalogue.FindBySymbol(item);
        if (stock is null
            || grade is null
            || experimentalUnresolved
            || double.IsNaN(quality)
            || double.IsInfinity(quality)
            || quality < 0
            || quality > 1)
        {
            return OrdinaryEngineeringProof.Unproven;
        }

        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(stock);
        (BlueprintGrade canonical, ExperimentalEffect? effect) =
            PrimitiveInputsFor(stock, grade, experimental);
        if (MissingBaseLabels(stock, baseStats, canonical.Features, effect?.Modifiers).Count > 0)
        {
            return OrdinaryEngineeringProof.Unproven;
        }

        List<EngineeringModifier> calculated = JournalModifiersFor(
            stock, Engineering.ComputeModifiers(baseStats, canonical, quality, effect));
        AppendDamageShares(
            calculated, stock, effect?.DamageDistribution ?? canonical.DamageDistribution);
        return MatchesCalculatedModifiers(engineering.Modifiers, calculated)
            ? OrdinaryEngineeringProof.Proven
            : OrdinaryEngineeringProof.Unproven;
    }

    /// <summary>Adds the damage shares a conversion writes to a journal modifier block.</summary>
    internal static void AppendDamageShares(
        List<EngineeringModifier> modifiers,
        OutfittingModule stock,
        DamageDistribution? converted)
    {
        if (converted is null) return;

        foreach (DamageShare share in new[]
        {
            DamageShare.Kinetic, DamageShare.Thermal, DamageShare.Explosive, DamageShare.Absolute,
        })
        {
            if (ModuleStatLabels.ShareOf(converted, share) is not double value) continue;
            List<string> labels = ModuleStatLabels.LabelsForShare(share);
            if (labels.Count == 0) continue;

            string label = labels[0];
            double scale = ModuleStatLabels.ScaleFor(label);
            modifiers.Add(new EngineeringModifier(
                label,
                value * scale,
                (ModuleStatLabels.ShareOf(stock.DamageDistribution, share) ?? 0) * scale));
        }
    }

    /// <summary>
    /// Whether a stated recipe identifies a final pre-engineered Guardian weapon.
    /// </summary>
    /// <remarks>
    /// A Guardian weapon's stock module offers Anti-Guardian Zone Resistance and nothing else. A
    /// journal or a build that instead names a real weapon recipe describes the bought or
    /// awarded article carrying that recipe, articles the narrower pre-engineered catalogue does
    /// not list included. Such an article accepts no further engineering.
    /// </remarks>
    internal static bool IsFinalGuardianWeaponEngineering(string item, string blueprint)
    {
        EngineeringGroupId? group = EngineeringOptions.GroupFor(item);
        if (group is null) return false;

        bool guardian = false;
        foreach (EngineeringGroupId weapon in GuardianWeaponGroups)
        {
            if (group.Value == weapon) guardian = true;
        }

        if (!guardian) return false;

        string resolved = BlueprintJournal.ResolveForModule(item, blueprint);
        return BlueprintCatalogue.Find(resolved) is not null
            && !BlueprintAvailableFor(item, blueprint);
    }

    /// <summary>
    /// The blueprints a fitted module accepts whose modifiers can also be computed.
    /// </summary>
    /// <remarks>
    /// The ordinary menu comes first, then any bespoke Mercenary recipes in catalogue order.
    /// Fixed community-goal and tech-broker rewards add nothing. An article sold in a final
    /// state offers none at all.
    /// </remarks>
    internal static List<AvailableBlueprint> AvailableBlueprintsFor(
        string item,
        OutfittingModule? statsOverride = null)
    {
        List<AvailableBlueprint> available = [];
        OutfittingModule? stats = statsOverride ?? ModuleCatalogue.FindBySymbol(item);
        if (stats is null || stats.EngineeringLocked) return available;

        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(stats);
        foreach (KeyValuePair<string, BlueprintRoute> route in BlueprintRoutesFor(item))
        {
            if (!BlueprintCatalogue.All.TryGetValue(route.Key, out Blueprint? blueprint)) continue;

            List<int> grades = [];
            foreach (KeyValuePair<int, BlueprintGrade> entry in blueprint.Grades)
            {
                if (MissingBaseLabels(stats, baseStats, entry.Value.Features).Count == 0)
                {
                    grades.Add(entry.Key);
                }
            }

            grades.Sort();
            if (grades.Count > 0) available.Add(new AvailableBlueprint(route.Key, grades, route.Value));
        }

        return available;
    }

    /// <summary>
    /// The experimental effects a fitted article offers whose modifiers can also be computed.
    /// </summary>
    internal static List<string> AvailableExperimentalsFor(
        string item,
        OutfittingModule? statsOverride = null)
    {
        List<string> available = [];
        OutfittingModule? stats = statsOverride ?? ModuleCatalogue.FindBySymbol(item);
        if (stats is null || stats.EngineeringLocked) return available;

        Dictionary<string, double> baseStats = ModuleStatLabels.BaseStats(stats);
        foreach (string symbol in EngineeringOptions.ExperimentalsFor(item))
        {
            ExperimentalEffect? effect = ExperimentalEffectCatalogue.Find(symbol);
            if (effect is null) continue;
            if (MissingBaseLabels(stats, baseStats, [], effect.Modifiers).Count == 0)
            {
                available.Add(symbol);
            }
        }

        return available;
    }
    /// <summary>The order Frontier's own outfitting and journal stat list uses.</summary>
    private static readonly string[] JournalModifierOrder =
    [
        "CargoCapacity", "GuardianModuleResistance", "Mass", "Integrity", "PowerDraw", "BootTime",
        "PowerCapacity", "HeatEfficiency", "FSDOptimalMass", "MaxFuelPerJump", "FSDHeatRate",
        "EngineOptimalMass", "EngineOptPerformance", "EngineHeatRate", "ShieldGenOptimalMass",
        "ShieldGenStrength", "DamagePerSecond", "Damage", "DistributorDraw", "ThermalLoad",
        "ArmourPenetration", "MaximumRange", "ShotSpeed", "RateOfFire", "DamageType", "$Kinetic;",
        "$Thermal;", "$Explosive;", "$Absolute;", "AmmoClipSize", "AmmoMaximum", "ReloadTime",
        "Jitter", "DamageFalloffRange", "DefenceModifierShieldMultiplier",
        "DefenceModifierHealthMultiplier", "DefenceModifierHealthAddition",
        "DefenceModifierShieldAddition", "RegenRate", "BrokenRegenRate", "EnergyPerRegen",
        "KineticResistance", "ThermicResistance", "ExplosiveResistance", "CausticResistance",
        "DamageProtection", "ModuleDefenceAbsorption", "WeaponsCapacity", "WeaponsRecharge",
        "EnginesCapacity", "EnginesRecharge", "SystemsCapacity", "SystemsRecharge",
        "ShieldBankSpinUp", "ShieldBankDuration", "ShieldBankReinforcement", "ShieldBankHeat",
        "FSDInterdictorRange", "FSDInterdictorFacingLimit", "SensorTargetScanAngle", "MaxAngle",
        "ScannerTimeToScan", "Range", "DSS_PatchRadius", "FuelScoopRate", "FuelCapacity",
    ];

    private static readonly Dictionary<string, int> JournalModifierRank = BuildRank();

    /// <summary>The burst-pattern labels a journal reports as one rate of fire.</summary>
    private static readonly string[] BurstLabels = ["BurstInterval", "BurstSize", "BurstRateOfFire"];

    private static Dictionary<string, int> BuildRank()
    {
        Dictionary<string, int> rank = new(JournalModifierOrder.Length, StringComparer.Ordinal);
        for (int index = 0; index < JournalModifierOrder.Length; index++)
        {
            rank[JournalModifierOrder[index]] = index;
        }

        return rank;
    }

    /// <summary>A discrete weapon's displayed damage per second, from a cycle where one exists.</summary>
    private static double Float32DamagePerSecond(
        double damage,
        double rounds,
        double rate,
        double burstRounds,
        double? cycle)
    {
        double Fround(double value) => EngineeringPrecision.Fround(value);
        if (cycle is double seconds && (rounds != 1 || burstRounds != 1))
        {
            double perCycle = Fround(Fround(Fround(damage) * Fround(rounds)) * Fround(burstRounds));
            return Fround(perCycle / seconds);
        }

        return Fround(Fround(Fround(damage) * Fround(rounds)) * Fround(rate));
    }

    /// <summary>Presents computed primitive modifiers the way Frontier writes them to a journal.</summary>
    /// <remarks>
    /// This does no blueprint arithmetic. It maps the one calculated result onto the
    /// module-specific aliases and derives the displayed stats a journal carries, which for a
    /// weapon are its damage per second and its rate of fire.
    /// </remarks>
    internal static List<EngineeringModifier> JournalModifiersFor(
        OutfittingModule stats,
        IReadOnlyList<EngineeringModifier> modifiers)
    {
        ModuleStats carried = stats.Stats;
        bool weapon = carried.Has(ModuleStat.Damage);
        (EngineeringModifier? damagePerSecond, EngineeringModifier? derivedRate) =
            weapon ? WeaponDisplayStats(stats, modifiers) : (null, null);

        List<EngineeringModifier> result = new(modifiers.Count + 2);
        foreach (EngineeringModifier modifier in modifiers)
        {
            string label = modifier.Label;
            if (weapon && IsBurstLabel(label)) continue;

            // A continuous weapon publishes its damage per second alone: the per-round figure
            // behind it is not a stat the game shows for one.
            if (weapon && label == "Damage" && !carried.Has(ModuleStat.RateOfFire)) continue;

            string journalLabel = JournalLabelFor(carried, label);
            result.Add(journalLabel == label ? modifier : modifier with { Label = journalLabel });
        }

        if (damagePerSecond is not null) result.Add(damagePerSecond);
        if (derivedRate is not null)
        {
            int direct = result.FindIndex(
                modifier => string.Equals(modifier.Label, "RateOfFire", StringComparison.Ordinal));
            if (direct >= 0) result[direct] = derivedRate;
            else result.Add(derivedRate);
        }

        return SortJournalModifiers(result);
    }

    private static string JournalLabelFor(ModuleStats carried, string label) => label switch
    {
        "Range" when carried.Has(ModuleStat.MaximumRange) => "MaximumRange",
        "FalloffRange" when carried.Has(ModuleStat.FalloffRange) => "DamageFalloffRange",
        "ScannerRange" when carried.Has(ModuleStat.ScannerRange) => "Range",
        "ProbeRadius" => "DSS_PatchRadius",
        "RefuelRate" => "FuelScoopRate",
        "DistributorDraw" when carried.Has(ModuleStat.ShieldRegenRate) => "EnergyPerRegen",
        _ => label,
    };

    private static bool IsBurstLabel(string label)
    {
        foreach (string burst in BurstLabels)
        {
            if (string.Equals(label, burst, StringComparison.Ordinal)) return true;
        }

        return false;
    }

    private static EngineeringModifier? Find(
        IReadOnlyList<EngineeringModifier> modifiers,
        string label)
    {
        foreach (EngineeringModifier modifier in modifiers)
        {
            if (string.Equals(modifier.Label, label, StringComparison.Ordinal)) return modifier;
        }

        return null;
    }

    private static double ValueFor(
        IReadOnlyList<EngineeringModifier> modifiers,
        string label,
        double fallback)
    {
        EngineeringModifier? modifier = Find(modifiers, label);
        double? stated = modifier is null ? null : modifier.PreciseValue;
        return stated ?? EngineeringPrecision.Fround(fallback);
    }

    /// <summary>The damage per second, and the rate of fire, a moved weapon publishes.</summary>
    private static (EngineeringModifier? DamagePerSecond, EngineeringModifier? RateOfFire)
        WeaponDisplayStats(OutfittingModule stats, IReadOnlyList<EngineeringModifier> modifiers)
    {
        ModuleStats carried = stats.Stats;
        bool burstTouched = false;
        foreach (string label in BurstLabels)
        {
            if (Find(modifiers, label) is not null) burstTouched = true;
        }

        bool damageTouched = Find(modifiers, "Damage") is not null;
        bool rateTouched = burstTouched || Find(modifiers, "RateOfFire") is not null;
        if (!damageTouched && !rateTouched) return (null, null);

        double baseDamage = EngineeringPrecision.Fround(carried[ModuleStat.Damage]!.Value);
        double effectiveDamage = ValueFor(modifiers, "Damage", carried[ModuleStat.Damage]!.Value);
        bool continuous = !carried.Has(ModuleStat.BurstInterval) && !carried.Has(ModuleStat.RateOfFire);
        if (continuous)
        {
            return (
                new EngineeringModifier(
                    "DamagePerSecond",
                    EngineeringPrecision.Round6(effectiveDamage),
                    EngineeringPrecision.Round6(baseDamage)),
                null);
        }

        // Normalized once, so the cycle, the rate and the damage per second built on them all
        // read one burst pattern.
        double burstRounds = EngineeringPrecision.BurstPartOrOne(
            ValueFor(modifiers, "BurstSize", carried[ModuleStat.BurstRounds] ?? 1));
        double burstRate = EngineeringPrecision.BurstPartOrOne(
            ValueFor(modifiers, "BurstRateOfFire", carried[ModuleStat.BurstRateOfFire] ?? 1));
        double baseBurstRounds = EngineeringPrecision.Fround(
            EngineeringPrecision.BurstPartOrOne(carried[ModuleStat.BurstRounds]));
        double baseBurstRate = EngineeringPrecision.Fround(
            EngineeringPrecision.BurstPartOrOne(carried[ModuleStat.BurstRateOfFire]));

        double? baseInterval = carried[ModuleStat.BurstInterval] is double stated
            ? EngineeringPrecision.Fround(stated)
            : null;
        double? baseCycle = baseInterval is double interval
            ? EngineeringPrecision.Float32FiringCycle(interval, baseBurstRounds, baseBurstRate)
            : null;
        double? baseRate = baseInterval is double stock
            ? EngineeringPrecision.JournalRateOfFire(stock, baseBurstRounds, baseBurstRate)
            : carried[ModuleStat.RateOfFire] is double rated
                ? EngineeringPrecision.Fround(rated)
                : null;

        EngineeringModifier? rateModifier = Find(modifiers, "RateOfFire");
        double? effectiveRate = rateModifier?.PreciseValue;
        double effectiveInterval = ValueFor(
            modifiers, "BurstInterval", carried[ModuleStat.BurstInterval] ?? 0);
        double? effectiveCycle = effectiveRate is null
            ? EngineeringPrecision.Float32FiringCycle(effectiveInterval, burstRounds, burstRate)
            : null;
        double? rate = effectiveRate
            ?? (effectiveCycle is double cycle
                ? EngineeringPrecision.Fround(EngineeringPrecision.Fround(burstRounds) / cycle)
                : null);

        if (baseRate is not double stockRate || rate is not double moved) return (null, null);

        double stockRounds = EngineeringPrecision.Fround(carried[ModuleStat.RoundsPerShot] ?? 1);
        EngineeringModifier? rounds = Find(modifiers, "Rounds") ?? Find(modifiers, "RoundsPerShot");
        double effectiveRounds = EngineeringPrecision.Fround(rounds?.Value ?? stockRounds);

        EngineeringModifier damagePerSecond = new(
            "DamagePerSecond",
            EngineeringPrecision.Round6(Float32DamagePerSecond(
                effectiveDamage, effectiveRounds, moved, burstRounds, effectiveCycle)),
            EngineeringPrecision.Round6(Float32DamagePerSecond(
                baseDamage, stockRounds, stockRate, baseBurstRounds, baseCycle)));

        EngineeringModifier? derivedRate = burstTouched
            ? new EngineeringModifier(
                "RateOfFire",
                EngineeringPrecision.Round6(moved),
                EngineeringPrecision.Round6(stockRate))
            : null;
        return (damagePerSecond, derivedRate);
    }

    private static List<EngineeringModifier> SortJournalModifiers(List<EngineeringModifier> modifiers)
    {
        List<(EngineeringModifier Modifier, int Rank, int Source)> ranked = new(modifiers.Count);
        for (int index = 0; index < modifiers.Count; index++)
        {
            int rank = JournalModifierRank.TryGetValue(modifiers[index].Label, out int found)
                ? found
                : JournalModifierOrder.Length;
            ranked.Add((modifiers[index], rank, index));
        }

        ranked.Sort((left, right) => left.Rank != right.Rank
            ? left.Rank.CompareTo(right.Rank)
            : left.Source.CompareTo(right.Source));

        List<EngineeringModifier> sorted = new(ranked.Count);
        foreach ((EngineeringModifier modifier, _, _) in ranked) sorted.Add(modifier);
        return sorted;
    }
}

/// <summary>Whether a captured block proves the ordinary roll it names.</summary>
internal enum OrdinaryEngineeringProof
{
    /// <summary>No fixed article shares the recipe, so nothing needs proving.</summary>
    NotFixedCandidate,

    /// <summary>The stated modifiers exactly describe the ordinary roll.</summary>
    Proven,

    /// <summary>The stated modifiers do not, so the block may describe a fixed article.</summary>
    Unproven,
}
