using System;
using System.Globalization;
using System.IO;
using System.Reflection;

namespace EliteDangerousAlmanac.Tests.Support;

/// <summary>Reads a text file the test assembly carries as an embedded resource.</summary>
/// <remarks>
/// A test that checks a document against the code it describes needs both of them at run
/// time. Embedding them keeps the check working wherever the test assembly runs, without a
/// path back up to the repository.
/// </remarks>
internal static class EmbeddedText
{
    private static readonly Assembly OwningAssembly = typeof(EmbeddedText).GetTypeInfo().Assembly;

    /// <summary>Reads one embedded text file whole.</summary>
    /// <param name="name">The resource name, such as <c>docs/package-readme.md</c>.</param>
    internal static string Read(string name)
    {
        using Stream stream = OwningAssembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException(string.Format(
                CultureInfo.InvariantCulture,
                "The file '{0}' is not embedded in the test assembly.",
                name));
        using StreamReader reader = new(stream);
        return reader.ReadToEnd();
    }
}
