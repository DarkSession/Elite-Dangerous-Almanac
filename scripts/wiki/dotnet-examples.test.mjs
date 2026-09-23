import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { findUnknownReferences } from "./dotnet-examples.mjs";
import { readDotnetApi } from "./dotnet-source.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** A stand-in for the parsed API, so a case states only the surface it needs. */
function surface(area, types) {
  return new Map([
    [
      area,
      {
        name: area,
        types: Object.entries(types).map(([name, members]) => ({
          name,
          members: members.map((member) => ({ name: member })),
          primaryParameters: [],
        })),
      },
    ],
  ]);
}

/** Runs the checker over one page of Markdown. */
async function findings(markdown, namespaces) {
  const docsRoot = await mkdtemp(join(tmpdir(), "dotnet-examples-"));
  await writeFile(join(docsRoot, "Page.md"), markdown);
  const found = await findUnknownReferences({
    docsRoots: [docsRoot],
    repositoryRoot: docsRoot,
    namespaces,
  });
  return found.map((one) => one.replace(/^Page\.md:/, ""));
}

/** Runs the checker over the documentation comments of one C# file. */
async function sourceFindings(source, namespaces) {
  const sourceRoot = await mkdtemp(join(tmpdir(), "dotnet-examples-"));
  await writeFile(join(sourceRoot, "Type.cs"), source);
  const found = await findUnknownReferences({
    sourceRoots: [sourceRoot],
    repositoryRoot: sourceRoot,
    namespaces,
  });
  return found.map((one) => one.replace(/^Type\.cs:/, ""));
}

const ships = surface("Ships", { ShipCatalogue: ["FindBySymbol"] });

test("accepts an example that names only what the library publishes", async () => {
  assert.deepEqual(
    await findings(
      '```csharp\nusing EliteDangerousAlmanac.Ships;\n\nvar hull = ShipCatalogue.FindBySymbol("anaconda");\n```\n',
      ships,
    ),
    [],
  );
});

test("reports a namespace the library does not publish", async () => {
  assert.deepEqual(
    await findings(
      "```csharp\nusing EliteDangerousAlmanac.Hulls;\n```\n",
      ships,
    ),
    ["2: no namespace EliteDangerousAlmanac.Hulls"],
  );
});

test("reports a member a published type does not carry", async () => {
  assert.deepEqual(
    await findings("```csharp\nShipCatalogue.FindByHull(x);\n```\n", ships),
    ["2: ShipCatalogue has no member FindByHull"],
  );
});

test("reports a finding at the page's own line, below prose and deeper in a fence", async () => {
  assert.deepEqual(
    await findings(
      "# Title\n\nProse.\n\n```csharp\nvar a = 1;\nShipCatalogue.FindByHull(x);\n```\n",
      ships,
    ),
    ["7: ShipCatalogue has no member FindByHull"],
  );
});

test("reports a fully qualified type the library does not publish", async () => {
  assert.deepEqual(
    await findings(
      "```csharp\nEliteDangerousAlmanac.Ships.Hull h;\n```\n",
      ships,
    ),
    ["2: no type Ships.Hull"],
  );
});

test("leaves a property that merely shares a type's name alone", async () => {
  assert.deepEqual(
    await findings(
      "```csharp\nvar n = build.ShipCatalogue.Invented;\n```\n",
      ships,
    ),
    [],
  );
});

test("leaves a call on a local alone, and a name from outside the library", async () => {
  assert.deepEqual(
    await findings(
      "```csharp\nvar hull = Get();\nConsole.WriteLine(hull.Name);\n```\n",
      ships,
    ),
    [],
  );
});

test("reads no reference out of a comment or a string literal", async () => {
  assert.deepEqual(
    await findings(
      '```csharp\n// ShipCatalogue.Invented\nvar text = "ShipCatalogue.AlsoInvented";\n```\n',
      ships,
    ),
    [],
  );
});

test("ignores a block written in another language", async () => {
  assert.deepEqual(
    await findings("```ts\nShipCatalogue.findByHull(x);\n```\n", ships),
    [],
  );
});

test("reports a member named in a documentation comment's <code> block, at its source line", async () => {
  assert.deepEqual(
    await sourceFindings(
      [
        "namespace EliteDangerousAlmanac.Ships;",
        "",
        "public static class ShipCatalogue",
        "{",
        "    /// <summary>Finds a hull.</summary>",
        "    /// <example>",
        "    /// <code>",
        '    /// var hull = ShipCatalogue.FindBySymbol("anaconda");',
        "    /// var other = ShipCatalogue.FindByHull(hull);",
        "    /// </code>",
        "    /// </example>",
        "    public static Hull? FindBySymbol(string symbol) => null;",
        "}",
      ].join("\n"),
      ships,
    ),
    ["9: ShipCatalogue has no member FindByHull"],
  );
});

test("reads a source file written with Windows line endings", async () => {
  assert.deepEqual(
    await sourceFindings(
      ["/// <code>", "/// ShipCatalogue.FindByHull(x);", "/// </code>"].join(
        "\r\n",
      ),
      ships,
    ),
    ["2: ShipCatalogue has no member FindByHull"],
  );
});

test("reads a <code> block that opens and closes on one line, and one carrying attributes", async () => {
  assert.deepEqual(
    await sourceFindings(
      [
        "/// <code>ShipCatalogue.FindByHull(x);</code>",
        '/// <code language="csharp">',
        "/// ShipCatalogue.FindByName(x);",
        "/// </code>",
      ].join("\n"),
      ships,
    ),
    [
      "1: ShipCatalogue has no member FindByHull",
      "3: ShipCatalogue has no member FindByName",
    ],
  );
});

test("reads a <code> block's XML entities as the characters the wiki shows", async () => {
  // Decoded, `&quot;` opens a string literal, which names nothing.
  assert.deepEqual(
    await sourceFindings(
      [
        "/// <code>",
        "/// var text = &quot;ShipCatalogue.Invented&quot;;",
        "/// </code>",
      ].join("\n"),
      ships,
    ),
    [],
  );
});

test("leaves a <code> block in another language alone", async () => {
  assert.deepEqual(
    await sourceFindings(
      [
        '/// <code language="json">',
        "/// ShipCatalogue.FindByHull",
        "/// </code>",
      ].join("\n"),
      ships,
    ),
    [],
  );
});

test("reads no example out of code, a plain comment or a <c> span", async () => {
  assert.deepEqual(
    await sourceFindings(
      [
        "// <code>ShipCatalogue.FindByHull(x);</code>",
        "/// <c>ShipCatalogue.FindByName</c>",
        "var hull = ShipCatalogue.FindByHull(x);",
      ].join("\n"),
      ships,
    ),
    [],
  );
});

test("every C# example in the documentation names a published symbol", async () => {
  const sourceRoot = join(repositoryRoot, "dotnet/src/EliteDangerousAlmanac");
  const namespaces = await readDotnetApi({ sourceRoot, repositoryRoot });
  assert.deepEqual(
    await findUnknownReferences({
      // The .NET guides and namespace pages, the shared wiki landing page, which also
      // carries one, and the package README beside the source, which NuGet shows.
      docsRoots: [
        join(repositoryRoot, "dotnet/docs"),
        join(repositoryRoot, "docs"),
        sourceRoot,
      ],
      // The examples in the documentation comments, which the reference pages carry.
      sourceRoots: [sourceRoot],
      repositoryRoot,
      namespaces,
    }),
    [],
  );
});
