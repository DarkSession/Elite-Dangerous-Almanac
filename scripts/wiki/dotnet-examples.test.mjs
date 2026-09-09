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
    docsRoot,
    repositoryRoot: docsRoot,
    namespaces,
  });
  return found.map((one) => one.replace(/^Page\.md:/, ""));
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

test("every C# example in the documentation names a published symbol", async () => {
  const namespaces = await readDotnetApi({
    sourceRoot: join(repositoryRoot, "dotnet/src/EliteDangerousAlmanac"),
    repositoryRoot,
  });
  // The .NET guides, and the shared wiki landing page, which also carries one.
  for (const docsRoot of ["dotnet/docs", "docs"]) {
    assert.deepEqual(
      await findUnknownReferences({
        docsRoot: join(repositoryRoot, docsRoot),
        repositoryRoot,
        namespaces,
      }),
      [],
      docsRoot,
    );
  }
});
