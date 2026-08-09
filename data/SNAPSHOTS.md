# Data snapshot metadata

Each `data/<domain>/SOURCES.md` file is authoritative for the catalogues in that
domain. It records the source, acquisition date, immutable revision or checksum,
derivation and manual corrections for each catalogue.

Some sources do not publish immutable versions, and some acquired snapshots do not
have a recorded revision. Those entries must state that limitation explicitly and
identify the source and derivation that can still be verified. Never infer a revision
after acquisition.

## Required metadata

Every data change must record, in the relevant domain `SOURCES.md`:

- the UTC acquisition date;
- an upstream commit, release, dataset version, response timestamp or checksum when
  available;
- the import or derivation method;
- every manual correction and every field sourced elsewhere;
- any known gap, why it remains unresolved and the issue that tracks it.

When an upstream source has no immutable version, preserve the acquired content or its
SHA-256 checksum where licensing permits. Update shared fixtures and every language
implementation affected by the data in the same change.

Provenance describes the checked-in data as it exists. Release history belongs in Git
and GitHub releases.
