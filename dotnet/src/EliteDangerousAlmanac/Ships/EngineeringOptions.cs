using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>What one group of modules can be engineered with.</summary>
/// <param name="Blueprints">The blueprint identifiers the group accepts.</param>
/// <param name="Experimentals">The experimental-effect identifiers the group accepts.</param>
/// <remarks>
/// A group carries no display name, because the game has no engineering-group label to carry: an
/// engineering menu is headed by the module's own outfitting family. Name a group by naming that
/// family.
/// </remarks>
public sealed record EngineeringOptionGroup(
    IReadOnlyList<string> Blueprints,
    IReadOnlyList<string> Experimentals);

/// <summary>
/// The ordinary engineering options: which blueprints and experimental effects appear in a stock
/// module's ordinary engineering menu.
/// </summary>
/// <remarks>
/// <para>
/// Availability is a property of the module, not of the blueprint. A Pulse Laser accepts the
/// Efficient blueprint and a Rail Gun does not, and the two offer different experimental effects
/// even where their blueprints overlap. So modules are grouped, and each group lists what it
/// offers.
/// </para>
/// <para>
/// A group is one menu. Where the same kind of module comes in two flavours with different
/// menus, they are two groups: a Guardian power plant takes only Anti-Guardian Zone Resistance
/// and an ordinary one takes only the ordinary recipes. The Guardian half of each pair takes no
/// experimental effect, because Anti-Guardian Zone Resistance is the whole menu and it has no
/// experimental slot.
/// </para>
/// <para>
/// A stock module with no ordinary menu is absent. A few of those still keep a Mercenary
/// upgrade route through their bespoke recipes, which no menu lists.
/// </para>
/// </remarks>
public static class EngineeringOptions
{
    private static readonly Lazy<OptionsCatalogue> Catalogue = new(Load);

    /// <summary>Every module group that can be engineered, keyed by its group identifier.</summary>
    public static IReadOnlyDictionary<EngineeringGroupId, EngineeringOptionGroup> Groups =>
        Catalogue.Value.Groups;

    /// <summary>The group a module is engineered as.</summary>
    /// <param name="symbol">
    /// A module symbol, such as <c>Hpt_BeamLaser_Fixed_Small</c>. Leading and trailing whitespace
    /// and case are ignored.
    /// </param>
    /// <returns>
    /// The group identifier, or <see langword="null"/> when this catalogue does not group the
    /// module. That answer means the stock module has no ordinary engineering menu, which for
    /// nearly every ungrouped module is the same as having no engineering route at all.
    /// </returns>
    public static EngineeringGroupId? GroupFor(string? symbol)
    {
        string? key = RegistryIndex.NormalizeKey(symbol);
        if (key is null) return null;
        return Catalogue.Value.ModuleGroups.TryGetValue(key, out EngineeringGroupId group) ? group : null;
    }

    /// <summary>Every blueprint in a stock module's ordinary engineering menu.</summary>
    /// <param name="symbol">A module symbol. Whitespace and case are ignored.</param>
    /// <returns>
    /// The blueprint identifiers, sorted. A module this catalogue does not group answers an
    /// empty list rather than <see langword="null"/>, so the result is always safe to iterate.
    /// </returns>
    /// <remarks>
    /// Where a modification applies to several module families the game writes a family-specific
    /// identifier, and <see cref="BlueprintCatalogue"/> carries both that and the generic
    /// spelling. The family-specific identifier is the one listed, so compare identifiers with
    /// that in mind: the two are the same recipe. The three colliding journal spellings are not
    /// such pairs, and <see cref="BlueprintJournal"/> settles them.
    /// </remarks>
    public static IReadOnlyList<string> BlueprintsFor(string? symbol)
    {
        EngineeringGroupId? group = GroupFor(symbol);
        return group is null ? [] : Groups[group.Value].Blueprints;
    }

    /// <summary>
    /// Every experimental effect in a stock module's ordinary menu: its group's list, less the
    /// effects that particular module is excluded from.
    /// </summary>
    /// <param name="symbol">A module symbol. Whitespace and case are ignored.</param>
    /// <returns>The experimental-effect identifiers this module accepts.</returns>
    /// <remarks>
    /// Most modules take their whole group's list, but some are exceptions: most multi-cannons
    /// cannot take Phasing Sequence, and dumbfire racks cannot take Drag Munitions. An empty
    /// list is the common answer, and it usually means "blueprints only": whole groups offer no
    /// experimental effect at all. An ungrouped module answers empty too, and
    /// <see cref="GroupFor"/> tells the two apart.
    /// </remarks>
    public static IReadOnlyList<string> ExperimentalsFor(string? symbol)
    {
        string? key = RegistryIndex.NormalizeKey(symbol);
        if (key is null) return [];
        if (!Catalogue.Value.ModuleGroups.TryGetValue(key, out EngineeringGroupId group)) return [];

        IReadOnlyList<string> offered = Groups[group].Experimentals;
        if (!Catalogue.Value.ModuleExclusions.TryGetValue(key, out HashSet<string>? excluded)) return offered;

        List<string> allowed = new(offered.Count);
        foreach (string effect in offered)
        {
            if (!excluded.Contains(effect)) allowed.Add(effect);
        }

        return new ReadOnlyCollection<string>(allowed);
    }

