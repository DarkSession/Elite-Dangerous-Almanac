// Checks every wiki link in the assembled wiki, and repairs the one the TypeScript theme
// gets wrong. A page name is global on GitHub Wiki, so a link that names a page nothing
// wrote is a 404 the reader meets, not an error the generator reports — this is what turns
// it back into a build failure.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const wikiUrl = "https://github.com/Elite-Dangerous-Almanac/Almanac-Core/wiki/";

export async function checkLinks(wikiDir) {
  const files = (
    await readdir(wikiDir, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name));
  const pageNames = new Set(files.map((file) => basename(file, ".md")));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    // The TypeScript wiki theme renders a same-page member link as `../wiki/#member`,
    // which navigates to the wiki's landing page. GitHub Wiki expects a local `#member`.
    const fixed = source.replaceAll("](../wiki/#", "](#");
    if (fixed !== source) await writeFile(file, fixed);

    for (const match of fixed.matchAll(
      /\]\(\.\.\/wiki\/([^#)]+)(?:#[^)]+)?\)/g,
    )) {
      const target = decodeURIComponent(match[1]);
      if (target && !pageNames.has(target)) {
        throw new Error(`${file}: link targets missing wiki page "${target}"`);
      }
    }

    // The hand-written pages under `docs/` link between wiki pages with absolute URLs,
    // because a relative `../wiki/…` in a TypeDoc `projectDocuments` page makes it warn
    // about a path it cannot copy. Those links are outside the check above, so a page
    // renamed by its front-matter title — a comma in a title is enough — would break
    // them silently. Hold them to the same standard.
    // Any GitHub wiki host is matched, not this one alone: a link left pointing at a
    // repository the project has moved away from resolves through a redirect today and
    // stops resolving the day the old name is taken, so it is a failure here.
    for (const match of fixed.matchAll(
      /\]\((https:\/\/github\.com\/[^/)]+\/[^/)]+\/wiki\/)([^#)]+)(?:#[^)]+)?\)/g,
    )) {
      if (match[1] !== wikiUrl) {
        throw new Error(`${file}: absolute wiki link names another repository`);
      }

      const target = decodeURIComponent(match[2]);
      if (!pageNames.has(target)) {
        throw new Error(
          `${file}: absolute wiki link targets missing page "${target}"`,
        );
      }
    }
  }
}
