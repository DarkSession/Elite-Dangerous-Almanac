# Ship catalogue derivation

Two scripts write the checked-in catalogues in `data/ships/`:

- **`merge-normalized-catalogues.mjs`** — the deterministic identity/stat join that
  builds them (below).
- **`add-coriolis-stats.mjs`** — the additive enrichment pass that widened them with
  the defence, power and weapon stats, and moved each hull's bulkheads onto its armour
  modules ([further down](#combat-and-defence-stat-enrichment)).

## Identity and stat join

`merge-normalized-catalogues.mjs` performs the deterministic final join used by
the checked-in ship and module catalogues. It keeps identity order and identity
fields authoritative, joins case-insensitively on `symbol`, rejects duplicate or
unmatched records, and preserves each output JSONC file's attribution header.

The inputs are normalized arrays:

- ship identities: `{ symbol, name, entitlement? }`;
- ship stats and slots: the former `ship-stats.jsonc` and `ship-slots.jsonc`
  shapes documented in `data/ships/SOURCES.md`;
- module identities: the FDevIDs-derived identity fields;
- module stats: the former `module-stats-<category>.jsonc` shape documented in
  `data/ships/SOURCES.md`.

Keep downloaded upstream files or their SHA-256 checksums with the update
record, then normalize only the whitelisted fields and run:

```bash
node scripts/data/ships/merge-normalized-catalogues.mjs \
  --ship-identities tmp/ships.json \
  --ship-stats tmp/ship-stats.json \
  --ship-slots tmp/ship-slots.json \
  --core-identities tmp/modules-core.json \
  --core-stats tmp/module-stats-core.json \
  --internal-identities tmp/modules-internal.json \
  --internal-stats tmp/module-stats-internal.json \
  --hardpoint-identities tmp/modules-hardpoint.json \
  --hardpoint-stats tmp/module-stats-hardpoint.json \
  --utility-identities tmp/modules-utility.json \
  --utility-stats tmp/module-stats-utility.json \
  --out data/ships
```

After joining, update the acquisition date, immutable revision/checksum, manual
corrections, and header attribution required by `data/SNAPSHOTS.md`, then run
the TypeScript data-file tests. The script is repository tooling and is not
included in the npm package.

## Combat and defence stat enrichment

`add-coriolis-stats.mjs` joins the stats the build calculations need — the four damage
resistances, hull and shield reinforcement, module protection, the `alwaysPowered`
flag, and the weapon block — onto the catalogues from a coriolis-data checkout:

```bash
git clone https://github.com/EDCD/coriolis-data.git tmp/coriolis-data
git -C tmp/coriolis-data checkout <the commit recorded in data/ships/SOURCES.md>
node scripts/data/ships/add-coriolis-stats.mjs \
  --coriolis tmp/coriolis-data \
  --out data/ships
```

It is **additive and idempotent**: it never overwrites a field a record already has,
keeps each record's key order (new keys go in before `cost`), and re-running it against
the same upstream revision changes nothing. It also owns two normalisations that upstream
does not model the way this catalogue does:

- `rateOfFire` is **derived** from the fire interval, burst pattern and charge time, so
  it matches the journal's own combined figure;
- a hull's **bulkheads** move from the hull record onto its `<Hull>_Armour_*` module
  records, and `bulkheads` is dropped from `ships.jsonc`. That migration has already
  run, so the step is a no-op today (it reports `0` hulls) — it stays in place so the
  script can still be pointed at a pre-migration catalogue. Regenerating from scratch
  does not depend on it: the Lynx Highliner's armour masses, the one thing that used to
  come from the hull's list, are in `MANUAL_BULKHEAD_STATS` with the rest of its grades.

Values upstream does not carry are filled from the tables at the top of the script, each
with the uniformity that justifies it. Record any change in `data/ships/SOURCES.md` with
the upstream commit and acquisition date, then run the TypeScript test suite.
