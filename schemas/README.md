# Shared data schemas

These plain JSON Schema draft-07 files describe the language-neutral payloads in
`data/`. Every language implementation should validate the same schemas before
building or publishing its package.

Each data domain has one schema whose definitions cover every catalogue in the
matching directory:

- `astro/catalogues.schema.json`
- `commodities/catalogues.schema.json`
- `materials/catalogues.schema.json`
- `ships/catalogues.schema.json`

The TypeScript data-file tests map each catalogue filename to its corresponding
definition and reject unknown fields, missing fields, invalid ranges, and invalid
enum values.
