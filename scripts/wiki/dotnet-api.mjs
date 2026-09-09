// Writes the .NET reference pages of the wiki from the C# source.
//
// The pages are shaped the way TypeDoc's Markdown output is — an index of areas, a page
// per area listing its symbols, a page per symbol — so that `sidebar.mjs` reads both
// references through the same index sections and builds one kind of navigation tree for
// both languages.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readDotnetApi, splitTopLevel } from "./dotnet-source.mjs";
import { readDocComment, renderDoc, renderInline } from "./xml-doc.mjs";

/** The wiki page every .NET page name starts with, so no page collides with a TypeScript one. */
const prefix = "DotNet";

/** The index section a type of each C# kind is listed under. */
const kindSections = new Map([
  ["class", "Classes"],
  ["record", "Records"],
  ["struct", "Structs"],
  ["interface", "Interfaces"],
  ["enum", "Enumerations"],
]);

/** The singular kind a page's title states, and the segment its page name carries. */
const kindNames = new Map([
  ["class", "Class"],
  ["record", "Record"],
  ["struct", "Struct"],
  ["interface", "Interface"],
  ["enum", "Enumeration"],
]);

/** The order a type page lists its member sections in. */
const memberSectionOrder = [
  ["constructor", "Constructors"],
  ["field", "Fields"],
  ["property", "Properties"],
  ["method", "Methods"],
  ["enum-member", "Enumeration Members"],
];

/**
 * A cross-reference held open until every page's anchors are known. The mark is a
 * character no doc comment can carry, so filling the marks in afterwards cannot disturb
 * prose that merely looks like one.
 */
const referenceMark = "\u0000";

function markReference(cref, scope) {
  return `${referenceMark}${cref}${referenceMark}${scope}${referenceMark}`;
}

function pageName(type) {
  const suffix =
    type.typeParameters.length > 0 ? `-${type.typeParameters.length}` : "";
  return `${prefix}.${areaOf(type)}.${kindNames.get(type.kind)}.${type.name}${suffix}`;
}

function areaOf(type) {
  return type.namespace.slice("EliteDangerousAlmanac.".length);
}

/**
 * A type's name as C# writes it. The angle brackets are escaped, because a heading or a
 * link's text is Markdown: an unescaped `<T>` reads as an HTML tag and disappears.
 */
function displayName(type) {
  return type.typeParameters.length > 0
    ? `${type.name}\\<${type.typeParameters.join(", ")}\\>`
    : type.name;
}

/**
 * GitHub's heading slug, and the numbering it gives a repeated one. The anchors a page
 * offers are worked out from its finished headings for the same reason the sidebar does
 * it: a member and a parameter can slug alike, and only their order tells them apart.
 */
