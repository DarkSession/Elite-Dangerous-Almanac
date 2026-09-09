namespace EliteDangerousAlmanac.Materials;

/// <summary>One engineering material and how it is classified.</summary>
/// <remarks>
/// A material is an immutable value: two materials with the same fields compare equal.
/// The category comes from the catalogue the record lives in. There is no separate rarity
/// field — the grade is the rarity.
/// </remarks>
/// <param name="Category">Which category this material belongs to.</param>
/// <param name="Symbol">
/// Frontier's internal symbol, such as <c>GridResistors</c> — the id the player journal
/// reports, matched without regard to case. This is the same field, with the same
/// meaning, as the symbol on a ship or outfitting module.
/// </param>
/// <param name="Name">Display name, such as <c>Grid Resistors</c>.</param>
/// <param name="ElementSymbol">
/// The chemical element symbol for a raw material, such as <c>Fe</c> for iron. Only raw
/// materials, which are chemical elements, have one; a manufactured or encoded material
/// has <see langword="null"/>.
/// </param>
/// <param name="Grade">The material grade, 1 to 5. Raw materials only reach 4.</param>
/// <param name="Line">The in-game line (group) this material sits in.</param>
public sealed record Material(
    MaterialCategory Category,
    string Symbol,
    string Name,
    string? ElementSymbol,
    MaterialGrade Grade,
    MaterialLine Line);
