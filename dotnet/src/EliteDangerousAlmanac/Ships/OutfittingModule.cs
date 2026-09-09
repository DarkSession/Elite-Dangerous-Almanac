using System.Collections.Generic;

namespace EliteDangerousAlmanac.Ships;

/// <summary>One fittable outfitting module: its identity and its sparse stats.</summary>
/// <remarks>
/// <para>
/// The identity fields say what the module is and where it goes. The stats say what it does,
/// and only the ones the module's family uses are present — read them through
/// <see cref="Stats"/>.
/// </para>
/// <para>
/// Identity comes primarily from EDCD FDevIDs and the stats from EDCD coriolis-data and EDSY,
/// joined on the symbol. See <c>data/ships/SOURCES.md</c> for provenance and
/// <c>ATTRIBUTIONS.md</c> for credit.
/// </para>
/// </remarks>
/// <param name="Symbol">
/// The internal identifier, such as <c>Hpt_PulseLaser_Fixed_Small</c>. It is unique across
/// every category, and it is the module's key.
/// </param>
/// <param name="Category">
/// Which kind of slot the module fits. It comes from the catalogue the record was read from,
/// so it always agrees with where you found the module.
/// </param>
/// <param name="EngineeringGroup">
/// The stable engineering menu this stock module offers, or <see langword="null"/> when it has
/// no ordinary engineering menu.
/// </param>
/// <param name="FamilyId">
/// The stable outfitting family an outfitting list groups by. Every record carries one, core
/// modules included, and closely related variants share it.
/// </param>
/// <param name="Slot">
/// The one fixed mount this module fills, when it fills one. Present on every core module and
/// on the Guardian hybrid power plants and distributors, which Frontier files under the
/// internal category but which go in a core mount. Absent on everything else, because a
/// weapon, a utility fitting or an ordinary optional internal fits any mount of its kind that
/// is large enough. A fuel tank is the one module that fits somewhere else as well: its own
/// core mount and any optional slot large enough.
/// </param>
/// <param name="Name">
/// The stable, descriptive English name, such as <c>Pulse Laser</c>. This is a canonical
/// library label rather than a byte-exact copy of the game's localized text: abbreviations are
/// expanded for readability. It is not unique — the game shows most modules at several sizes
/// and ratings, and every hull's armour shares the same five names.
/// </param>
/// <param name="Class">
/// The module size, 0 to 8 — the number in the "5A" an outfitting screen shows. Frontier calls
/// it the module class, and it is the slot-size number rather than the grade letter.
/// </param>
/// <param name="Rating">The grade letter — the letter in the "5A" an outfitting screen shows.</param>
/// <param name="Mount">How the weapon is aimed, on a hardpoint weapon that has a mount variant.</param>
/// <param name="Guidance">A missile or torpedo launcher's guidance.</param>
/// <param name="Ship">
/// The hull an armour variant belongs to. Present only on the armour modules, which are the
/// one ship-specific module.
/// </param>
/// <param name="Entitlement">Frontier's purchase-grant token, on a gated module.</param>
/// <param name="GrantOnly">
/// <see langword="true"/> on an article that arrives granted, with a hull or with a bundle,
/// and that no outfitting screen sells. Each is a second identity for an article the game
/// already sells, which is why a module picker leaves them out — but they are real fitted
/// articles, so every lookup still resolves one. It is not a price: the cost is missing on
/// these and also on articles that are sold and unpriced by every registry.
/// </param>
/// <param name="RestrictedToShips">
/// The hulls a ship-specific module is limited to. Present only on the handful of non-armour
/// modules with such a limit; armour states its hull separately.
/// </param>
/// <param name="RestrictedToSlot">
/// The slot restriction this module requires: it fits only mounts carrying that restriction,
/// and no unrestricted mount at all. It is the mirror image of a mount's own restriction, and
/// the other half of the same rule. Most restricted families bind one way only — a cargo rack
/// fits a cargo mount and any unrestricted optional — so this is present on just the records
/// the game sells for one kind of mount and nowhere else.
/// </param>
/// <param name="ExclusionGroup">
/// The one-per-ship family, when the module has an exclusive fitting rule. Two fitted modules
/// sharing this are structurally invalid.
/// </param>
/// <param name="LimitGroup">The per-ship count limit this fitted module consumes, when it consumes one.</param>
/// <param name="LimitIncrease">The increase this fitted module grants to a per-ship count allowance.</param>
/// <param name="Cost">
/// The standard purchase price, in credits, before any station discount or markup. Absent on
/// the handful of records no registry prices. Treat an absent price as unknown, never as free.
/// </param>
/// <param name="Stats">The sparse performance and capability stats this module carries.</param>
/// <param name="DamageDistribution">How the weapon's damage splits across the damage types.</param>
/// <param name="DamageComponents">
/// Exact damage amounts, where in-game verification exposes distinct components.
/// </param>
/// <param name="ProjectileRange">Projectile boundary parameters, which are not effective distances.</param>
/// <param name="SupercruiseOvercharge">
/// <see langword="true"/> on a Supercruise Overcharge drive, the line an outfitting screen
/// labels SCO. The two lines share every jump constant this library models, so the flag changes
/// no calculation here; it is what an outfitting list filters and labels on.
/// </param>
/// <param name="GuardianZoneResistance">
/// <see langword="true"/> when Anti-Guardian Zone Resistance protects this Guardian module from
/// a Thargoid anti-Guardian field, either inherently or because the grade-1 blueprint grants it.
/// </param>
/// <param name="AlwaysPowered">
/// <see langword="true"/> when a hardpoint-mounted module draws its power continuously. Weapons
/// and most utility fittings only draw power while the hardpoints are deployed; shield
/// boosters, chaff, heat sinks, point defence, caustic sinks and shutdown field neutralisers
/// draw theirs all the time.
/// </param>
/// <param name="EngineeringLocked">
/// <see langword="true"/> when this particular resolved article accepts no further engineering.
/// A stock catalogue record never carries it; a final pre-engineered Guardian weapon does, so a
/// fitted article exposes an empty engineering menu and refuses both blueprints and
/// experimental effects.
/// </param>
public sealed record OutfittingModule(
    string Symbol,
    ModuleCategory Category,
    EngineeringGroupId? EngineeringGroup,
    OutfittingFamilyId FamilyId,
    ModuleSlot? Slot,
    string Name,
    int Class,
    ModuleRating Rating,
    ModuleMount? Mount,
    ModuleGuidance? Guidance,
    string? Ship,
    string? Entitlement,
    bool GrantOnly,
    IReadOnlyList<string>? RestrictedToShips,
    SlotRestriction? RestrictedToSlot,
    ModuleExclusionGroup? ExclusionGroup,
    ModuleLimitGroup? LimitGroup,
    ModuleLimitIncrease? LimitIncrease,
    long? Cost,
    ModuleStats Stats,
    DamageDistribution? DamageDistribution = null,
    DamageComponents? DamageComponents = null,
    ProjectileRangeBoundaries? ProjectileRange = null,
    bool SupercruiseOvercharge = false,
    bool GuardianZoneResistance = false,
    bool AlwaysPowered = false,
    bool EngineeringLocked = false);
