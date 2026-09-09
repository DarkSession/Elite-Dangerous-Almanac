using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>The module-to-mount compatibility rules a build reads.</summary>
internal static class LoadoutFitting
{
    /// <summary>The optional-internal families a military mount accepts.</summary>
    private static readonly string[] MilitaryPrefixes =
    [
        "int_hullreinforcement",
        "int_metaalloyhullreinforcement",
        "int_modulereinforcement",
        "int_shieldcellbank",
        "int_guardianhullreinforcement",
        "int_guardianmodulereinforcement",
        "int_guardianshieldreinforcement",
    ];

    /// <summary>The weapon families a mining hardpoint accepts.</summary>
    /// <remarks>
    /// The Sub-Surface Extraction Missile is here because both source registries file it with
    /// the displacement missile it is a variant of, despite its unrelated symbol. The Pulse
    /// Wave Analyser is not, because it is a utility fitting.
    /// </remarks>
    private static readonly string[] MiningPrefixes =
    [
        "hpt_mininglaser",
        "hpt_mining_abrblstr",
        "hpt_mining_seismchrgwarhd",
        "hpt_mining_subsurfdispmisle",
        "hpt_human_extraction",
        "hpt_miningtoolv2",
    ];

    /// <summary>
    /// The optional-internal families a dedicated cargo mount accepts. A fuel tank counts
    /// here, as it does in an unrestricted optional mount.
    /// </summary>
    private static readonly string[] CargoPrefixes =
    [
        "int_cargorack",
        "int_largecargorack",
        "int_corrosionproofcargorack",
        "int_fueltank",
    ];

    /// <summary>The module families each restricted mount accepts.</summary>
    /// <remarks>
    /// This is the mount's half of compatibility. A module reserved for one mount carries its
    /// own restriction, which is checked separately.
    /// </remarks>
    private static readonly ReadOnlyDictionary<SlotRestriction, string[]> RestrictedPrefixes =
        new(new Dictionary<SlotRestriction, string[]>
        {
            [SlotRestriction.Mining] = MiningPrefixes,
            [SlotRestriction.Military] = MilitaryPrefixes,
            [SlotRestriction.Cargo] = CargoPrefixes,

            // Single-limpet and multi-limpet controllers are separate symbol families.
            [SlotRestriction.LimpetController] = ["int_dronecontrol", "int_multidronecontrol"],

            // One family covers both the Mark I and the Mark II vessel bays. Both Large
            // Planetary Vehicle Hangar lines are separate families the game also fits here — a
            // journal module purchase puts a Mark II large buggy bay into the Type-11's first
            // fighter bay, over the vessel hangar it replaced — so the mount takes three
            // families rather than one. The large buggy bay prefix covers that line's granted
            // articles too, since they fit wherever their sold twins do.
            [SlotRestriction.VesselHangar] = ["int_fighterbay", "int_largebuggybay", "int_mkiilargebuggybay"],

            // Mark II cabins are a separate family rather than passenger-cabin variants.
            [SlotRestriction.Passenger] = ["int_passengercabin", "int_mkii_passengercabin"],

            // Both the ordinary and the advanced suite share this prefix and reserve this mount.
            [SlotRestriction.PlanetaryApproachSuite] = ["int_planetapproachsuite"],
        });

