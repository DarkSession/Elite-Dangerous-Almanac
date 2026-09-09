// Turns a C# `///` documentation comment into the Markdown the wiki pages carry.
//
// The compiler's own XML file is not the input here, because it states a member by its
// documentation id and drops every signature. The generator reads the source instead
// (`dotnet-source.mjs`), which means the doc comment arrives as the raw XML fragment the
// author wrote, and this module is what reads it.
//
// The reader is deliberately small: it accepts the tag vocabulary the library uses and
// throws on anything else, so a doc comment written with a tag nothing renders fails the
// documentation build rather than reaching the wiki as dropped prose.

/** Every documentation tag this renderer knows how to place. */
const blockTags = new Set([
  "summary",
  // What one part of a partial type adds. The compiler's own tag for it, and the reason
  // a partial declaration beyond the first is documented at all.
  "content",
  "remarks",
  "returns",
  "value",
  "example",
  "param",
  "typeparam",
  "exception",
  "seealso",
  "inheritdoc",
]);

const inlineTags = new Set([
  "c",
  "code",
  "para",
  "see",
  "paramref",
  "typeparamref",
  "b",
  "i",
  "em",
  "strong",
  "list",
  "item",
  "term",
  "description",
  "br",
]);

const entities = new Map([
  ["lt", "<"],
  ["gt", ">"],
  ["amp", "&"],
  ["quot", '"'],
  ["apos", "'"],
]);

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#"))
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    const decoded = entities.get(body);
    if (decoded === undefined) throw new Error(`unknown XML entity "${whole}"`);
    return decoded;
  });
}

/**
 * The doc comment as a tree of `{ tag, attributes, children }` element nodes and plain
 * strings. The comment is a fragment rather than a document, so the parse starts and ends
 * at the top level with however many siblings the author wrote.
 */
export function parseXmlDoc(xml, where) {
  const root = { tag: null, attributes: {}, children: [] };
  const open = [root];
  const fail = (message) => {
    throw new Error(`${where}: ${message}`);
  };
  let index = 0;

  while (index < xml.length) {
    const next = xml.indexOf("<", index);
    if (next === -1) {
      appendText(open.at(-1), xml.slice(index));
      break;
    }
    appendText(open.at(-1), xml.slice(index, next));

    const end = xml.indexOf(">", next);
    if (end === -1) fail("an unterminated XML tag");
    const raw = xml.slice(next + 1, end);
    index = end + 1;

    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim();
      const current = open.at(-1);
      if (current.tag !== name) {
        fail(`</${name}> closes <${current.tag ?? "nothing"}>`);
      }
      open.pop();
      continue;
    }

    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const match = /^([\w-]+)((?:\s+[\w-]+\s*=\s*"[^"]*")*)\s*$/.exec(body);
    if (!match) fail(`an XML tag this reader cannot parse: <${raw}>`);
    const [, tag, attributeText] = match;
    if (!blockTags.has(tag) && !inlineTags.has(tag)) {
      fail(`an unsupported documentation tag <${tag}>`);
    }

    const attributes = {};
    for (const attribute of attributeText.matchAll(
      /([\w-]+)\s*=\s*"([^"]*)"/g,
    )) {
      attributes[attribute[1]] = decodeEntities(attribute[2]);
    }

    const node = { tag, attributes, children: [] };
    open.at(-1).children.push(node);
    // `<br>` carries no content in this vocabulary, so it never opens a scope.
    if (!selfClosing && tag !== "br") open.push(node);
  }

  if (open.length !== 1) fail(`an unclosed <${open.at(-1).tag}>`);
  return root.children;
}

function appendText(parent, text) {
  if (text.length > 0) parent.children.push(decodeEntities(text));
}

/**
 * Markdown-escape prose. Doc comments write identifiers inside `<c>` or `<see>`, so the
 * text around them is ordinary English: the characters worth escaping are the ones that
 * would otherwise start a construct — a stray `<` opening an HTML tag above all.
 */
function escapeText(text) {
  return text.replace(
    /[<>&]/g,
    (character) => `&${{ "<": "lt", ">": "gt", "&": "amp" }[character]};`,
  );
}

/** Collapse the line wrapping of a doc comment; a paragraph break is `<para>`, not a newline. */
function collapse(text) {
  return text.replace(/\s+/g, " ");
}

/**
 * Renders a run of nodes to inline Markdown. `resolve` turns a `cref` into the link text
 * the surrounding page should show, which is what keeps cross-references working when a
 * symbol moves between pages.
 */
function inline(nodes, resolve) {
  let out = "";
  for (const node of nodes) {
    if (typeof node === "string") {
      out += escapeText(collapse(node));
      continue;
    }
    switch (node.tag) {
      case "c":
        out += `\`${plain(node.children)}\``;
        break;
      case "b":
      case "strong":
        out += `**${inline(node.children, resolve).trim()}**`;
        break;
      case "i":
      case "em":
        out += `*${inline(node.children, resolve).trim()}*`;
        break;
      case "see":
      case "seealso":
        out += reference(node, resolve);
        break;
      case "paramref":
      case "typeparamref":
        out += `\`${node.attributes.name}\``;
        break;
      case "br":
        out += "\n";
        break;
      default:
        throw new Error(
          `<${node.tag}> is a block element and cannot render inline`,
        );
    }
  }
  return out;
}

