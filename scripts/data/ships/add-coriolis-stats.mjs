#!/usr/bin/env node

/**
 * Enrichment pass that joins the *defence*, *power* and *weapon* stats onto the
 * checked-in ship and module catalogues.
 *
 * `merge-normalized-catalogues.mjs` performs the identity/stat join that builds the
 * catalogues; this script is the additive follow-up that widened them with the fields
 * the build calculations (power budget, shield and armour metrics, weapon DPS) need.
 * It is **additive and idempotent**: existing fields are never overwritten, records
 * keep their key order, and new keys are inserted immediately before `cost` so the
 * price stays last. Re-running it against the same upstream revision is a no-op.
 *
 * Upstream: EDCD/coriolis-data (`modules/**\/*.json`, `ships/*.json`). The stat values
 * are Elite Dangerous game data, the property of Frontier Developments plc. Records
 * upstream does not carry are filled from the tables in MANUAL_* below, each of which
 * documents where its values come from; every fill is also recorded in
 * `data/ships/SOURCES.md`.
 *
 * Usage:
 *   node scripts/data/ships/add-coriolis-stats.mjs \
 *     --coriolis <path to a coriolis-data checkout> \
 *     --out data/ships
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { stripJsonComments } from "../../../typescript/scripts/jsonc.mjs";

const usage = `Usage:
  node scripts/data/ships/add-coriolis-stats.mjs \\
    --coriolis <path to a coriolis-data checkout> \\
    --out <data/ships>`;

/**
 * Upstream field -> library field, with the converter that normalizes the value.
 * Order here is the order new keys are appended to a record.
 */
const MODULE_FIELDS = [
  // ── Defence ──────────────────────────────────────────────────────────────
  ["kinres", "kineticResistance", (v) => v],
  ["thermres", "thermalResistance", (v) => v],
  ["explres", "explosiveResistance", (v) => v],
  ["causres", "causticResistance", (v) => v],
  ["hullreinforcement", "hullReinforcement", (v) => v],
  ["shieldaddition", "shieldAddition", (v) => v],
  ["protection", "moduleProtection", (v) => v],
  // ── Power ────────────────────────────────────────────────────────────────
  ["passive", "alwaysPowered", (v) => (v ? true : undefined)],
  // ── Weapons ──────────────────────────────────────────────────────────────
  ["damage", "damage", (v) => v],
  ["damagedist", "damageDistribution", damageDistribution],
  // Upstream stores 0 on two Shock Cannon variants where the weapon plainly fires one
  // round per shot; its own DPS code reads the field as `roundspershot || 1`. A zero
  // here would zero the DPS, so drop it and let the calculation default to 1.
  ["roundspershot", "roundsPerShot", (v) => (v > 0 ? v : undefined)],
  [null, "rateOfFire", null], // derived; see rateOfFire()
  ["fireint", "burstInterval", (v) => v],
  ["burst", "burstRounds", (v) => v],
  // A zero burst rate is upstream noise on a weapon that fires one shot per burst.
  ["burstrof", "burstRateOfFire", (v) => (v > 0 ? v : undefined)],
  ["charge", "chargeTime", (v) => v],
  ["clip", "clipSize", (v) => v],
  ["ammo", "ammoMaximum", (v) => v],
  ["reload", "reloadTime", (v) => v],
  ["distdraw", "distributorDraw", (v) => v],
  ["thermload", "thermalLoad", (v) => v],
  ["piercing", "armourPiercing", (v) => v],
  ["range", "maximumRange", (v) => v],
  ["falloff", "falloffRange", (v) => v],
  ["shotspeed", "shotSpeed", (v) => v],
  ["jitter", "jitter", (v) => v],
];

/**
 * Fields taken only from the two hardpoint-mounted categories.
 *
 * Upstream's `range` is a distance in **metres** for anything that mounts on a
 * hardpoint, but a sensor range in kilometres and a limpet-controller range in its own
 * units elsewhere. Rather than ship one field with three units, the range fields are
 * limited to the categories where the unit is unambiguous.
 */
