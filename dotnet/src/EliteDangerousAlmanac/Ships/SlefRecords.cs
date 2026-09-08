using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Ships;

/// <summary>The SLEF envelope header, which says which application produced an export.</summary>
/// <param name="AppName">The exporting application's name, such as <c>EDSY</c>.</param>
/// <param name="AppVersion">
/// The exporting application's version. The specification calls for a string and some
/// applications write a number instead, so a numeric version reads back as its decimal text.
/// </param>
public sealed record SlefHeader(
    [property: JsonPropertyName("appName")] string AppName,
    [property: JsonPropertyName("appVersion")] string AppVersion)
{
    /// <summary>A link back to the build in the exporting application, when one is stated.</summary>
    [JsonPropertyName("appURL")]
    public string? AppUrl { get; init; }

    /// <summary>Application-specific extra fields, kept as written so an export carries them back.</summary>
    [JsonPropertyName("appCustomProperties")]
    public IReadOnlyDictionary<string, JsonElement>? AppCustomProperties { get; init; }
}

/// <summary>The durable modification applied to one module.</summary>
/// <param name="BlueprintName">
/// The blueprint's journal name, such as <c>FSD_LongRange</c>. It names a craftable recipe or
/// a fixed pre-engineered identity such as a grade-five festive launcher.
/// </param>
/// <param name="Level">The blueprint grade, 1 through 5.</param>
/// <param name="Quality">The roll quality, 0 through 1.</param>
/// <remarks>
/// A journal capture may also name the engineer, the engineer's identifier and the numeric
/// blueprint identifier. They are deliberately outside this shape: the engineer fields record
/// who applied a modification, and the numeric identifier repeats
/// <paramref name="BlueprintName"/>. None of them changes the fitted module.
/// </remarks>
public sealed record ModuleEngineering(
    [property: JsonPropertyName("BlueprintName")] string BlueprintName,
    [property: JsonPropertyName("Level")] int Level,
    [property: JsonPropertyName("Quality")] double Quality)
{
    /// <summary>The experimental effect's journal name, when one is applied.</summary>
    [JsonPropertyName("ExperimentalEffect")]
    public string? ExperimentalEffect { get; init; }

    /// <summary>The experimental effect's display name, when the source states one.</summary>
    [JsonPropertyName("ExperimentalEffect_Localised")]
    public string? ExperimentalEffectLocalised { get; init; }

    /// <summary>Every stat this engineering changed, or <see langword="null"/> when none are stated.</summary>
    /// <remarks>
    /// A journal <c>Loadout</c> event always writes the list, but SLEF requires only the
    /// blueprint name, the grade and the quality, and the specification's own example omits it.
    /// A parser that demands the list cannot read the format it implements. Absent means "not
    /// stated" rather than "changed nothing", so an export never invents an empty list.
    /// </remarks>
    [JsonPropertyName("Modifiers")]
    public IReadOnlyList<EngineeringModifier>? Modifiers { get; init; }
}

/// <summary>One fitted module in a <c>Loadout</c> event.</summary>
/// <param name="Slot">The mount it occupies, such as <c>FrameShiftDrive</c> or <c>Slot07_Size5</c>.</param>
/// <param name="Item">The module's internal identifier, such as <c>int_hyperdrive_size5_class5</c>.</param>
/// <remarks>
/// The ammunition state is not carried. A journal writes the rounds in the clip and in the
/// hopper on every weapon that takes ammunition, and both are dropped on import and never
/// written back, because they are the ship's rearm state at the instant of capture rather than
/// part of the build. What a fitted weapon can hold is a property of the build, and
/// <see cref="Ammunition"/> answers it.
/// </remarks>
public sealed record LoadoutModule(
    [property: JsonPropertyName("Slot")] string Slot,
    [property: JsonPropertyName("Item")] string Item)
{
    /// <summary>Whether the module is powered on. An absent value means it is on.</summary>
    [JsonPropertyName("On")]
    public bool? On { get; init; }

    /// <summary>The module's power-priority group, 0 through 4.</summary>
    [JsonPropertyName("Priority")]
    public int? Priority { get; init; }

    /// <summary>The module's health, 0 through 1.</summary>
    [JsonPropertyName("Health")]
    public double? Health { get; init; }

    /// <summary>
    /// What the capture says was paid for this module, in credits, net of whatever discount its
    /// owner had. It is not the catalogue's list price, and an absent figure is not free.
    /// </summary>
    [JsonPropertyName("Value")]
    public double? Value { get; init; }

    /// <summary>The engineering, present only on a modified module.</summary>
    [JsonPropertyName("Engineering")]
    public ModuleEngineering? Engineering { get; init; }
}

