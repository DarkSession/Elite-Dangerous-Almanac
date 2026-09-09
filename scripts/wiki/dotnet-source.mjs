// Reads the published surface of the .NET library out of its C# source.
//
// The alternative input is the compiler's XML documentation file, and it cannot answer the
// question a reference page asks. That file states a member by its documentation id, so a
// return type, a modifier and a parameter name are all absent from it, and producing one
// needs the .NET SDK — which would put an SDK behind a documentation build that is
// otherwise one Node script. The source carries the signatures and the doc comments
// together, so it is what this reads.
//
// The reader recognises the declaration shapes this library is written in and throws on
// anything else, so a construct it has never seen fails the documentation build rather
// than dropping out of the reference unannounced.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const typeKeywords = new Set([
  "class",
  "record",
  "struct",
  "interface",
  "enum",
]);

/** Declaration modifiers, in the order a rendered signature shows them. */
const modifierOrder = [
  "public",
  "protected",
  "internal",
  "private",
  "file",
  "const",
  "static",
  "abstract",
  "virtual",
  "override",
  "sealed",
  "new",
  "readonly",
  "required",
  "partial",
  "extern",
  "unsafe",
  "async",
  "volatile",
];
const modifiers = new Set(modifierOrder);

const parameterKeywords = new Set([
  "out",
  "ref",
  "in",
  "params",
  "this",
  "scoped",
  "readonly",
]);

/**
 * The file with every comment and every string or character literal blanked out, keeping
 * each character's position so a match can still be located by line. Scanning declarations
 * over this is what makes brace counting reliable; the documentation comments are read off
 * to the side, by line, before they are blanked.
 */
function blankNonCode(text, path) {
  const source = [...text];
  const blanked = source.map((character) => (character === "\n" ? "\n" : " "));
  const docLines = new Map();
  let index = 0;
  let line = 1;

  const copy = (to) => {
    for (; index < to; index += 1) {
      blanked[index] = source[index];
      if (source[index] === "\n") line += 1;
    }
  };
  const skip = (to) => {
    for (; index < to && index < source.length; index += 1) {
      if (source[index] === "\n") line += 1;
    }
  };
  const endOfLine = () => {
    const at = text.indexOf("\n", index);
    return at === -1 ? source.length : at;
  };

  while (index < source.length) {
    const character = source[index];
    if (character === "/" && source[index + 1] === "/") {
      const stop = endOfLine();
      if (source[index + 2] === "/") {
        const comment = text.slice(index + 3, stop);
        docLines.set(
          line,
          comment.startsWith(" ") ? comment.slice(1) : comment,
        );
      }
      skip(stop);
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const stop = text.indexOf("*/", index + 2);
      if (stop === -1)
        throw new Error(`${path}: an unterminated block comment`);
      skip(stop + 2);
      continue;
    }
    if (character === "@" && source[index + 1] === '"') {
      let scan = index + 2;
      while (scan < source.length) {
        if (source[scan] === '"') {
          if (source[scan + 1] === '"') scan += 2;
          else break;
        } else scan += 1;
      }
      if (scan >= source.length)
        throw new Error(`${path}: an unterminated verbatim string`);
      skip(scan + 1);
      continue;
    }
    if (character === '"' || character === "'") {
      let scan = index + 1;
      while (scan < source.length && source[scan] !== character) {
        scan += source[scan] === "\\" ? 2 : 1;
      }
      skip(Math.min(scan + 1, source.length));
      continue;
    }
    copy(index + 1);
  }
  return { code: blanked.join(""), docLines };
}

/** A position-to-line lookup over the file. */
function lineIndex(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return (position) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle] <= position) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