const HARDPOINT_ONLY_FIELDS = new Set(["maximumRange", "falloffRange"]);
const HARDPOINT_CATEGORIES = new Set(["hardpoint", "utility"]);

/** Upstream damage-distribution key -> library key, in output order. */
const DAMAGE_TYPES = [
  ["K", "kinetic"],
  ["T", "thermal"],
  ["E", "explosive"],
  ["A", "absolute"],
  ["X", "antiXeno"],
];

/**
 * Bulkhead stats, upstream field -> library field, in output order.
 *
 * Armour is the one ship-specific module, and upstream keeps it on the *hull* record
 * rather than in its module catalogue. This library keeps every module's stats on the
 * module, so a hull's bulkhead stats land on its `<Hull>_Armour_*` records in
 * `modules-core.jsonc`, joined by the hull and the symbol's grade suffix.
 */
const BULKHEAD_FIELDS = [
  ["mass", "mass"],
  ["hullboost", "hullBoost"],
  ["kinres", "kineticResistance"],
  ["thermres", "thermalResistance"],
  ["explres", "explosiveResistance"],
  ["causres", "causticResistance"],
];

/**
 * Armour symbol suffix -> its position in the hull's bulkhead list. The Caspian
 * Explorer is the one hull with six options: its stock Lightweight Alloy leads the
 * list, ahead of the five Mk II Ablative grades.
 */
const BULKHEAD_SUFFIXES = [
  ["_armour_grade1_default", 0, 0],
  ["_armour_grade1", 1, 0],
  ["_armour_grade2", 2, 1],
  ["_armour_grade3", 3, 2],
  ["_armour_mirrored", 4, 3],
  ["_armour_reactive", 5, 4],
];

/** Where a hull's armour variant sits in its bulkhead list, or `null` if unrecognised. */
function bulkheadIndex(symbol, count) {
  const normalized = symbol.toLowerCase();
  for (const [suffix, sixIndex, fiveIndex] of BULKHEAD_SUFFIXES) {
    if (normalized.endsWith(suffix)) return count === 6 ? sixIndex : fiveIndex;
  }
  return null;
}

/**
 * Modules upstream does not carry, filled from a documented uniformity.
 *
 * `Int_ShieldGenerator_Size1_Class4` was added from EDSY in the 2026-08-01 pass and
 * so has no coriolis-data record. Every one of the 55 shield generators coriolis does
 * carry — regular, bi-weave and prismatic, every size and rating — has the same
 * resistances and distributor draw, so this variant's are not in doubt.
 */
const MANUAL_MODULE_STATS = {
  int_shieldgenerator_size1_class4: {
    kineticResistance: 0.4,
    thermalResistance: -0.2,
    explosiveResistance: 0.5,
    distributorDraw: 0.6,
  },
  // The cargo hatch is fitted to every hull and cannot be removed, so upstream keeps
  // it as a hard-coded module (ModuleUtils.cargoHatch: class 1, rating H, power 0.6)
  // rather than a catalogue entry. Its draw belongs in the power budget.
  modularcargobaydoor: { powerDraw: 0.6 },
};

/**
 * Bulkheads upstream does not carry, filled from a documented uniformity.
 *
 * The Lynx Highliner (`MediumTransport01`) post-dates the coriolis-data snapshot. Every
 * one of the 47 hulls coriolis does carry gives identical hull boost and resistances for
 * a given bulkhead grade, so the grade table below applies to it too. The *masses* are
 * the Lynx's own, from EDSY's ship data (see `data/ships/SOURCES.md`); every other hull
 * takes its masses from upstream.
 */