/** The text of a run with no Markdown at all, for the inside of a code span. */
function plain(nodes) {
  let out = "";
  for (const node of nodes) {
    if (typeof node === "string") out += collapse(node);
    else if (node.tag === "paramref" || node.tag === "typeparamref")
      out += node.attributes.name;
    else if (node.tag === "see")
      out += node.attributes.cref ?? node.attributes.langword ?? "";
    else out += plain(node.children);
  }
  return out;
}

function reference(node, resolve) {
  const { cref, langword, href } = node.attributes;
  if (langword !== undefined) return `\`${langword}\``;
  if (href !== undefined) {
    const text = inline(node.children, resolve).trim();
    return `[${text.length > 0 ? text : href}](${href})`;
  }
  if (cref === undefined)
    throw new Error("<see> carries neither cref, langword nor href");
  return resolve(cref);
}

/**
 * Renders a run of nodes as block Markdown: an array of lines, with `<para>`, `<code>` and
 * `<list>` each starting a block of their own and everything else joining the paragraph
 * being built.
 */
export function renderDoc(nodes, resolve) {
  const blocks = [];
  let paragraph = [];

  const flush = () => {
    const text = paragraph.join("").trim();
    if (text.length > 0) blocks.push(text);
    paragraph = [];
  };

  for (const node of nodes) {
    if (typeof node === "string") {
      paragraph.push(escapeText(collapse(node)));
      continue;
    }
    switch (node.tag) {
      case "para":
        flush();
        blocks.push(inline(node.children, resolve).trim());
        break;
      case "code":
        flush();
        blocks.push(codeBlock(node));
        break;
      case "list":
        flush();
        blocks.push(list(node, resolve));
        break;
      default:
        paragraph.push(inline([node], resolve));
    }
  }
  flush();
  return blocks.filter((block) => block.length > 0);
}

/**
 * A `<code>` block keeps its source layout, so the shared indentation the doc comment
 * carried is stripped and nothing else is touched.
 */
function codeBlock(node) {
  const text = node.children
    .map((child) => (typeof child === "string" ? child : plain([child])))
    .join("");
  const lines = text.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => /^ */.exec(line)[0].length);
  const shared = indents.length > 0 ? Math.min(...indents) : 0;
  return ["```csharp", ...lines.map((line) => line.slice(shared)), "```"].join(
    "\n",
  );
}

function list(node, resolve) {
  const items = node.children.filter((child) => typeof child !== "string");
  return items
    .map((item) => {
      if (item.tag !== "item") throw new Error(`<list> holds a <${item.tag}>`);
      const parts = item.children.filter((child) => typeof child !== "string");
      const term = parts.find((part) => part.tag === "term");
      const description = parts.find((part) => part.tag === "description");
      const head = term
        ? `**${inline(term.children, resolve).trim()}** — `
        : "";
      const body = description
        ? inline(description.children, resolve).trim()
        : inline(item.children, resolve).trim();
      return `- ${head}${body}`;
    })
    .join("\n");
}

/**
 * The documentation of one declaration, bucketed by tag. Every block tag the library uses
 * is read here, so a tag that stops being rendered stops being accepted at the same time.
 */
export function readDocComment(xml, where) {
  const nodes = parseXmlDoc(xml, where);
  const doc = {
    summary: [],
    content: [],
    remarks: [],
    returns: [],
    value: [],
    example: [],
    params: new Map(),
    typeParams: new Map(),
    exceptions: [],
    seeAlso: [],
    inheritsDoc: false,
  };

  for (const node of nodes) {
    if (typeof node === "string") {
      if (node.trim().length > 0)
        throw new Error(`${where}: prose outside a documentation tag`);
      continue;
    }
    switch (node.tag) {
      // A partial type is documented across its parts: one carries the `<summary>`
      // and the others say what they add, with `<summary>` or `<content>` of their
      // own. Each is a paragraph under the first, never a replacement for it.
      case "summary":
        if (doc.summary.length === 0) doc.summary = node.children;
        else doc.content.push(node.children);
        break;
      case "content":
        doc.content.push(node.children);
        break;
      case "remarks":
        doc.remarks.push(node.children);
        break;
      case "returns":
        doc.returns = node.children;
        break;
      case "value":
        doc.value = node.children;
        break;
      case "example":
        doc.example = node.children;
        break;
      case "param":
        doc.params.set(node.attributes.name, node.children);
        break;
      case "typeparam":
        doc.typeParams.set(node.attributes.name, node.children);
        break;
      case "exception":
        doc.exceptions.push({
          cref: node.attributes.cref,
          nodes: node.children,
        });
        break;
      case "seealso":
        doc.seeAlso.push(node);
        break;
      case "inheritdoc":
        doc.inheritsDoc = true;
        break;
      default:
        throw new Error(
          `${where}: <${node.tag}> is not a documentation section`,
        );
    }
  }
  return doc;
}

export const renderInline = inline;
