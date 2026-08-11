# Data snapshot metadata

Each `data/<domain>/SOURCES.md` file is authoritative for the catalogues in that
domain. It records, per catalogue, which source the data came from, the acquisition
date, the immutable revision or checksum, the derivation and every manual correction.
Who to credit for a source — its author, link and licence terms — is recorded once, in
`../ATTRIBUTIONS.md`, and a `SOURCES.md` refers to it by name.

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

A **test fixture is not recorded here.** A fixture in `fixtures/` carries the same
metadata in its own comment header — what it pins, and for a captured build where it
came from, when, its checksum and anything scrubbed or corrected. A `SOURCES.md` entry
may name a fixture as the evidence for a value; it does not document the fixture.

Provenance describes the checked-in data as it exists. Release history belongs in Git
and GitHub releases, and how the library computes something belongs in its own
documentation, not here.
