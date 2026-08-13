// Rebuilds `docs/wiki/_Sidebar.md` as a collapsible tree.
//
// The wiki theme's own sidebar is one flat list of the guides and the four feature
// areas, which leaves 300-odd symbol pages reachable only by walking a module index.
// This rewrites it as nested `<details>` blocks — feature area, then member kind,
// then a class's own accessors and methods — so every page in the wiki is visible in
// its navigation context and each level can still be collapsed independently.
//
// It reads the pages TypeDoc has already written rather than the reflection tree, so
// the titles, link targets and ordering are by construction the ones the module index
// pages show. Run it after `typedoc` and before `postprocess-wiki.mjs`, whose link
// check then covers the sidebar too.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wikiDir = fileURLToPath(new URL('../docs/wiki/', import.meta.url));

/** The one bullet shape TypeDoc's index sections emit: `- [Title](../wiki/Target)`. */
const indexBullet = /^- \[([^\]]+)\]\(\.\.\/wiki\/([^)#]+)\)$/;

/**
 * Module-page sections that list symbols, as opposed to prose the module author wrote.
 * These are TypeDoc's group titles (`kind_plural_*` in its `en` locale) — all of them,
 * so that attaching a guide to a feature area or exporting a namespace lands somewhere
 * rather than tripping the reachability check at the end.
 */
const symbolSections = new Set([
    'Classes',
    'Documents',
    'Enumerations',
    'Functions',
    'Interfaces',
    'Modules',
    'Namespaces',
    'References',
    'Type Aliases',
    'Variables',
]);

/** Index-shaped sections met under a title not in the set above — a hint if we throw. */
const unhandledSections = new Set();

/** Class-page sections whose members are worth expanding in place. */
const memberSections = new Set(['Constructors', 'Properties', 'Accessors', 'Methods']);

/** Pages that are navigation rather than content, so nothing has to link to them. */
const notLinkTargets = new Set(['_Sidebar']);

const pages = new Map();

async function page(name) {
    if (!pages.has(name)) pages.set(name, readFile(join(wikiDir, `${name}.md`), 'utf8'));
    return pages.get(name);
}

/**
 * A page's lines with fenced code blocks removed. The generated pages are full of
 * `@example` blocks, and a heading- or bullet-shaped line inside one is sample text,
 * not structure — a fence containing `### ghostMember` would otherwise put a member
 * in the sidebar that the page does not have.
 */
function proseLines(markdown) {
    const lines = [];
    let fence = null;
    for (const line of markdown.split('\n')) {
        const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
        if (fence === null) {
            if (opener) fence = opener[1];
            else lines.push(line);
        } else if (
            opener &&
            opener[1][0] === fence[0] &&
            opener[1].length >= fence.length &&
            // A closing fence carries no info string, so ` ```ts ` opens a block but
            // never closes one.
            line.slice(opener[0].length).trim() === ''
        ) {
            fence = null;
        }
    }
    return lines;
}

/** Split a page into its headings of one level, in document order. */
function sections(markdown, level) {
    const marker = `${'#'.repeat(level)} `;
    const found = [];
    let current = null;
    for (const line of proseLines(markdown)) {
        if (line.startsWith(marker)) {
            current = { title: line.slice(marker.length).trim(), lines: [] };
            found.push(current);
        } else current?.lines.push(line);
    }
    return found;
}

function entries(lines) {
    const found = [];
    for (const line of lines) {
        const match = indexBullet.exec(line.trim());
        if (match) found.push({ title: match[1], target: match[2] });
    }
    return found;
}

/** Undo the Markdown escapes TypeDoc puts in link text and headings (`REAL\_NEBULAE`). */
function unescape(text) {
    return text.replace(/\\(.)/g, '$1');
}

/**
 * GitHub's heading slug: lower-cased, everything but word characters, spaces and
 * hyphens dropped, then spaces to hyphens. Word characters are Unicode — a heading
 * with an accent or a CJK character keeps it, so this cannot be narrowed to ASCII.
 */
function slug(heading) {
    return unescape(heading)
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
        .replace(/ /g, '-');
}

/**
 * Every heading on a page, in order, each with the anchor GitHub will give it.
 * Repeated slugs are what make this worth doing: GitHub numbers the second and later
 * occurrences `-1`, `-2`, …, so `### shipSymbol` the accessor and `##### shipSymbol`
 * the parameter of a constructor are different anchors, and a link that just asserts
 * "some heading slugs to this" would happily point at the wrong one.
 */
function headings(markdown) {
    const used = new Map();
    const found = [];
    for (const line of proseLines(markdown)) {
        const match = /^(#{1,6}) +(.+)$/.exec(line);
        if (!match) continue;
        const base = slug(match[2].trim());
        const seen = used.get(base) ?? 0;
        used.set(base, seen + 1);
        found.push({
            level: match[1].length,
            title: match[2].trim(),
            anchor: seen === 0 ? base : `${base}-${seen}`,
        });
    }
    return found;
}

function details(summary, body, { open = false } = {}) {
    return [
        `<details${open ? ' open' : ''}>`,
        `<summary>${summary}</summary>`,
        '',
        ...body,
        '',
        '</details>',
    ];
}

/** Join blocks that are each already a run of lines, with a blank line between them. */
function stack(blocks) {
    return blocks
        .filter((block) => block.length > 0)
        .flatMap((block, index) => (index === 0 ? block : ['', ...block]));
}

function bullets(items) {
    return items.map((item) => `- [${item.title}](../wiki/${item.target})`);
}

/**
 * A `<summary>` sits inside an HTML block, so its content is never re-parsed as
 * Markdown: an escape that a bullet would swallow renders literally there, and a
 * symbol named `Foo<Bar>` would open a tag. Bullets keep their escapes and are
 * deliberately left alone.
 */
function summaryText(title) {
    return unescape(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Step one level in, as a blockquote. GitHub's Markdown stylesheet gives `<details>`
 * no indentation at all, so a nested disclosure would sit flush against its parent and
 * the tree would read as one flat column. A blockquote is the one construct that indents
 * without a bullet, and being Markdown rather than raw HTML it cannot be sanitised away.
 * A blank line inside one has to carry the marker or it closes the quote early.
 */
function indent(lines) {
    return lines.map((line) => (line === '' ? '>' : `> ${line}`));
}

/** The `## Examples` (or `## Example`) link a page offers, if it has one. */
function examplesLink(target, pageHeadings) {
    const heading = pageHeadings.find(
        (candidate) =>
            candidate.level === 2 &&
            (candidate.title === 'Examples' || candidate.title === 'Example'),
    );
    return heading ? [`- [${heading.title}](../wiki/${target}#${heading.anchor})`] : [];
}

/** A class expands in place: its own page, then its properties, accessors and methods. */
async function classBlock({ title, target }) {
    const pageHeadings = headings(await page(target));
    const body = [[`- [Overview](../wiki/${target})`, ...examplesLink(target, pageHeadings)]];

    // A member section that yields nothing means the members moved: the orphan check at
    // the end cannot see it, because a class page stays linked by its own Overview bullet
    // however little of its inside was read.
    const close = (group) => {
        if (!group?.empty) return;
        throw new Error(
            `_Sidebar: "${target}" has a "${group.title}" section with no members under ` +
                `it — have TypeDoc's member headings changed shape?`,
        );
    };

    let members = null;
    for (const heading of pageHeadings) {
        if (heading.level === 2) {
            close(members);
            members = memberSections.has(heading.title)
                ? { title: heading.title, empty: true, lines: [`**${heading.title}**`, ''] }
                : null;
        } else if (heading.level === 3 && members) {
            // Push the group on its first member, never before: a section that turns out
            // to hold nothing would otherwise leave a bold label with no list under it.
            if (members.empty) body.push(members.lines);
            members.empty = false;
            members.lines.push(`- [${heading.title}](../wiki/${target}#${heading.anchor})`);
        }
    }
    close(members);

    return details(summaryText(title), stack(body), { open: true });
}

/**
 * An index section whose entries are pages with indexes of their own, rather than leaf
 * symbol pages. Bulleting one of these would leave everything inside it reachable from
 * nowhere, so each entry expands into a subtree instead.
 */
const nestedSections = new Set(['Modules', 'Namespaces']);

/**
 * A namespace, or a module nested under another module, is a module page in miniature —
 * its own index sections, and a page per symbol inside it — so it expands the same way.
 */
async function subtreeBlock({ title, target }, seen) {
    const overview = [
        `- [Overview](../wiki/${target})`,
        ...examplesLink(target, headings(await page(target))),
    ];
    return details(
        summaryText(title),
        stack([overview, indent(stack(await symbolGroups(target, seen)))]),
        { open: true },
    );
}

/**
 * The index sections of a page that has them, dropping prose and noting any index-shaped
 * section under a title we do not know — that note is the hint the reachability check
 * prints, so every path that reads an index has to come through here to collect it.
 */
async function indexSections(target) {
    const found = [];
    for (const section of sections(await page(target), 2)) {
        const symbols = entries(section.lines);
        if (symbols.length === 0) continue;
        if (symbolSections.has(section.title)) found.push({ title: section.title, symbols });
        else unhandledSections.add(section.title);
    }
    return found;
}

/** The collapsible member-kind groups of a page that carries index sections. */
async function symbolGroups(target, seen = new Set()) {
    if (seen.has(target)) return [];
    const within = new Set(seen).add(target);
    const groups = [];

    for (const { title, symbols } of await indexSections(target)) {
        let inner;
        if (title === 'Classes') {
            inner = indent(stack(await Promise.all(symbols.map((symbol) => classBlock(symbol)))));
        } else if (nestedSections.has(title)) {
            inner = indent(
                stack(await Promise.all(symbols.map((symbol) => subtreeBlock(symbol, within)))),
            );
        } else inner = bullets(symbols);
        groups.push(details(`${title} (${symbols.length})`, inner, { open: true }));
    }

    return groups;
}

/**
 * Subpath modules are the split catalogues — one bulk export each — so they read better
 * flattened to a bullet and its symbols than as a disclosure per module. One that turns
 * out to hold a subtree gets the full treatment instead of losing it.
 */
async function subpathBlock(submodules) {
    const blocks = [];
    let flat = null;

    for (const submodule of submodules) {
        const index = await indexSections(submodule.target);
        const nested = index.some(
            (section) => section.title === 'Classes' || nestedSections.has(section.title),
        );
        if (nested) {
            blocks.push(await subtreeBlock(submodule, new Set()));
            flat = null;
            continue;
        }
        // Consecutive flat entries share one list; a subtree between them starts a new one.
        if (!flat) blocks.push((flat = []));
        flat.push(`- [${submodule.title}](../wiki/${submodule.target})`);
        for (const { symbols } of index) {
            flat.push(...bullets(symbols).map((bullet) => `    ${bullet}`));
        }
    }

    return details(`Subpath modules (${submodules.length})`, stack(blocks), { open: true });
}

async function moduleBlock(module, submodules) {
    const overview = [
        `- [Overview](../wiki/${module.target})`,
        ...examplesLink(module.target, headings(await page(module.target))),
    ];
    const kinds = await symbolGroups(module.target);

    if (submodules.length > 0) kinds.push(await subpathBlock(submodules));

    // `_Sidebar.md` is shared by every GitHub Wiki page, so it cannot mark only the
    // current page's feature area as open. Keep each disclosure open instead: after
    // following an Overview or symbol link the reader retains the complete navigation
    // context, while every level can still be collapsed manually.
    return details(`<b>${summaryText(module.title)}</b>`, stack([overview, indent(stack(kinds))]), {
        open: true,
    });
}

/**
 * Guides in the order Home introduces them — that order is a reading order, and
 * TypeDoc's index lists them alphabetically. A guide Home does not link sorts to the
 * end rather than dropping out, so adding one still reaches the sidebar untouched.
 */
async function guideOrder(documents) {
    const home = await page('Home');
    const ranked = [...home.matchAll(/\/wiki\/(Document\.[^)#\s]+)/g)].map((match) =>
        decodeURIComponent(match[1]),
    );
    const rank = (document) => {
        const index = ranked.indexOf(document.target);
        return index === -1 ? ranked.length : index;
    };
    return documents
        .map((document, index) => ({ document, index }))
        .sort((a, b) => rank(a.document) - rank(b.document) || a.index - b.index)
        .map(({ document }) => document);
}

// Through the shared reader like every other index, so that renaming a section on the
// project page — the rename that costs every symbol page its place — is reported by name
// rather than as an unexplained pile of unreachable pages.
const index = await indexSections('modules');
const section = (title) => index.find((candidate) => candidate.title === title)?.symbols ?? [];
const documents = section('Documents');
const modules = section('Modules');

const blocks = [['## API', '', '- [Home](../wiki/Home)', '- [API reference](../wiki/modules)']];

if (documents.length > 0) {
    blocks.push(details('<b>Guides</b>', bullets(await guideOrder(documents)), { open: true }));
}

// `astro/nebulae-all` belongs under `astro`: it is the same feature area on a subpath
// the barrel deliberately does not re-export, not a fifth thing to scan past.
for (const module of modules.filter((module) => !module.title.includes('/'))) {
    const submodules = modules.filter((candidate) =>
        candidate.title.startsWith(`${module.title}/`),
    );
    blocks.push(await moduleBlock(module, submodules));
}

const sidebar = `${stack(blocks).join('\n')}\n`;

// Every assumption this script makes about TypeDoc's output — the index section names,
// the bullet shape, which sections hold symbols — is a "find it, or quietly render less"
// lookup, and CI publishes whatever comes out. One page reachable from nowhere is the
// symptom they all share, so check for that rather than for each cause: a renamed index
// heading or a changed bullet format fails the build instead of shipping a stub sidebar.
const linked = new Set([...sidebar.matchAll(/\]\(\.\.\/wiki\/([^)#]+)/g)].map((match) => match[1]));
const orphans = (await readdir(wikiDir))
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.slice(0, -'.md'.length))
    .filter((name) => !notLinkTargets.has(name) && !linked.has(name));
if (orphans.length > 0) {
    const hint =
        unhandledSections.size > 0
            ? `unrecognised index section(s): ${[...unhandledSections].sort().join(', ')}`
            : "has TypeDoc's index shape changed?";
    throw new Error(
        `_Sidebar: ${orphans.length} generated page(s) unreachable from the sidebar, ` +
            `starting with "${orphans[0]}" — ${hint}`,
    );
}

await writeFile(join(wikiDir, '_Sidebar.md'), sidebar);
