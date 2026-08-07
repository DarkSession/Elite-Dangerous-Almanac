# Ship catalogue derivation

`merge-normalized-catalogues.mjs` writes the checked-in catalogues in `data/ships/`.
It takes **normalized local arrays** and joins them; it does not read, clone or fetch
any upstream repository itself. Preparing those arrays — including recording the
upstream revision and checksums each field came from — is a manual step, documented
per catalogue in `data/ships/SOURCES.md`.

## Identity and stat join

`merge-normalized-catalogues.mjs` performs the deterministic final join used by
the checked-in ship and module catalogues. It keeps identity order and identity
fields authoritative, joins case-insensitively on `symbol`, rejects duplicate or
unmatched records, and preserves each output JSONC file's attribution header.

Every input is an array of objects carrying a string `symbol`, and nothing else is
required of them. The identity array fixes the output order, and each stat or slot
array contributes all of its fields **except `symbol` and `name`** — identity wins on
those two. Symbols match case-insensitively; a duplicate symbol within one array, or a
stat record whose symbol no identity carries, is an error rather than a silent drop.

- ship identities (`--ship-identities`): `{ symbol, name, entitlement? }`, the
  FDevIDs `shipyard.csv` fields;
- ship stats (`--ship-stats`): `{ symbol, hullMass, speed, baseArmour, … }`, the
  whitelisted coriolis-data `properties`;
- ship slots (`--ship-slots`): `{ symbol, core, hardpoints, utility, optional }`;
- module identities (`--<category>-identities`):
  `{ symbol, slot?, name, class, rating, mount?, guidance?, ship?, entitlement? }`,
  the FDevIDs `outfitting.csv` fields. **No `category`** — the CSV column of that name
  is what chooses the `--<category>-identities` argument a record is passed under, and
  the output file is what states it, so carrying it on every record would inline the
  same string 1197 times into consumers' bundles. `slot` names the one fixed mount a
  module fills; it is on every core record and on the Guardian Hybrid power plants and
  distributors, and nowhere else. See `data/ships/SOURCES.md` §Modules (outfitting);
- module stats (`--<category>-stats`): `{ symbol, mass?, integrity?, powerDraw?, … }`
  — sparse, each record carrying only the stats its module group uses.

`data/ships/SOURCES.md` records where each field came from and how it was normalized;
this file describes only the join.

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
