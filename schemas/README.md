# Shared data schemas

These plain JSON Schema draft-07 files describe the language-neutral payloads in
`data/`. Every language implementation should validate the same schemas before
building or publishing its package.

`ships/catalogues.schema.json` defines the payload for all seven files under
`data/ships/`; the TypeScript data-file tests map each catalogue filename to its
corresponding definition and reject unknown fields, missing fields, invalid ranges,
and invalid enum values.
