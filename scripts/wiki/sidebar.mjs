// Builds the wiki's navigation: one collapsible tree per library surface.
//
// The wiki carries two references — the TypeScript package and the .NET package — and a
// reader is working in one language at a time. So the navigation is split the way the
// wiki is: the root sidebar offers the choice, and inside a surface the sidebar is that
// surface's own tree with a link back to the other. Neither reader scrolls past the other
// language's symbols.
//
// Within a surface the tree nests: guides, then each area, then its member kinds, then a
// class's own accessors and methods. Pages are placed in directories carrying
// context-specific sidebars, because Gollum uses the nearest `_Sidebar.md`: only the path
// to the current page starts open, and each level can still be collapsed independently.
//
// It reads the pages the generators have already written rather than any reflection tree,
// so the titles, link targets and ordering are by construction the ones the index pages
// show. Run it after the generators and before `check-links.mjs`, whose link check then
// covers the sidebars too.

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** The one bullet shape an index section emits: `- [Title](../wiki/Target)`. */
const indexBullet = /^- \[([^\]]+)\]\(\.\.\/wiki\/([^)#]+)\)$/;

/**
 * Index sections that list symbols, as opposed to prose the author wrote. These are
 * TypeDoc's group titles (`kind_plural_*` in its `en` locale) and the .NET generator's
 * matching set — all of them, so that attaching a guide to an area or exporting a
 * namespace lands somewhere rather than tripping the reachability check at the end.
 */
const symbolSections = new Set([
  "Classes",
  "Delegates",
  "Documents",
  "Enumerations",
  "Functions",
  "Guides",
  "Interfaces",
  "Modules",
  "Namespaces",
  "Records",
  "References",
  "Structs",
  "Type Aliases",
  "Variables",
]);

/** Sections whose entries carry members worth expanding in place under the entry. */
const expandableSections = new Set(["Classes"]);

/**
 * An index section whose entries are pages with indexes of their own, rather than leaf
 * symbol pages. Bulleting one of these would leave everything inside it reachable from
 * nowhere, so each entry expands into a subtree instead.
 */
const nestedSections = new Set(["Modules", "Namespaces"]);

/** Page sections whose members are worth expanding in place. */
const memberSections = new Set([
  "Constructors",
  "Properties",
  "Accessors",
  "Methods",
]);

/** Pages that are navigation rather than content, so nothing has to link to them. */
const notLinkTargets = new Set(["_Sidebar"]);

/**
 * Builds every `_Sidebar.md` the wiki needs and moves each generated page into the
 * directory whose sidebar shows it.
 *
 * @param {object} options
 * @param {string} options.wikiDir The assembled wiki, with every page still at its root.
 * @param {string} options.home The page name of the wiki's shared landing page.
 * @param {object[]} options.surfaces One descriptor per library surface.
 */
export async function buildSidebars({ wikiDir, home, surfaces }) {
  const pages = new Map();
  const page = async (name) => {
    if (!pages.has(name))
      pages.set(name, readFile(join(wikiDir, `${name}.md`), "utf8"));
    return pages.get(name);
  };

  const written = new Map();
  const placements = new Map();
  const linked = new Set([home]);

  /** Index-shaped sections met under a title we do not know — the hint if we throw. */
  const unhandled = new Set();

  written.set("_Sidebar.md", rootSidebar(home, surfaces));
  for (const surface of surfaces) {
    const built = await buildSurface({ surface, surfaces, home, page });
    for (const title of built.unhandledSections) unhandled.add(title);
    for (const [path, markdown] of built.sidebars) written.set(path, markdown);
    for (const [target, directory] of built.placements) {
      if (placements.has(target)) {
        throw new Error(`_Sidebar: "${target}" is placed by two surfaces`);
      }
      placements.set(target, directory);
    }
    for (const target of built.linked) linked.add(target);
  }

  const orphans = (await readdir(wikiDir))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -".md".length))
    .filter((name) => !notLinkTargets.has(name) && !linked.has(name));
  // Every assumption made about a generator's output — the index section names, the
  // bullet shape, which sections hold symbols — is a "find it, or quietly render less"
  // lookup, and CI publishes whatever comes out. One page reachable from nowhere is the
  // symptom they all share, so check for that rather than for each cause: a renamed
  // index heading or a changed bullet format fails the build instead of shipping a stub.
  if (orphans.length > 0) {
    const hint =
      unhandled.size > 0
        ? `unrecognised index section(s): ${[...unhandled].sort().join(", ")}`
        : "has a generator's index shape changed?";
    throw new Error(
      `_Sidebar: ${orphans.length} generated page(s) unreachable from the sidebars, ` +
        `starting with "${orphans[0]}" — ${hint}`,
    );
  }

  for (const [target, directory] of placements) {
    await mkdir(join(wikiDir, directory), { recursive: true });
    await rename(
      join(wikiDir, `${target}.md`),
      join(wikiDir, directory, `${target}.md`),
    );
  }
  for (const [path, markdown] of written) {
    await mkdir(dirname(join(wikiDir, path)), { recursive: true });
    await writeFile(join(wikiDir, path), markdown);
  }
}

