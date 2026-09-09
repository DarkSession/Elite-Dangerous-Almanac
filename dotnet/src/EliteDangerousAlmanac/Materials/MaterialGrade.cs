namespace EliteDangerousAlmanac.Materials;

/// <summary>
/// A material grade, 1 to 5. A material's grade is its rarity: each member is named for
/// the rarity the grade denotes, so a material carries no separate rarity field.
/// </summary>
/// <remarks>
/// Raw materials only reach <see cref="Rare"/>; grade 5 appears in the manufactured and
/// encoded categories only. The numeric values match Frontier's own grading, so a grade
/// compares equal to the plain number.
/// </remarks>
public enum MaterialGrade
{
    /// <summary>Grade 1 — very common.</summary>
    VeryCommon = 1,

    /// <summary>Grade 2 — common.</summary>
    Common = 2,

    /// <summary>Grade 3 — standard.</summary>
    Standard = 3,

    /// <summary>Grade 4 — rare. The highest grade a raw element reaches.</summary>
    Rare = 4,

    /// <summary>Grade 5 — very rare. Manufactured and encoded materials only.</summary>
    VeryRare = 5,
}
