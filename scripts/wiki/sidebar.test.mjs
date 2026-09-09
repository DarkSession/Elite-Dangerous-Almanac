import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSidebars } from "./sidebar.mjs";

/** One surface shaped like the .NET reference: an index of areas, no member expansion. */
const surface = {
  key: "dotnet",
  title: ".NET",
  directory: "dotnet",
  home: { target: "DotNet", title: "Overview" },
  index: { target: "DotNet.API", title: "API reference" },
  guidesSection: "Guides",
  areasSection: "Namespaces",
  expandMembers: false,
  subpaths: false,
};

/** A wiki with every page still at its root, as the generators leave it. */
async function wiki(pages) {
  const wikiDir = await mkdtemp(join(tmpdir(), "sidebar-"));
  for (const [name, markdown] of Object.entries(pages)) {
    await writeFile(join(wikiDir, `${name}.md`), markdown);
  }
  return wikiDir;
}

const complete = {
  Home: "# Elite Dangerous Almanac\n",
  DotNet: "# EliteDangerousAlmanac\n",
  "DotNet.API": [
    "# EliteDangerousAlmanac v1.0.0",
    "",
    "## Guides",
    "",
    "- [Getting started](../wiki/DotNet.Document.Getting-started)",
    "",
    "## Namespaces",
    "",
    "- [Ships](../wiki/DotNet.Ships)",
    "",
  ].join("\n"),
  "DotNet.Document.Getting-started": "# Getting started\n",
  "DotNet.Ships": [
    "# Ships",
    "",
    "## Classes",
    "",
    "- [Hull](../wiki/DotNet.Ships.Class.Hull)",
    "",
  ].join("\n"),
  "DotNet.Ships.Class.Hull": "# Hull\n",
};

async function build(pages) {
  const wikiDir = await wiki(pages);
  await buildSidebars({ wikiDir, home: "Home", surfaces: [surface] });
  return wikiDir;
}

test("offers the surfaces from the root, and the tree from inside one", async () => {
  const wikiDir = await build(complete);

  const root = await readFile(join(wikiDir, "_Sidebar.md"), "utf8");
  assert.match(root, /\[\.NET\]\(\.\.\/wiki\/DotNet\)/);

  const inside = await readFile(join(wikiDir, "dotnet/_Sidebar.md"), "utf8");
  assert.match(inside, /\[Home\]\(\.\.\/wiki\/Home\)/);
  assert.match(inside, /\[API reference\]\(\.\.\/wiki\/DotNet\.API\)/);
  assert.match(
    inside,
    /\[Getting started\]\(\.\.\/wiki\/DotNet\.Document\.Getting-started\)/,
  );
  assert.match(inside, /\[Hull\]\(\.\.\/wiki\/DotNet\.Ships\.Class\.Hull\)/);
});

test("moves each page into the directory whose sidebar shows it", async () => {
  const wikiDir = await build(complete);
  const files = (await readdir(wikiDir, { recursive: true })).filter((entry) =>
    entry.endsWith(".md"),
  );

  assert.ok(
    files.includes("Home.md"),
    "the shared landing page stays at the root",
  );
  assert.ok(files.includes("dotnet/ships/classes/DotNet.Ships.Class.Hull.md"));
  assert.ok(files.includes("dotnet/guides/DotNet.Document.Getting-started.md"));
  // Gollum reads the nearest sidebar, so each directory carries one.
  assert.ok(files.includes("dotnet/ships/classes/_Sidebar.md"));
});

test("fails when a generated page is reachable from no sidebar", async () => {
  await assert.rejects(
    build({ ...complete, "DotNet.Ships.Class.Stranded": "# Stranded\n" }),
    /1 generated page\(s\) unreachable.*"DotNet\.Ships\.Class\.Stranded"/s,
  );
});

test("names the index section it did not recognise", async () => {
  const renamed = {
    ...complete,
    "DotNet.Ships": complete["DotNet.Ships"].replace(
      "## Classes",
      "## Class Types",
    ),
  };
  await assert.rejects(
    build(renamed),
    /unrecognised index section\(s\): Class Types/,
  );
});
