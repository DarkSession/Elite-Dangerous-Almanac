using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Localization;

/// <summary>A language the shared localized-name catalogues carry.</summary>
/// <remarks>
/// <para>
/// English is complete, because it is the canonical name the Almanac publishes already.
/// Every other language is sparse and depends on its source, so a lookup answers
/// <see langword="null"/> where the pinned source carries no translation. This leaves the
/// application in charge of its own fallback policy.
/// </para>
/// <para>
/// A lookup takes any tag rather than only these, so a caller passes its application
/// locale straight in. A regional or a script subtag is dropped rather than matched,
/// because every stored language is a bare language tag: <c>de-DE</c> selects German. Case
/// is ignored, and an underscore stands for a hyphen. Any other language is one the
/// catalogues do not carry, and every lookup for it answers <see langword="null"/>.
/// </para>
/// <para>
/// A source can publish a translation whose spelling equals the English name. A lookup
/// answers what the source states, and never builds an English fallback of its own.
/// </para>
/// </remarks>
public enum GameLocale
{
    /// <summary>English.</summary>
    En,

    /// <summary>German.</summary>
    De,

    /// <summary>Spanish.</summary>
    Es,

    /// <summary>French.</summary>
    Fr,

    /// <summary>
    /// Portuguese. The stored spelling is the Brazilian Portuguese every accepted source
    /// publishes under a bare tag, so <c>pt-PT</c> selects it like any other regional tag.
    /// </summary>
    Pt,

    /// <summary>Russian.</summary>
    Ru,
}

/// <summary>Reads a <see cref="GameLocale"/> from the tag an application holds.</summary>
public static class GameLocales
{
    private static readonly Dictionary<string, GameLocale> Languages =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["en"] = GameLocale.En,
            ["de"] = GameLocale.De,
            ["es"] = GameLocale.Es,
            ["fr"] = GameLocale.Fr,
            ["pt"] = GameLocale.Pt,
            ["ru"] = GameLocale.Ru,
        };

    /// <summary>Reads the language one BCP 47 tag selects.</summary>
    /// <param name="tag">
    /// The tag, such as <c>de</c> or <c>de-DE</c>. Case is ignored, an underscore stands
    /// for a hyphen, and a regional or script subtag is dropped.
    /// </param>
    /// <param name="locale">The language the tag selects, when the answer is <see langword="true"/>.</param>
    /// <returns>
    /// <see langword="true"/> where the catalogues carry the language the tag names.
    /// </returns>
    public static bool TryParse(string? tag, out GameLocale locale)
    {
        locale = default;
        if (tag is null) return false;

        string language = tag.Trim().Replace('_', '-');
        int subtag = language.IndexOf('-');
        if (subtag >= 0) language = language.Substring(0, subtag);

        return Languages.TryGetValue(language, out locale);
    }
}