    /// <summary>Why a module cannot fit a mount, or <see langword="null"/> when it fits.</summary>
    /// <remarks>
    /// The checks run from the fixed hull mount, through the articles that belong to the hull,
    /// to the module's own mount reservation, then the mount kind and finally the size, so a
    /// caller is given the most specific useful refusal.
    /// </remarks>
    internal static ModuleFitProblem? Problem(string shipSymbol, BuildSlot slot, OutfittingModule module)
    {
        if (slot.Kind == SlotKind.CargoHatch)
        {
            return new ModuleFitProblem(
                ModuleFitConstraint.ImmutableSlot, "the cargo hatch mount cannot be changed");
        }

        // The hatch arrives with the hull, no station sells it, and the one mount that holds it
        // is the fixed mount refused just above. So it fits nowhere a caller can fit it, and an
        // outfitting list must never offer it. The source registry files it under the internal
        // category, which an unrestricted optional mount would otherwise accept.
        if (LoadoutState.IsBuiltInHullSymbol(module.Symbol))
        {
            return new ModuleFitProblem(
                ModuleFitConstraint.BuiltInHullModule,
                "the cargo hatch is part of the hull, not an outfitting module");
        }

        if (slot.Kind == SlotKind.Armour) return ArmourProblem(shipSymbol, module);

        ModuleFitProblem? restrictedHull = RestrictedHullProblem(shipSymbol, module);
        if (restrictedHull is not null) return restrictedHull;

        // The article's own reserved mount comes before the general kind rules, because it
        // holds even when the mount a caller offered is otherwise unrestricted.
        if (module.RestrictedToSlot is SlotRestriction required && slot.Restriction != required)
        {
            return new ModuleFitProblem(
                ModuleFitConstraint.RestrictedMount,
                "module only fits a mount that takes " + required.Label())
            {
                Restriction = required,
            };
        }

        ModuleFitProblem? kind = KindProblem(slot, module);
        if (kind is not null) return kind;

        // A utility mount takes any utility fitting, whatever its class says.
        if (slot.Kind == SlotKind.Utility) return null;

        return module.Class > slot.Size
            ? new ModuleFitProblem(
                ModuleFitConstraint.Oversized,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "module size {0} exceeds slot size {1}",
                    module.Class,
                    slot.Size))
            {
                ModuleClass = module.Class,
                SlotSize = slot.Size,
            }
            : null;
    }

    private static ModuleFitProblem? ArmourProblem(string shipSymbol, OutfittingModule module)
    {
        Ship? hull = ShipCatalogue.FindBySymbol(shipSymbol);
        if (module.Slot != ModuleSlot.Armour || module.Ship is null)
        {
            return new ModuleFitProblem(
                ModuleFitConstraint.ArmourRequired, "not a ship armour module");
        }

        if (hull is not null && RegistryIndex.KeyComparer.Equals(module.Ship, hull.Name))
        {
            return null;
        }

        Ship? armourHull = ShipCatalogue.FindByName(module.Ship);
        return new ModuleFitProblem(
            ModuleFitConstraint.WrongHullArmour,
            string.Format(
                CultureInfo.InvariantCulture,
                "armour belongs to {0}, not {1}",
                TextPreview.Truncate(module.Ship),
                TextPreview.Truncate(hull?.Name ?? shipSymbol)))
        {
            ArmourShipName = module.Ship,
            ArmourShipSymbol = armourHull?.Symbol,
            ShipSymbol = shipSymbol,
            ShipName = hull?.Name,
        };
    }

    /// <summary>
    /// Whether a module sold for named hulls only is on one of them.
    /// </summary>
    /// <remarks>
    /// The module's own ship field is unreliable for a restricted module, some carrying a
    /// sentinel, so the normalized restriction list decides. The refusal keeps the symbols as
    /// well as the names, so a reader can search a journal for either.
    /// </remarks>
    private static ModuleFitProblem? RestrictedHullProblem(string shipSymbol, OutfittingModule module)
    {
        IReadOnlyList<string>? restricted = module.RestrictedToShips;
        if (restricted is null) return null;

        foreach (string symbol in restricted)
        {
            if (RegistryIndex.KeyComparer.Equals(symbol, shipSymbol)) return null;
        }

        List<string> names = new(restricted.Count);
        List<string> symbols = new(restricted.Count);
        List<string> labels = new(restricted.Count);
        foreach (string symbol in restricted)
        {
            string name = ShipCatalogue.FindBySymbol(symbol)?.Name ?? symbol;
            names.Add(name);
            symbols.Add(symbol);
            labels.Add(name == symbol
                ? symbol
                : string.Format(CultureInfo.InvariantCulture, "{0} ({1})", name, symbol));
        }

        return new ModuleFitProblem(
            ModuleFitConstraint.RestrictedHull,
            "module is restricted to " + TextPreview.Truncate(string.Join(", ", labels)))
        {
            AllowedShipNames = new ReadOnlyCollection<string>(names),
            AllowedShipSymbols = new ReadOnlyCollection<string>(symbols),
            ShipSymbol = shipSymbol,
        };
    }

    private static ModuleFitProblem? KindProblem(BuildSlot slot, OutfittingModule module)
    {
        switch (slot.Kind)
        {
            case SlotKind.Core:
                // The normalized mount field handles the Guardian core modules the registry
                // files as internal, and the hull-specific modules whose symbols share no
                // family prefix.
                return module.Slot is ModuleSlot fitted && (int)fitted == (int)slot.Core!.Value
                    ? null
                    : new ModuleFitProblem(
                        ModuleFitConstraint.WrongCoreType,
                        string.Format(
                            CultureInfo.InvariantCulture, "not a {0} module", slot.Core))
                    {
                        RequiredCore = slot.Core,
                        ModuleSlot = module.Slot,
                    };

            case SlotKind.Hardpoint:
                return module.Category != ModuleCategory.Hardpoint
                    ? new ModuleFitProblem(
                        ModuleFitConstraint.HardpointRequired, "not a hardpoint weapon")
                    : RestrictionProblem(slot, module.Symbol);

            case SlotKind.Utility:
                return module.Category != ModuleCategory.Utility
                    ? new ModuleFitProblem(
                        ModuleFitConstraint.UtilityRequired, "not a utility module")
                    : null;

            default:
                return OptionalProblem(slot, module);
        }
    }

    private static ModuleFitProblem? OptionalProblem(BuildSlot slot, OutfittingModule module)
    {
        bool fuelTank = module.Slot == ModuleSlot.FuelTank;
        if (module.Category != ModuleCategory.Internal && !fuelTank)
        {
            return new ModuleFitProblem(
                ModuleFitConstraint.OptionalInternalRequired, "not an optional-internal module");
        }

        if (module.Slot is not null && !fuelTank)
        {
            return new ModuleFitProblem(
                ModuleFitConstraint.CoreModuleInOptionalSlot,
                "a core module only fits its core slot")
            {
                ModuleSlot = module.Slot,
            };
        }

        return RestrictionProblem(slot, module.Symbol);
    }

    private static ModuleFitProblem? RestrictionProblem(BuildSlot slot, string symbol)
    {
        if (slot.Restriction is not SlotRestriction restriction) return null;

        string wanted = symbol.ToLowerInvariant();
        foreach (string prefix in RestrictedPrefixes[restriction])
        {
            if (wanted.StartsWith(prefix, StringComparison.Ordinal)) return null;
        }

        return new ModuleFitProblem(
            ModuleFitConstraint.RestrictedMount, "slot only takes " + restriction.Label())
        {
            Restriction = restriction,
        };
    }
}
