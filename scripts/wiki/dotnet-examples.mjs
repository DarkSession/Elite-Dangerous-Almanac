// Holds the C# examples in the .NET documentation to the surface the library actually
// publishes.
//
// The TypeScript snippets are compiled and executed by `check:examples`. The C# ones
// cannot be, without putting the .NET SDK behind a documentation check — so this reads
// them the one way that needs no compiler and still catches the mistake that actually
// happens: a member or a type named in an example that the library does not have. A
// static call on a published type states its type outright, so
// `ShipCatalogue.FindBySymbol` is checkable exactly as written. Two things are left alone,
// because nothing here can tell them apart from a name that is simply not the library's: a
// call on a local variable, and a static call on a type this library does not publish —
// `JsonSerializer.Deserialize` has to pass, so a misspelt `ShipCatalog` does too.
//
// An example reaches a reader from a ```csharp fence in a Markdown page, or from a C#
// `<code>` block in a `///` comment, which `xml-doc.mjs` renders as the same fence. Both
// are read here, the second from the C# source so a finding names the line to fix.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { sourceFiles } from "./dotnet-source.mjs";
import { decodeEntities } from "./xml-doc.mjs";

const rootNamespace = "EliteDangerousAlmanac";

/** Every fenced C# block on a page, with the line its first line of code sits on. */
function csharpFences(markdown) {
  const found = [];
  let fence = null;
  for (const [index, line] of markdown.split("\n").entries()) {
    if (fence === null) {
      if (/^```(csharp|cs|c#)\s*$/i.test(line.trim())) {
        fence = { line: index + 2, body: [] };
      }
      continue;
    }
    if (line.trim().startsWith("```")) {
      found.push({ line: fence.line, code: fence.body.join("\n") });
      fence = null;
      continue;
    }
    fence.body.push(line);
  }
  return found;
}

/**
 * Every C# `<code>` block in a source file's documentation comments, with the line its
 * text starts on: the line of the `<code>` tag, so a block written below the tag counts
 * from there. Each line that is not a `///` comment is read as an empty one, so a block's
 * line numbers are the file's. A block whose `language` names another language is left
 * alone, as `xml-doc.mjs` fences it in that language.
 */
function docCommentCode(source) {
  const comments = source
    .split(/\r?\n/)
    .map((line) => /^\s*\/\/\/ ?(.*)$/.exec(line)?.[1] ?? "")
    .join("\n");
  const found = [];
  for (const match of comments.matchAll(/<code\b([^>]*)>([\s\S]*?)<\/code>/g)) {
    const language = /\blanguage\s*=\s*"([^"]*)"/.exec(match[1])?.[1];
    if (language !== undefined && !/^(csharp|cs|c#)$/i.test(language)) continue;
    const opens = match.index + match[0].indexOf(">") + 1;
    found.push({
      line: comments.slice(0, opens).split("\n").length,
      code: decodeEntities(match[2]),
    });
  }
  return found;
}

/** A snippet with its comments and string literals blanked, every line left where it was. */
function code(snippet) {
  return snippet.replace(
    /@"(?:[^"]|"")*"|"(?:[^"\\\n]|\\.)*"|\/\/[^\n]*/g,
    (match) => match.replace(/[^\n]/g, " "),
  );
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/**
 * Reads every C# example — each ```csharp fence in a Markdown page under `docsRoots`, and
 * each C# `<code>` block in a documentation comment under `sourceRoots` — and answers one
 * finding per reference the published surface does not carry.
 *
 * @param {Map<string, object>} namespaces The published API, from `readDotnetApi`.
 */
export async function findUnknownReferences({
  docsRoots = [],
  sourceRoots = [],
  repositoryRoot,
  namespaces,
}) {
  const members = new Map();
  const types = new Set();
  for (const area of namespaces.values()) {
    for (const type of area.types) {
      types.add(type.name);
      const own = members.get(type.name) ?? new Set();
      for (const member of type.members) own.add(member.name);
      for (const parameter of type.primaryParameters) own.add(parameter.name);
      members.set(type.name, own);
    }
  }
  const areas = new Set(namespaces.keys());

  const sources = [];
  for (const root of docsRoots) {
    for (const file of await markdownFiles(root)) {
      sources.push({
        file,
        examples: csharpFences(await readFile(file, "utf8")),
      });
    }
  }
  for (const root of sourceRoots) {
    // The files the reference itself is read from, so the two see the same comments.
    for (const file of await sourceFiles(root)) {
      sources.push({
        file,
        examples: docCommentCode(await readFile(file, "utf8")),
      });
    }
  }

  const findings = [];
  for (const { file, examples } of sources) {
    const where = relative(repositoryRoot, file);
    for (const example of examples) {
      for (const [offset, line] of code(example.code).split("\n").entries()) {
        const at = (message) =>
          findings.push(`${where}:${example.line + offset}: ${message}`);

        for (const match of line.matchAll(
          new RegExp(`\\busing\\s+${rootNamespace}\\.(\\w+)\\s*;`, "g"),
        )) {
          if (!areas.has(match[1]))
            at(`no namespace ${rootNamespace}.${match[1]}`);
        }

        // A static access names its type, so it is the one reference an example states
        // completely. Anything reached through a local is skipped: reading it would need
        // the type inference only a compiler has — and so is a name that is itself
        // reached through a dot, because `build.Weapons.Count` names no type at all.
        for (const match of line.matchAll(
          /(?<![.\w])([A-Z]\w*)\s*\.\s*([A-Za-z_]\w*)/g,
        )) {
          const [, owner, member] = match;
          if (!types.has(owner)) continue;
          if (!members.get(owner).has(member)) {
            at(`${owner} has no member ${member}`);
          }
        }

        // A qualified reference, as in `EliteDangerousAlmanac.Ships.ShipLoadout`, states
        // its namespace as well, and is checkable against both.
        for (const match of line.matchAll(
          new RegExp(`\\b${rootNamespace}\\.(\\w+)\\.(\\w+)\\b`, "g"),
        )) {
          if (!areas.has(match[1]))
            at(`no namespace ${rootNamespace}.${match[1]}`);
          else if (!types.has(match[2])) at(`no type ${match[1]}.${match[2]}`);
        }
      }
    }
  }
  return findings;
}