function anchorsOf(markdown) {
  const used = new Map();
  const found = [];
  let fence = null;
  for (const line of markdown.split("\n")) {
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === null && opener) {
      fence = opener[1];
      continue;
    }
    if (fence !== null) {
      if (
        opener &&
        opener[1][0] === fence[0] &&
        line.slice(opener[0].length).trim() === ""
      ) {
        fence = null;
      }
      continue;
    }
    const heading = /^(#{1,6}) +(.+)$/.exec(line);
    if (!heading) continue;
    const base = heading[2]
      .trim()
      .replace(/\\(.)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
      .replace(/ /g, "-");
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    found.push({
      level: heading[1].length,
      title: heading[2].trim(),
      anchor: seen === 0 ? base : `${base}-${seen}`,
    });
  }
  return found;
}

/** Escape the Markdown that would otherwise read as emphasis inside a link's text. */
function escapeLinkText(text) {
  return text.replace(/[_*]/g, "\\$&");
}

/**
 * Renders a C# type expression, linking each published type it names. The expression is
 * split on its identifiers so that a generic argument links as readily as the type it sits
 * inside, and everything else stays in a code span.
 */
function renderType(text, index) {
  const parts = [];
  let run = "";
  const flush = () => {
    if (run.length > 0) parts.push(`\`${run}\``);
    run = "";
  };
  for (const token of text.split(/([A-Za-z_][\w.]*)/)) {
    if (token.length === 0) continue;
    const target = /^[A-Za-z_]/.test(token)
      ? index.types.get(token)
      : undefined;
    if (target) {
      flush();
      parts.push(`[\`${escapeLinkText(token)}\`](../wiki/${target.page})`);
    } else run += token;
  }
  flush();
  return parts.join("");
}

/**
 * The parameter list of a signature. A parameter with a default is marked optional, the
 * way a reader of the signature needs to know before they can leave it out.
 */
function renderParameterNames(parameters) {
  const shown = parameters.map(
    (parameter) =>
      `\`${parameter.name}${parameter.default === null ? "" : "?"}\``,
  );
  return `(${shown.join(", ")})`;
}

function modifierSpans(member) {
  return member.modifiers
    .filter((modifier) => modifier !== "public" && modifier !== "partial")
    .map((modifier) => `\`${modifier}\``)
    .join(" ");
}

function signatureOf(member, type, index) {
  const spans = modifierSpans(member);
  const lead = spans.length > 0 ? `${spans} ` : "";
  const generics =
    member.typeParameters?.length > 0
      ? `\\<${member.typeParameters.map((one) => `\`${one}\``).join(", ")}\\>`
      : "";
  switch (member.kind) {
    case "constructor":
      return `> ${lead}**new ${displayName(type)}**${renderParameterNames(member.parameters)}`;
    case "method":
      return `> ${lead}**${member.name}**${generics}${renderParameterNames(member.parameters)}: ${renderType(member.returnType, index)}`;
    case "property":
      return `> ${lead}**${member.name}**: ${renderType(member.type, index)}`;
    case "field":
      return `> ${lead}**${member.name}**: ${renderType(member.type, index)}${
        member.value === null || member.value === undefined
          ? ""
          : ` = \`${member.value}\``
      }`;
    case "enum-member":
      return member.value === null
        ? `> **${member.name}**`
        : `> **${member.name}** = \`${member.value}\``;
    default:
      throw new Error(`no signature shape for a ${member.kind}`);
  }
}

/**
 * The heading a member carries. A method states its parentheses so that a property and a
 * method of the same name stay apart, which is what TypeDoc's pages do too.
 */
function headingOf(member, type) {
  if (member.kind === "constructor") return `new ${displayName(type)}()`;
  if (member.kind === "method") return `${member.name}()`;
  return member.name;
}

/** The `Defined in:` line, which points at the declaration in the repository. */
function definedIn(file, line, commit) {
  const url = `https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/${commit}/${file}#L${line}`;
  return `Defined in: [${file}:${line}](${url})`;
}

/** Reads a declaration's doc comment, with the cross-references left as marks. */
function documentation(raw, scope, where) {
  const doc = readDocComment(raw, where);
  const resolve = (cref) => markReference(cref, scope);
  return {
    summary: [
      ...renderDoc(doc.summary, resolve),
      ...doc.content.flatMap((nodes) => renderDoc(nodes, resolve)),
    ],
    remarks: doc.remarks.flatMap((nodes) => renderDoc(nodes, resolve)),
    returns: renderDoc(doc.returns, resolve),
    value: renderDoc(doc.value, resolve),
    example: renderDoc(doc.example, resolve),
    params: new Map(
      [...doc.params].map(([name, nodes]) => [name, renderDoc(nodes, resolve)]),
    ),
    typeParams: new Map(
      [...doc.typeParams].map(([name, nodes]) => [
        name,
        renderDoc(nodes, resolve),
      ]),
    ),
    exceptions: doc.exceptions.map((exception) => ({
      cref: markReference(exception.cref, scope),
      body: renderInline(exception.nodes, resolve).trim(),
    })),
    inheritsDoc: doc.inheritsDoc,
  };
}

/**
 * The members a type page lists, grouped into its sections. A record's primary
 * constructor is both a constructor and the properties it declares, and it is documented
 * once — on the type — so both readings are built from the type's own `<param>` tags.
 */
