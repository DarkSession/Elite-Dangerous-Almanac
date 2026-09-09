// Holds the C# examples in the .NET documentation to the surface the library actually
// publishes.
//
// The TypeScript snippets are compiled and executed by `check:examples`. The C# ones
// cannot be, without putting the .NET SDK behind a documentation check — so this reads
// them the one way that needs no compiler and still catches the mistake that actually
// happens: a member or a type named in an example that the library does not have. A
// static call states its type outright, so `ShipCatalogue.FindBySymbol` is checkable
// exactly as written; a call on a local variable is not, and is left alone.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const rootNamespace = "EliteDangerousAlmanac";

/** Every fenced C# block on a page, with the line its fence opens on. */
function csharpFences(markdown) {
  const found = [];
  let fence = null;
  for (const [index, line] of markdown.split("\n").entries()) {
    if (fence === null) {
      if (/^```(csharp|cs|c#)\s*$/i.test(line.trim())) {
        fence = { line: index + 1, body: [] };
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
 * Reads every C# example under `docsRoot` and answers one finding per reference the
 * published surface does not carry.
 *
 * @param {Map<string, object>} namespaces The published API, from `readDotnetApi`.
 */
export async function findUnknownReferences({
  docsRoot,
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

  const findings = [];
  for (const file of await markdownFiles(docsRoot)) {
    const where = relative(repositoryRoot, file);
    const markdown = await readFile(file, "utf8");
    for (const fence of csharpFences(markdown)) {
      for (const [offset, line] of code(fence.code).split("\n").entries()) {
        const at = (message) =>
          findings.push(`${where}:${fence.line + offset + 1}: ${message}`);

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
