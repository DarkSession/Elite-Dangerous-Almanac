using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Astronomy.Internal;

/// <summary>The word parts the procedural sector names are built from.</summary>
/// <remarks>
/// <para>
/// A procedural sector name is one word or two. A one-word name is a prefix, one or two
/// infixes and a suffix; a two-word name is two prefix-and-suffix pairs. Each part carries
/// a run length, and the running total of those lengths turns a sector's packed grid
/// offset into a name and back again.
/// </para>
/// <para>
/// The tables and their run lengths are the game's own, taken from the EDTS reference. See
/// <c>ATTRIBUTIONS.md</c> for credit and licence terms.
/// </para>
/// </remarks>
internal static class SectorFragments
{
    /// <summary>The run length of a prefix with no entry of its own.</summary>
    internal const int PrefixDefaultRunLength = 35;

    /// <summary>Every prefix, in the order the generator counts them.</summary>
    internal static readonly string[] Prefixes =
    [
        "Th", "Eo", "Oo", "Eu", "Tr", "Sly", "Dry", "Ou", "Tz", "Phl", "Ae", "Sch", "Hyp",
        "Syst", "Ai", "Kyl", "Phr", "Eae", "Ph", "Fl", "Ao", "Scr", "Shr", "Fly", "Pl", "Fr",
        "Au", "Pry", "Pr", "Hyph", "Py", "Chr", "Phyl", "Tyr", "Bl", "Cry", "Gl", "Br", "Gr",
        "By", "Aae", "Myc", "Gyr", "Ly", "Myl", "Lych", "Myn", "Ch", "Myr", "Cl", "Rh", "Wh",
        "Pyr", "Cr", "Syn", "Str", "Syr", "Cy", "Wr", "Hy", "My", "Sty", "Sc", "Sph", "Spl",
        "A", "Sh", "B", "C", "D", "Sk", "Io", "Dr", "E", "Sl", "F", "Sm", "G", "H", "I", "Sp",
        "J", "Sq", "K", "L", "Pyth", "M", "St", "N", "O", "Ny", "Lyr", "P", "Sw", "Thr", "Lys",
        "Q", "R", "S", "T", "Ea", "U", "V", "W", "Schr", "X", "Ee", "Y", "Z", "Ei", "Oe",
    ];

    /// <summary>Every vowel infix, in the order the generator counts them.</summary>
    internal static readonly string[] Infixes1 =
    [
        "o", "ai", "a", "oi", "ea", "ie", "u", "e", "ee", "oo", "ue", "i", "oa", "au", "ae",
        "oe",
    ];

    /// <summary>Every consonant infix, in the order the generator counts them.</summary>
    internal static readonly string[] Infixes2 =
    [
        "ll", "ss", "b", "c", "d", "f", "dg", "g", "ng", "h", "j", "k", "l", "m", "n", "mb",
        "p", "q", "gn", "th", "r", "s", "t", "ch", "tch", "v", "w", "wh", "ck", "x", "y", "z",
        "ph", "sh", "ct", "wr",
    ];

    /// <summary>Every vowel suffix, in the order the generator counts them.</summary>
    internal static readonly string[] Suffixes1 =
    [
        "oe", "io", "oea", "oi", "aa", "ua", "eia", "ae", "ooe", "oo", "a", "ue", "ai", "e",
        "iae", "oae", "ou", "uae", "i", "ao", "au", "o", "eae", "u", "aea", "ia", "ie", "eou",
        "aei", "ea", "uia", "oa", "aae", "eau", "ee",
    ];

    /// <summary>Every consonant suffix, in the order the generator counts them.</summary>
    internal static readonly string[] Suffixes2 =
    [
        "b", "scs", "wsy", "c", "d", "vsky", "f", "sms", "dst", "g", "rb", "h", "nts", "ch",
        "rd", "rld", "k", "lls", "ck", "rgh", "l", "rg", "m", "n", "hm", "p", "hn", "rk", "q",
        "rl", "r", "rm", "s", "cs", "wyg", "rn", "ct", "t", "hs", "rbs", "rp", "tts", "v",
        "wn", "ms", "w", "rr", "mt", "x", "rs", "cy", "y", "rt", "z", "ws", "lch", "my", "ry",
        "nks", "nd", "sc", "ng", "sh", "nk", "sk", "nn", "ds", "sm", "sp", "ns", "nt", "dy",
        "ss", "st", "rrs", "xt", "nz", "sy", "xy", "rsch", "rphs", "sts", "sys", "sty", "th",
        "tl", "tls", "rds", "nch", "rns", "ts", "wls", "rnt", "tt", "rdy", "rst", "pps", "tz",
        "tch", "sks", "ppy", "ff", "sps", "kh", "sky", "ph", "lts", "wnst", "rth", "ths", "fs",
        "pp", "ft", "ks", "pr", "ps", "pt", "fy", "rts", "ky", "rshch", "mly", "py", "bb",
        "nds", "wry", "zz", "nns", "ld", "lf", "gh", "lks", "sly", "lk", "ll", "rph", "ln",
        "bs", "rsts", "gs", "ls", "vvy", "lt", "rks", "qs", "rps", "gy", "wns", "lz", "nth",
        "phs",
    ];

    /// <summary>The prefixes a two-word name pairs with a consonant suffix.</summary>
    internal static readonly HashSet<string> C2PrefixSuffix2 = new(StringComparer.Ordinal)
    {
        "eo", "oo", "eu", "ou", "ae", "ai", "eae", "ao", "au", "aae",
    };

    /// <summary>The prefixes a one-word name follows with a consonant infix.</summary>
    internal static readonly HashSet<string> C1PrefixInfix2 = new(StringComparer.Ordinal)
    {
        "eo", "oo", "eu", "ou", "ae", "ai", "eae", "ao", "au", "aae", "a", "io", "e", "i", "o",
        "ea", "u", "ee", "ei", "oe",
    };

    /// <summary>The prefixes whose run length is not the default.</summary>
    internal static readonly Dictionary<string, int> PrefixRunLengths = new(StringComparer.Ordinal)
    {
        ["eu"] = 31, ["sly"] = 4, ["tz"] = 1, ["phl"] = 13, ["ae"] = 12, ["hyp"] = 25,
        ["kyl"] = 30, ["phr"] = 10, ["eae"] = 4, ["ao"] = 5, ["scr"] = 24, ["shr"] = 11,
        ["fly"] = 20, ["pry"] = 3, ["hyph"] = 14, ["py"] = 12, ["phyl"] = 8, ["tyr"] = 25,
        ["cry"] = 5, ["aae"] = 5, ["myc"] = 2, ["gyr"] = 10, ["myl"] = 12, ["lych"] = 3,
        ["myn"] = 10, ["myr"] = 4, ["rh"] = 15, ["wr"] = 31, ["sty"] = 4, ["spl"] = 16,
        ["sk"] = 27, ["sq"] = 7, ["pyth"] = 1, ["lyr"] = 10, ["sw"] = 24, ["thr"] = 32,
        ["lys"] = 10, ["schr"] = 3, ["z"] = 34,
    };

    /// <summary>The infixes whose run length is not their table's default.</summary>
    internal static readonly Dictionary<string, int> InfixRunLengths = new(StringComparer.Ordinal)
    {
        ["oi"] = 88, ["ue"] = 147, ["oa"] = 57, ["au"] = 119, ["ae"] = 12, ["oe"] = 39,
        ["dg"] = 31, ["tch"] = 20, ["wr"] = 31,
    };
}