/** Split a bracketed list at its top level, ignoring separators inside brackets. */
export function splitTopLevel(text, separator = ",") {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of text) {
    if ("<([{".includes(character)) depth += 1;
    else if (">)]}".includes(character)) depth -= 1;
    if (character === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += character;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

function stripAttributes(text) {
  let rest = text.trimStart();
  while (rest.startsWith("[")) {
    let depth = 0;
    let index = 0;
    for (; index < rest.length; index += 1) {
      if (rest[index] === "[") depth += 1;
      else if (rest[index] === "]" && --depth === 0) break;
    }
    rest = rest.slice(index + 1).trimStart();
  }
  return rest;
}

/** Peel the leading modifiers off a declaration, in the order the list above fixes. */
function takeModifiers(text) {
  const found = [];
  let rest = text.trimStart();
  for (;;) {
    const word = /^([A-Za-z]+)\b/.exec(rest);
    // `record` is a modifier only in `record class` and `record struct`, neither of
    // which this library writes, so it always reads as the type keyword.
    if (!word || !modifiers.has(word[1]) || typeKeywords.has(word[1])) break;
    found.push(word[1]);
    rest = rest.slice(word[1].length).trimStart();
  }
  found.sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));
  return { modifiers: found, rest };
}

/**
 * Where a declaration's parameter list opens, or -1 when it has none. The list is the
 * bracket group a name sits in front of, which is what tells it apart from a tuple type
 * standing at the head of the declaration, as in `(int Total, int Kept) Count()`.
 */
function parameterListParen(text) {
  let angle = 0;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "<") angle += 1;
    else if (character === ">") angle -= 1;
    else if (character === "(" || character === "[") {
      if (
        depth === 0 &&
        angle === 0 &&
        character === "(" &&
        /[\w>]/.test(text.slice(0, index).trimEnd().at(-1) ?? "")
      ) {
        return index;
      }
      depth += 1;
    } else if (character === ")" || character === "]") depth -= 1;
  }
  return -1;
}

function matchingParen(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")" && --depth === 0) return index;
  }
  throw new Error(`unbalanced parentheses in "${text}"`);
}

/** The position of the `]` closing the `[` at `open`. */
function matchingBracket(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "[") depth += 1;
    else if (text[index] === "]" && --depth === 0) return index;
  }
  throw new Error(`unbalanced brackets in "${text}"`);
}

/** The generic parameters of `Name<T, TValue>`, and the name without them. */
function splitGenerics(text) {
  const open = text.indexOf("<");
  if (open === -1) return { name: text.trim(), typeParameters: [] };
  const close = text.lastIndexOf(">");
  return {
    name: text.slice(0, open).trim(),
    typeParameters: splitTopLevel(text.slice(open + 1, close)).map((part) =>
      part.split(/\s+/).at(-1),
    ),
  };
}

/** One parameter of a method, a constructor or a record's primary constructor. */
function parseParameter(text, where) {
  const [declaration, ...defaults] = splitTopLevel(stripAttributes(text), "=");
  const keywords = [];
  let rest = declaration.trim();
  for (;;) {
    const word = /^([A-Za-z]+)\b/.exec(rest);
    if (!word || !parameterKeywords.has(word[1])) break;
    keywords.push(word[1]);
    rest = rest.slice(word[1].length).trimStart();
  }
  const name = /([A-Za-z_]\w*)\s*$/.exec(rest);
  if (!name)
    throw new Error(`${where}: cannot read the parameter "${text.trim()}"`);
  return {
    keywords,
    type: rest.slice(0, name.index).trim(),
    name: name[1],
    default: defaults.length > 0 ? defaults.join("=").trim() : null,
  };
}

function parseParameterList(text, where) {
  if (text.trim().length === 0) return [];
  return splitTopLevel(text).map((part) => parseParameter(part, where));
}

/**
 * Classifies one member declaration into the shapes C# allows inside a type: a
 * constructor, a method, a property, and a field or constant.
 */
