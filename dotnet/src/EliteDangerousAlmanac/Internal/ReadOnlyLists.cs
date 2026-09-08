using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace EliteDangerousAlmanac.Internal;

/// <summary>Wraps a deserialized list so a caller cannot change a shared catalogue.</summary>
/// <remarks>
/// The JSON reader builds ordinary lists. A catalogue is a process-wide singleton, so
/// every list inside one is wrapped before it is published.
/// </remarks>
internal static class ReadOnlyLists
{
    /// <summary>Wraps a list, or answers an empty one for an absent list.</summary>
    internal static ReadOnlyCollection<T> Freeze<T>(IReadOnlyList<T>? values)
    {
        if (values is ReadOnlyCollection<T> frozen) return frozen;
        return new ReadOnlyCollection<T>(values is null ? [] : [.. values]);
    }
}
