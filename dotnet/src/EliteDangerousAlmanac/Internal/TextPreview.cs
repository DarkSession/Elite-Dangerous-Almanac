namespace EliteDangerousAlmanac.Internal;

/// <summary>
/// Shortens a caller-supplied value before a message reproduces it.
/// </summary>
/// <remarks>
/// Every exception and diagnostic that quotes a caller argument or a captured field
/// quotes it through here, so one enormous string in an import cannot turn a message into
/// a payload. The original value stays intact in the structured field beside the message.
/// </remarks>
internal static class TextPreview
{
    /// <summary>The most characters a message reproduces.</summary>
    private const int PreviewLimit = 60;

    /// <summary>Shortens a value, marking that it was shortened.</summary>
    /// <param name="value">The text to quote. An absent one reads as an empty preview.</param>
    /// <returns>
    /// The text itself when it is short enough, and otherwise its first characters followed
    /// by a horizontal ellipsis.
    /// </returns>
    internal static string Truncate(string? value)
    {
        string text = value ?? string.Empty;
        if (text.Length <= PreviewLimit) return text;

        // Never end on the leading half of a surrogate pair the cut split in two.
        int cut = char.IsHighSurrogate(text[PreviewLimit - 1]) ? PreviewLimit - 1 : PreviewLimit;
        return text.Substring(0, cut) + "…";
    }
}
