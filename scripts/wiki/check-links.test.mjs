import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkLinks } from "./check-links.mjs";

const wikiUrl = "https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki";

async function wiki(pages) {
  const wikiDir = await mkdtemp(join(tmpdir(), "check-links-"));
  for (const [name, markdown] of Object.entries(pages)) {
    await writeFile(join(wikiDir, `${name}.md`), markdown);
  }
  return wikiDir;
}

test("accepts a relative and an absolute link to a page that exists", async () => {
  const wikiDir = await wiki({
    Home: `[a](../wiki/Ships) and [b](${wikiUrl}/Ships#hull)\n`,
    Ships: "# Ships\n",
  });
  await checkLinks(wikiDir);
});

test("refuses a relative link to a page nothing wrote", async () => {
  const wikiDir = await wiki({ Home: "[gone](../wiki/Ships)\n" });
  await assert.rejects(
    checkLinks(wikiDir),
    /link targets missing wiki page "Ships"/,
  );
});

test("refuses an absolute link to a page nothing wrote", async () => {
  const wikiDir = await wiki({ Home: `[gone](${wikiUrl}/Ships)\n` });
  await assert.rejects(
    checkLinks(wikiDir),
    /absolute wiki link targets missing page "Ships"/,
  );
});

test("repairs the same-page member link the TypeScript theme writes", async () => {
  const wikiDir = await wiki({ Home: "[of](../wiki/#of)\n" });
  await checkLinks(wikiDir);
  assert.equal(await readFile(join(wikiDir, "Home.md"), "utf8"), "[of](#of)\n");
});

test("names a page by its file, whatever directory the sidebars moved it into", async () => {
  const wikiDir = await mkdtemp(join(tmpdir(), "check-links-"));
  await mkdir(join(wikiDir, "dotnet/ships"), { recursive: true });
  await writeFile(join(wikiDir, "Home.md"), "[a](../wiki/DotNet.Ships)\n");
  await writeFile(join(wikiDir, "dotnet/ships/DotNet.Ships.md"), "# Ships\n");
  await checkLinks(wikiDir);
});
