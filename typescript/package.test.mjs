import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';

test('fine-grained package subpaths resolve', () => {
    assert.equal(massCodeToSizeClass('d'), 3);
    assert.equal(
        StarSystem.fromName('pleiades sector hr-w d1-79')?.name,
        'Pleiades Sector HR-W d1-79',
    );
});

test('the publication manifest includes consumer documentation and notices', async () => {
    const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    assert.deepEqual(
        ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'].map((name) => [
            name,
            pkg.files.includes(name),
        ]),
        [
            ['README.md', true],
            ['LICENSE', true],
            ['THIRD_PARTY_NOTICES.md', true],
        ],
    );
});