const MANUAL_BULKHEAD_STATS = {
  "Lightweight Alloy": {
    mass: 0,
    hullBoost: 0.8,
    kineticResistance: -0.2,
    thermalResistance: 0,
    explosiveResistance: -0.4,
    causticResistance: 0,
  },
  "Reinforced Alloy": {
    mass: 26,
    hullBoost: 1.52,
    kineticResistance: -0.2,
    thermalResistance: 0,
    explosiveResistance: -0.4,
    causticResistance: 0,
  },
  "Military Grade Composite": {
    mass: 53,
    hullBoost: 2.5,
    kineticResistance: -0.2,
    thermalResistance: 0,
    explosiveResistance: -0.4,
    causticResistance: 0,
  },
  "Mirrored Surface Composite": {
    mass: 53,
    hullBoost: 2.5,
    kineticResistance: -0.75,
    thermalResistance: 0.5,
    explosiveResistance: -0.5,
    causticResistance: 0,
  },
  "Reactive Surface Composite": {
    mass: 53,
    hullBoost: 2.5,
    kineticResistance: 0.25,
    thermalResistance: -0.4,
    explosiveResistance: 0.2,
    causticResistance: 0,
  },
};

/**
 * Coriolis hull key -> the registry's display name, for the one hull the two do not
 * merely spell differently: coriolis calls the Viper MkIII plain "Viper". The mark
 * numbers are handled by `normalizeName`, which closes up "Mk III" to "MkIII".
 */
const SHIP_NAME_ALIASES = { viper: "viper mkiii" };

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

/** Round to 6 decimals, matching the precision the catalogues already store. */
const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Normalize a display name for the ship join: case, spacing and punctuation, and the
 * mark number closed up — upstream writes "Cobra Mk III" where the registry writes
 * "Cobra MkIII".
 */
const normalizeName = (name) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/\bmk\s+([ivx]+)\b/g, "mk$1");

/**
 * Damage split by type, with upstream's single-letter keys spelled out. Values are
 * copied at full precision: the physical shares sum to exactly `1`, and a rail gun's
 * one-third/two-thirds split would not survive rounding.
 */
