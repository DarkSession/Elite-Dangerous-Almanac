#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stripJsonComments } from "../../../typescript/scripts/jsonc.mjs";

const usage = `Usage:
  node scripts/data/ships/merge-normalized-catalogues.mjs \\
    --ship-identities <jsonc> --ship-stats <jsonc> --ship-slots <jsonc> \\
    --core-identities <jsonc> --core-stats <jsonc> \\
    --internal-identities <jsonc> --internal-stats <jsonc> \\
    --hardpoint-identities <jsonc> --hardpoint-stats <jsonc> \\
    --utility-identities <jsonc> --utility-stats <jsonc> \\
    --out <data/ships>

Inputs are the normalized identity/stat/slot arrays described in
scripts/data/ships/README.md. Existing output files supply their attribution
headers; the script replaces only their strict-JSON payloads.`;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(usage);
    args.set(key.slice(2), value);
  }
  return args;
}

async function readArray(path) {
  const parsed = JSON.parse(
    stripJsonComments(await readFile(resolve(path), "utf8")),
  );
  if (!Array.isArray(parsed))
    throw new TypeError(`${path}: expected a top-level array`);
  return parsed;
}

function indexBySymbol(records, label) {
  const index = new Map();
  for (const record of records) {
    if (
      typeof record !== "object" ||
      record === null ||
      typeof record.symbol !== "string"
    ) {
      throw new TypeError(`${label}: every record needs a string symbol`);
    }
    const key = record.symbol.toLowerCase();
    if (index.has(key))
      throw new Error(`${label}: duplicate symbol ${record.symbol}`);
    index.set(key, record);
  }
  return index;
}

function join(identityRecords, additions, additionLabels) {
  const indexes = additions.map((records, i) =>
    indexBySymbol(records, additionLabels[i] ?? `addition ${i + 1}`),
  );
  const identities = indexBySymbol(identityRecords, "identities");
  for (let i = 0; i < indexes.length; i++) {
    for (const record of additions[i]) {
      if (!identities.has(record.symbol.toLowerCase())) {
        throw new Error(
          `${additionLabels[i] ?? `addition ${i + 1}`}: unmatched symbol ${record.symbol}`,
        );
      }
    }
  }

  return identityRecords.map((identity) => {
    const key = identity.symbol.toLowerCase();
    const merged = { ...identity };
    for (const index of indexes) {
      const addition = index.get(key);
      if (!addition) continue;
      for (const [field, value] of Object.entries(addition)) {
        if (field !== "symbol" && field !== "name") merged[field] = value;
      }
    }
    return merged;
  });
}

async function writeJsonc(path, records) {
  const absolute = resolve(path);
  const current = await readFile(absolute, "utf8");
  const header = current.match(/^\/\*[\s\S]*?\*\/\s*/)?.[0];
  if (!header)
    throw new Error(
      `${path}: existing output needs an attribution comment header`,
    );
  await writeFile(absolute, `${header}${JSON.stringify(records, null, 2)}\n`);
}

const args = parseArgs(process.argv.slice(2));
const required = [
  "ship-identities",
  "ship-stats",
  "ship-slots",
  "core-identities",
  "core-stats",
  "internal-identities",
  "internal-stats",
  "hardpoint-identities",
  "hardpoint-stats",
  "utility-identities",
  "utility-stats",
  "out",
];
for (const name of required) {
  if (!args.has(name)) throw new Error(`Missing --${name}\n\n${usage}`);
}

const out = resolve(args.get("out"));
const shipIdentities = await readArray(args.get("ship-identities"));
const ships = join(
  shipIdentities,
  [
    await readArray(args.get("ship-stats")),
    await readArray(args.get("ship-slots")),
  ],
  ["ship stats", "ship slots"],
);
await writeJsonc(resolve(out, "ships.jsonc"), ships);

for (const category of ["core", "internal", "hardpoint", "utility"]) {
  const identities = await readArray(args.get(`${category}-identities`));
  const stats = await readArray(args.get(`${category}-stats`));
  await writeJsonc(
    resolve(out, `modules-${category}.jsonc`),
    join(identities, [stats], [`${category} module stats`]),
  );
}