function parseMember(signature, terminator, owner, where) {
  const withoutConstraints = signature.split(/\bwhere\b/)[0];
  const { modifiers: found, rest } = takeModifiers(
    stripAttributes(withoutConstraints),
  );
  const cut = cutInitializer(rest);
  const declaration = cut.declaration.trim();

  // An indexer is a property reached through a bracketed argument list rather than a
  // name, so it is read like one and keeps the arguments that select the value.
  const indexer = /\bthis\s*\[/.exec(declaration);
  if (indexer) {
    const open = indexer.index + indexer[0].length - 1;
    return {
      kind: "indexer",
      name: "this[]",
      type: declaration.slice(0, indexer.index).trim(),
      parameters: parseParameterList(
        declaration.slice(open + 1, matchingBracket(declaration, open)),
        where,
      ),
      modifiers: found,
    };
  }

  const open = parameterListParen(declaration);

  if (open !== -1) {
    const head = declaration.slice(0, open).trim();
    const last = head.split(/\s+/).at(-1) ?? "";
    const { name, typeParameters } = splitGenerics(last);
    const returnType = head.slice(0, head.length - last.length).trim();
    const parameters = parseParameterList(
      declaration.slice(open + 1, matchingParen(declaration, open)),
      where,
    );
    if (returnType.length === 0) {
      if (name !== owner)
        throw new Error(
          `${where}: cannot read the member "${signature.trim()}"`,
        );
      return {
        kind: "constructor",
        name,
        parameters,
        typeParameters,
        modifiers: found,
      };
    }
    return {
      kind: "method",
      name,
      returnType,
      parameters,
      typeParameters,
      modifiers: found,
    };
  }

  const words = declaration.split(/\s+/).filter(Boolean);
  if (words.length < 2)
    throw new Error(`${where}: cannot read the member "${signature.trim()}"`);
  const name = words.at(-1);
  const type = words.slice(0, -1).join(" ");
  // A property carries an accessor list or an expression body; anything else with no
  // parameter list is a field or a constant.
  if (terminator !== ";")
    return { kind: "property", name, type, modifiers: found };
  // A constant's value is part of what it promises, so it is read back out. Any other
  // initializer is an implementation and stays out of the signature.
  const value = found.includes("const") ? cut.initializer : null;
  return { kind: "field", name, type, value, modifiers: found };
}

/**
 * A declaration split from its initializer. A field's initializer is arbitrary C# — a
 * lambda, an object initializer, a collection expression — and none of it belongs in a
 * signature, so the declaration is cut at the first assignment outside any bracket.
 */
function cutInitializer(text) {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if ("<([{".includes(character)) depth += 1;
    else if (">)]}".includes(character)) depth -= 1;
    else if (character === "=" && depth === 0) {
      const next = text[index + 1];
      const previous = text[index - 1];
      if (next !== "=" && next !== ">" && !"=!<>+-*/%&|^".includes(previous)) {
        return {
          declaration: text.slice(0, index),
          initializer: text.slice(index + 1).trim(),
        };
      }
    }
  }
  return { declaration: text, initializer: null };
}

/**
 * Every type declaration in one file, published or not, each with the members declared
 * directly inside it.
 */
