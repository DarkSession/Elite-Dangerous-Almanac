using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Text.Json.Serialization;
using EliteDangerousAlmanac.Equipment.Internal;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>One weapon a suit loadout event states.</summary>
/// <param name="SlotName">Frontier's journal slot name, such as <c>PrimaryWeapon1</c>.</param>
/// <param name="ModuleName">The weapon's item symbol.</param>
/// <param name="Class">The grade the weapon is owned at.</param>
/// <param name="SuitModuleId">The game's own identifier for this fitted weapon.</param>
/// <param name="ModuleNameLocalised">The weapon's display name in the player's language.</param>
/// <param name="WeaponMods">The modification symbols the weapon carries.</param>
public sealed record SuitLoadoutModuleEvent(
    [property: JsonPropertyName("SlotName")] string SlotName,
    [property: JsonPropertyName("ModuleName")] string ModuleName,
    [property: JsonPropertyName("Class")] int Class,
    [property: JsonPropertyName("SuitModuleID")] long? SuitModuleId = null,
    [property: JsonPropertyName("ModuleName_Localised")] string? ModuleNameLocalised = null,
    [property: JsonPropertyName("WeaponMods")] IReadOnlyList<string>? WeaponMods = null);

/// <summary>A suit loadout as the player journal states it.</summary>
/// <param name="SuitName">The suit's grade-specific item symbol, such as <c>tacticalsuit_class5</c>.</param>
/// <param name="SuitId">The game's own identifier for the owned suit.</param>
/// <param name="SuitNameLocalised">The suit's display name in the player's language.</param>
/// <param name="SuitMods">The modification symbols the suit carries.</param>
/// <param name="LoadoutId">The game's own identifier for the saved loadout.</param>
/// <param name="LoadoutName">The name the player gave the loadout.</param>
/// <param name="Modules">The weapons the loadout fits.</param>
/// <remarks>
/// The <c>SuitLoadout</c>, <c>CreateSuitLoadout</c> and <c>SwitchSuitLoadout</c> events all
/// carry this shape.
/// </remarks>
public sealed record SuitLoadoutEvent(
    [property: JsonPropertyName("SuitName")] string SuitName,
    [property: JsonPropertyName("SuitID")] long? SuitId = null,
    [property: JsonPropertyName("SuitName_Localised")] string? SuitNameLocalised = null,
    [property: JsonPropertyName("SuitMods")] IReadOnlyList<string>? SuitMods = null,
    [property: JsonPropertyName("LoadoutID")] long? LoadoutId = null,
    [property: JsonPropertyName("LoadoutName")] string? LoadoutName = null,
    [property: JsonPropertyName("Modules")] IReadOnlyList<SuitLoadoutModuleEvent>? Modules = null);

/// <summary>One modification a read loadout fitted.</summary>
/// <param name="JournalSymbol">The symbol the event states.</param>
/// <param name="Symbol">The recipe symbol the catalogue is keyed by.</param>
/// <param name="Modification">The recipe itself.</param>
public sealed record FittedPersonalModification(
    string JournalSymbol,
    string Symbol,
    PersonalModification Modification);

/// <summary>One weapon a read loadout fitted, and what it deals.</summary>
/// <param name="Mount">The mount key the weapon sits on.</param>
/// <param name="Weapon">The weapon itself.</param>
/// <param name="Grade">The grade the weapon is owned at.</param>
/// <param name="Modifications">The modifications the weapon carries.</param>
/// <param name="Modifiers">
/// Every stat change acting on the weapon: its own modifications, and the suit
/// modifications that name a stat the weapon carries.
/// </param>
/// <param name="ReloadSpeed">Whether the reload-speed modification is fitted.</param>
/// <param name="Scope">Whether the scope modification is fitted.</param>
/// <param name="Metrics">What the weapon deals with those changes applied.</param>
/// <param name="ModuleId">The game's own identifier for this fitted weapon.</param>
public sealed record FittedPersonalWeapon(
    string Mount,
    PersonalWeapon Weapon,
    int Grade,
    IReadOnlyList<FittedPersonalModification> Modifications,
    IReadOnlyList<PersonalModifier> Modifiers,
    bool ReloadSpeed,
    bool Scope,
    PersonalWeaponMetrics Metrics,
    long? ModuleId = null);

/// <summary>What a read loadout could not fit, and why.</summary>
public enum SuitLoadoutImportAction
{
    /// <summary>No catalogue carries the stated weapon.</summary>
    UnknownWeapon,

    /// <summary>The suit has no mount by the stated name.</summary>
    UnknownMount,

    /// <summary>The mount does not take a weapon of that kind.</summary>
    RefusedMount,

    /// <summary>The stated grade is not a whole number from one through five.</summary>
    UnknownGrade,

    /// <summary>No catalogue carries the stated modification.</summary>
    UnknownModification,

    /// <summary>The modification is fitted to the other kind of article.</summary>
    RefusedModification,
}