/// <summary>A ship's fuel-tank capacities, in tonnes.</summary>
/// <param name="Main">The main tank's capacity.</param>
/// <param name="Reserve">The reserve tank's capacity.</param>
public sealed record LoadoutFuelCapacity(
    [property: JsonPropertyName("Main")] double Main,
    [property: JsonPropertyName("Reserve")] double Reserve);

/// <summary>A journal <c>Loadout</c> event, which is the data half of a SLEF entry.</summary>
/// <param name="Ship">The hull's internal identifier, such as <c>explorer_nx</c>.</param>
/// <param name="Modules">Every fitted module.</param>
/// <remarks>
/// Only the hull and the modules are required; every other member is optional. Masses are in
/// tonnes, ranges in light-years and values in credits. The timestamp, the ship identifier, the
/// hull health and the hot flag are deliberately outside this shape, because they name the
/// journal line or describe the capture rather than the fit. A read still accepts an event
/// carrying them.
/// </remarks>
public sealed record LoadoutEvent(
    [property: JsonPropertyName("Ship")] string Ship,
    [property: JsonPropertyName("Modules")] IReadOnlyList<LoadoutModule> Modules)
{
    /// <summary>The journal line's own name, which is <c>Loadout</c> when a journal supplied it.</summary>
    [JsonPropertyName("event")]
    public string? Event { get; init; }

    /// <summary>The player-given ship name.</summary>
    [JsonPropertyName("ShipName")]
    public string? ShipName { get; init; }

    /// <summary>The player-given ship identification plate.</summary>
    [JsonPropertyName("ShipIdent")]
    public string? ShipIdent { get; init; }

    /// <summary>The hull cost, in credits.</summary>
    [JsonPropertyName("HullValue")]
    public double? HullValue { get; init; }

    /// <summary>The fitted modules' cost, in credits.</summary>
    [JsonPropertyName("ModulesValue")]
    public double? ModulesValue { get; init; }

    /// <summary>The hull and module mass with an empty tank and no cargo, in tonnes.</summary>
    [JsonPropertyName("UnladenMass")]
    public double? UnladenMass { get; init; }

    /// <summary>The cargo rack capacity, in tonnes.</summary>
    [JsonPropertyName("CargoCapacity")]
    public double? CargoCapacity { get; init; }

    /// <summary>The exporter's own best single-jump range, in light-years.</summary>
    [JsonPropertyName("MaxJumpRange")]
    public double? MaxJumpRange { get; init; }

    /// <summary>The fuel-tank capacities, in tonnes.</summary>
    [JsonPropertyName("FuelCapacity")]
    public LoadoutFuelCapacity? FuelCapacity { get; init; }

    /// <summary>The insurance rebuy cost, in credits.</summary>
    [JsonPropertyName("Rebuy")]
    public double? Rebuy { get; init; }
}

/// <summary>One header-and-data pair in a SLEF export.</summary>
/// <param name="Header">Which application produced this entry.</param>
/// <param name="Data">The fitted-ship loadout.</param>
public sealed record SlefEntry(
    [property: JsonPropertyName("header")] SlefHeader Header,
    [property: JsonPropertyName("data")] LoadoutEvent Data);