    /// <summary>
    /// Every experimental effect that can be paired with a blueprint, across all the module
    /// groups that accept it.
    /// </summary>
    /// <param name="blueprintSymbol">
    /// A blueprint identifier, such as <c>Weapon_Efficient</c>. Whitespace and case are ignored.
    /// </param>
    /// <returns>
    /// The experimental-effect identifiers, sorted and without duplicates. It is empty when no
    /// group names the blueprint, and when its groups take no experimental effect.
    /// </returns>
    /// <remarks>
    /// Because availability is per module, this is the union: engineering a Rail Gun with Long
    /// Range does not offer every effect listed here, only its own group's. Use
    /// <see cref="ExperimentalsFor"/> once you know the module, which is the exact answer.
    /// </remarks>
    public static IReadOnlyList<string> ExperimentalsForBlueprint(string? blueprintSymbol)
    {
        string? key = RegistryIndex.NormalizeKey(blueprintSymbol);
        if (key is null) return [];

        SortedSet<string> effects = new(StringComparer.Ordinal);
        foreach (EngineeringOptionGroup group in Groups.Values)
        {
            bool offers = false;
            foreach (string blueprint in group.Blueprints)
            {
                if (RegistryIndex.KeyComparer.Equals(blueprint, key))
                {
                    offers = true;
                    break;
                }
            }

            if (!offers) continue;
            foreach (string effect in group.Experimentals) effects.Add(effect);
        }

        return new ReadOnlyCollection<string>([.. effects]);
    }

    private static OptionsCatalogue Load()
    {
        OptionsFile file = SharedData.Load<OptionsFile>("data/ships/engineering-options.jsonc");

        Dictionary<EngineeringGroupId, EngineeringOptionGroup> groups = new(file.Groups.Count);
        foreach (KeyValuePair<string, EngineeringOptionGroup> entry in file.Groups)
        {
            if (!EnumParsing.TryParse(entry.Key, out EngineeringGroupId id))
            {
                throw new InvalidOperationException(string.Format(
                    CultureInfo.InvariantCulture,
                    "The engineering options name an unknown group '{0}'.",
                    entry.Key));
            }

            groups[id] = new EngineeringOptionGroup(
                ReadOnlyLists.Freeze(entry.Value.Blueprints),
                ReadOnlyLists.Freeze(entry.Value.Experimentals));
        }

        Dictionary<string, EngineeringGroupId> moduleGroups = new(file.Modules.Count, RegistryIndex.KeyComparer);
        foreach (KeyValuePair<string, string> entry in file.Modules)
        {
            if (!EnumParsing.TryParse(entry.Value, out EngineeringGroupId id))
            {
                throw new InvalidOperationException(string.Format(
                    CultureInfo.InvariantCulture,
                    "The engineering options group '{0}' as an unknown '{1}'.",
                    entry.Key,
                    entry.Value));
            }

            moduleGroups[entry.Key] = id;
        }

        Dictionary<string, HashSet<string>> exclusions = new(file.Exclusions.Count, RegistryIndex.KeyComparer);
        foreach (KeyValuePair<string, string[]> entry in file.Exclusions)
        {
            exclusions[entry.Key] = new HashSet<string>(entry.Value, RegistryIndex.KeyComparer);
        }

        return new OptionsCatalogue(
            new ReadOnlyDictionary<EngineeringGroupId, EngineeringOptionGroup>(groups),
            moduleGroups,
            exclusions);
    }

    private sealed record OptionsFile(
        Dictionary<string, EngineeringOptionGroup> Groups,
        Dictionary<string, string> Modules,
        Dictionary<string, string[]> Exclusions);

    private sealed record OptionsCatalogue(
        IReadOnlyDictionary<EngineeringGroupId, EngineeringOptionGroup> Groups,
        Dictionary<string, EngineeringGroupId> ModuleGroups,
        Dictionary<string, HashSet<string>> ModuleExclusions);
}
