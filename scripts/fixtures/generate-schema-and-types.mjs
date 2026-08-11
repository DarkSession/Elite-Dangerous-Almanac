#!/usr/bin/env node

/**
 * Generate the shared fixture schema and TypeScript import declarations.
 *
 * Fixtures are the source of truth. Structurally similar captures are inferred as one
 * family so a port validates journals, SLEF envelopes and community builds against the
 * same contract. All other fixtures form a single-file family. Generated artefacts are
 * checked in so non-TypeScript implementations can consume the schema without running
 * this script.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { stripJsonComments } from "../../typescript/scripts/jsonc.mjs";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const FIXTURE_ROOT = join(REPOSITORY_ROOT, "fixtures");
const SCHEMA_PATH = join(REPOSITORY_ROOT, "schemas/fixtures.schema.json");
const TYPES_PATH = join(
  REPOSITORY_ROOT,
  "typescript/src/fixtures.generated.d.ts",
);
const require = createRequire(join(REPOSITORY_ROOT, "typescript/package.json"));
const { format } = require("prettier");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(path) : [path];
    }),
  );
  return files.flat().sort();
}

function nameFromFile(file) {
  return file
    .replace(/\.jsonc$/, "")
    .split(/[^a-zA-Z0-9]+/)
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join("");
}

function familyName(file) {
  if (/^ships\/builds\/(?!index\.jsonc$)/.test(file)) return "shipsBuild";
  if (/^ships\/journal-/.test(file)) return "shipsJournalLoadout";
  if (/^ships\/(?:slef-inara-|slef-the-deep-black\.jsonc$)/.test(file)) {
    return "shipsSlefEnvelope";
  }
  return nameFromFile(file);
}

function valueKind(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number")
    return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function groupBy(values, keyFor) {
  const groups = new Map();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}

function inferSchema(values) {
  assert.ok(values.length > 0);
  const byKind = groupBy(values, valueKind);

  if (byKind.has("number") && byKind.has("integer")) {
    byKind.set("number", [...byKind.get("number"), ...byKind.get("integer")]);
    byKind.delete("integer");
  }

  if (byKind.size > 1) {
    return {
      anyOf: [...byKind.values()].map((members) => inferSchema(members)),
    };
  }

  const [[kind, members]] = byKind;
  switch (kind) {
    case "null":
    case "boolean":
    case "string":
    case "integer":
    case "number":
      return { type: kind };
    case "array": {
      const items = members.flat();
      if (items.length === 0) {
        return { type: "array", maxItems: 0, items: false };
      }
      return {
        type: "array",
        items: inferSchema(items),
      };
    }
    case "object": {
      const objects = members;
      const keys = [
        ...new Set(objects.flatMap((value) => Object.keys(value))),
      ].sort();
      const required = keys.filter((key) =>
        objects.every((value) => Object.hasOwn(value, key)),
      );
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(
          keys.map((key) => [
            key,
            inferSchema(
              objects
                .filter((value) => Object.hasOwn(value, key))
                .map((value) => value[key]),
            ),
          ]),
        ),
      };
      if (required.length > 0) schema.required = required;
      return schema;
    }
    default:
      throw new Error(`Unsupported fixture value kind: ${kind}`);
  }
}

function visitChildren(schema, visit) {
  for (const member of schema.anyOf ?? []) visit(member);
  if (schema.items && Object.keys(schema.items).length > 0) visit(schema.items);
  for (const property of Object.values(schema.properties ?? {}))
    visit(property);
}

function deduplicateSchemas(familySchemas) {
  const occurrences = new Map();
  function count(schema) {
    const canonical = JSON.stringify(schema);
    const occurrence = occurrences.get(canonical);
    if (occurrence) occurrence.count += 1;
    else occurrences.set(canonical, { count: 1, schema });
    visitChildren(schema, count);
  }
  for (const schema of Object.values(familySchemas))
    visitChildren(schema, count);

  const sharedByCanonical = new Map(
    [...occurrences.entries()]
      .filter(
        ([canonical, occurrence]) =>
          occurrence.count > 1 && canonical.length >= 80,
      )
      .map(([canonical]) => [
        canonical,
        `shared${createHash("sha256").update(canonical).digest("hex").slice(0, 12)}`,
      ]),
  );

  function rewrite(schema, keepCanonical) {
    const canonical = JSON.stringify(schema);
    const shared = sharedByCanonical.get(canonical);
    if (shared && canonical !== keepCanonical)
      return { $ref: `#/definitions/${shared}` };
    if (schema.anyOf) {
      return {
        ...schema,
        anyOf: schema.anyOf.map((member) => rewrite(member)),
      };
    }
    if (schema.type === "array" && Object.keys(schema.items).length > 0) {
      return { ...schema, items: rewrite(schema.items) };
    }
    if (schema.type === "object") {
      return {
        ...schema,
        properties: Object.fromEntries(
          Object.entries(schema.properties ?? {}).map(([name, value]) => [
            name,
            rewrite(value),
          ]),
        ),
      };
    }
    return schema;
  }

  const definitions = Object.fromEntries(
    Object.entries(familySchemas).map(([name, schema]) => [
      name,
      rewrite(schema),
    ]),
  );
  for (const [canonical, name] of [...sharedByCanonical.entries()].sort(
    (left, right) => left[1].localeCompare(right[1]),
  )) {
    definitions[name] = rewrite(occurrences.get(canonical).schema, canonical);
  }
  return definitions;
}

function typeName(name) {
  return `Fixture${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
}

function propertyName(name) {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function schemaType(schema, depth = 0) {
  if (schema === false) return "never";
  if (schema.anyOf)
    return schema.anyOf.map((member) => schemaType(member, depth)).join(" | ");
  if (Object.keys(schema).length === 0) return "unknown";
  switch (schema.type) {
    case "null":
      return "null";
    case "boolean":
    case "string":
    case "number":
    case "integer":
      return schema.type === "integer" ? "number" : schema.type;
    case "array": {
      const item = schemaType(schema.items, depth);
      return / \| /.test(item) ? `(${item})[]` : `${item}[]`;
    }
    case "object": {
      const required = new Set(schema.required ?? []);
      const indent = "    ".repeat(depth);
      const childIndent = "    ".repeat(depth + 1);
      const properties = Object.entries(schema.properties ?? {}).map(
        ([name, value]) => {
          const optional = required.has(name) ? "" : "?";
          return `${childIndent}${propertyName(name)}${optional}: ${schemaType(value, depth + 1)};`;
        },
      );
      return properties.length === 0
        ? "Record<string, never>"
        : `{\n${properties.join("\n")}\n${indent}}`;
    }
    default:
      throw new Error(`Unsupported fixture schema: ${JSON.stringify(schema)}`);
  }
}

function generatedTypes(families) {
  const lines = [
    "/**",
    " * Generated fixture import types. Do not edit by hand.",
    " *",
    " * Run `npm run generate:fixtures` from `typescript/` after changing a fixture.",
    " */",
    "",
  ];

  for (const family of families) {
    if (family.name === "shipsBuild") continue;
    for (const fixture of family.fixtures) {
      const name = nameFromFile(fixture.file);
      lines.push(
        `type ${typeName(name)} = ${schemaType(inferSchema([fixture.value]))};`,
        "",
        `declare module '*/fixtures/${fixture.file}' {`,
        `    const value: ${typeName(name)};`,
        "    export default value;",
        "}",
        "",
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function generatedOutputs() {
  const paths = (await filesBelow(FIXTURE_ROOT)).filter((file) =>
    file.endsWith(".jsonc"),
  );
  const payloads = await Promise.all(
    paths.map(async (path) => ({
      file: relative(FIXTURE_ROOT, path).replaceAll("\\", "/"),
      value: JSON.parse(stripJsonComments(await readFile(path, "utf8"))),
    })),
  );
  const grouped = groupBy(payloads, ({ file }) => familyName(file));
  const families = [...grouped.entries()]
    .map(([name, fixtures]) => ({
      name,
      files: fixtures.map(({ file }) => file).sort(),
      fixtures: fixtures.sort((left, right) =>
        left.file.localeCompare(right.file),
      ),
      values: fixtures.map(({ value }) => value),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const familySchemas = Object.fromEntries(
    families.map((family) => [family.name, inferSchema(family.values)]),
  );
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://elite-dangerous-almanac.dev/schemas/fixtures.schema.json",
    title: "Elite Dangerous Almanac shared fixture schemas",
    description:
      "Generated language-neutral structural schemas for every JSONC payload in fixtures/.",
    "x-fixture-families": families.map(({ name, files }) => ({
      definition: name,
      files,
    })),
    definitions: deduplicateSchemas(familySchemas),
  };
  return {
    schema: await format(JSON.stringify(schema), {
      parser: "json",
      tabWidth: 2,
    }),
    types: await format(generatedTypes(families), {
      parser: "typescript",
      printWidth: 100,
      singleQuote: true,
      tabWidth: 4,
    }),
  };
}

async function checkFile(path, expected) {
  let actual;
  try {
    actual = await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") actual = "";
    else throw error;
  }
  assert.equal(
    actual,
    expected,
    `${relative(REPOSITORY_ROOT, path)} is stale; run npm run generate:fixtures`,
  );
}

const outputs = await generatedOutputs();
if (process.argv.includes("--check")) {
  await Promise.all([
    checkFile(SCHEMA_PATH, outputs.schema),
    checkFile(TYPES_PATH, outputs.types),
  ]);
} else {
  await Promise.all([
    writeFile(SCHEMA_PATH, outputs.schema),
    writeFile(TYPES_PATH, outputs.types),
  ]);
  console.log(`generated ${relative(REPOSITORY_ROOT, SCHEMA_PATH)}`);
  console.log(`generated ${relative(REPOSITORY_ROOT, TYPES_PATH)}`);
}
