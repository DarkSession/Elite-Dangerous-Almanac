using System.Collections.Generic;
using System.Text.Json;

namespace EliteDangerousAlmanac.Tests.Equipment;

/// <summary>The part of <c>fixtures/equipment/suit-loadouts.jsonc</c> these tests read.</summary>
internal sealed class SuitLoadoutFixtures
{
    /// <summary>One captured loadout, and everything it reads to.</summary>
    public CaptureFixture Capture { get; set; } = new();

    /// <summary>The events a read passes an entry over on, and what it reports.</summary>
    public Dictionary<string, ImportCaseFixture> Imports { get; set; } = [];

    /// <summary>The events a read refuses altogether.</summary>
    public Dictionary<string, RefusalFixture> Refusals { get; set; } = [];

    /// <summary>One event whose recipe symbols are spelled loosely.</summary>
    public RecipeSpellingFixture RecipeSpelling { get; set; } = new();
}

/// <summary>One captured loadout and everything it reads to.</summary>
internal sealed class CaptureFixture
{
    /// <summary>The capture this case reads.</summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>The same loadout as a switch event states it.</summary>
    public string SwitchSource { get; set; } = string.Empty;

    public string SuitFamily { get; set; } = string.Empty;

    public string SuitName { get; set; } = string.Empty;

    public int Grade { get; set; }

    public long SuitId { get; set; }

    public long LoadoutId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>The suit recipes the read fits, by their catalogue symbols.</summary>
    public List<string> Modifications { get; set; } = [];

    /// <summary>The suit's shield regeneration with its recipes applied.</summary>
    public double ShieldRegeneration { get; set; }

    /// <summary>The suit's kinetic armour resistance with its recipes applied.</summary>
    public double ArmourKineticResistance { get; set; }

    public List<CaptureWeaponFixture> Weapons { get; set; } = [];

    /// <summary>The stats the suit's own recipes name, in the order they are met.</summary>
    public List<string> ModifierStats { get; set; } = [];
}

/// <summary>One weapon a captured loadout fits.</summary>
internal sealed class CaptureWeaponFixture
{
    public string Mount { get; set; } = string.Empty;

    public long ModuleId { get; set; }

    public string Symbol { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int Grade { get; set; }

    public List<string> Modifications { get; set; } = [];

    /// <summary>The stats acting on the weapon, its own and the suit's.</summary>
    public List<string> ModifierStats { get; set; } = [];

    public bool ReloadSpeed { get; set; }

    public bool Scope { get; set; }

    public double MagazineSize { get; set; }

    public double ReserveAmmo { get; set; }

    public double DamagePerShot { get; set; }

    public double HeadshotDamagePerShot { get; set; }

    public double DamagePerSecond { get; set; }

    public double SustainedDamagePerSecond { get; set; }
}

/// <summary>One event a read passes an entry over on.</summary>
internal sealed class ImportCaseFixture
{
    /// <summary>The game's own identifier for each fitted weapon, in mount order.</summary>
    public List<long?> ModuleIds { get; set; } = [];

    /// <summary>The event, as the journal states it.</summary>
    public JsonElement Event { get; set; }

    /// <summary>The mounts the read fills, in the suit's own spelling.</summary>
    public List<string> Mounts { get; set; } = [];

    /// <summary>The modifications the read fits, by their catalogue symbols.</summary>
    public List<string> Modifications { get; set; } = [];

    /// <summary>What the read passed over, in the order it was met.</summary>
    public List<ImportOutcomeFixture> ImportOutcomes { get; set; } = [];
}

/// <summary>One thing a read passed over.</summary>
internal sealed class ImportOutcomeFixture
{
    public string Action { get; set; } = string.Empty;

    public string? Mount { get; set; }

    public string SourceSymbol { get; set; } = string.Empty;
}

/// <summary>One event a read refuses altogether.</summary>
internal sealed class RefusalFixture
{
    /// <summary>The refusal the reference implementation writes.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>The event, as the journal states it.</summary>
    public JsonElement Event { get; set; }
}

/// <summary>One event whose recipe symbols are spelled loosely.</summary>
internal sealed class RecipeSpellingFixture
{
    /// <summary>The event, as the journal states it.</summary>
    public JsonElement Event { get; set; }

    public string Mount { get; set; } = string.Empty;

    /// <summary>The symbols the event states, in its own spelling.</summary>
    public List<string> JournalSymbols { get; set; } = [];

    /// <summary>The catalogue symbols those spellings name.</summary>
    public List<string> Modifications { get; set; } = [];

    public bool ReloadSpeed { get; set; }

    public bool Scope { get; set; }

    public double SustainedDamagePerSecond { get; set; }
}
