import assert from "node:assert/strict";
import test from "node:test";

import { readDocComment, renderDoc, renderInline } from "./xml-doc.mjs";

/** Resolves a cross-reference to the name it states, so a test reads what was linked. */
const name = (cref) => `<${cref}>`;

function summary(xml) {
  return renderDoc(readDocComment(xml, "Test").summary, name);
}

test("collapses the line wrapping a doc comment carries", () => {
  assert.deepEqual(summary("<summary>One\nsentence\nwrapped.</summary>"), [
    "One sentence wrapped.",
  ]);
});

test("gives each <para> a block of its own", () => {
  assert.deepEqual(
    summary("<summary><para>First.</para><para>Second.</para></summary>"),
    ["First.", "Second."],
  );
});

test("renders the inline vocabulary", () => {
  assert.deepEqual(
    summary(
      "<summary>A <c>Slot01_Size7</c> is <b>fitted</b>, <em>not</em> " +
        '<see langword="null"/>, and <paramref name="symbol"/> names it.</summary>',
    ),
    ["A `Slot01_Size7` is **fitted**, *not* `null`, and `symbol` names it."],
  );
});

test("hands every cref to the resolver", () => {
  assert.deepEqual(
    summary('<summary>See <see cref="MassCode.Of"/>.</summary>'),
    ["See <MassCode.Of>."],
  );
});

test("escapes prose that would otherwise read as markup", () => {
  assert.deepEqual(summary("<summary>A &lt;T&gt; &amp; a value.</summary>"), [
    "A &lt;T&gt; &amp; a value.",
  ]);
});

test("renders <code> as a fenced C# block, without its comment indentation", () => {
  assert.deepEqual(
    renderDoc(
      readDocComment(
        "<example>\n<code>\n    if (x)\n    {\n        Y();\n    }\n</code>\n</example>",
        "Test",
      ).example,
      name,
    ),
    ["```csharp\nif (x)\n{\n    Y();\n}\n```"],
  );
});

test("renders a <list> as bullets, with a term where one is given", () => {
  assert.deepEqual(
    summary(
      "<summary><list><item><term>One</term><description>First.</description></item>" +
        "<item><description>Second.</description></item></list></summary>",
    ),
    ["- **One** — First.\n- Second."],
  );
});

test("buckets every block tag it accepts", () => {
  const doc = readDocComment(
    "<summary>Does it.</summary>" +
      '<param name="symbol">The symbol.</param>' +
      '<typeparam name="T">The value.</typeparam>' +
      "<returns>The result.</returns>" +
      '<exception cref="ArgumentNullException">It was null.</exception>' +
      "<remarks>Immutable.</remarks>",
    "Test",
  );
  assert.deepEqual([...doc.params.keys()], ["symbol"]);
  assert.deepEqual([...doc.typeParams.keys()], ["T"]);
  assert.equal(doc.exceptions[0].cref, "ArgumentNullException");
  assert.deepEqual(renderDoc(doc.returns, name), ["The result."]);
  assert.equal(doc.remarks.length, 1);
});

test("keeps a partial type's <content> under the summary rather than replacing it", () => {
  const doc = readDocComment(
    "<summary>A build.</summary><content>The edits it accepts.</content>",
    "Test",
  );
  assert.deepEqual(renderDoc(doc.summary, name), ["A build."]);
  assert.deepEqual(
    doc.content.map((nodes) => renderDoc(nodes, name)),
    [["The edits it accepts."]],
  );
});

test("refuses a tag nothing renders", () => {
  assert.throws(
    () => readDocComment("<summary>A <table>row</table>.</summary>", "Test"),
    /unsupported documentation tag <table>/,
  );
});

test("refuses a comment whose tags do not nest", () => {
  assert.throws(
    () => readDocComment("<summary>Unclosed.", "Test"),
    /an unclosed <summary>/,
  );
});

test("renders inline runs without the surrounding block", () => {
  assert.equal(
    renderInline(
      readDocComment("<returns>A <c>Hull</c>.</returns>", "Test").returns,
      name,
    ),
    "A `Hull`.",
  );
});
