using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Text.Json;
using EliteDangerousAlmanac.Internal;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>Reads one outfitting category's catalogue from its shared data file.</summary>
/// <remarks>
/// <para>
/// The data files spell the engineering group <c>kind</c>, state no category, and leave a core
/// module's family to the mount its slot names. This reader restores all three: the file a
/// record came from decides its category, and the core mount decides the family.
/// </para>
/// <para>
/// A key the reader does not know fails the load. A module record has some sixty possible
/// fields, so a silent skip would let a data update lose a stat with nothing to notice it.
/// </para>
/// </remarks>
internal static class ModuleCatalogueReader
{
    /// <summary>The family each core mount's modules are listed under.</summary>
    private static readonly Dictionary<ModuleSlot, OutfittingFamilyId> CoreSlotFamily = new()
    {
        [ModuleSlot.Armour] = OutfittingFamilyId.Armour,
        [ModuleSlot.PowerPlant] = OutfittingFamilyId.PowerPlants,
        [ModuleSlot.Thrusters] = OutfittingFamilyId.Engines,
        [ModuleSlot.FrameShiftDrive] = OutfittingFamilyId.Fsd,
        [ModuleSlot.LifeSupport] = OutfittingFamilyId.LifeSupport,
        [ModuleSlot.PowerDistributor] = OutfittingFamilyId.PowerDistributors,
        [ModuleSlot.Sensors] = OutfittingFamilyId.Sensors,
        [ModuleSlot.FuelTank] = OutfittingFamilyId.FuelTanks,
    };

    /// <summary>Reads a catalogue file and stamps every record with its category.</summary>
    internal static ReadOnlyCollection<OutfittingModule> Read(string path, ModuleCategory category)
    {
        using Stream stream = SharedData.Open(path);
        using JsonDocument document = JsonDocument.Parse(
            stream,
            new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip });

        List<OutfittingModule> modules = [];
        foreach (JsonElement element in document.RootElement.EnumerateArray())
        {
            modules.Add(ReadModule(element, category, path));
        }

