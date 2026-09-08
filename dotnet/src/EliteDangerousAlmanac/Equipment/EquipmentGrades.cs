using System;

namespace EliteDangerousAlmanac.Equipment;

/// <summary>The grade ladder Pioneer Supplies sells a suit and a weapon along.</summary>
/// <remarks>
/// A grade is a whole number from one through five. The stock article is grade one, and
/// every upgrade step buys the next rung.
/// </remarks>
public static class EquipmentGrades
{
    /// <summary>The stock grade every suit and weapon is sold at.</summary>
    public const int Lowest = 1;

    /// <summary>The grade the last upgrade step reaches.</summary>
    public const int Highest = 5;

    /// <summary>Answers whether a figure names a grade.</summary>
    /// <param name="grade">The figure to judge.</param>
    /// <returns><see langword="true"/> for a whole number from one through five.</returns>
    public static bool IsGrade(double grade) =>
        grade >= Lowest && grade <= Highest && grade == Math.Floor(grade);

    /// <summary>Refuses a figure that does not name a grade.</summary>
    /// <param name="grade">The figure to judge.</param>
    /// <param name="parameterName">The parameter the figure arrived in.</param>
    /// <exception cref="ArgumentOutOfRangeException">
    /// The figure is not a whole number from one through five.
    /// </exception>
    internal static void Require(int grade, string parameterName)
    {
        if (grade >= Lowest && grade <= Highest) return;
        throw new ArgumentOutOfRangeException(
            parameterName, grade, "The grade must be a whole number from 1 through 5.");
    }
}
