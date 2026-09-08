using System;

namespace EliteDangerousAlmanac.Internal;

/// <summary>Reads an enum member from a name that came from data or from a user.</summary>
/// <remarks>
/// Leading and trailing whitespace and case are ignored, which is the rule every other
/// catalogue key follows. A numeric string is refused: <c>"3"</c> is a value a caller
/// meant as a name, and answering it with the third member hides the mistake.
/// </remarks>
internal static class EnumParsing
{
    internal static bool TryParse<TEnum>(string? name, out TEnum value)
        where TEnum : struct, Enum
    {
        value = default;
        string? key = name?.Trim();
        if (string.IsNullOrEmpty(key)) return false;
        if (char.IsDigit(key![0]) || key[0] == '-' || key[0] == '+') return false;
        return Enum.TryParse(key, ignoreCase: true, out value) && Enum.IsDefined(typeof(TEnum), value);
    }
}