/** The sidebar beside the shared landing page: the choice of surface, and nothing else. */
function rootSidebar(home, surfaces) {
  const lines = ["## Elite Dangerous Almanac", "", `- [Home](../wiki/${home})`];
  for (const surface of surfaces) {
    lines.push(`- [${surface.title}](../wiki/${surface.home.target})`);
  }
  return `${lines.join("\n")}\n`;
}

/** The header every sidebar inside a surface opens with: where you are, and the way out. */
function surfaceHeader(surface, surfaces, home) {
  const others = surfaces
    .filter((candidate) => candidate.key !== surface.key)
    .map(
      (candidate) => `[${candidate.title}](../wiki/${candidate.home.target})`,
    );
  return [
    `## ${surface.title}`,
    "",
    `- [Home](../wiki/${home}) · ${others.join(" · ")}`,
    `- [${surface.home.title}](../wiki/${surface.home.target})`,
    `- [${surface.index.title}](../wiki/${surface.index.target})`,
  ];
}

async function buildSurface({ surface, surfaces, home, page }) {
  /** Navigation ancestry for each generated page that belongs below this surface. */
  const pageContexts = new Map();
  /** Index-shaped sections met under a title we do not know — the hint if we throw. */
  const unhandledSections = new Set();

  const rememberContext = (target, context) => {
    const previous = pageContexts.get(target);
    const key = (nodes) => nodes.map((node) => node.key).join("\0");
    if (previous && key(previous) !== key(context)) {
      throw new Error(
        `_Sidebar: "${target}" appears in more than one navigation context`,
      );
    }
    pageContexts.set(target, context);
  };

  /**
   * The index sections of a page that has them, dropping prose and noting any
   * index-shaped section under a title we do not know — that note is the hint the
   * reachability check prints, so every path that reads an index comes through here.
   */
  const indexSections = async (target) => {
    const found = [];
    for (const section of sections(await page(target), 2)) {
      const symbols = entries(section.lines);
      if (symbols.length === 0) continue;
      if (symbolSections.has(section.title))
        found.push({ title: section.title, symbols });
      else unhandledSections.add(section.title);
    }
    return found;
  };

  /** A type expands in place: its own page, then its properties, accessors and methods. */
  const memberBlock = async ({ title, target }, opened, context) => {
    const node = contextNode(target, title);
    rememberContext(target, [...context, node]);
    const pageHeadings = headings(await page(target));
    const body = [
      [
        `- [Overview](../wiki/${target})`,
        ...examplesLink(target, pageHeadings),
      ],
    ];

    // A member section that yields nothing means the members moved: the orphan check
    // cannot see it, because a type page stays linked by its own Overview bullet
    // however little of its inside was read.
    const close = (group) => {
      if (!group?.empty) return;
      throw new Error(
        `_Sidebar: "${target}" has a "${group.title}" section with no members under ` +
          "it — has the generated member heading shape changed?",
      );
    };

    let members = null;
    for (const heading of pageHeadings) {
      if (heading.level === 2) {
        close(members);
        members = memberSections.has(heading.title)
          ? {
              title: heading.title,
              empty: true,
              lines: [`**${heading.title}**`, ""],
            }
          : null;
      } else if (heading.level === 3 && members) {
        // Push the group on its first member, never before: a section that turns
        // out to hold nothing would otherwise leave a label with no list under it.
        if (members.empty) body.push(members.lines);
        members.empty = false;
        members.lines.push(
          `- [${heading.title}](../wiki/${target}#${heading.anchor})`,
        );
      }
    }
    close(members);

    return details(summaryText(title), stack(body), {
      open: opened.has(node.key),
    });
  };

  /**
   * A namespace, or a module nested under another module, is an area page in miniature —
   * its own index sections, and a page per symbol inside it — so it expands the same way.
   */
  const subtreeBlock = async ({ title, target }, seen, opened, context) => {
    const node = contextNode(target, title);
    const within = [...context, node];
    rememberContext(target, within);
    const overview = [
      `- [Overview](../wiki/${target})`,
      ...examplesLink(target, headings(await page(target))),
    ];
    return details(
      summaryText(title),
      stack([
        overview,
        indent(stack(await symbolGroups(target, seen, opened, within))),
      ]),
      { open: opened.has(node.key) },
    );
  };

  /** The collapsible member-kind groups of a page that carries index sections. */
  const symbolGroups = async (
    target,
    seen = new Set(),
    opened = new Set(),
    context = [],
  ) => {
    if (seen.has(target)) return [];
    const within = new Set(seen).add(target);
    const groups = [];

    for (const { title, symbols } of await indexSections(target)) {
      const node = contextNode(`${target}:${title}`, title);
      const groupContext = [...context, node];
      let inner;
      if (surface.expandMembers && expandableSections.has(title)) {
        inner = indent(
          stack(
            await Promise.all(
              symbols.map((symbol) =>
                memberBlock(symbol, opened, groupContext),
              ),
            ),
          ),
        );
      } else if (nestedSections.has(title)) {
        inner = indent(
          stack(
            await Promise.all(
              symbols.map((symbol) =>
                subtreeBlock(symbol, within, opened, groupContext),
              ),
            ),
          ),
        );
      } else {
        for (const symbol of symbols)
          rememberContext(symbol.target, groupContext);
        inner = bullets(symbols);
      }
      groups.push(
        details(`${title} (${symbols.length})`, inner, {
          open: opened.has(node.key),
        }),
      );
    }

    return groups;
  };

  /**
   * Subpath modules are the split catalogues — one bulk export each — so they read
   * better flattened to a bullet and its symbols than as a disclosure per module. One
   * that turns out to hold a subtree gets the full treatment instead of losing it.
   */
  const subpathBlock = async (parentTarget, submodules, opened, context) => {
    const node = contextNode(
      `${parentTarget}:Subpath modules`,
      "Subpath modules",
    );
    const groupContext = [...context, node];
    const blocks = [];
    let flat = null;

    for (const submodule of submodules) {
      const index = await indexSections(submodule.target);
      const nested = index.some(
        (section) =>
          expandableSections.has(section.title) ||
          nestedSections.has(section.title),
      );
      if (nested) {
        blocks.push(
          await subtreeBlock(submodule, new Set(), opened, groupContext),
        );
        flat = null;
        continue;
      }
      rememberContext(submodule.target, groupContext);
      // Consecutive flat entries share one list; a subtree between them starts a new one.
      if (!flat) blocks.push((flat = []));
      flat.push(`- [${submodule.title}](../wiki/${submodule.target})`);
      for (const { symbols } of index) {
        for (const symbol of symbols)
          rememberContext(symbol.target, groupContext);
        flat.push(...bullets(symbols).map((bullet) => `    ${bullet}`));
      }
    }

    return details(`Subpath modules (${submodules.length})`, stack(blocks), {
      open: opened.has(node.key),
    });
  };

  const areaBlock = async (area, submodules, opened) => {
    const node = contextNode(area.target, area.title);
    const context = [node];
    rememberContext(area.target, context);
    const overview = [
      `- [Overview](../wiki/${area.target})`,
      ...examplesLink(area.target, headings(await page(area.target))),
    ];
    const kinds = await symbolGroups(area.target, new Set(), opened, context);

    if (submodules.length > 0) {
      kinds.push(await subpathBlock(area.target, submodules, opened, context));
    }

    return details(
      `<b>${summaryText(area.title)}</b>`,
      stack([overview, indent(stack(kinds))]),
      {
        open: opened.has(node.key),
      },
    );
  };

  /**
   * Guides in the order the surface's home page introduces them — that order is a
   * reading order, and an index lists them alphabetically. A guide the home page does
   * not link sorts to the end rather than dropping out, so adding one still reaches the
   * sidebar untouched.
   */
  const guideOrder = async (documents) => {
    const text = await page(surface.home.target);
    const ranked = [...text.matchAll(/\/wiki\/([^)#\s]+)/g)].map((match) =>
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
  };

  // Through the shared reader like every other index, so that renaming a section on the
  // index page — the rename that costs every symbol page its place — is reported by name
  // rather than as an unexplained pile of unreachable pages.
  const index = await indexSections(surface.index.target);
  const section = (title) =>
    index.find((candidate) => candidate.title === title)?.symbols ?? [];
  const documents = section(surface.guidesSection);
  const areas = section(surface.areasSection);

  const renderSidebar = async (opened) => {
    const blocks = [surfaceHeader(surface, surfaces, home)];

    if (documents.length > 0) {
      const node = contextNode(`${surface.index.target}:Guides`, "Guides");
      for (const document of documents)
        rememberContext(document.target, [node]);
      blocks.push(
        details("<b>Guides</b>", bullets(await guideOrder(documents)), {
          open: opened.has(node.key),
        }),
      );
    }

    // `astro/nebulae-all` belongs under `astro`: it is the same feature area on a
    // subpath the barrel deliberately does not re-export, not a new top-level area.
    for (const area of areas.filter(
      (candidate) => !candidate.title.includes("/"),
    )) {
      const submodules = surface.subpaths
        ? areas.filter((candidate) =>
            candidate.title.startsWith(`${area.title}/`),
          )
        : [];
      blocks.push(await areaBlock(area, submodules, opened));
    }

    return `${stack(blocks).join("\n")}\n`;
  };

  const closed = await renderSidebar(new Set());
  assertOpenDisclosureCount(closed, 0, surface.directory);

  const contexts = new Map();
  const directoryContexts = new Map();
  for (const context of pageContexts.values()) {
    const signature = context.map((node) => node.key).join("\0");
    contexts.set(signature, context);

    const directory = [
      surface.directory,
      ...context.map((node) => directorySegment(node.title)),
    ].join("/");
    const previous = directoryContexts.get(directory);
    if (previous && previous !== signature) {
      throw new Error(
        `_Sidebar: more than one navigation context maps to "${directory}"`,
      );
    }
    directoryContexts.set(directory, signature);
  }

  // GitHub Wiki keeps page names global even when their files live in directories, while
  // Gollum chooses the nearest `_Sidebar.md`. Give every distinct disclosure ancestry its
  // own directory and sidebar without changing any public page target.
  const sidebars = new Map([[`${surface.directory}/_Sidebar.md`, closed]]);
  for (const [directory, signature] of directoryContexts) {
    const context = contexts.get(signature);
    const variant = await renderSidebar(
      new Set(context.map((node) => node.key)),
    );
    assertOpenDisclosureCount(variant, context.length, directory);
    sidebars.set(`${directory}/_Sidebar.md`, variant);
  }

  const placements = new Map([
    [surface.home.target, surface.directory],
    [surface.index.target, surface.directory],
  ]);
  for (const [target, context] of pageContexts) {
    placements.set(
      target,
      [
        surface.directory,
        ...context.map((node) => directorySegment(node.title)),
      ].join("/"),
    );
  }

  const linked = new Set([
    ...[...sidebars.values()]
      .flatMap((markdown) => [
        ...markdown.matchAll(/\]\(\.\.\/wiki\/([^)#]+)/g),
      ])
      .map((match) => match[1]),
  ]);

  return { sidebars, placements, linked, unhandledSections };
}

function contextNode(key, title) {
  return { key, title: unescape(title) };
}

/** Split a page into its headings of one level, in document order. */
function sections(markdown, level) {
  const marker = `${"#".repeat(level)} `;
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

/**
 * A page's lines with fenced code blocks removed. The generated pages are full of example
 * blocks, and a heading- or bullet-shaped line inside one is sample text, not structure —
 * a fence containing `### ghostMember` would otherwise put a member in the sidebar that
 * the page does not have.
 */
function proseLines(markdown) {
  const lines = [];
  let fence = null;
  for (const line of markdown.split("\n")) {
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
      line.slice(opener[0].length).trim() === ""
    ) {
      fence = null;
    }
  }
  return lines;
}

function entries(lines) {
  const found = [];
  for (const line of lines) {
    const match = indexBullet.exec(line.trim());
    if (match) found.push({ title: match[1], target: match[2] });
  }
  return found;
}

/** Undo the Markdown escapes a generator puts in link text and headings (`REAL\_NEBULAE`). */
function unescape(text) {
  return text.replace(/\\(.)/g, "$1");
}

/**
 * GitHub's heading slug: lower-cased, everything but word characters, spaces and hyphens
 * dropped, then spaces to hyphens. Word characters are Unicode — a heading with an accent
 * or a CJK character keeps it, so this cannot be narrowed to ASCII.
 */
function slug(heading) {
  return unescape(heading)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/**
 * Every heading on a page, in order, each with the anchor GitHub will give it. Repeated
 * slugs are what make this worth doing: GitHub numbers the second and later occurrences
 * `-1`, `-2`, …, so `### shipSymbol` the accessor and `##### shipSymbol` the parameter of
 * a constructor are different anchors, and a link that just asserts "some heading slugs to
 * this" would happily point at the wrong one.
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

/** The `## Examples` (or `## Example`) link a page offers, if it has one. */
function examplesLink(target, pageHeadings) {
  const heading = pageHeadings.find(
    (candidate) =>
      candidate.level === 2 &&
      (candidate.title === "Examples" || candidate.title === "Example"),
  );
  return heading
    ? [`- [${heading.title}](../wiki/${target}#${heading.anchor})`]
    : [];
}

function details(summary, body, { open = false } = {}) {
  return [
    `<details${open ? " open" : ""}>`,
    `<summary>${summary}</summary>`,
    "",
    ...body,
    "",
    "</details>",
  ];
}

/** Join blocks that are each already a run of lines, with a blank line between them. */
function stack(blocks) {
  return blocks
    .filter((block) => block.length > 0)
    .flatMap((block, index) => (index === 0 ? block : ["", ...block]));
}

function bullets(items) {
  return items.map((item) => `- [${item.title}](../wiki/${item.target})`);
}

/**
 * A `<summary>` sits inside an HTML block, so its content is never re-parsed as Markdown:
 * an escape that a bullet would swallow renders literally there, and a symbol named
 * `Foo<Bar>` would open a tag. Bullets keep their escapes and are deliberately left alone.
 */
function summaryText(title) {
  return unescape(title)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Step one level in, as a blockquote. GitHub's Markdown stylesheet gives `<details>` no
 * indentation at all, so a nested disclosure would sit flush against its parent and the
 * tree would read as one flat column. A blockquote is the one construct that indents
 * without a bullet, and being Markdown rather than raw HTML it cannot be sanitised away.
 * A blank line inside one has to carry the marker or it closes the quote early.
 */
function indent(lines) {
  return lines.map((line) => (line === "" ? ">" : `> ${line}`));
}

/** A readable, stable directory component for one disclosure in the tree. */
function directorySegment(title) {
  const segment = title
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1-$2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  if (!segment)
    throw new Error(`_Sidebar: cannot derive a directory from "${title}"`);
  return segment;
}

function assertOpenDisclosureCount(markdown, expected, location) {
  const actual = [...markdown.matchAll(/<details open>/g)].length;
  if (actual !== expected) {
    throw new Error(
      `_Sidebar: "${location}" opens ${actual} disclosure(s), expected ${expected}`,
    );
  }
}