export function readSourceFile(text, path) {
  const { code, docLines } = blankNonCode(text, path);
  const lineOf = lineIndex(code);
  const types = [];
  let namespace = null;

  /** The doc comment written immediately above a declaration, as one XML fragment. */
  const docAbove = (position) => {
    const lines = [];
    for (let line = lineOf(position) - 1; docLines.has(line); line -= 1) {
      lines.unshift(docLines.get(line));
    }
    return lines.join("\n");
  };

  const skipSpace = (from) => {
    let index = from;
    while (index < code.length && /\s/.test(code[index])) index += 1;
    return index;
  };

  /**
   * The declaration's own position, past any attributes written above it. A `Defined in:`
   * line should point at the member and not at its `[JsonPropertyName]`.
   */
  const pastAttributes = (from) => {
    let index = skipSpace(from);
    while (code[index] === "[")
      index = skipSpace(matchingBracket(code, index) + 1);
    return index;
  };

  /** The position just past the `}` matching the `{` at `open`. */
  const skipBlock = (open) => {
    let depth = 0;
    for (let index = open; index < code.length; index += 1) {
      if (code[index] === "{") depth += 1;
      else if (code[index] === "}" && --depth === 0) return index + 1;
    }
    throw new Error(`${path}: an unclosed block at line ${lineOf(open)}`);
  };

  /**
   * The declaration starting at `from`: its signature text, the token that ended it, and
   * where the declaration's own text begins once attributes are stripped.
   */
  const readSignature = (from, { commaEnds }) => {
    let depth = 0;
    for (let index = from; index < code.length; index += 1) {
      const character = code[index];
      if ("([".includes(character)) depth += 1;
      else if (")]".includes(character)) depth -= 1;
      else if (depth === 0) {
        if (character === "=" && code[index + 1] === ">") {
          return {
            signature: code.slice(from, index),
            terminator: "=>",
            end: index + 2,
          };
        }
        if (
          character === "{" ||
          character === ";" ||
          (commaEnds && character === ",")
        ) {
          return {
            signature: code.slice(from, index),
            terminator: character,
            end: index,
          };
        }
        if (character === "}") return null;
      }
    }
    return null;
  };

  /** Reads the members of a type body, answering the position just past its `}`. */
  const readBody = (open, owner) => {
    const inEnum = owner !== null && owner.kind === "enum";
    let index = open + 1;
    for (;;) {
      index = skipSpace(index);
      if (index >= code.length)
        throw new Error(`${path}: an unclosed type body`);
      if (code[index] === "}") return index + 1;

      const start = index;
      const read = readSignature(start, { commaEnds: inEnum });
      if (read === null)
        throw new Error(`${path}:${lineOf(start)}: cannot read a declaration`);
      const where = `${path}:${lineOf(start)}`;
      const doc = docAbove(start);

      if (inEnum) {
        const name = stripAttributes(read.signature).trim().split(/\s+/)[0];
        owner.members.push({
          kind: "enum-member",
          name,
          value: read.signature.includes("=")
            ? read.signature.split("=").slice(1).join("=").trim()
            : null,
          modifiers: [],
          doc,
          file: path,
          line: lineOf(pastAttributes(start)),
          where,
        });
        index = read.terminator === "," ? read.end + 1 : read.end;
        continue;
      }

      const nested = readTypeDeclaration(
        read,
        doc,
        namespace,
        path,
        lineOf(pastAttributes(start)),
        where,
      );
      if (nested !== null) {
        // A nested type is the library's own workings, so nothing inside it is published.
        // One that is public would vanish from the reference instead, so refuse it rather
        // than drop it: teach this reader about nested types on the day one exists.
        if (nested.modifiers.includes("public")) {
          throw new Error(
            `${where}: a public nested type is not published — "${nested.name}"`,
          );
        }
        index = read.terminator === "{" ? skipBlock(read.end) : read.end + 1;
        continue;
      }

      const member = parseMember(
        read.signature,
        read.terminator,
        owner.name,
        where,
      );
      Object.assign(member, {
        doc,
        file: path,
        line: lineOf(pastAttributes(start)),
        where,
      });
      const visible =
        owner.kind === "interface" ||
        member.modifiers.includes("public") ||
        member.modifiers.includes("protected");
      if (visible) owner.members.push(member);

      if (read.terminator === "{") {
        // The block is an accessor list or a collection initializer; either may be
        // followed by `= value` and either may end with a semicolon.
        index = skipBlock(read.end);
        const after = skipSpace(index);
        if (code[after] === "=") index = statementEnd(after);
        else if (code[after] === ";") index = after + 1;
      } else if (read.terminator === "=>") {
        index = statementEnd(read.end);
      } else index = read.end + 1;
    }
  };

  /** The position just past the `;` that ends an expression body or an initializer. */
  const statementEnd = (from) => {
    let depth = 0;
    for (let index = from; index < code.length; index += 1) {
      const character = code[index];
      if ("([{".includes(character)) depth += 1;
      else if (")]}".includes(character)) depth -= 1;
      else if (character === ";" && depth === 0) return index + 1;
    }
    throw new Error(
      `${path}: an unterminated statement at line ${lineOf(from)}`,
    );
  };

  let index = 0;
  for (;;) {
    index = skipSpace(index);
    if (index >= code.length) break;

    const rest = code.slice(index);
    const namespaceMatch = /^namespace\s+([\w.]+)\s*;/.exec(rest);
    if (namespaceMatch) {
      namespace = namespaceMatch[1];
      index += namespaceMatch[0].length;
      continue;
    }
    const usingMatch = /^(global\s+)?using\s[^;]*;/.exec(rest);
    if (usingMatch) {
      index += usingMatch[0].length;
      continue;
    }

    const start = index;
    const read = readSignature(start, { commaEnds: false });
    if (read === null)
      throw new Error(`${path}:${lineOf(start)}: cannot read a declaration`);
    const where = `${path}:${lineOf(start)}`;
    const type = readTypeDeclaration(
      read,
      docAbove(start),
      namespace,
      path,
      lineOf(pastAttributes(start)),
      where,
    );
    if (type === null) {
      throw new Error(
        `${where}: expected a type declaration, read "${read.signature.trim()}"`,
      );
    }
    types.push(type);
    if (read.terminator === "{") {
      index = readBody(read.end, type);
    } else index = read.end + 1;
  }
  return types;
}

