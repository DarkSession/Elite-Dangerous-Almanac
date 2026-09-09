import assert from "node:assert/strict";
import test from "node:test";

import { readSourceFile } from "./dotnet-source.mjs";
import { readDocComment, renderDoc } from "./xml-doc.mjs";

/** Reads one C# fragment the way the generator reads a file. */
function read(source) {
  return readSourceFile(source, "dotnet/src/EliteDangerousAlmanac/Test.cs");
}

const header = "namespace EliteDangerousAlmanac.Ships;\n\n";

function only(source) {
  const types = read(header + source);
  assert.equal(types.length, 1);
  return types[0];
}

function member(type, name) {
  const found = type.members.find((candidate) => candidate.name === name);
  assert.ok(found, `no member named ${name}`);
  return found;
}

test("reads a class, its properties and its methods", () => {
  const type = only(`
/// <summary>A hull.</summary>
public sealed class Hull
{
    private readonly int hidden;

    /// <summary>The symbol.</summary>
    public string Symbol { get; }

    /// <summary>The name.</summary>
    public string Name => Format(Symbol);

    /// <summary>Reads a hull.</summary>
    public static Hull? FromSymbol(string? symbol, bool exact = false) =>
        symbol is null ? null : new Hull(symbol);

    private static string Format(string symbol) => symbol;
}
`);

  assert.equal(type.kind, "class");
  assert.equal(type.namespace, "EliteDangerousAlmanac.Ships");
  assert.deepEqual(type.modifiers, ["public", "sealed"]);
  assert.deepEqual(
    type.members.map((one) => one.name),
    ["Symbol", "Name", "FromSymbol"],
  );

  assert.equal(member(type, "Name").kind, "property");
  const method = member(type, "FromSymbol");
  assert.equal(method.kind, "method");
  assert.equal(method.returnType, "Hull?");
  assert.deepEqual(
    method.parameters.map((one) => [one.type, one.name, one.default]),
    [
      ["string?", "symbol", null],
      ["bool", "exact", "false"],
    ],
  );
});

test("reads a record's primary constructor and the properties beside it", () => {
  const type = only(`
/// <summary>An issue.</summary>
/// <param name="Field">The input.</param>
public sealed record Issue(
    CalculationField Field,
    string Message)
{
    /// <summary>The mount.</summary>
    public string? Slot { get; init; }
}
`);

  assert.equal(type.kind, "record");
  assert.deepEqual(
    type.primaryParameters.map((one) => one.name),
    ["Field", "Message"],
  );
  assert.equal(member(type, "Slot").kind, "property");
});

test("reads a record with no body", () => {
  const type = only(
    "/// <summary>A point.</summary>\npublic sealed record Point(double X, double Y);\n",
  );
  assert.deepEqual(
    type.primaryParameters.map((one) => one.type),
    ["double", "double"],
  );
  assert.deepEqual(type.members, []);
});

test("reads an enumeration in declaration order, with its values", () => {
  const type = only(`
/// <summary>A grade.</summary>
public enum Grade
{
    /// <summary>One.</summary>
    Low = 1,

    /// <summary>Two.</summary>
    High = 2,
}
`);
  assert.equal(type.kind, "enum");
  assert.deepEqual(
    type.members.map((one) => [one.name, one.value]),
    [
      ["Low", "1"],
      ["High", "2"],
    ],
  );
});

test("reads an interface's members without a visibility modifier", () => {
  const type = only(`
/// <summary>A curve.</summary>
public interface ICurve
{
    /// <summary>The mass.</summary>
    double OptMass { get; }
}
`);
  assert.deepEqual(
    type.members.map((one) => one.name),
    ["OptMass"],
  );
});

