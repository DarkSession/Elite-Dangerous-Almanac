using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text.Json;
using EliteDangerousAlmanac.Internal;
using EliteDangerousAlmanac.Tests.Support;
using Xunit;

namespace EliteDangerousAlmanac.Tests;

/// <summary>
/// The portability rules every shared catalogue keeps, so each language implementation
/// reads the same files with its own standard parser.
/// </summary>
public class SharedDataFilesTests
{
    private static readonly string[] BannedPayloadKeys = ["attribution", "description", "comment"];

    public static TheoryData<string> Catalogues()
    {
        TheoryData<string> data = [];
        foreach (string path in DataPaths()) data.Add(path);
        return data;
    }

    [Fact]
    public void EveryDomainShipsInsideThePackage()
    {
        IReadOnlyList<string> paths = DataPaths();
        Assert.NotEmpty(paths);
        foreach (string domain in new[] { "astro", "commodities", "equipment", "i18n", "materials", "ships" })
        {
            Assert.Contains(paths, path => path.StartsWith($"data/{domain}/", StringComparison.Ordinal));
        }
    }

    [Theory]
    [MemberData(nameof(Catalogues))]
    public void CatalogueOpensWithACommentHeader(string path)
    {
        string text = ReadText(path);
        Assert.StartsWith("/*", text.TrimStart(), StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(Catalogues))]
    public void CatalogueIsStrictJsonOnceItsCommentsAreGone(string path)
    {
        string payload = Jsonc.StripComments(ReadText(path));
        JsonDocumentOptions strict = new()
        {
            CommentHandling = JsonCommentHandling.Disallow,
            AllowTrailingCommas = false,
        };

        using JsonDocument document = JsonDocument.Parse(payload, strict);
        Assert.NotEqual(JsonValueKind.Undefined, document.RootElement.ValueKind);
    }

    /// <summary>
    /// Prose belongs in the comment header, so the payload carries no top-level
    /// <c>attribution</c>, <c>description</c> or <c>comment</c> key. Deeper in the payload
    /// those words can be data — an experimental effect really does have a description.
    /// </summary>
    [Theory]
    [MemberData(nameof(Catalogues))]
    public void CatalogueCarriesNoProseAtTheTopOfItsPayload(string path)
    {
        using JsonDocument document = JsonDocument.Parse(
            Jsonc.StripComments(ReadText(path)),
            new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Disallow });
        if (document.RootElement.ValueKind != JsonValueKind.Object) return;

        foreach (JsonProperty property in document.RootElement.EnumerateObject())
        {
            Assert.DoesNotContain(property.Name, BannedPayloadKeys, StringComparer.OrdinalIgnoreCase);
        }
    }

    private static string ReadText(string path)
    {
        using Stream stream = SharedData.Open(path);
        using StreamReader reader = new(stream);
        return reader.ReadToEnd();
    }

    private static IReadOnlyList<string> DataPaths()
    {
        Assembly library = typeof(SharedData).GetTypeInfo().Assembly;
        List<string> paths = [];
        foreach (string name in library.GetManifestResourceNames())
        {
            if (name.StartsWith("data/", StringComparison.Ordinal)) paths.Add(name);
        }

        paths.Sort(StringComparer.Ordinal);
        return paths;
    }
}
