using System.Collections.Generic;
using System.Collections.ObjectModel;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Localization.Internal;

/// <summary>One source-backed name, complete in English and sparse elsewhere.</summary>
internal sealed class LocalizedName
{
    public string En { get; set; } = string.Empty;

    public string? De { get; set; }

    public string? Es { get; set; }

    public string? Fr { get; set; }

    public string? Pt { get; set; }

    public string? Ru { get; set; }

    /// <summary>Reads the spelling one language carries, where the source publishes one.</summary>
    internal string? For(GameLocale locale) => locale switch
    {
        GameLocale.En => En,
        GameLocale.De => De,
        GameLocale.Es => Es,
        GameLocale.Fr => Fr,
        GameLocale.Pt => Pt,
        _ => Ru,
    };
}

/// <summary>The on-disk shape of a catalogue that shares one record between identifiers.</summary>
/// <remarks>
/// Two articles the game spells the same in every language hold one record between them.
/// The sharing is finer than one English name: the game separates in another language what
/// English spells alike, and those keep records of their own.
/// </remarks>
internal sealed class SharedLocalizedNames
{
    public Dictionary<string, string> NameKeys { get; set; } = [];

    public Dictionary<string, LocalizedName> Names { get; set; } = [];
}

/// <summary>Reads a localized-name catalogue and answers the spellings it carries.</summary>
internal static class LocalizedNames
{
    /// <summary>Reads a catalogue that keys each identifier to its own record.</summary>
    internal static IReadOnlyDictionary<string, LocalizedName> Direct(string path)
    {
        Dictionary<string, LocalizedName> records =
            SharedData.Load<Dictionary<string, LocalizedName>>(path);
        return Freeze(records);
    }

    /// <summary>Reads a catalogue whose identifiers share records between them.</summary>
    internal static IReadOnlyDictionary<string, LocalizedName> Shared(string path)
    {
        SharedLocalizedNames catalogue = SharedData.Load<SharedLocalizedNames>(path);
        Dictionary<string, LocalizedName> index =
            new(catalogue.NameKeys.Count, RegistryIndex.KeyComparer);
        foreach (KeyValuePair<string, string> entry in catalogue.NameKeys)
        {
            if (catalogue.Names.TryGetValue(entry.Value, out LocalizedName? name)
                && !index.ContainsKey(entry.Key))
            {
                index.Add(entry.Key, name);
            }
        }

        return new ReadOnlyDictionary<string, LocalizedName>(index);
    }

    /// <summary>Reads one identifier's spelling in one language.</summary>
    /// <returns>
    /// The spelling, or <see langword="null"/> where no record carries the identifier, the
    /// tag names a language the catalogues do not carry, or the source publishes no
    /// spelling for it.
    /// </returns>
    internal static string? Find(
        IReadOnlyDictionary<string, LocalizedName> index,
        string? identifier,
        string? locale)
    {
        // The tag is read first, so a tag no catalogue carries answers alike on a hit and
        // on a miss.
        if (!GameLocales.TryParse(locale, out GameLocale wanted)) return null;
        return RegistryIndex.FindInKeyIndex(index, identifier)?.For(wanted);
    }

    /// <summary>Reads one English spelling in one language.</summary>
    /// <remarks>
    /// A diagnostic message and a mount label are English prose this package builds rather
    /// than a source publishes. Answering it for an English tag alone keeps a caller from
    /// mistaking English for the language it asked for.
    /// </remarks>
    internal static string? English(string? english, string? locale)
    {
        if (!GameLocales.TryParse(locale, out GameLocale wanted)) return null;
        return wanted == GameLocale.En ? english : null;
    }

    private static ReadOnlyDictionary<string, LocalizedName> Freeze(
        Dictionary<string, LocalizedName> records)
    {
        Dictionary<string, LocalizedName> index = new(records.Count, RegistryIndex.KeyComparer);
        foreach (KeyValuePair<string, LocalizedName> record in records)
        {
            // Two spellings of one identifier are one record, and the file states the
            // one that answers first.
            if (!index.ContainsKey(record.Key)) index.Add(record.Key, record.Value);
        }

        return new ReadOnlyDictionary<string, LocalizedName>(index);
    }
}