function memberSections(type, doc) {
  const declared = new Map(memberSectionOrder.map(([kind]) => [kind, []]));
  for (const member of type.members) declared.get(member.kind).push(member);

  if (type.primaryParameters.length > 0) {
    declared.get("constructor").unshift({
      kind: "constructor",
      name: type.name,
      parameters: type.primaryParameters,
      typeParameters: [],
      modifiers: ["public"],
      doc: "",
      primary: true,
      line: type.line,
      file: type.file,
    });
    for (const parameter of type.primaryParameters) {
      declared.get("property").push({
        kind: "property",
        name: parameter.name,
        type: parameter.type,
        modifiers: ["public"],
        doc: "",
        primaryOf: parameter.name,
        line: type.line,
        file: type.file,
      });
    }
  }

  return memberSectionOrder
    .map(([kind, title]) => {
      const members = declared.get(kind);
      // An enumeration's members are ordered by the game's own grading, so they keep
      // the order they are declared in; everything else reads better by name.
      if (kind !== "enum-member") {
        members.sort((a, b) => a.name.localeCompare(b.name));
      }
      return { kind, title, members, doc };
    })
    .filter((section) => section.members.length > 0);
}

/** One type's page. */
function renderTypePage(type, index, commit) {
  const scope = `${type.namespace}.${type.name}`;
  const doc = documentation(
    type.docs.join("\n"),
    scope,
    `${type.file}:${type.line}`,
  );
  const area = areaOf(type);
  const lines = [
    `[EliteDangerousAlmanac](../wiki/${prefix}.API) / [${area}](../wiki/${prefix}.${area}) / ${displayName(type)}`,
    "",
    `# ${kindNames.get(type.kind)}: ${displayName(type)}`,
    "",
    definedIn(type.file, type.line, commit),
  ];

  const block = (heading, blocks, level = 2) => {
    if (blocks.length === 0) return;
    lines.push("", `${"#".repeat(level)} ${heading}`, "", blocks.join("\n\n"));
  };

  if (doc.summary.length > 0) lines.push("", doc.summary.join("\n\n"));
  if (type.typeParameters.length > 0) {
    lines.push("", "## Type Parameters");
    for (const parameter of type.typeParameters) {
      lines.push("", `### ${parameter}`);
      const described = doc.typeParams.get(parameter);
      if (described?.length > 0) lines.push("", described.join("\n\n"));
    }
  }
  block("Remarks", doc.remarks);
  block("Example", doc.example);

  for (const section of memberSections(type, doc)) {
    lines.push("", `## ${section.title}`);
    for (const member of section.members) {
      lines.push(
        "",
        `### ${headingOf(member, type)}`,
        "",
        signatureOf(member, type, index),
      );
      // A record's primary constructor and its properties are the type's own
      // declaration, which the page has already pointed at.
      if (!member.primary && !member.primaryOf) {
        lines.push(
          "",
          definedIn(member.file ?? type.file, member.line, commit),
        );
      }
      renderMemberBody(lines, member, type, doc, index);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderMemberBody(lines, member, type, typeDoc, index) {
  const where = `${member.file ?? type.file}:${member.line}`;
  // A record's primary constructor and the properties it declares are documented by the
  // `<param>` tags on the record itself.
  const doc = member.primary
    ? { ...emptyDoc(), params: typeDoc.params }
    : member.primaryOf
      ? { ...emptyDoc(), summary: typeDoc.params.get(member.primaryOf) ?? [] }
      : documentation(
          member.doc ?? "",
          `${type.namespace}.${type.name}`,
          where,
        );

  if (doc.summary.length > 0) lines.push("", doc.summary.join("\n\n"));
  if (doc.value.length > 0) lines.push("", doc.value.join("\n\n"));

  if (member.parameters?.length > 0) {
    lines.push("", "#### Parameters");
    for (const parameter of member.parameters) {
      const keywords = parameter.keywords
        .map((word) => `\`${word}\` `)
        .join("");
      const fallback =
        parameter.default === null ? "" : ` = \`${parameter.default}\``;
      lines.push(
        "",
        `##### ${parameter.name}`,
        "",
        `${keywords}${renderType(parameter.type, index)}${fallback}`,
      );
      const described = doc.params.get(parameter.name);
      if (described?.length > 0) lines.push("", described.join("\n\n"));
    }
  }

  if (member.kind === "method" && member.returnType !== "void") {
    lines.push("", "#### Returns", "", renderType(member.returnType, index));
    if (doc.returns.length > 0) lines.push("", doc.returns.join("\n\n"));
  }

  if (doc.remarks.length > 0)
    lines.push("", "#### Remarks", "", doc.remarks.join("\n\n"));
  if (doc.example.length > 0)
    lines.push("", "#### Example", "", doc.example.join("\n\n"));
  if (doc.exceptions.length > 0) {
    lines.push("", "#### Exceptions");
    for (const exception of doc.exceptions) {
      lines.push("", exception.cref, "", exception.body);
    }
  }
}

function emptyDoc() {
  return {
    summary: [],
    content: [],
    remarks: [],
    returns: [],
    value: [],
    example: [],
    params: new Map(),
    typeParams: new Map(),
    exceptions: [],
    inheritsDoc: false,
  };
}

/** One namespace's page: its intro, then the types it publishes, grouped by kind. */
function renderAreaPage(area, intro) {
  const lines = [
    `[EliteDangerousAlmanac](../wiki/${prefix}.API) / ${area.name}`,
    "",
    `# ${area.name}`,
  ];
  if (intro.length > 0) lines.push("", intro.trim());

  for (const [kind, title] of kindSections) {
    const types = area.types.filter((type) => type.kind === kind);
    if (types.length === 0) continue;
    lines.push("", `## ${title}`, "");
    for (const type of types) {
      lines.push(
        `- [${escapeLinkText(displayName(type))}](../wiki/${pageName(type)})`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

/** The reference index: the guides, then the namespaces. */
function renderIndexPage(namespaces, guides, version) {
  const lines = [`# EliteDangerousAlmanac v${version}`];
  if (guides.length > 0) {
    lines.push("", "## Guides", "");
    for (const guide of guides)
      lines.push(`- [${guide.title}](../wiki/${guide.page})`);
  }
  lines.push("", "## Namespaces", "");
  for (const area of namespaces.values()) {
    lines.push(`- [${area.name}](../wiki/${prefix}.${area.name})`);
  }
  return `${lines.join("\n")}\n`;
}

/** A guide's front matter states its title; the body is the page. */
function readGuide(name, text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const title = match
    ? /^title:\s*(.+)$/m.exec(match[1])?.[1]?.trim()
    : undefined;
  if (!title)
    throw new Error(
      `dotnet/docs/guides/${name}: no "title" in the front matter`,
    );
  return { title, body: text.slice(match[0].length).trimStart() };
}

/**
 * Resolves one `cref`. The lookup widens from the type the reference was written in to the
 * whole published surface, and a reference the library does not publish — a BCL type such
 * as `InvalidOperationException` — stays as the name it names.
 */
function resolveReference(cref, scope, index) {
  const bare = cref.replace(/^[A-Z]:/, "").replace(/\(.*\)$/, "");
  const shown = bare.replace(/\{/g, "<").replace(/\}/g, ">");
  const normalized = bare.replace(
    /\{[^{}]*\}/g,
    (generics) => `-${splitTopLevel(generics.slice(1, -1)).length}`,
  );
  const namespace = scope.slice(0, scope.lastIndexOf("."));

  // A bare name is read as a member of the declaring type first, then as a type in the
  // declaring namespace, then anywhere on the surface — the order C# itself resolves in.
  const entry =
    index.members.get(`${scope}.${normalized}`) ??
    index.members.get(normalized) ??
    index.types.get(`${namespace}.${normalized}`) ??
    index.types.get(normalized);
  if (!entry) return `\`${shown}\``;
  const anchor = entry.anchor ? `#${entry.anchor}` : "";
  return `[\`${escapeLinkText(shown)}\`](../wiki/${entry.page}${anchor})`;
}

/**
 * Generates every .NET page into `wikiDir`.
 *
 * @returns The page name of the reference index and of each guide, for the surface home.
 */
export async function writeDotnetPages({
  wikiDir,
  repositoryRoot,
  commit,
  version,
}) {
  const namespaces = await readDotnetApi({
    sourceRoot: join(repositoryRoot, "dotnet/src/EliteDangerousAlmanac"),
    repositoryRoot,
  });

  // The index of everything the reference can link to, built before a page is rendered
  // because a cross-reference on one page names an anchor on another.
  const index = { types: new Map(), members: new Map() };
  for (const area of namespaces.values()) {
    for (const type of area.types) {
      const entry = {
        page: pageName(type),
        full: `${type.namespace}.${type.name}`,
      };
      const arity =
        type.typeParameters.length > 0 ? `-${type.typeParameters.length}` : "";
      for (const key of [
        `${type.namespace}.${type.name}${arity}`,
        `${type.name}${arity}`,
        `${type.namespace}.${type.name}`,
        type.name,
      ]) {
        if (!index.types.has(key)) index.types.set(key, entry);
      }
    }
  }

  const pages = new Map();
  for (const area of namespaces.values()) {
    for (const type of area.types) {
      pages.set(pageName(type), renderTypePage(type, index, commit));
    }
  }

  // Anchors come from the finished pages, so a member's link target is the one GitHub
  // will actually mint for its heading.
  for (const area of namespaces.values()) {
    for (const type of area.types) {
      const page = pageName(type);
      const seen = new Set();
      for (const heading of anchorsOf(pages.get(page))) {
        if (heading.level !== 3) continue;
        const name = heading.title.replace(/\(\)$/, "").replace(/^new /, "");
        if (seen.has(name)) continue;
        seen.add(name);
        const entry = { page, anchor: heading.anchor };
        for (const key of [
          `${type.namespace}.${type.name}.${name}`,
          `${type.name}.${name}`,
        ]) {
          if (!index.members.has(key)) index.members.set(key, entry);
        }
      }
    }
  }

  const introDir = join(repositoryRoot, "dotnet/docs/namespaces");
  const intros = new Map();
  for (const file of await readdir(introDir)) {
    intros.set(
      file.replace(/\.md$/, ""),
      await readFile(join(introDir, file), "utf8"),
    );
  }
  for (const area of namespaces.values()) {
    const intro = intros.get(area.name);
    if (intro === undefined) {
      throw new Error(`dotnet/docs/namespaces/${area.name}.md is missing`);
    }
    pages.set(`${prefix}.${area.name}`, renderAreaPage(area, intro));
  }

  const guideDir = join(repositoryRoot, "dotnet/docs/guides");
  const guides = [];
  for (const file of (await readdir(guideDir)).sort()) {
    const guide = readGuide(file, await readFile(join(guideDir, file), "utf8"));
    const page = `${prefix}.Document.${file.replace(/\.md$/, "")}`;
    guides.push({ title: guide.title, page });
    pages.set(page, guide.body);
  }
  guides.sort((a, b) => a.title.localeCompare(b.title));

  pages.set(`${prefix}.API`, renderIndexPage(namespaces, guides, version));

  // The marks left where a cross-reference stood are filled in now that every anchor is
  // known, so a reference resolves the same wherever on the surface it was written.
  const pattern = new RegExp(
    `${referenceMark}([^${referenceMark}]*)${referenceMark}([^${referenceMark}]*)${referenceMark}`,
    "g",
  );
  for (const [name, markdown] of pages) {
    const resolved = markdown.replace(pattern, (whole, cref, scope) =>
      resolveReference(cref, scope, index),
    );
    await writeFile(join(wikiDir, `${name}.md`), resolved);
  }

  return { index: `${prefix}.API`, guides, namespaces: [...namespaces.keys()] };
}
