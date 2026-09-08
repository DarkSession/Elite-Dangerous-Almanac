using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;

namespace EliteDangerousAlmanac.Ships.Internal;

/// <summary>One field of a SLEF payload that broke its rule.</summary>
internal sealed record InvalidSlefField(
    SlefDiagnosticCode Code,
    string Path,
    SlefConstraint Constraint,
    string Reason);

/// <summary>
/// Reads a SLEF payload one field at a time, reporting the first field that breaks its rule.
/// </summary>
/// <remarks>
/// <para>
/// The whole format is checked here and nowhere else. A tolerant inspection reports what this
/// finds, a strict parse turns the first report into a failure, and a write serializes the
/// records a caller offers and checks the result the same way. One walker means an export
/// cannot produce a payload the matching import refuses.
/// </para>
/// <para>
/// A rule is stated over the wire shape, so a value of the wrong JSON kind and a value of the
/// right kind outside its range read the same way to a caller.
/// </para>
/// </remarks>
internal static class SlefDiagnosis
{
    /// <summary>The English reading of each field-level rule.</summary>
    /// <remarks>
    /// The duplicate-mount rule is absent on purpose. It is stated over a whole entry rather
    /// than over one field, so its message names the mount instead of reading a rule out.
    /// </remarks>
    private static readonly Dictionary<SlefConstraint, string> Reasons = new()
    {
        [SlefConstraint.ObjectRequired] = "must be an object",
        [SlefConstraint.StringRequired] = "must be a string",
        [SlefConstraint.BooleanRequired] = "must be a boolean",
        [SlefConstraint.ArrayRequired] = "must be an array",
        [SlefConstraint.FiniteNumberRequired] = "must be a finite number",
        [SlefConstraint.NonNegativeNumberRequired] = "must be a non-negative number",
        [SlefConstraint.PriorityRange] = "must be an integer from 0 to 4",
        [SlefConstraint.EngineeringLevelRange] = "must be an integer from 1 to 5",
        [SlefConstraint.UnitInterval] = "must be a number from 0 to 1",
        [SlefConstraint.BinaryInteger] = "must be 0 or 1",
        [SlefConstraint.VersionRequired] = "must be a string or finite number",
        [SlefConstraint.LoadoutEventRequired] = "must be \"Loadout\"",
        [SlefConstraint.ValidLoadoutRequired] = "is not a valid Loadout event",
    };

    /// <summary>The English reading of one field-level rule.</summary>
    internal static string Reason(SlefConstraint constraint) => Reasons[constraint];

    private static InvalidSlefField Invalid(SlefDiagnosticCode code, string path, SlefConstraint constraint) =>
        new(code, path, constraint, Reason(constraint));

    /// <summary>Whether a value is a JSON object, which is what every record shape needs.</summary>
    internal static bool IsObject(JsonElement value) => value.ValueKind == JsonValueKind.Object;

    private static bool IsString(JsonElement value) => value.ValueKind == JsonValueKind.String;

    private static bool OptionalString(JsonElement owner, string name) =>
        !owner.TryGetProperty(name, out JsonElement value) || IsString(value);

    private static bool FiniteNumber(JsonElement value, out double number)
    {
        number = 0;
        return value.ValueKind == JsonValueKind.Number
            && value.TryGetDouble(out number)
            && !double.IsNaN(number)
            && !double.IsInfinity(number);
    }

    private static bool OptionalFiniteNumber(JsonElement owner, string name) =>
        !owner.TryGetProperty(name, out JsonElement value) || FiniteNumber(value, out _);

    private static bool NumberInRange(JsonElement value, double minimum, double maximum) =>
        FiniteNumber(value, out double number) && number >= minimum && number <= maximum;

    private static bool OptionalNumberInRange(
        JsonElement owner,
        string name,
        double minimum,
        double maximum = double.PositiveInfinity) =>
        !owner.TryGetProperty(name, out JsonElement value) || NumberInRange(value, minimum, maximum);

    private static bool IntegerInRange(JsonElement value, double minimum, double maximum) =>
        NumberInRange(value, minimum, maximum)
        && value.TryGetDouble(out double number)
        && number == Math.Floor(number);

    private static bool OptionalIntegerInRange(JsonElement owner, string name, double minimum, double maximum) =>
        !owner.TryGetProperty(name, out JsonElement value) || IntegerInRange(value, minimum, maximum);

    private static bool RequiredIntegerInRange(JsonElement owner, string name, double minimum, double maximum) =>
        owner.TryGetProperty(name, out JsonElement value) && IntegerInRange(value, minimum, maximum);

