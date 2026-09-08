using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Ships.Internal;

namespace EliteDangerousAlmanac.Ships;

/// <summary>
/// The Ship Loadout Export Format: a strict reader, a tolerant inspector and a writer.
/// </summary>
/// <remarks>
/// <para>
/// SLEF is the community interchange format for a fitted ship, which EDSY, Coriolis, Inara and
/// others all read and write. It is the game journal's <c>Loadout</c> event wrapped in an
/// envelope that records which application exported it:
/// </para>
/// <code>
/// [{ "header": { "appName": "EDSY", "appVersion": "..." },
///    "data":   { "event": "Loadout", "Ship": "explorer_nx", "Modules": [ ... ] } }]
/// </code>
/// <para>
/// The top level is an array, so several builds travel together. This class carries the record
/// shapes only, so it reads no ship, module or blueprint catalogue.
/// </para>
/// <para>
/// The specification is Inara's, at <c>https://inara.cz/elite/inara-impexp-slef/</c>.
/// </para>
/// </remarks>
public static class Slef
{
    /// <summary>The header a bare, envelope-less loadout is given.</summary>
    private static readonly SlefHeader SyntheticHeader = new(string.Empty, string.Empty);

    private static readonly IReadOnlyList<SlefEntry> NoEntries =
        new ReadOnlyCollection<SlefEntry>([]);

    private static readonly IReadOnlyList<SlefDiagnostic> NoDiagnostics =
        new ReadOnlyCollection<SlefDiagnostic>([]);

    /// <summary>One indented writer per indent width, because a fresh one caches no metadata.</summary>
    private static readonly ConcurrentDictionary<int, JsonSerializerOptions> IndentedOptions = new();