        return new ReadOnlyCollection<OutfittingModule>(modules);
    }

    private static OutfittingModule ReadModule(JsonElement element, ModuleCategory category, string path)
    {
        string symbol = string.Empty;
        string name = string.Empty;
        int moduleClass = 0;
        ModuleRating rating = ModuleRating.A;
        EngineeringGroupId? engineeringGroup = null;
        OutfittingFamilyId? familyId = null;
        ModuleSlot? slot = null;
        ModuleMount? mount = null;
        ModuleGuidance? guidance = null;
        string? ship = null;
        string? entitlement = null;
        bool grantOnly = false;
        IReadOnlyList<string>? restrictedToShips = null;
        SlotRestriction? restrictedToSlot = null;
        ModuleExclusionGroup? exclusionGroup = null;
        ModuleLimitGroup? limitGroup = null;
        ModuleLimitIncrease? limitIncrease = null;
        long? cost = null;
        DamageDistribution? damageDistribution = null;
        DamageComponents? damageComponents = null;
        ProjectileRangeBoundaries? projectileRange = null;
        bool supercruiseOvercharge = false;
        bool guardianZoneResistance = false;
        bool alwaysPowered = false;
        Dictionary<ModuleStat, double> stats = [];

        foreach (JsonProperty property in element.EnumerateObject())
        {
            switch (property.Name)
            {
                case "symbol": symbol = property.Value.GetString()!; break;
                case "name": name = property.Value.GetString()!; break;
                case "class": moduleClass = property.Value.GetInt32(); break;
                case "rating": rating = Enum<ModuleRating>(property, path); break;
                case "kind": engineeringGroup = Enum<EngineeringGroupId>(property, path); break;
                case "familyId": familyId = Enum<OutfittingFamilyId>(property, path); break;
                case "slot": slot = Enum<ModuleSlot>(property, path); break;
                case "mount": mount = Enum<ModuleMount>(property, path); break;
                case "guidance": guidance = Enum<ModuleGuidance>(property, path); break;
                case "ship": ship = property.Value.GetString(); break;
                case "entitlement": entitlement = property.Value.GetString(); break;
                case "grantOnly": grantOnly = property.Value.GetBoolean(); break;
                case "restrictedToShips": restrictedToShips = ReadStrings(property.Value); break;
                case "restrictedToSlot": restrictedToSlot = Enum<SlotRestriction>(property, path); break;
                case "exclusionGroup": exclusionGroup = Enum<ModuleExclusionGroup>(property, path); break;
                case "limitGroup": limitGroup = Enum<ModuleLimitGroup>(property, path); break;
                case "limitIncrease": limitIncrease = ReadLimitIncrease(property.Value, path); break;
                case "cost": cost = property.Value.GetInt64(); break;
                case "damageDistribution": damageDistribution = ReadDistribution(property.Value); break;
                case "damageComponents": damageComponents = ReadComponents(property.Value); break;
                case "projectileRange": projectileRange = ReadProjectileRange(property.Value); break;
                case "supercruiseOvercharge": supercruiseOvercharge = property.Value.GetBoolean(); break;
                case "guardianZoneResistance": guardianZoneResistance = property.Value.GetBoolean(); break;
                case "alwaysPowered": alwaysPowered = property.Value.GetBoolean(); break;
                default:
                    stats[ReadStatKey(property.Name, path)] = property.Value.GetDouble();
                    break;
            }
        }

        // A slot on a non-core record belongs to a Guardian hybrid, which states its own family;
        // only the core file leaves the family to its mount.
        OutfittingFamilyId family = familyId
            ?? (slot is ModuleSlot core && CoreSlotFamily.TryGetValue(core, out OutfittingFamilyId derived)
                ? derived
                : throw Malformed(path, symbol, "states neither a family nor a core mount"));

        return new OutfittingModule(
            symbol,
            category,
            engineeringGroup,
            family,
            slot,
            name,
            moduleClass,
            rating,
            mount,
            guidance,
            ship,
            entitlement,
            grantOnly,
            restrictedToShips,
            restrictedToSlot,
            exclusionGroup,
            limitGroup,
            limitIncrease,
            cost,
            ModuleStats.From(stats),
            damageDistribution,
            damageComponents,
            projectileRange,
            supercruiseOvercharge,
            guardianZoneResistance,
            alwaysPowered);
    }

    private static ModuleStat ReadStatKey(string name, string path) =>
        EnumParsing.TryParse(name, out ModuleStat stat)
            ? stat
            : throw Malformed(path, name, "is not a field this library knows");

    private static TEnum Enum<TEnum>(JsonProperty property, string path)
        where TEnum : struct, Enum
    {
        string? text = property.Value.GetString();
        return EnumParsing.TryParse(text, out TEnum value)
            ? value
            : throw Malformed(path, text ?? "null", $"is not a {typeof(TEnum).Name}");
    }

    private static ReadOnlyCollection<string> ReadStrings(JsonElement element)
    {
        List<string> values = [];
        foreach (JsonElement item in element.EnumerateArray()) values.Add(item.GetString()!);
        return new ReadOnlyCollection<string>(values);
    }

    private static ModuleLimitIncrease ReadLimitIncrease(JsonElement element, string path)
    {
        string? group = element.GetProperty("group").GetString();
        if (!EnumParsing.TryParse(group, out ModuleLimitGroup parsed))
        {
            throw Malformed(path, group ?? "null", "is not a module limit group");
        }

        return new ModuleLimitIncrease(parsed, element.GetProperty("amount").GetInt32());
    }

    private static DamageDistribution ReadDistribution(JsonElement element) => new(
        Number(element, "kinetic"),
        Number(element, "thermal"),
        Number(element, "explosive"),
        Number(element, "absolute"),
        Number(element, "unclassified"),
        Number(element, "antiXeno"));

    private static DamageComponents ReadComponents(JsonElement element)
    {
        IReadOnlyList<double>? unclassified = null;
        if (element.TryGetProperty("unclassified", out JsonElement values))
        {
            List<double> amounts = [];
            foreach (JsonElement amount in values.EnumerateArray()) amounts.Add(amount.GetDouble());
            unclassified = new ReadOnlyCollection<double>(amounts);
        }

        return new DamageComponents(
            Number(element, "kinetic"),
            Number(element, "thermal"),
            Number(element, "explosive"),
            Number(element, "absolute"),
            Number(element, "antiXeno"),
            unclassified);
    }

    private static ProjectileRangeBoundaries ReadProjectileRange(JsonElement element) =>
        new(element.GetProperty("falloffBoundary").GetDouble(), Number(element, "maximumBoundary"));

    private static double? Number(JsonElement element, string name) =>
        element.TryGetProperty(name, out JsonElement value) ? value.GetDouble() : null;

    private static InvalidOperationException Malformed(string path, string subject, string problem) =>
        new(string.Format(
            CultureInfo.InvariantCulture, "The shared file '{0}': '{1}' {2}.", path, subject, problem));
}