    private static bool RequiredNumberInRange(JsonElement owner, string name, double minimum, double maximum) =>
        owner.TryGetProperty(name, out JsonElement value) && NumberInRange(value, minimum, maximum);

    /// <summary>Checks one engineering block and the modifiers it states.</summary>
    internal static InvalidSlefField? DiagnoseEngineering(JsonElement value, string path)
    {
        const SlefDiagnosticCode Code = SlefDiagnosticCode.InvalidEngineering;
        if (!IsObject(value)) return Invalid(Code, path, SlefConstraint.ObjectRequired);
        if (!value.TryGetProperty("BlueprintName", out JsonElement blueprint) || !IsString(blueprint))
        {
            return Invalid(Code, path + ".BlueprintName", SlefConstraint.StringRequired);
        }

        if (!RequiredIntegerInRange(value, "Level", 1, 5))
        {
            return Invalid(Code, path + ".Level", SlefConstraint.EngineeringLevelRange);
        }

        if (!RequiredNumberInRange(value, "Quality", 0, 1))
        {
            return Invalid(Code, path + ".Quality", SlefConstraint.UnitInterval);
        }

        if (!OptionalString(value, "ExperimentalEffect"))
        {
            return Invalid(Code, path + ".ExperimentalEffect", SlefConstraint.StringRequired);
        }

        if (!OptionalString(value, "ExperimentalEffect_Localised"))
        {
            return Invalid(Code, path + ".ExperimentalEffect_Localised", SlefConstraint.StringRequired);
        }

        if (!value.TryGetProperty("Modifiers", out JsonElement modifiers)) return null;
        if (modifiers.ValueKind != JsonValueKind.Array)
        {
            return Invalid(Code, path + ".Modifiers", SlefConstraint.ArrayRequired);
        }

        int index = 0;
        foreach (JsonElement modifier in modifiers.EnumerateArray())
        {
            InvalidSlefField? failure = DiagnoseModifier(
                modifier,
                string.Format(CultureInfo.InvariantCulture, "{0}.Modifiers[{1}]", path, index));
            if (failure is not null) return failure;
            index++;
        }

        return null;
    }

    private static InvalidSlefField? DiagnoseModifier(JsonElement value, string path)
    {
        const SlefDiagnosticCode Code = SlefDiagnosticCode.InvalidEngineering;
        if (!IsObject(value)) return Invalid(Code, path, SlefConstraint.ObjectRequired);
        if (!value.TryGetProperty("Label", out JsonElement label) || !IsString(label))
        {
            return Invalid(Code, path + ".Label", SlefConstraint.StringRequired);
        }

        if (!OptionalFiniteNumber(value, "Value"))
        {
            return Invalid(Code, path + ".Value", SlefConstraint.FiniteNumberRequired);
        }

        if (!OptionalFiniteNumber(value, "OriginalValue"))
        {
            return Invalid(Code, path + ".OriginalValue", SlefConstraint.FiniteNumberRequired);
        }

        if (!OptionalString(value, "ValueStr"))
        {
            return Invalid(Code, path + ".ValueStr", SlefConstraint.StringRequired);
        }

        if (!OptionalIntegerInRange(value, "LessIsGood", 0, 1))
        {
            return Invalid(Code, path + ".LessIsGood", SlefConstraint.BinaryInteger);
        }

        return null;
    }

    /// <summary>Checks one fitted module.</summary>
    internal static InvalidSlefField? DiagnoseModule(JsonElement value, string path)
    {
        const SlefDiagnosticCode Code = SlefDiagnosticCode.InvalidModule;
        if (!IsObject(value)) return Invalid(Code, path, SlefConstraint.ObjectRequired);
        if (!value.TryGetProperty("Slot", out JsonElement slot) || !IsString(slot))
        {
            return Invalid(Code, path + ".Slot", SlefConstraint.StringRequired);
        }

        if (!value.TryGetProperty("Item", out JsonElement item) || !IsString(item))
        {
            return Invalid(Code, path + ".Item", SlefConstraint.StringRequired);
        }

        if (value.TryGetProperty("On", out JsonElement on)
            && on.ValueKind != JsonValueKind.True
            && on.ValueKind != JsonValueKind.False)
        {
            return Invalid(Code, path + ".On", SlefConstraint.BooleanRequired);
        }

        if (!OptionalIntegerInRange(value, "Priority", 0, 4))
        {
            return Invalid(Code, path + ".Priority", SlefConstraint.PriorityRange);
        }

        if (!OptionalNumberInRange(value, "Health", 0, 1))
        {
            return Invalid(Code, path + ".Health", SlefConstraint.UnitInterval);
        }

        if (!OptionalNumberInRange(value, "Value", 0))
        {
            return Invalid(Code, path + ".Value", SlefConstraint.NonNegativeNumberRequired);
        }

        return value.TryGetProperty("Engineering", out JsonElement engineering)
            ? DiagnoseEngineering(engineering, path + ".Engineering")
            : null;
    }

