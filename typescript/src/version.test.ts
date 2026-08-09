import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LIBRARY_NAME, LIBRARY_VERSION } from './internal/version.js';

// Read the manifest rather than importing it: an `import … with { type: 'json' }` here
// would inline the whole of package.json into any bundle that reaches this module.
const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

test('LIBRARY_VERSION matches the published version', () => {
    assert.equal(LIBRARY_VERSION, manifest.version);
});

test('LIBRARY_NAME matches the published name', () => {
    assert.equal(LIBRARY_NAME, manifest.name);
});
