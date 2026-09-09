using System;
using System.Globalization;

namespace EliteDangerousAlmanac.Astronomy;

/// <summary>The letter that states how large a boxel is, and the size class behind it.</summary>
/// <remarks>
/// <para>
/// The lower-case letter after the number pair in a procedural name is the mass code. It
/// is the <c>d</c> in <c>Synuefe EN-H d11-96</c>, and it states the edge of the boxel the
/// system was generated in. An <c>a</c> boxel is ten light years on a side, and every
/// letter after it doubles that, up to a whole sector at <c>h</c>.
/// </para>
/// <para>
/// The same figure is the size class the system address packs, counted from zero.
/// </para>
/// </remarks>
public static class MassCode
{
    /// <summary>The count of mass codes, and of size classes.</summary>
    public const int Count = 8;

    /// <summary>The edge of the smallest boxel, in light years.</summary>
    public const int BaseBoxelLy = 10;

    /// <summary>Reads a mass-code letter as its size class.</summary>
    /// <param name="code">The letter, <c>a</c> through <c>h</c>, in either case.</param>
    /// <returns>The size class, zero through seven.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The letter is not one of <c>a</c> through <c>h</c>.
    /// </exception>
    public static int ToSizeClass(char code)
    {
        int sizeClass = char.ToLowerInvariant(code) - 'a';
        if (sizeClass < 0 || sizeClass >= Count)
        {
            throw new ArgumentOutOfRangeException(
                nameof(code),
                code,
                string.Format(CultureInfo.InvariantCulture, "'{0}' is not a mass code.", code));
        }

        return sizeClass;
    }

    /// <summary>Reads a one-letter mass code as its size class.</summary>
    /// <param name="code">The letter, <c>a</c> through <c>h</c>, in either case.</param>
    /// <returns>The size class, zero through seven.</returns>
    /// <exception cref="ArgumentNullException">The code is absent.</exception>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The code is not one letter of <c>a</c> through <c>h</c>. A mass code is asked for
    /// rather than searched for, so an unusable one is loud.
    /// </exception>
    public static int ToSizeClass(string code)
    {
        if (code is null) throw new ArgumentNullException(nameof(code));
        if (code.Length != 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(code),
                code,
                "A mass code is one letter.");
        }

        return ToSizeClass(code[0]);
    }

    /// <summary>Writes a size class as its mass-code letter.</summary>
    /// <param name="sizeClass">The size class, zero through seven.</param>
    /// <returns>The letter, <c>a</c> through <c>h</c>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The size class is outside zero through seven.</exception>
    public static char FromSizeClass(int sizeClass)
    {
        RequireSizeClass(sizeClass, nameof(sizeClass));
        return (char)('a' + sizeClass);
    }

    /// <summary>Reads the edge of a boxel of one size class, in light years.</summary>
    /// <param name="sizeClass">The size class, zero through seven.</param>
    /// <returns>The edge in light years, ten through 1280.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The size class is outside zero through seven.</exception>
    public static int BoxelEdgeLy(int sizeClass)
    {
        RequireSizeClass(sizeClass, nameof(sizeClass));
        return BaseBoxelLy << sizeClass;
    }

    /// <summary>Refuses a size class the address layout has no room for.</summary>
    internal static void RequireSizeClass(int sizeClass, string parameter)
    {
        if (sizeClass < 0 || sizeClass >= Count)
        {
            throw new ArgumentOutOfRangeException(
                parameter,
                sizeClass,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "A size class is an integer from 0 through {0}.",
                    Count - 1));
        }
    }
}
