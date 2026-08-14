# Shared data schemas

These plain JSON Schema draft-07 files describe the language-neutral payloads in
`data/` and `fixtures/`. Every language implementation should validate the same
schemas before building or publishing its package.

Each data domain has one schema whose definitions cover every catalogue in the
matching directory:

- `astro/catalogues.schema.json`
- `commodities/catalogues.schema.json`
- `equipment/catalogues.schema.json`
- `i18n/catalogues.schema.json`
- `materials/catalogues.schema.json`
- `ships/catalogues.schema.json`

The TypeScript data-file tests map each catalogue filename to its corresponding
definition and reject unknown fields, missing fields, invalid ranges, and invalid
enum values.

JSON Schema draft-07 cannot express an inequality between two sibling properties.
Every language implementation must therefore enforce the semantic relationships that
the relevant schema's `$comment` identifies after schema validation. For ship records
these are `minimumSpeed <= maximumSpeed`, `minPitch <= pitch`, `minRoll <= roll`, and
`minYaw <= yaw`. Keeping this check in each implementation is portable; non-standard
validator extensions such as Ajv's `$data` are not.

`fixtures.schema.json` is generated from the shared fixtures. Captures with the same
wire format — journal loadouts, SLEF envelopes and community builds — share one family
definition; all other fixtures have a definition of their own. Its
`x-fixture-families` list maps every file to exactly one definition. From `typescript/`,
run `pnpm run generate:fixtures` after changing a fixture. The same command generates
`src/fixtures.generated.d.ts`, and `pnpm run check:fixtures` rejects stale artefacts.