/// <summary>One thing a read loadout passed over, and what it was.</summary>
/// <param name="Action">Why the entry was passed over.</param>
/// <param name="Mount">
/// The mount the entry names, in the event's own spelling. A suit modification names none.
/// </param>
/// <param name="SourceSymbol">The symbol the event states, in its own spelling.</param>
public sealed record SuitLoadoutImportOutcome(
    SuitLoadoutImportAction Action,
    string? Mount,
    string SourceSymbol);

/// <summary>A suit loadout read from a journal event.</summary>
/// <param name="Suit">The suit the event names.</param>
/// <param name="Grade">The grade the suit is owned at.</param>
/// <param name="Stats">The suit's stats at that grade.</param>
/// <param name="Modifications">The modifications the suit carries.</param>
/// <param name="Modifiers">The stat changes those modifications make.</param>
/// <param name="Weapons">The weapons the loadout fits, in the event's own order.</param>
/// <param name="ImportOutcomes">Everything the read passed over, in the order it was met.</param>
/// <param name="SuitId">The game's own identifier for the owned suit.</param>
/// <param name="LoadoutId">The game's own identifier for the saved loadout.</param>
/// <param name="Name">The name the player gave the loadout.</param>
public sealed record SuitLoadout(
    Suit Suit,
    int Grade,
    SuitGrade Stats,
    IReadOnlyList<FittedPersonalModification> Modifications,
    IReadOnlyList<PersonalModifier> Modifiers,
    IReadOnlyList<FittedPersonalWeapon> Weapons,
    IReadOnlyList<SuitLoadoutImportOutcome> ImportOutcomes,
    long? SuitId = null,
    long? LoadoutId = null,
    string? Name = null)
{
    private const string ReloadSpeedSymbol = "weapon_reloadspeed";
    private const string ScopeSymbol = "weapon_scope";

    /// <summary>Reads a suit loadout event.</summary>
    /// <param name="loadout">The event, as the journal states it.</param>
    /// <returns>The loadout, with every weapon fitted and every stat change applied.</returns>
    /// <exception cref="ArgumentNullException">The event, or a field it must carry, is absent.</exception>
    /// <exception cref="FormatException">
    /// No catalogue carries the stated suit, or one mount is named twice.
    /// </exception>
    /// <remarks>
    /// A read never refuses an entry it can pass over: an unknown weapon, an unknown mount,
    /// a grade outside the ladder and an unknown modification are all reported in
    /// <see cref="ImportOutcomes"/> and the rest of the loadout is read. What it refuses is
    /// an event it cannot identify a suit from, and one that fits two weapons to one mount.
    /// </remarks>
    public static SuitLoadout Parse(SuitLoadoutEvent loadout)
    {
        if (loadout is null) throw new ArgumentNullException(nameof(loadout));
        if (loadout.SuitName is null)
        {
            throw new ArgumentNullException(nameof(loadout), "The event states no suit.");
        }

        SuitIdentity? identified = SuitCatalogue.FindBySymbol(loadout.SuitName);
        if (identified is null)
        {
            throw new FormatException(string.Format(
                CultureInfo.InvariantCulture,
                "No suit carries the symbol \"{0}\".",
                TextPreview.Truncate(loadout.SuitName)));
        }

        // The symbol was read off this suit's own grade record, so the grade is one it has.
        SuitGrade stats = SuitCatalogue.Grade(identified.Suit, identified.Grade)!;

        List<SuitLoadoutImportOutcome> outcomes = [];
        ReadOnlyCollection<FittedPersonalModification> modifications = ResolveModifications(
            loadout.SuitMods ?? [], weapon: null, mount: null, outcomes);

        return new SuitLoadout(
            identified.Suit,
            identified.Grade,
            stats,
            modifications,
            Changes(modifications),
            FitWeapons(loadout.Modules ?? [], identified.Suit, modifications, outcomes),
            new ReadOnlyCollection<SuitLoadoutImportOutcome>(outcomes),
            loadout.SuitId,
            loadout.LoadoutId,
            loadout.LoadoutName);
    }

    private static ReadOnlyCollection<PersonalModifier> Changes(
        IReadOnlyList<FittedPersonalModification> modifications)
    {
        List<PersonalModifier> changes = [];
        foreach (FittedPersonalModification fitted in modifications)
        {
            changes.AddRange(fitted.Modification.Modifiers);
        }

        return new ReadOnlyCollection<PersonalModifier>(changes);
    }

    private static ReadOnlyCollection<FittedPersonalModification> ResolveModifications(
        IReadOnlyList<string> stated,
        PersonalWeapon? weapon,
        string? mount,
        List<SuitLoadoutImportOutcome> outcomes)
    {
        PersonalModificationTarget target = weapon is null
            ? PersonalModificationTarget.Suit
            : PersonalModificationTarget.Weapon;

        List<FittedPersonalModification> fitted = [];
        foreach (string journalSymbol in stated)
        {
            if (journalSymbol is null)
            {
                throw new ArgumentNullException(nameof(stated), "A modification symbol is absent.");
            }

            // A journal writes a recipe symbol in whatever case it pleases, and one
            // spelling can name a recipe in each weapon menu. A fit reports the
            // catalogue's own spelling, so two builds that state one recipe differently
            // still compare equal.
            string named = weapon is null
                ? journalSymbol
                : ModificationJournal.ResolveForWeapon(weapon.Symbol, journalSymbol);

            string? symbol = PersonalModificationCatalogue.CanonicalSymbol(named);
            PersonalModification? modification = PersonalModificationCatalogue.Find(symbol);
            if (symbol is null || modification is null)
            {
                outcomes.Add(new SuitLoadoutImportOutcome(
                    SuitLoadoutImportAction.UnknownModification, mount, journalSymbol));
                continue;
            }

            if (modification.Target != target)
            {
                outcomes.Add(new SuitLoadoutImportOutcome(
                    SuitLoadoutImportAction.RefusedModification, mount, journalSymbol));
                continue;
            }

            fitted.Add(new FittedPersonalModification(journalSymbol, symbol, modification));
        }

        return new ReadOnlyCollection<FittedPersonalModification>(fitted);
    }

    private static ReadOnlyCollection<FittedPersonalWeapon> FitWeapons(
        IReadOnlyList<SuitLoadoutModuleEvent> modules,
        Suit suit,
        IReadOnlyList<FittedPersonalModification> suitModifications,
        List<SuitLoadoutImportOutcome> outcomes)
    {
        List<FittedPersonalWeapon> weapons = [];
        HashSet<string> taken = new(RegistryIndex.KeyComparer);
        for (int index = 0; index < modules.Count; index++)
        {
            SuitLoadoutModuleEvent module = modules[index];
            if (module is null)
            {
                throw new ArgumentNullException(nameof(modules), "A fitted weapon is absent.");
            }

            if (module.SlotName is null || module.ModuleName is null)
            {
                throw new ArgumentNullException(
                    nameof(modules), "A fitted weapon states no mount or no symbol.");
            }

            string key = module.SlotName.Trim();
            if (!taken.Add(key))
            {
                throw new FormatException(string.Format(
                    CultureInfo.InvariantCulture,
                    "The event fits two weapons to the mount \"{0}\".",
                    TextPreview.Truncate(module.SlotName)));
            }

            PersonalMount? mount = MountFor(suit, key);
            if (mount is null)
            {
                outcomes.Add(new SuitLoadoutImportOutcome(
                    SuitLoadoutImportAction.UnknownMount, module.SlotName, module.ModuleName));
                continue;
            }

            PersonalWeapon? weapon = PersonalWeaponCatalogue.FindBySymbol(module.ModuleName);
            if (weapon is null)
            {
                outcomes.Add(new SuitLoadoutImportOutcome(
                    SuitLoadoutImportAction.UnknownWeapon, module.SlotName, module.ModuleName));
                continue;
            }

            if (weapon.Slot != mount.Kind)
            {
                outcomes.Add(new SuitLoadoutImportOutcome(
                    SuitLoadoutImportAction.RefusedMount, module.SlotName, module.ModuleName));
                continue;
            }

            if (module.Class < EquipmentGrades.Lowest || module.Class > EquipmentGrades.Highest)
            {
                outcomes.Add(new SuitLoadoutImportOutcome(
                    SuitLoadoutImportAction.UnknownGrade, module.SlotName, module.ModuleName));
                continue;
            }

            ReadOnlyCollection<FittedPersonalModification> modifications = ResolveModifications(
                module.WeaponMods ?? [], weapon, module.SlotName, outcomes);

            List<PersonalModifier> modifiers = [.. Changes(modifications)];

            // A suit recipe naming a stat the weapon carries acts on the weapon: Extra Ammo
            // Capacity is fitted to the suit and multiplies the weapon's reserve ammunition.
            foreach (FittedPersonalModification fitted in suitModifications)
            {
                foreach (PersonalModifier modifier in fitted.Modification.Modifiers)
                {
                    if (WeaponStats.Carries(weapon, modifier.Stat)) modifiers.Add(modifier);
                }
            }

            bool reloadSpeed = Fitted(modifications, ReloadSpeedSymbol);
            weapons.Add(new FittedPersonalWeapon(
                mount.Key,
                weapon,
                module.Class,
                modifications,
                new ReadOnlyCollection<PersonalModifier>(modifiers),
                reloadSpeed,
                Fitted(modifications, ScopeSymbol),
                // Every weapon carries all five grades, and the grade is judged above, so
                // the figures resolve.
                PersonalWeaponCatalogue.Metrics(weapon, module.Class, modifiers, reloadSpeed)!,
                module.SuitModuleId));
        }

        return new ReadOnlyCollection<FittedPersonalWeapon>(weapons);
    }

    private static PersonalMount? MountFor(Suit suit, string key)
    {
        foreach (PersonalMount mount in suit.Mounts)
        {
            if (string.Equals(mount.Key, key, StringComparison.OrdinalIgnoreCase)) return mount;
        }

        return null;
    }

    private static bool Fitted(IReadOnlyList<FittedPersonalModification> modifications, string symbol)
    {
        foreach (FittedPersonalModification fitted in modifications)
        {
            if (string.Equals(fitted.Symbol, symbol, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }
}
