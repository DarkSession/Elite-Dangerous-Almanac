namespace EliteDangerousAlmanac.Commodities;

/// <summary>One tradable commodity in Frontier's market registry.</summary>
/// <remarks>
/// A pure id, name and group record. This is the commodity registry, not a price sheet,
/// so it carries no buy or sell price, no supply, no demand and no producing station. A
/// rare good's origin station is not carried either, because the library has no station
/// registry to key it against.
/// </remarks>
/// <param name="Symbol">
/// Frontier's internal symbol, such as <c>Platinum</c> — the id the market and the player
/// journal report, matched without regard to case. This is the commodity's key.
/// </param>
/// <param name="Name">Display name, such as <c>Platinum</c>.</param>
/// <param name="Category">The market group this commodity is sold under.</param>
/// <param name="Rare">
/// Whether this is a rare commodity — a location-specific luxury good produced at a single
/// station — rather than a standard market good. It comes from the catalogue the record
/// lives in.
/// </param>
public sealed record Commodity(string Symbol, string Name, CommodityCategory Category, bool Rare);