/** Reads a type declaration, or answers null when the declaration is a member. */
function readTypeDeclaration(read, doc, namespace, path, line, where) {
  const { modifiers: found, rest } = takeModifiers(
    stripAttributes(read.signature),
  );
  const keyword = /^([A-Za-z]+)\b/.exec(rest);
  if (!keyword || !typeKeywords.has(keyword[1])) return null;

  const head = rest
    .slice(keyword[1].length)
    .split(/\bwhere\b/)[0]
    .trim();
  const parenthesis = parameterListParen(head);
  const nameText =
    parenthesis === -1
      ? splitTopLevel(head, ":")[0]
      : head.slice(0, parenthesis);
  const { name, typeParameters } = splitGenerics(nameText);
  const primaryParameters =
    parenthesis === -1
      ? []
      : parseParameterList(
          head.slice(parenthesis + 1, matchingParen(head, parenthesis)),
          where,
        );

  return {
    kind: keyword[1],
    name,
    typeParameters,
    primaryParameters,
    modifiers: found,
    namespace,
    file: path,
    line,
    docs: doc.length > 0 ? [doc] : [],
    members: [],
  };
}

/** Every `.cs` file under a directory, in a stable order. */
async function sourceFiles(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".cs"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/**
 * The published types of the .NET library, grouped by the namespace that holds them.
 *
 * A namespace ending in `.Internal` is the library's own workings and is not published,
 * which is the rule `excludeInternal` applies to the TypeScript reference.
 */
export async function readDotnetApi({ sourceRoot, repositoryRoot }) {
  const declarations = [];
  for (const file of await sourceFiles(sourceRoot)) {
    const text = await readFile(file, "utf8");
    declarations.push(...readSourceFile(text, relative(repositoryRoot, file)));
  }

  const published = declarations.filter(
    (type) =>
      type.modifiers.includes("public") &&
      type.namespace.startsWith("EliteDangerousAlmanac") &&
      !type.namespace.endsWith(".Internal") &&
      type.namespace !== "EliteDangerousAlmanac",
  );

  // Partial declarations are one type. The part in `<TypeName>.cs` is the one the
  // reference is written from — the parts beside it are named for what they add, and
  // say so with `<content>` or a `<summary>` of their own — so it leads and the rest
  // follow in file order.
  const parts = new Map();
  for (const type of published) {
    const key = `${type.namespace}.${type.name}\`${type.typeParameters.length}`;
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key).push(type);
  }

  const merged = new Map();
  for (const [key, group] of parts) {
    const primary =
      group.find((type) => type.file.endsWith(`/${type.name}.cs`)) ??
      group.find((type) => type.docs[0]?.includes("<summary>")) ??
      group[0];
    const others = group.filter((type) => type !== primary);
    primary.docs = [...primary.docs, ...others.flatMap((type) => type.docs)];
    primary.members = group.flatMap((type) => type.members);
    merged.set(key, primary);
  }

  const namespaces = new Map();
  for (const type of [...merged.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const area = type.namespace.slice("EliteDangerousAlmanac.".length);
    if (!namespaces.has(area)) namespaces.set(area, { name: area, types: [] });
    namespaces.get(area).types.push(type);
  }
  return new Map([...namespaces].sort(([a], [b]) => a.localeCompare(b)));
}
