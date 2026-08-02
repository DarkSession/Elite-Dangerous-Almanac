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
import { toSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address-input';
import { sectorNameFromGalacticCoords } from '@elite-dangerous-almanac/core/astro/galaxy-grid';

async function readReachableJs(entry, seen = new Set()) {
    if (seen.has(entry.href)) return '';
    seen.add(entry.href);

    const source = await readFile(entry, 'utf8');
    const modules = [source];
    // `from` may sit flush against the quote in minified output (`from'./chunk-X.js'`),
    // so the separator is optional. If this stops matching, the traversal silently
    // shrinks and every `doesNotMatch` assertion below starts passing vacuously.
    const importPattern = /(?:from\s*|import\s*)['"](\.\.?\/[^'"]+\.js)['"]/g;
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
    assert.equal(toSystemAddress(10_477_373_803), 10_477_373_803n);
    assert.equal(sectorNameFromGalacticCoords({ x: 751, y: -179, z: -91 }), 'Synuefe');
});

test('a journal address reaches every id64 entry point without conversion', async () => {
    // JSON.parse of a journal event yields a plain number, not a bigint.
    const { StarSystem: SS } = await import('@elite-dangerous-almanac/core/astro/star-system');
    const { decodeSystemAddress } =
        await import('@elite-dangerous-almanac/core/astro/system-address');
    const { findRegionForBoxel } =
        await import('@elite-dangerous-almanac/core/astro/galactic-region-lookup');
    assert.equal(SS.fromSystemAddress(3_309_179_996_515).name, 'Synuefe EN-H d11-96');
    assert.equal(decodeSystemAddress(3_309_179_996_515).sizeClass, 3);
    assert.equal(findRegionForBoxel(3_309_179_996_515).region?.name, 'Inner Orion Spur');
    assert.throws(() => SS.fromSystemAddress(2 ** 53 + 2), TypeError);
});

test('converting an address costs nothing but the conversion', async () => {
    // The address-input leaf must stay dependency-free, so accepting a journal number
    // never drags data into a consumer's bundle.
    const graph = await readReachableJs(
        new URL('./dist/astro/system-address-input.js', import.meta.url),
    );
    assert.ok(graph.length < 4096, `expected a tiny module, got ${graph.length} bytes`);
    for (const marker of [/Witch Head/, /Col 70 Sector/, /scaleNumerator/, /Anaconda/]) {
        assert.doesNotMatch(graph, marker);
    }
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

test('internal loadout engineering adapters are not package exports', async () => {
    await assert.rejects(import('@elite-dangerous-almanac/core/ships/loadout-engineering'), {
        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
});

test('internal loadout metric adapters are not package exports', async () => {
    await assert.rejects(import('@elite-dangerous-almanac/core/ships/loadout-metrics'), {
        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
});

test('the internal journal-label table is not a package export', async () => {
    await assert.rejects(import('@elite-dangerous-almanac/core/ships/module-stat-labels'), {
        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
});

test('the data-free build calculations are importable on their own', async () => {
    const { powerBudget } = await import('@elite-dangerous-almanac/core/ships/power');
    const { stackShieldResistance } =
        await import('@elite-dangerous-almanac/core/ships/resistances');
    const { weaponMetrics } = await import('@elite-dangerous-almanac/core/ships/weapons');
    assert.equal(powerBudget(10, [{ draw: 4, priority: 1 }]).headroom, 6);
    assert.ok(Math.abs(stackShieldResistance(0, [0.1, 0.1]) - 0.19) < 1e-9);
    assert.equal(weaponMetrics({ damage: 2, rateOfFire: 3 }).damagePerSecond, 6);
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

    // The packaged notice is a generated copy of the repository's canonical
    // ATTRIBUTIONS.md. Assert it exists and is byte-identical: a missing or stale
    // copy would publish a tarball whose credits are wrong or absent, and several
    // upstream licences require the notice to travel with the distribution.
    const notices = await readFile(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
    const canonical = await readFile(new URL('../ATTRIBUTIONS.md', import.meta.url), 'utf8');
    assert.equal(
        notices,
        canonical,
        'THIRD_PARTY_NOTICES.md is stale — run `npm run build` (it copies ATTRIBUTIONS.md)',
    );
    assert.match(notices, /Odyssey micro resources/);
    assert.match(notices, /Market commodities/);
    assert.match(notices, /CC BY-NC 4\.0/);
    // The BSD 3-Clause text must ship in full, as EDTS's terms require.
    assert.match(notices, /Copyright \(c\) 2016, Andy Martin/);
    assert.match(notices, /THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS/);

    const license = await readFile(new URL('./LICENSE', import.meta.url), 'utf8');
    assert.match(license, /does not relicense bundled third-party/);
    assert.match(license, /before redistributing the data or using\s+it commercially/);
});
