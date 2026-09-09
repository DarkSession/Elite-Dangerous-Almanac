using System;
using System.Text;

namespace EliteDangerousAlmanac.Tests.Support;

/// <summary>
/// Removes the comments from a JSONC file, so what remains can be measured against the
/// strict-JSON rule the shared files keep.
/// </summary>
/// <remarks>
/// The library itself never needs this — <c>System.Text.Json</c> skips comments while it
/// reads. The tests need it to prove the stronger property: comments are the only JSONC
/// extension the shared files use, so any language's standard parser reads them.
/// </remarks>
internal static class Jsonc
{
    /// <summary>Replaces every comment with whitespace, keeping the byte offsets.</summary>
    /// <param name="text">The JSONC text.</param>
    /// <returns>The same text with its comments blanked.</returns>
    internal static string StripComments(string text)
    {
        StringBuilder output = new(text.Length);
        bool inString = false;
        bool escaped = false;

        for (int index = 0; index < text.Length; index++)
        {
            char current = text[index];

            if (inString)
            {
                output.Append(current);
                if (escaped) escaped = false;
                else if (current == '\\') escaped = true;
                else if (current == '"') inString = false;
                continue;
            }

            if (current == '"')
            {
                inString = true;
                output.Append(current);
                continue;
            }

            if (current == '/' && index + 1 < text.Length && text[index + 1] == '/')
            {
                while (index < text.Length && text[index] != '\n') index++;
                if (index < text.Length) output.Append('\n');
                continue;
            }

            if (current == '/' && index + 1 < text.Length && text[index + 1] == '*')
            {
                index += 2;
                while (index + 1 < text.Length && !(text[index] == '*' && text[index + 1] == '/'))
                {
                    if (text[index] == '\n') output.Append('\n');
                    index++;
                }

                index++;
                continue;
            }

            output.Append(current);
        }

        if (inString) throw new FormatException("The JSONC text ends inside a string.");
        return output.ToString();
    }
}
