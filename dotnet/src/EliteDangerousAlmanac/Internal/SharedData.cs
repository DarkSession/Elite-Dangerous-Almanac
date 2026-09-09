using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Internal;

/// <summary>
/// Reads the shared JSONC catalogues that travel inside the assembly.
/// </summary>
/// <remarks>
/// <para>
/// The repository keeps one copy of every catalogue under <c>data/</c>, and each language
/// implementation strips the comment header in its own loader. Here the file is an
/// embedded resource keyed by its repository path, and
/// <see cref="JsonCommentHandling.Skip"/> is the comment stripper.
/// </para>
/// <para>
/// A catalogue loads once, on first use, and stays loaded. Every record is immutable, so
/// the single instance is safe to share between callers.
/// </para>
/// </remarks>
internal static class SharedData
{
    private static readonly Assembly OwningAssembly = typeof(SharedData).GetTypeInfo().Assembly;

    /// <summary>
    /// Reader settings the shared files need: comments skipped, camel-cased property
    /// names, and no trailing commas.
    /// </summary>
    /// <remarks>
    /// Trailing commas stay rejected on purpose. A shared file must remain strict JSON
    /// once its header comment is gone, so every language's standard parser reads it.
    /// </remarks>
    internal static readonly JsonSerializerOptions Options = new()
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false) },
    };

    /// <summary>Reads one embedded JSONC payload into <typeparamref name="T"/>.</summary>
    /// <typeparam name="T">The shape the payload has.</typeparam>
    /// <param name="path">The repository path, such as <c>data/materials/materials-raw.jsonc</c>.</param>
    /// <returns>The parsed payload.</returns>
    /// <exception cref="InvalidOperationException">
    /// The resource is absent from the assembly, or it parses to <see langword="null"/>.
    /// Either one means the build lost a shared file, so it is a defect in this package
    /// rather than a caller error.
    /// </exception>
    internal static T Load<T>(string path)
    {
        using Stream stream = Open(path);
        T? payload;
        try
        {
            payload = JsonSerializer.Deserialize<T>(stream, Options);
        }
        catch (JsonException error)
        {
            throw new InvalidOperationException(
                string.Format(CultureInfo.InvariantCulture, "The shared file '{0}' is not valid JSONC.", path),
                error);
        }

        return payload ?? throw new InvalidOperationException(
            string.Format(CultureInfo.InvariantCulture, "The shared file '{0}' holds no payload.", path));
    }

    /// <summary>
    /// Reads one embedded JSONC payload as a frozen list of records.
    /// </summary>
    /// <typeparam name="T">The record shape one array element has.</typeparam>
    /// <param name="path">The repository path of the catalogue.</param>
    /// <returns>A read-only list in the file's own order.</returns>
    internal static IReadOnlyList<T> LoadList<T>(string path) =>
        new ReadOnlyCollection<T>(Load<T[]>(path));

    /// <summary>
    /// Reads one embedded JSONC object whose keys are the names of an enum's members.
    /// </summary>
    /// <typeparam name="TKey">The enum the keys name.</typeparam>
    /// <typeparam name="TValue">The shape one value has.</typeparam>
    /// <param name="path">The repository path of the catalogue.</param>
    /// <returns>A read-only map, in the file's own order.</returns>
    /// <exception cref="InvalidOperationException">A key names no member of the enum.</exception>
    internal static IReadOnlyDictionary<TKey, TValue> LoadEnumKeyed<TKey, TValue>(string path)
        where TKey : struct, Enum
    {
        Dictionary<string, TValue> raw = Load<Dictionary<string, TValue>>(path);
        Dictionary<TKey, TValue> parsed = new(raw.Count);
        foreach (KeyValuePair<string, TValue> entry in raw)
        {
            if (!EnumParsing.TryParse(entry.Key, out TKey key))
            {
                throw new InvalidOperationException(string.Format(
                    CultureInfo.InvariantCulture,
                    "The shared file '{0}' names an unknown {1} '{2}'.",
                    path,
                    typeof(TKey).Name,
                    entry.Key));
            }

            parsed[key] = entry.Value;
        }

        return new ReadOnlyDictionary<TKey, TValue>(parsed);
    }

    /// <summary>Opens the embedded resource for <paramref name="path"/>.</summary>
    internal static Stream Open(string path)
    {
        return OwningAssembly.GetManifestResourceStream(path)
            ?? throw new InvalidOperationException(
                string.Format(CultureInfo.InvariantCulture, "The shared file '{0}' is not embedded in this package.", path));
    }
}
