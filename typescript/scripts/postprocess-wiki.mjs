import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wikiDir = fileURLToPath(new URL('../docs/wiki/', import.meta.url));

async function markdownFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
        else if (entry.name.endsWith('.md')) files.push(path);
    }
    return files;
}

const files = await markdownFiles(wikiDir);
const pageNames = new Set(files.map((file) => file.slice(file.lastIndexOf('/') + 1, -3)));

for (const file of files) {
    const source = await readFile(file, 'utf8');
    // The wiki theme currently renders same-page member links as `../wiki/#member`,
    // which navigates to the wiki Home page. GitHub Wiki expects a local `#member`.
    const fixed = source.replaceAll('](../wiki/#', '](#');
    if (fixed !== source) await writeFile(file, fixed);

    for (const match of fixed.matchAll(/\]\(\.\.\/wiki\/([^#)]+)(?:#[^)]+)?\)/g)) {
        const target = match[1];
        if (target && !pageNames.has(target)) {
            throw new Error(`${file}: generated link targets missing wiki page "${target}"`);
        }
    }
    if (fixed.includes('](../wiki/#')) {
        throw new Error(`${file}: generated a broken wiki-home member link`);
    }

    // The hand-written pages under `docs/` link between wiki pages with absolute URLs,
    // because a relative `../wiki/…` in a `projectDocuments` page makes TypeDoc warn
    // about a path it cannot copy. Those links are outside the check above, so a page
    // renamed by its front-matter title — a comma in a title is enough — would break
    // them silently. Hold them to the same standard.
    for (const match of fixed.matchAll(
        /\]\(https:\/\/github\.com\/DarkSession\/Elite-Dangerous-Almanac\/wiki\/([^#)]+)(?:#[^)]+)?\)/g,
    )) {
        const target = decodeURIComponent(match[1]);
        if (!pageNames.has(target)) {
            throw new Error(`${file}: absolute wiki link targets missing page "${target}"`);
        }
    }
}
