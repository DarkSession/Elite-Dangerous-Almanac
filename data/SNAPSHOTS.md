# Data snapshot metadata

The checked-in catalogues began as one library-wide snapshot dated **2026-07-24**,
and domains are revised independently after that. The **`SOURCES.md` header in each
`data/<domain>/` is authoritative** for that domain: it carries the snapshot line,
any later revision, and the upstream identifiers behind both. This file states the
policy; do not restate a domain's dates here or they will drift apart.

Package documentation states the baseline and points at the domain `SOURCES.md` files
for the complete record, so consumers can judge freshness independently from the npm
package version. It is **not** a changelog: what changed in a given release belongs in
that release's notes, and a `SOURCES.md` describes the data as it stands rather than the
order it got there in (`AGENTS.md` §Documentation states the present).

## Initial-snapshot limitations

The initial imports did not retain immutable upstream commit identifiers. The
sources are live APIs, community-maintained spreadsheets, downloadable datasets,
or registries whose exact revision was not recorded when the files were assembled.
The domain-specific `SOURCES.md` files document the source and derivation of every
catalogue; this file makes the missing revision metadata explicit rather than
inventing one after the fact.

## Required metadata for updates

Every future data update must record, in the relevant domain `SOURCES.md`:

- the UTC acquisition date;
- an upstream commit, release, dataset version, or response timestamp when the
  source provides one;
- the import or derivation method;
- any manual corrections or records sourced elsewhere.

When an upstream source has no immutable version, preserve the downloaded source
or its SHA-256 checksum in the change record. Shared fixtures and all language
implementations must be updated in the same change.