    /// <summary>Checks one envelope header.</summary>
    internal static InvalidSlefField? DiagnoseHeader(JsonElement value, string path)
    {
        const SlefDiagnosticCode Code = SlefDiagnosticCode.InvalidHeader;
        if (!IsObject(value)) return Invalid(Code, path, SlefConstraint.ObjectRequired);
        if (!value.TryGetProperty("appName", out JsonElement name) || !IsString(name))
        {
            return Invalid(Code, path + ".appName", SlefConstraint.StringRequired);
        }

        if (!value.TryGetProperty("appVersion", out JsonElement version)
            || (!IsString(version) && !FiniteNumber(version, out _)))
        {
            return Invalid(Code, path + ".appVersion", SlefConstraint.VersionRequired);
        }

        if (!OptionalString(value, "appURL"))
        {
            return Invalid(Code, path + ".appURL", SlefConstraint.StringRequired);
        }

        if (value.TryGetProperty("appCustomProperties", out JsonElement custom) && !IsObject(custom))
        {
            return Invalid(Code, path + ".appCustomProperties", SlefConstraint.ObjectRequired);
        }

        return null;
    }

    /// <summary>Checks one <c>Loadout</c> event and every module it fits.</summary>
    internal static InvalidSlefField? DiagnoseLoadout(JsonElement value, string path)
    {
        const SlefDiagnosticCode Code = SlefDiagnosticCode.InvalidLoadout;
        if (!IsObject(value)) return Invalid(Code, path, SlefConstraint.ObjectRequired);
        if (!value.TryGetProperty("Ship", out JsonElement ship) || !IsString(ship))
        {
            return Invalid(Code, path + ".Ship", SlefConstraint.StringRequired);
        }

        if (!value.TryGetProperty("Modules", out JsonElement modules)
            || modules.ValueKind != JsonValueKind.Array)
        {
            return Invalid(Code, path + ".Modules", SlefConstraint.ArrayRequired);
        }

        if (value.TryGetProperty("event", out JsonElement journalEvent)
            && !(IsString(journalEvent) && journalEvent.GetString() == "Loadout"))
        {
            return Invalid(Code, path + ".event", SlefConstraint.LoadoutEventRequired);
        }

        foreach (string field in new[] { "ShipName", "ShipIdent" })
        {
            if (!OptionalString(value, field))
            {
                return Invalid(Code, path + "." + field, SlefConstraint.StringRequired);
            }
        }

        foreach (string field in new[]
        {
            "HullValue", "ModulesValue", "UnladenMass", "CargoCapacity", "MaxJumpRange", "Rebuy",
        })
        {
            if (!OptionalNumberInRange(value, field, 0))
            {
                return Invalid(Code, path + "." + field, SlefConstraint.NonNegativeNumberRequired);
            }
        }

        if (value.TryGetProperty("FuelCapacity", out JsonElement fuel))
        {
            if (!IsObject(fuel))
            {
                return Invalid(Code, path + ".FuelCapacity", SlefConstraint.ObjectRequired);
            }

            foreach (string field in new[] { "Main", "Reserve" })
            {
                if (!RequiredNumberInRange(fuel, field, 0, double.PositiveInfinity))
                {
                    return Invalid(
                        Code,
                        path + ".FuelCapacity." + field,
                        SlefConstraint.NonNegativeNumberRequired);
                }
            }
        }

        int index = 0;
        foreach (JsonElement module in modules.EnumerateArray())
        {
            InvalidSlefField? failure = DiagnoseModule(
                module,
                string.Format(CultureInfo.InvariantCulture, "{0}.Modules[{1}]", path, index));
            if (failure is not null) return failure;
            index++;
        }

        return null;
    }

