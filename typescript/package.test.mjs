import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { nearestNebulae } from '@elite-dangerous-almanac/core/astro/nebulae';
import { REAL_NEBULAE } from '@elite-dangerous-almanac/core/astro/nebulae-real';
import { permitLockForSystemName } from '@elite-dangerous-almanac/core/astro/permit-locks';
import { permitLockedSystemForAddress } from '@elite-dangerous-almanac/core/astro/permit-locked-systems';
import { isPermitLockedRegionName } from '@elite-dangerous-almanac/core/astro/permit-locked-regions';
import { getMaterialByName } from '@elite-dangerous-almanac/core/materials';
import { RAW_MATERIALS } from '@elite-dangerous-almanac/core/materials/materials-raw';
import { getMicroResourceBySymbol } from '@elite-dangerous-almanac/core/materials';
import { COMPONENT_MICRO_RESOURCES } from '@elite-dangerous-almanac/core/materials/micro-resources-component';
import { getShipBySymbol } from '@elite-dangerous-almanac/core/ships/ships';
import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
import { UTILITY_MODULES } from '@elite-dangerous-almanac/core/ships/modules-utility';
import { getCommodityBySymbol } from '@elite-dangerous-almanac/core/commodities';
import { RARE_COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-rare';

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
    assert.equal(getMaterialByName('iron', RAW_MATERIALS)?.name, 'Iron');
    assert.equal(getMicroResourceBySymbol('graphene', COMPONENT_MICRO_RESOURCES)?.name, 'Graphene');
    assert.equal(getShipBySymbol('empire_trader')?.name, 'Imperial Clipper');
    assert.equal(
        getModuleBySymbol('Hpt_ChaffLauncher_Tiny', UTILITY_MODULES)?.name,
        'Chaff Launcher',
    );
    assert.equal(getCommodityBySymbol('lavianbrandy', RARE_COMMODITIES)?.name, 'Lavian Brandy');
});

test('a single module catalogue does not bundle the others', async () => {
    const graph = await readReachableJs(
        new URL('./dist/ships/modules-utility.js', import.meta.url),
    );
    // The utility catalogue must not drag in the standard-category armour data.
    assert.doesNotMatch(graph, /Anaconda_Armour/);
    assert.match(graph, /Chaff Launcher/);
});

test('internal material construction helpers are not package exports', async () => {
    await assert.rejects(import('@elite-dangerous-almanac/core/materials/material-catalogue'), {
        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
});

test('internal commodity construction helpers are not package exports', async () => {
    await assert.rejects(import('@elite-dangerous-almanac/core/commodities/commodity-catalogue'), {
        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
});

test('internal engineering compatibility rules are not package exports', async () => {
    await assert.rejects(import('@elite-dangerous-almanac/core/ships/engineering-compatibility'), {
        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
});

test('the package omits unusable source maps whose sources are not published', async () => {
    await assert.rejects(readFile(new URL('./dist/ships/ship-loadout.js.map', import.meta.url)));
});

test('the publication manifest includes consumer documentation and notices', async () => {
    const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    assert.equal(pkg.license, 'SEE LICENSE IN LICENSE');
    assert.equal(
        pkg.repository.url,
        'git+https://github.com/DarkSession/Elite-Dangerous-Almanac.git',
    );
    assert.equal(pkg.homepage, 'https://github.com/DarkSession/Elite-Dangerous-Almanac#readme');
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

    const notices = await readFile(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
    assert.match(notices, /Odyssey micro resources/);
    assert.match(notices, /Market commodities/);
    assert.match(notices, /CC BY-NC 4\.0/);

    const license = await readFile(new URL('./LICENSE', import.meta.url), 'utf8');
    assert.match(license, /does not relicense bundled third-party/);
    assert.match(license, /before redistributing the data or using\s+it commercially/);
});