    /// <summary>How an export is written: journal spelling, and no member for an absent value.</summary>
    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>
    /// How a caller's records are written for checking, which admits the floating-point values
    /// JSON has no notation for so that the walker rejects them by name.
    /// </summary>
    private static readonly JsonSerializerOptions CheckOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
    };

    /// <summary>Inspects a SLEF payload without losing the entries it cannot read.</summary>
    /// <param name="json">The export's JSON text.</param>
    /// <returns>Every valid entry, and one diagnostic for each entry that was rejected.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="json"/> is <see langword="null"/>.</exception>
    /// <exception cref="JsonException"><paramref name="json"/> is not valid JSON.</exception>
    public static SlefInspection Inspect(string json)
    {
        if (json is null) throw new ArgumentNullException(nameof(json));
        using JsonDocument document = JsonDocument.Parse(json);
        return Inspect(document.RootElement);
    }

    /// <summary>Inspects an already-parsed SLEF payload.</summary>
    /// <param name="root">
    /// The payload. The accepted shapes, in order of leniency, are the standard array of
    /// envelopes, a single envelope, and a bare journal <c>Loadout</c> event, which is given an
    /// empty header of its own.
    /// </param>
    /// <returns>Every valid entry, and one diagnostic for each entry that was rejected.</returns>
    public static SlefInspection Inspect(JsonElement root)
    {
        List<SlefEntry> entries = [];
        List<SlefDiagnostic> diagnostics = [];
        int index = 0;
        foreach (JsonElement raw in TopLevelEntries(root))
        {
            InspectEntry(raw, index, entries, diagnostics);
            index++;
        }

        return new SlefInspection(
            entries.Count == 0 ? NoEntries : new ReadOnlyCollection<SlefEntry>(entries),
            diagnostics.Count == 0 ? NoDiagnostics : new ReadOnlyCollection<SlefDiagnostic>(diagnostics));
    }

    /// <summary>Reads a SLEF payload, refusing the whole export over one bad entry.</summary>
    /// <param name="json">The export's JSON text.</param>
    /// <returns>The entries, in export order. It is never empty.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="json"/> is <see langword="null"/>.</exception>
    /// <exception cref="JsonException"><paramref name="json"/> is not valid JSON.</exception>
    /// <exception cref="FormatException">
    /// The payload holds no entry, or an entry, a header, a loadout, a module or an engineering
    /// field is malformed. Use <see cref="Inspect(string)"/> to recover the valid entries of a
    /// mixed payload instead.
    /// </exception>
    public static IReadOnlyList<SlefEntry> Parse(string json) => Complete(Inspect(json));

    /// <summary>Reads an already-parsed SLEF payload, refusing it over one bad entry.</summary>
    /// <param name="root">The payload, in any of the shapes <see cref="Inspect(JsonElement)"/> takes.</param>
    /// <returns>The entries, in export order. It is never empty.</returns>
    /// <exception cref="FormatException">
    /// The payload holds no entry, or one of its fields is malformed.
    /// </exception>
    public static IReadOnlyList<SlefEntry> Parse(JsonElement root) => Complete(Inspect(root));

    /// <summary>Wraps one loadout in a SLEF envelope.</summary>
    /// <param name="data">The loadout to export.</param>
    /// <param name="header">
    /// Which exporting application to credit. SLEF attribution belongs to the application
    /// producing the export, so a caller states its own name and version.
    /// </param>
    /// <returns>The export, holding the one entry.</returns>
    /// <exception cref="ArgumentNullException">An argument is <see langword="null"/>.</exception>
    /// <exception cref="FormatException">The header or the loadout is malformed.</exception>
    public static IReadOnlyList<SlefEntry> Wrap(LoadoutEvent data, SlefHeader header) =>
        Wrap(data is null ? throw new ArgumentNullException(nameof(data)) : [data], header);

    /// <summary>Wraps several loadouts in one SLEF export.</summary>
    /// <param name="data">
    /// The loadouts to export. They travel as separate entries, which is what the format's array
    /// top level is for.
    /// </param>
    /// <param name="header">Which exporting application to credit.</param>
    /// <returns>The export, one entry per loadout, in the order given.</returns>
    /// <remarks>
    /// Every entry is checked by the walker a read uses, so anything this answers reads back.
    /// </remarks>
    /// <exception cref="ArgumentNullException">An argument is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentException">
    /// <paramref name="data"/> is empty. A read rejects an empty export, so writing one would
    /// break the promise that everything this produces reads back.
    /// </exception>
    /// <exception cref="FormatException">The header or one of the loadouts is malformed.</exception>
    public static IReadOnlyList<SlefEntry> Wrap(IReadOnlyList<LoadoutEvent> data, SlefHeader header)
    {
        if (data is null) throw new ArgumentNullException(nameof(data));
        if (header is null) throw new ArgumentNullException(nameof(header));

        InvalidSlefField? failure = SlefDiagnosis.DiagnoseHeader(Check(header), "header");
        if (failure is not null) throw Malformed(failure);
        if (data.Count == 0)
        {
            throw new ArgumentException("An export needs at least one loadout.", nameof(data));
        }

        List<SlefEntry> entries = new(data.Count);
        for (int index = 0; index < data.Count; index++)
        {
            LoadoutEvent loadout = data[index];
            string path = string.Format(CultureInfo.InvariantCulture, "entries[{0}]", index);
            failure = loadout is null
                ? new InvalidSlefField(
                    SlefDiagnosticCode.InvalidLoadout,
                    path,
                    SlefConstraint.ObjectRequired,
                    SlefDiagnosis.Reason(SlefConstraint.ObjectRequired))
                : SlefDiagnosis.DiagnoseLoadout(Check(loadout), path);
            if (failure is not null) throw Malformed(failure);

            (string Slot, int ModuleIndex)? duplicate = SlefDiagnosis.DuplicateSlot(loadout!);
            if (duplicate is not null) throw new FormatException(DuplicateMessage(index, duplicate.Value.Slot));
            entries.Add(new SlefEntry(header, loadout!));
        }

        return new ReadOnlyCollection<SlefEntry>(entries);
    }

    /// <summary>Writes a SLEF export as compact JSON.</summary>
    /// <param name="slef">The entries, as <see cref="Wrap(LoadoutEvent, SlefHeader)"/> answers them.</param>
    /// <returns>The JSON text, which is what the clipboard exchange these exports travel by wants.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="slef"/> is <see langword="null"/>.</exception>
    public static string Stringify(IReadOnlyList<SlefEntry> slef)
    {
        if (slef is null) throw new ArgumentNullException(nameof(slef));
        return JsonSerializer.Serialize(slef, WriteOptions);
    }

    /// <summary>Writes a SLEF export as indented JSON, for a file a person reads.</summary>
    /// <param name="slef">The entries to write.</param>
    /// <param name="indent">The spaces one indent level costs, from 1 to 127.</param>
    /// <returns>The JSON text.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="slef"/> is <see langword="null"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="indent"/> is outside 1 to 127.</exception>
    public static string Stringify(IReadOnlyList<SlefEntry> slef, int indent)
    {
        if (slef is null) throw new ArgumentNullException(nameof(slef));
        if (indent is < 1 or > 127)
        {
            throw new ArgumentOutOfRangeException(
                nameof(indent), indent, "The indent must be from 1 to 127 spaces.");
        }

        JsonSerializerOptions options = IndentedOptions.GetOrAdd(
            indent,
            width => new JsonSerializerOptions(WriteOptions) { WriteIndented = true, IndentSize = width });
        return JsonSerializer.Serialize(slef, options);
    }

    /// <summary>Reads one engineering modifier off a fitted module by its journal label.</summary>
    /// <param name="module">The fitted module.</param>
    /// <param name="label">
    /// The stat's journal name, such as <c>FSDOptimalMass</c>. It is matched with the
    /// surrounding whitespace removed and the case folded.
    /// </param>
    /// <returns>
    /// The modifier's numeric value, or <see langword="null"/> when the module is not
    /// engineered, states no modifiers at all, carries no such modifier, or carries one that is
    /// not numeric.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="module"/> is <see langword="null"/>.</exception>
    public static double? FindModifier(LoadoutModule module, string? label)
    {
        if (module is null) throw new ArgumentNullException(nameof(module));

        string? wanted = RegistryIndex.NormalizeKey(label);
        IReadOnlyList<EngineeringModifier>? modifiers = module.Engineering?.Modifiers;
        if (wanted is null || modifiers is null) return null;

        foreach (EngineeringModifier modifier in modifiers)
        {
            if (RegistryIndex.KeyComparer.Equals(modifier.Label, wanted)) return modifier.Value;
        }

        return null;
    }

    private static List<JsonElement> TopLevelEntries(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Array) return [root];
        List<JsonElement> raw = [];
        foreach (JsonElement entry in root.EnumerateArray()) raw.Add(entry);
        return raw;
    }

    private static void InspectEntry(
        JsonElement raw,
        int index,
        List<SlefEntry> entries,
        List<SlefDiagnostic> diagnostics)
    {
        string entryPath = string.Format(CultureInfo.InvariantCulture, "entries[{0}]", index);
        bool bare = SlefDiagnosis.DiagnoseLoadout(raw, entryPath) is null;
        JsonElement data = default;
        bool enveloped = !bare
            && SlefDiagnosis.IsObject(raw)
            && raw.TryGetProperty("data", out data)
            && SlefDiagnosis.DiagnoseLoadout(data, entryPath + ".data") is null;

        SlefHeader? header = null;
        if (bare)
        {
            header = SyntheticHeader;
        }
        else if (enveloped
            && raw.TryGetProperty("header", out JsonElement stated)
            && SlefDiagnosis.DiagnoseHeader(stated, entryPath + ".header") is null)
        {
            header = SlefDiagnosis.ReadHeader(stated);
        }

        if (header is null)
        {
            diagnostics.Add(RejectEntry(raw, index, entryPath));
            return;
        }

        LoadoutEvent loadout = SlefDiagnosis.ReadLoadout(bare ? raw : data);
        (string Slot, int ModuleIndex)? duplicate = SlefDiagnosis.DuplicateSlot(loadout);
        if (duplicate is not null)
        {
            diagnostics.Add(new SlefDiagnostic(
                index,
                SlefDiagnosticCode.DuplicateSlot,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "{0}{1}.Modules[{2}].Slot",
                    entryPath,
                    bare ? string.Empty : ".data",
                    duplicate.Value.ModuleIndex),
                SlefConstraint.UniqueSlot,
                DuplicateMessage(index, duplicate.Value.Slot))
            {
                Slot = duplicate.Value.Slot,
            });
            return;
        }

        entries.Add(new SlefEntry(header, loadout));
    }

    /// <summary>Says which field of a rejected entry to report.</summary>
    /// <remarks>
    /// An entry that names a header or a data half is one somebody meant as an envelope, so its
    /// own halves are inspected. Anything else is reported as the bare loadout it was offered
    /// as, which keeps a journal capture's diagnostics free of an envelope it never had.
    /// </remarks>
    private static SlefDiagnostic RejectEntry(JsonElement raw, int index, string entryPath)
    {
        bool envelope = SlefDiagnosis.IsObject(raw)
            && (raw.TryGetProperty("header", out _) || raw.TryGetProperty("data", out _));
        InvalidSlefField? detail;
        if (envelope)
        {
            raw.TryGetProperty("header", out JsonElement header);
            raw.TryGetProperty("data", out JsonElement data);
            detail = SlefDiagnosis.DiagnoseHeader(header, entryPath + ".header")
                ?? SlefDiagnosis.DiagnoseLoadout(data, entryPath + ".data");
        }
        else
        {
            detail = SlefDiagnosis.DiagnoseLoadout(raw, entryPath);
        }

        string path = detail?.Path ?? entryPath;
        SlefConstraint constraint = detail?.Constraint ?? SlefConstraint.ValidLoadoutRequired;
        return new SlefDiagnostic(
            index,
            detail?.Code ?? SlefDiagnosticCode.InvalidLoadout,
            path,
            constraint,
            path + " " + (detail?.Reason ?? SlefDiagnosis.Reason(SlefConstraint.ValidLoadoutRequired)));
    }

    private static IReadOnlyList<SlefEntry> Complete(SlefInspection inspected)
    {
        if (inspected.Diagnostics.Count > 0)
        {
            throw new FormatException(inspected.Diagnostics[0].Message);
        }

        if (inspected.Entries.Count == 0)
        {
            throw new FormatException("The payload holds no SLEF entry.");
        }

        return inspected.Entries;
    }

    private static JsonElement Check<T>(T value) => JsonSerializer.SerializeToElement(value, CheckOptions);

    private static FormatException Malformed(InvalidSlefField failure) =>
        new(failure.Path + " " + failure.Reason);

    private static string DuplicateMessage(int index, string slot) => string.Format(
        CultureInfo.InvariantCulture,
        "Entry {0} contains duplicate slot \"{1}\"",
        index,
        TextPreview.Truncate(slot));
}
