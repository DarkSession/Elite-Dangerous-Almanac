using System;
using System.Buffers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EliteDangerousAlmanac.Tests.Support;

/// <summary>One figure read off a display, with the precision it was read at.</summary>
/// <remarks>
/// A panel shows a rounded figure, so a reading of 39.76 says the true value lies within
/// half of the last place shown. Keeping the decimal places the fixture writes is what lets
/// a comparison hold the calculation to exactly that, and no tighter.
/// </remarks>
[JsonConverter(typeof(PanelReadingConverter))]
internal readonly struct PanelReading
{
    internal PanelReading(double value, int decimals)
    {
        Value = value;
        Decimals = decimals;
    }

    /// <summary>The figure as written.</summary>
    internal double Value { get; }

    /// <summary>How many decimal places it was written to.</summary>
    internal int Decimals { get; }

    /// <summary>Half of the last place shown, which is the interval the reading stands for.</summary>
    internal double Interval => 0.5 * Math.Pow(10, -Decimals);

    /// <summary>Whether one computed figure displays as this reading.</summary>
    /// <remarks>
    /// The interval is widened by one single-precision step. The game computes in single
    /// precision, so where a figure lands on the boundary of the last place shown, which
    /// side it falls is decided below the precision the game itself carries.
    /// </remarks>
    internal bool Matches(double actual) =>
        Math.Abs(actual - Value) <= Interval + (Math.Abs(Value) * SinglePrecision);

    /// <summary>The gap between one single-precision figure and the next, relative.</summary>
    private const double SinglePrecision = 1.1920929E-7;

    public override string ToString() => Value.ToString($"F{Decimals}", null);
}

/// <summary>Reads a number and keeps the decimal places its own text was written with.</summary>
internal sealed class PanelReadingConverter : JsonConverter<PanelReading>
{
    public override PanelReading Read(
        ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.Number)
        {
            throw new JsonException($"A panel reading must be a number, not {reader.TokenType}.");
        }

        string text = Encoding.UTF8.GetString(
            reader.HasValueSequence
                ? BuffersExtensions.ToArray(reader.ValueSequence)
                : reader.ValueSpan.ToArray());
        int point = text.IndexOf('.');
        return new PanelReading(reader.GetDouble(), point < 0 ? 0 : text.Length - point - 1);
    }

    public override void Write(
        Utf8JsonWriter writer, PanelReading value, JsonSerializerOptions options) =>
        writer.WriteNumberValue(value.Value);
}
