using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Tests.Support;

/// <summary>
/// Reads the shared JSONC fixtures, which are the parity contract every language
/// implementation is measured against.
/// </summary>
/// <remarks>
/// A fixture holds the expected values, so a test that reads one proves this port agrees
/// with the TypeScript package on identical data. The files travel inside the test
/// assembly as embedded resources keyed by their repository path.
/// </remarks>
internal static class SharedFixtures
{
    private static readonly Assembly OwningAssembly = typeof(SharedFixtures).GetTypeInfo().Assembly;

    private static readonly JsonSerializerOptions Options = new()
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.Strict,

        // A fixture block no model carries is a parity case this port never checks. Refusing
        // it makes that a failure rather than a silence.
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };

    /// <summary>The rules a captured journal line is read by.</summary>
    /// <remarks>
    /// A real journal line carries the fields the game writes on every event, such as its
    /// timestamp. A library type states the fields it reads and no more, so the strict rules
    /// above would refuse the very captures the library exists to read.
    /// </remarks>
    private static readonly JsonSerializerOptions CaptureOptions = new(Options)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Skip,
    };

    /// <summary>Reads one fixture into <typeparamref name="T"/>.</summary>
    /// <param name="path">The repository path, such as <c>fixtures/materials/materials.jsonc</c>.</param>
    internal static T Load<T>(string path)
    {
        using Stream stream = Open(path);
        return JsonSerializer.Deserialize<T>(stream, Options)
            ?? throw new InvalidOperationException($"The fixture '{path}' holds no payload.");
    }

    /// <summary>Reads one captured journal line into the library type that reads it.</summary>
    /// <param name="path">The repository path of the capture.</param>
    internal static T LoadCapture<T>(string path)
    {
        using Stream stream = Open(path);
        return JsonSerializer.Deserialize<T>(stream, CaptureOptions)
            ?? throw new InvalidOperationException($"The capture '{path}' holds no payload.");
    }

    /// <summary>Reads one fixture as a document, for a payload with a loose shape.</summary>
    /// <param name="path">The repository path of the fixture.</param>
    internal static JsonDocument LoadDocument(string path)
    {
        using Stream stream = Open(path);
        return JsonDocument.Parse(stream, new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip });
    }

    /// <summary>Every fixture path the test assembly carries, in sorted order.</summary>
    internal static IReadOnlyList<string> Paths()
    {
        List<string> paths = [];
        foreach (string name in OwningAssembly.GetManifestResourceNames())
        {
            if (name.StartsWith("fixtures/", StringComparison.Ordinal)) paths.Add(name);
        }

        paths.Sort(StringComparer.Ordinal);
        return paths;
    }

    /// <summary>Opens one fixture as a stream.</summary>
    /// <param name="path">The repository path of the fixture.</param>
    internal static Stream Open(string path) =>
        OwningAssembly.GetManifestResourceStream(path)
        ?? throw new InvalidOperationException(string.Format(
            CultureInfo.InvariantCulture,
            "The fixture '{0}' is not embedded in the test assembly.",
            path));
}
