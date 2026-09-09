import assert from "node:assert/strict";
import test from "node:test";

import { escapeLinkText } from "./dotnet-api.mjs";
import { unescape } from "./sidebar.mjs";

test("escapes the markers that would read as emphasis in a link's text", () => {
  assert.equal(escapeLinkText("REAL_NEBULAE"), "REAL\\_NEBULAE");
  assert.equal(escapeLinkText("a*b"), "a\\*b");
});

test("escapes a backslash, so the escape beside it stays an escape", () => {
  assert.equal(escapeLinkText("a\\_b"), "a\\\\\\_b");
  assert.equal(escapeLinkText("\\"), "\\\\");
});

test("leaves text carrying neither alone", () => {
  assert.equal(escapeLinkText("CalculationResult"), "CalculationResult");
});

test("round-trips through the unescaping the sidebar reads names back with", () => {
  for (const name of ["REAL_NEBULAE", "a*b", "a\\_b", "\\", "Plain"]) {
    assert.equal(unescape(escapeLinkText(name)), name, name);
  }
});
