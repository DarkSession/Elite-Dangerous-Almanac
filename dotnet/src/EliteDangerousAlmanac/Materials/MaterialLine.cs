using System;
using System.Collections.Generic;

namespace EliteDangerousAlmanac.Materials;

/// <summary>The in-game line (group) a material belongs to.</summary>
/// <remarks>
/// The seven raw lines are named after their grade-1 element. Manufactured and encoded
/// materials use Frontier's group names. Guardian and Thargoid materials, which Frontier
/// files outside the standard groups, are collected under <see cref="Guardian"/> and
/// <see cref="Thargoid"/>.
/// </remarks>
public enum MaterialLine
{
    /// <summary>Raw element family, grades 1 to 4: Carbon, Vanadium, Niobium, Yttrium.</summary>
    Carbon,

    /// <summary>Raw element family, grades 1 to 4, starting at Phosphorus.</summary>
    Phosphorus,

    /// <summary>Raw element family, grades 1 to 4, starting at Sulphur.</summary>
    Sulphur,

    /// <summary>Raw element family, grades 1 to 4, starting at Iron.</summary>
    Iron,

    /// <summary>Raw element family, grades 1 to 4, starting at Nickel.</summary>
    Nickel,

    /// <summary>Raw element family, grades 1 to 4, starting at Rhenium.</summary>
    Rhenium,

    /// <summary>Raw element family, grades 1 to 4, starting at Lead.</summary>
    Lead,

    /// <summary>Manufactured line: chemical storage units up to chemical manipulators.</summary>
    Chemical,

    /// <summary>Manufactured line: thermic alloys and processors.</summary>
    Thermic,

    /// <summary>Manufactured line: heat conduction wiring up to heat exchangers.</summary>
    Heat,

    /// <summary>Manufactured line: conductive components up to conductive polymers.</summary>
    Conductive,

    /// <summary>Manufactured line: mechanical scrap up to mechanical equipment.</summary>
    MechanicalComponents,

    /// <summary>Manufactured line: grid resistors up to military supercapacitors.</summary>
    Capacitors,

    /// <summary>Manufactured line: worn shield emitters up to imperial shielding.</summary>
    Shielding,

    /// <summary>Manufactured line: compact composites up to core dynamics composites.</summary>
    Composite,

    /// <summary>Manufactured line: crystal shards up to exquisite focus crystals.</summary>
    Crystals,

    /// <summary>Manufactured line: salvaged alloys up to proto light alloys.</summary>
    Alloys,

    /// <summary>Encoded line: scrambled emission data up to abnormal compact emissions.</summary>
    EmissionData,

    /// <summary>Encoded line: disrupted wake echoes up to datamined wake exceptions.</summary>
    WakeScans,

    /// <summary>Encoded line: shield cycle recordings up to inconsistent shield soak analysis.</summary>
    ShieldData,

    /// <summary>Encoded line: unusual encrypted files up to adaptive encryptors capture.</summary>
    EncryptionFiles,

    /// <summary>Encoded line: atypical encoded data up to classified scan databanks.</summary>
    DataArchives,

    /// <summary>Encoded line: specialised legacy firmware up to modified embedded firmware.</summary>
    EncodedFirmware,

    /// <summary>Guardian technology materials, filed outside the standard lines.</summary>
    Guardian,

    /// <summary>Thargoid materials, including the caustic and Titan set, outside the standard lines.</summary>
    Thargoid,
}

/// <summary>Reads and writes the in-game spelling of a <see cref="MaterialLine"/>.</summary>
/// <remarks>
/// Four lines are two words in the game — mechanical components, emission data, wake
/// scans, shield data, encryption files, data archives and encoded firmware — so the
/// member name and the in-game name differ. Use these members whenever a line has to
/// reach a user interface or arrive from one.
/// </remarks>
public static class MaterialLines
{
    private static readonly Dictionary<MaterialLine, string> Names = new()
    {
        [MaterialLine.Carbon] = "Carbon",
        [MaterialLine.Phosphorus] = "Phosphorus",
        [MaterialLine.Sulphur] = "Sulphur",
        [MaterialLine.Iron] = "Iron",
        [MaterialLine.Nickel] = "Nickel",
        [MaterialLine.Rhenium] = "Rhenium",
        [MaterialLine.Lead] = "Lead",
        [MaterialLine.Chemical] = "Chemical",
        [MaterialLine.Thermic] = "Thermic",
        [MaterialLine.Heat] = "Heat",
        [MaterialLine.Conductive] = "Conductive",
        [MaterialLine.MechanicalComponents] = "Mechanical Components",
        [MaterialLine.Capacitors] = "Capacitors",
        [MaterialLine.Shielding] = "Shielding",
        [MaterialLine.Composite] = "Composite",
        [MaterialLine.Crystals] = "Crystals",
        [MaterialLine.Alloys] = "Alloys",
        [MaterialLine.EmissionData] = "Emission Data",
        [MaterialLine.WakeScans] = "Wake Scans",
        [MaterialLine.ShieldData] = "Shield Data",
        [MaterialLine.EncryptionFiles] = "Encryption Files",
        [MaterialLine.DataArchives] = "Data Archives",
        [MaterialLine.EncodedFirmware] = "Encoded Firmware",
        [MaterialLine.Guardian] = "Guardian",
        [MaterialLine.Thargoid] = "Thargoid",
    };

    private static readonly Dictionary<string, MaterialLine> Lines = BuildLookup();

    /// <summary>The in-game name of a line, such as <c>"Mechanical Components"</c>.</summary>
    /// <param name="line">The line to name.</param>
    /// <returns>The in-game name.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="line"/> is not a member.</exception>
    public static string DisplayName(this MaterialLine line) =>
        Names.TryGetValue(line, out string? name)
            ? name
            : throw new ArgumentOutOfRangeException(nameof(line), line, "Not a material line.");

    /// <summary>Reads a line from its in-game name or its member name.</summary>
    /// <remarks>
    /// Leading and trailing whitespace and case are ignored, so a value that arrived from
    /// a saved filter or a dropdown resolves without cleaning it first.
    /// </remarks>
    /// <param name="name">The name to read. An absent name is a miss.</param>
    /// <param name="line">The line the name denotes, when the answer is <see langword="true"/>.</param>
    /// <returns><see langword="true"/> when the name denotes a line.</returns>
    public static bool TryParse(string? name, out MaterialLine line)
    {
        line = default;
        string? key = name?.Trim();
        if (string.IsNullOrEmpty(key)) return false;
        return Lines.TryGetValue(key!, out line);
    }

    private static Dictionary<string, MaterialLine> BuildLookup()
    {
        Dictionary<string, MaterialLine> lookup = new(StringComparer.OrdinalIgnoreCase);
        foreach (KeyValuePair<MaterialLine, string> entry in Names)
        {
            lookup[entry.Value] = entry.Key;
            lookup[entry.Key.ToString()] = entry.Key;
        }

        return lookup;
    }
}