function damageDistribution(dist) {
  if (typeof dist !== "object" || dist === null) return undefined;
  const out = {};
  for (const [from, to] of DAMAGE_TYPES) {
    if (typeof dist[from] === "number") out[to] = dist[from];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Shots per second, burst pattern and charge time included — the combined figure the
 * journal reports as `RateOfFire` and both EDSY and Coriolis derive the same way:
 * a cycle fires `burst` shots `1/burstRateOfFire` apart, then waits out the fire
 * interval, and a charged weapon (rail guns) spends its charge time first.
 * Continuous-fire weapons (beam and mining lasers) have no fire interval upstream;
 * their `damage` is already per second, so they get no rate at all.
 */
function rateOfFire(record) {
  const interval = record.fireint;
  if (typeof interval !== "number" || interval <= 0) return undefined;
  const burst = record.burst > 0 ? record.burst : 1;
  const burstRate = record.burstrof > 0 ? record.burstrof : 1;
  const charge = record.charge ?? 0;
  // A single-shot "burst" spends no time between shots, whatever the burst rate is —
  // guarding the division keeps a zero burst rate from poisoning the result.
  const withinBurst = burst > 1 ? (burst - 1) / burstRate : 0;
  const rate = burst / (withinBurst + interval + charge);
  return Number.isFinite(rate) && rate > 0 ? round6(rate) : undefined;
}

/**
 * Index every upstream module by symbol.
 *
 * Upstream files a module's pre-engineered variants under the base module's `fdname`,
 * distinguished only by a display name and a missing `edID` — this library keeps those
 * pairings in `pre-engineered.jsonc` instead, so the stock record (the first one
 * carrying an `edID`) is the one that wins here.
 */
async function readCoriolisModules(root) {
  const dir = resolve(root, "modules");
  const files = [];
  for (const category of await readdir(dir, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    for (const name of await readdir(join(dir, category.name))) {
      if (name.endsWith(".json")) files.push(join(dir, category.name, name));
    }
  }
  files.sort();

  const index = new Map();
  const shadowed = [];
  for (const file of files) {
    const groups = JSON.parse(await readFile(file, "utf8"));
    for (const records of Object.values(groups)) {
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        if (typeof record.symbol !== "string") continue;
        const key = record.symbol.toLowerCase();
        const existing = index.get(key);
        if (!existing) {
          index.set(key, record);
        } else if (existing.edID === undefined && record.edID !== undefined) {
          index.set(key, record);
          shadowed.push(record.symbol);
        } else {
          shadowed.push(record.symbol);
        }
      }
    }
  }
  return { index, shadowed };
}

/** Index every upstream hull by normalized display name. */
async function readCoriolisShips(root) {
  const dir = resolve(root, "ships");
  const index = new Map();
  for (const name of (await readdir(dir)).sort()) {
    if (!name.endsWith(".json")) continue;
    const parsed = JSON.parse(await readFile(resolve(dir, name), "utf8"));
    for (const [key, ship] of Object.entries(parsed)) {
      const display = ship.properties?.name ?? key;
      const normalized = normalizeName(
        SHIP_NAME_ALIASES[normalizeName(key)] ?? display,
      );
      if (index.has(normalized)) {
        throw new Error(`coriolis ships: duplicate hull "${normalized}"`);
      }
      index.set(normalized, ship);
    }
  }
  return index;
}

/** Rebuild a record with `additions` inserted immediately before `cost`. */
function withAdditions(record, additions) {
  const fresh = Object.entries(additions).filter(
    ([field, value]) => value !== undefined && record[field] === undefined,
  );
  if (fresh.length === 0) return record;
  const out = {};
  for (const [field, value] of Object.entries(record)) {
    if (field === "cost") for (const [key, added] of fresh) out[key] = added;
    out[field] = value;
  }
  if (record.cost === undefined) for (const [key, added] of fresh) out[key] = added;
  return out;
}

async function readJsonc(path) {
  const raw = await readFile(path, "utf8");
  const header = raw.match(/^\/\*[\s\S]*?\*\/\s*/)?.[0];
  if (!header) throw new Error(`${path}: expected an attribution comment header`);
  return { header, payload: JSON.parse(stripJsonComments(raw)) };
}

async function writeJsonc(path, header, payload) {
  await writeFile(path, `${header}${JSON.stringify(payload, null, 2)}\n`);
}

const args = parseArgs(process.argv.slice(2));
for (const name of ["coriolis", "out"]) {
  if (!args.has(name)) throw new Error(`Missing --${name}\n\n${usage}`);
}
const coriolisRoot = resolve(args.get("coriolis"));
const out = resolve(args.get("out"));

const { index: coriolisModules, shadowed } = await readCoriolisModules(coriolisRoot);
const coriolisShips = await readCoriolisShips(coriolisRoot);

// Read the hulls up front: an armour variant's mass is per-hull, and on a pre-migration
// catalogue it still lives in the hull's `bulkheads` list (this script is what moves it
// onto the module). Once that has run the field is gone and every mass comes from
// upstream, or from MANUAL_BULKHEAD_STATS for the hull upstream does not carry.
const shipsPath = resolve(out, "ships.jsonc");
const ships = await readJsonc(shipsPath);
const hullBulkheads = new Map(
  ships.payload
    .filter((ship) => Array.isArray(ship.bulkheads))
    .map((ship) => [ship.name, ship.bulkheads]),
);

/** How many armour variants a hull has — the Caspian Explorer is the one with six. */
const armourCountByHull = new Map();
{
  const { payload } = await readJsonc(resolve(out, "modules-core.jsonc"));
  for (const record of payload) {
    if (typeof record.ship !== "string") continue;
    armourCountByHull.set(record.ship, (armourCountByHull.get(record.ship) ?? 0) + 1);
  }
}

/** The bulkhead stats for one `<Hull>_Armour_*` record. */
function armourStats(record) {
  const hull = record.ship;
  const index = bulkheadIndex(record.symbol, armourCountByHull.get(hull) ?? 5);
  if (index === null) throw new Error(`${record.symbol}: unrecognised armour grade`);
  const local = hullBulkheads.get(hull)?.[index];
  const upstream = coriolisShips.get(normalizeName(hull))?.bulkheads?.[index];
  if (local && upstream && local.name !== upstream.name) {
    throw new Error(
      `${record.symbol}: bulkhead ${index} is "${local.name}" here and "${upstream.name}" upstream`,
    );
  }
  const stats = {};
  if (upstream) {
    for (const [from, to] of BULKHEAD_FIELDS) {
      if (typeof upstream[from] === "number") stats[to] = upstream[from];
    }
  } else {
    // The Lynx Highliner: per-grade stats and masses from the table above.
    Object.assign(stats, MANUAL_BULKHEAD_STATS[record.name] ?? {});
    if (typeof local?.mass === "number") stats.mass = local.mass;
  }
  return stats;
}

// ── Modules ────────────────────────────────────────────────────────────────────
const unmatched = { withStats: [], withoutStats: 0 };
let enriched = 0;
let armourEnriched = 0;
for (const category of ["core", "internal", "hardpoint", "utility"]) {
  const path = resolve(out, `modules-${category}.jsonc`);
  const { header, payload } = await readJsonc(path);
  const records = payload.map((record) => {
    const key = record.symbol.toLowerCase();
    const upstream = coriolisModules.get(key);
    // Ship armour: upstream files its stats on the hull, not in the module catalogue.
    if (!upstream && typeof record.ship === "string") {
      const ordered = {};
      const stats = armourStats(record);
      for (const [, to] of BULKHEAD_FIELDS) {
        if (stats[to] !== undefined) ordered[to] = stats[to];
      }
      const next = withAdditions(record, ordered);
      if (next !== record) armourEnriched++;
      return next;
    }
    const additions = { ...MANUAL_MODULE_STATS[key] };
    if (upstream) {
      for (const [from, to, convert] of MODULE_FIELDS) {
        if (from === null) continue;
        if (upstream[from] === undefined || upstream[from] === null) continue;
        if (HARDPOINT_ONLY_FIELDS.has(to) && !HARDPOINT_CATEGORIES.has(category)) {
          continue;
        }
        const value = convert(upstream[from]);
        if (value !== undefined) additions[to] = value;
      }
      const rate = rateOfFire(upstream);
      if (rate !== undefined) additions.rateOfFire = rate;
    } else if (!MANUAL_MODULE_STATS[key]) {
      // Ship armour and the reward/starter variants have no upstream stats at all.
      unmatched.withoutStats++;
    }
    // Re-order additions to the declared field order so the output is stable.
    const ordered = {};
    for (const [, to] of MODULE_FIELDS) {
      if (additions[to] !== undefined) ordered[to] = additions[to];
    }
    const next = withAdditions(record, ordered);
    if (next !== record) enriched++;
    return next;
  });
  await writeJsonc(path, header, records);
}

// ── Ships: drop the bulkhead list now its stats live on the armour modules ─────
let hullsTrimmed = 0;
const hulls = ships.payload.map((ship) => {
  if (!Array.isArray(ship.bulkheads)) return ship;
  hullsTrimmed++;
  const { bulkheads, ...rest } = ship;
  return rest;
});
await writeJsonc(shipsPath, ships.header, hulls);

console.log(
  [
    `modules enriched:      ${enriched}`,
    `armour modules given their hull's bulkhead stats: ${armourEnriched}`,
    `modules with no upstream record: ${unmatched.withoutStats}`,
    `pre-engineered/duplicate upstream records ignored: ${shadowed.length}`,
    `hulls whose bulkhead list moved to the module catalogue: ${hullsTrimmed}`,
  ].join("\n"),
);