    /// <summary>Builds a header from a payload the walker already accepted.</summary>
    internal static SlefHeader ReadHeader(JsonElement value)
    {
        JsonElement version = value.GetProperty("appVersion");
        Dictionary<string, JsonElement>? custom = null;
        if (value.TryGetProperty("appCustomProperties", out JsonElement properties))
        {
            custom = [];
            foreach (JsonProperty property in properties.EnumerateObject())
            {
                custom[property.Name] = property.Value.Clone();
            }
        }

        return new SlefHeader(
            value.GetProperty("appName").GetString()!,
            IsString(version) ? version.GetString()! : version.GetRawText())
        {
            AppUrl = ReadOptionalString(value, "appURL"),
            AppCustomProperties = custom,
        };
    }

    /// <summary>Builds a <c>Loadout</c> event from a payload the walker already accepted.</summary>
    internal static LoadoutEvent ReadLoadout(JsonElement value)
    {
        List<LoadoutModule> modules = [];
        foreach (JsonElement module in value.GetProperty("Modules").EnumerateArray())
        {
            modules.Add(ReadModule(module));
        }

        return new LoadoutEvent(value.GetProperty("Ship").GetString()!, modules)
        {
            Event = ReadOptionalString(value, "event"),
            ShipName = ReadOptionalString(value, "ShipName"),
            ShipIdent = ReadOptionalString(value, "ShipIdent"),
            HullValue = ReadOptionalNumber(value, "HullValue"),
            ModulesValue = ReadOptionalNumber(value, "ModulesValue"),
            UnladenMass = ReadOptionalNumber(value, "UnladenMass"),
            CargoCapacity = ReadOptionalNumber(value, "CargoCapacity"),
            MaxJumpRange = ReadOptionalNumber(value, "MaxJumpRange"),
            FuelCapacity = value.TryGetProperty("FuelCapacity", out JsonElement fuel)
                ? new LoadoutFuelCapacity(
                    fuel.GetProperty("Main").GetDouble(),
                    fuel.GetProperty("Reserve").GetDouble())
                : null,
            Rebuy = ReadOptionalNumber(value, "Rebuy"),
        };
    }

    private static LoadoutModule ReadModule(JsonElement value) =>
        new(value.GetProperty("Slot").GetString()!, value.GetProperty("Item").GetString()!)
        {
            On = value.TryGetProperty("On", out JsonElement on) ? on.GetBoolean() : null,
            Priority = value.TryGetProperty("Priority", out JsonElement priority)
                ? (int)priority.GetDouble()
                : null,
            Health = ReadOptionalNumber(value, "Health"),
            Value = ReadOptionalNumber(value, "Value"),
            Engineering = value.TryGetProperty("Engineering", out JsonElement engineering)
                ? ReadEngineering(engineering)
                : null,
        };

    private static ModuleEngineering ReadEngineering(JsonElement value)
    {
        List<EngineeringModifier>? modifiers = null;
        if (value.TryGetProperty("Modifiers", out JsonElement stated))
        {
            modifiers = [];
            foreach (JsonElement modifier in stated.EnumerateArray())
            {
                modifiers.Add(new EngineeringModifier(
                    modifier.GetProperty("Label").GetString()!,
                    ReadOptionalNumber(modifier, "Value"),
                    ReadOptionalNumber(modifier, "OriginalValue"),
                    ReadOptionalString(modifier, "ValueStr")));
            }
        }

        return new ModuleEngineering(
            value.GetProperty("BlueprintName").GetString()!,
            (int)value.GetProperty("Level").GetDouble(),
            value.GetProperty("Quality").GetDouble())
        {
            ExperimentalEffect = ReadOptionalString(value, "ExperimentalEffect"),
            ExperimentalEffectLocalised = ReadOptionalString(value, "ExperimentalEffect_Localised"),
            Modifiers = modifiers,
        };
    }

    private static string? ReadOptionalString(JsonElement owner, string name) =>
        owner.TryGetProperty(name, out JsonElement value) ? value.GetString() : null;

    private static double? ReadOptionalNumber(JsonElement owner, string name) =>
        owner.TryGetProperty(name, out JsonElement value) ? value.GetDouble() : null;

    /// <summary>The first mount two fitted modules both name, ignoring case.</summary>
    /// <returns>
    /// The mount as the second module spelled it and that module's position, or
    /// <see langword="null"/> when every mount is named once.
    /// </returns>
    internal static (string Slot, int ModuleIndex)? DuplicateSlot(LoadoutEvent loadout)
    {
        HashSet<string> seen = new(StringComparer.OrdinalIgnoreCase);
        for (int index = 0; index < loadout.Modules.Count; index++)
        {
            string slot = loadout.Modules[index].Slot;
            if (!seen.Add(slot)) return (slot, index);
        }

        return null;
    }
}
