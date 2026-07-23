import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { nearestNebulae } from '@elite-dangerous-almanac/core/astro/nebulae';
import { REAL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-real';

test('fine-grained package subpaths resolve', () => {
    assert.equal(massCodeToSizeClass('d'), 3);
    assert.equal(
        StarSystem.fromName('pleiades sector hr-w d1-79')?.name,
        'Pleiades Sector HR-W d1-79',
    );
    assert.equal(nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 1)[0]?.name, 'Pleiades');
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