test("keeps a constant's value and drops every other initializer", () => {
  const type = only(`
/// <summary>The grid.</summary>
public static class Grid
{
    /// <summary>The edge.</summary>
    public const int SectorEdgeLy = 1280;

    /// <summary>The origin.</summary>
    public static readonly Point Origin = new(-49985, -40985);

    private static readonly Lazy<IReadOnlyList<int>> Runs =
        new(() => Load<int>("data/astro/runs.jsonc"));

    private static readonly HashSet<string> Prefixes = new(StringComparer.Ordinal)
    {
        "eo", "oo",
    };
}
`);
  assert.equal(member(type, "SectorEdgeLy").value, "1280");
  assert.equal(member(type, "Origin").value, null);
  assert.deepEqual(
    type.members.map((one) => one.name),
    ["SectorEdgeLy", "Origin"],
  );
});

test("reads a generic type and a generic method", () => {
  const type = only(`
/// <summary>A result.</summary>
/// <typeparam name="T">The value.</typeparam>
public sealed class Result<T>
    where T : class
{
    /// <summary>Wraps a value.</summary>
    public static Result<T> Of<TValue>(TValue value) => new();
}
`);
  assert.deepEqual(type.typeParameters, ["T"]);
  assert.deepEqual(member(type, "Of").typeParameters, ["TValue"]);
});

test("reads a tuple return type as a return type, not a parameter list", () => {
  const type = only(`
/// <summary>Counts.</summary>
public static class Counter
{
    /// <summary>Counts.</summary>
    public static (int Total, int Kept) Count(string[] items) => (0, 0);
}
`);
  const method = member(type, "Count");
  assert.equal(method.kind, "method");
  assert.equal(method.returnType, "(int Total, int Kept)");
  assert.deepEqual(
    method.parameters.map((one) => one.name),
    ["items"],
  );
});

test("skips a private nested type and everything inside it", () => {
  const type = only(`
/// <summary>Nebulae.</summary>
public static class Nebulae
{
    /// <summary>The count.</summary>
    public static int Count => 0;

    private readonly struct Ranked(int index)
    {
        public int Index { get; } = index;
    }
}
`);
  assert.deepEqual(
    type.members.map((one) => one.name),
    ["Count"],
  );
});

test("ignores braces and doc-comment markers inside literals", () => {
  const type = only(`
/// <summary>Slots.</summary>
public static class Slots
{
    /// <summary>A pattern.</summary>
    public static string Pattern => @"^Slot(\\d+)_Size(\\d+)$";

    /// <summary>A brace.</summary>
    public static string Brace => "} /// <summary>not a comment</summary>";
}
`);
  assert.deepEqual(
    type.members.map((one) => one.name),
    ["Pattern", "Brace"],
  );
});

test("refuses a public nested type rather than dropping it", () => {
  assert.throws(
    () =>
      only(`
/// <summary>Nebulae.</summary>
public static class Nebulae
{
    /// <summary>A rank.</summary>
    public readonly struct Ranked
    {
        /// <summary>The index.</summary>
        public int Index { get; }
    }
}
`),
    /a public nested type is not published — "Ranked"/,
  );
});

test("reads past a block comment, apostrophe and all", () => {
  const type = only(`
/// <summary>Slots.</summary>
public static class Slots
{
    /* A mount's key: it is the game's, and not ours to compose. }
       public static int Hidden => 0; */

    /// <summary>The count.</summary>
    public static int Count => 0;
}
`);
  assert.deepEqual(
    type.members.map((one) => one.name),
    ["Count"],
  );
});

test("refuses a block comment nothing closes", () => {
  assert.throws(
    () => read(`${header}public sealed class Hull\n{\n    /* open\n}\n`),
    /an unterminated block comment/,
  );
});

test("attaches the doc comment written above the declaration", () => {
  const type = only(`
/// <summary>A hull.</summary>
/// <remarks>Immutable.</remarks>
public sealed class Hull
{
    /// <summary>The symbol.</summary>
    [JsonPropertyName("symbol")]
    public string Symbol { get; }
}
`);
  const doc = readDocComment(type.docs[0], "Hull");
  assert.deepEqual(
    renderDoc(doc.summary, (cref) => cref),
    ["A hull."],
  );
  assert.equal(member(type, "Symbol").doc, "<summary>The symbol.</summary>");
});

test("refuses a declaration it cannot read", () => {
  assert.throws(
    () => read(`${header}public sealed class Hull\n{\n    +++;\n}\n`),
    /cannot read the member/,
  );
});
