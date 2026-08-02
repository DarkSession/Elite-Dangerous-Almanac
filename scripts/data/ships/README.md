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
