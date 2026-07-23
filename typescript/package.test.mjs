import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { nearestNebulae } from '@elite-dangerous-almanac/core/astro/nebulae';
import { REAL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-real';
import { permitLockForSystemName } from '@elite-dangerous-almanac/core/astro/permit-locks';
import {
    permitLockedSystemForAddress,
} from '@elite-dangerous-almanac/core/astro/permit-locked-systems';
import {
    isPermitLockedRegionName,
} from '@elite-dangerous-almanac/core/astro/permit-locked-regions';

async function readReachableJs(entry, seen = new Set()) {
    if (seen.has(entry.href)) return '';
    seen.add(entry.href);

    const source = await readFile(entry, 'utf8');
    const modules = [source];
    const importPattern = /(?:from\s+|import\s*)['"](\.\.?\/[^'"]+\.js)['"]/g;
    for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (specifier) modules.push(await readReachableJs(new URL(specifier, entry), seen));
    }
    return modules.join('\n');
}

test('StarSystem excludes individually locked systems from its package graph', async () => {
    const graph = await readReachableJs(new URL('./dist/astro/star-system.js', import.meta.url));
    assert.doesNotMatch(graph, /10477373803/);
    assert.match(graph, /Col 70 Sector/);
});

test('fine-grained package subpaths resolve', () => {
    assert.equal(massCodeToSizeClass('d'), 3);
    assert.equal(
        StarSystem.fromName('pleiades sector hr-w d1-79')?.name,
        'Pleiades Sector HR-W d1-79',
    );
    assert.equal(nearestNebulae({ x: 0, y: 0, z: 0 }, REAL_NEBULAE, 1)[0]?.name, 'Pleiades');
    assert.equal(permitLockForSystemName('  sol ')?.name, 'Sol');
    assert.equal(permitLockedSystemForAddress(10_477_373_803)?.name, 'Sol');
    assert.equal(isPermitLockedRegionName('Cone Sector'), true);
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
