import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { stripBareImports } from './scripts/strip-bare-imports.mjs';

import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';
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
import { sectorNameFromGalacticPosition } from '@elite-dangerous-almanac/core/astro/galaxy-grid';
import { parseSlef, toSlef, stringifySlef } from '@elite-dangerous-almanac/core/ships/slef';

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

async function publicEntries(directory = new URL('./dist/', import.meta.url), subpath = '') {
    const entries = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            entries.push(
                ...(await publicEntries(
                    new URL(`${entry.name}/`, directory),
                    `${subpath}${entry.name}/`,
                )),
            );
        } else if (entry.name.endsWith('.js') && !entry.name.startsWith('chunk-')) {
            const relative = `${subpath}${entry.name}`;
            const modulePath = relative.replace(/\.js$/, '');
            const exported = modulePath === 'index' ? '' : modulePath.replace(/\/index$/, '');
            entries.push({
                file: fileURLToPath(new URL(entry.name, directory)),
                specifier: `@elite-dangerous-almanac/core${exported ? `/${exported}` : ''}`,
            });
        }
    }
    return entries;
}

async function internalSourceEntries(directory = new URL('./src/', import.meta.url), subpath = '') {
    const entries = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const relative = `${subpath}${entry.name}`;
        if (entry.isDirectory()) {
            entries.push(
                ...(await internalSourceEntries(
                    new URL(`${entry.name}/`, directory),
                    `${relative}/`,
                )),
            );
        } else if (entry.name.endsWith('.ts') && relative.split('/').includes('internal')) {
            entries.push(relative.replace(/\.ts$/, ''));
        }
    }
    return entries.sort();
}

test('ProceduralSystem excludes individually locked systems from its package graph', async () => {
    const graph = await readReachableJs(
        new URL('./dist/astro/procedural-system.js', import.meta.url),
    );
    assert.doesNotMatch(graph, /10477373803/);
    assert.match(graph, /Col 70 Sector/);
});

test('fine-grained package subpaths resolve', () => {
    assert.equal(massCodeToSizeClass('d'), 3);
    assert.equal(
        ProceduralSystem.fromName('pleiades sector hr-w d1-79')?.name,
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
    assert.equal(sectorNameFromGalacticPosition({ x: 751, y: -179, z: -91 }), 'Synuefe');
    const slef = stringifySlef(
        toSlef(
            { Ship: 'sidewinder', Modules: [] },
            { appName: 'Package test', appVersion: '1.0.0' },
        ),
    );
    assert.equal(parseSlef(slef)[0]?.data.Ship, 'sidewinder');
});

test('generated public entries contain no redundant bare imports', async () => {
    for (const { file, specifier } of await publicEntries()) {
        const source = await readFile(file, 'utf8');
        assert.equal(stripBareImports(source), source, specifier);
    }
});

test('bare-import pruning preserves import-like text and value imports', () => {
    const source = `const message="import './keep.js'";import value from'./value.js';import'./remove.js';export{message,value};`;
    assert.equal(
        stripBareImports(source),
        `const message="import './keep.js'";import value from'./value.js';export{message,value};`,
    );
});

test('a consumer bundle of every public entry produces no warnings', async () => {
    const entries = await publicEntries();
    const contents = entries
        .map(({ specifier }, index) => `import * as entry${index} from '${specifier}';`)
        .join('\n');
    const result = await build({
        stdin: {
            contents: `${contents}\nconsole.log(${entries.map((_, index) => `entry${index}`).join(',')});`,
            resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        minify: true,
        format: 'esm',
        platform: 'browser',
        logLevel: 'silent',
    });
    assert.deepEqual(result.warnings, []);
});

test('a journal address reaches every id64 entry point without conversion', async () => {
    // JSON.parse of a journal event yields a plain number, not a bigint.
    const { ProceduralSystem: PS } =
        await import('@elite-dangerous-almanac/core/astro/procedural-system');
    const { decodeSystemAddress } =
        await import('@elite-dangerous-almanac/core/astro/system-address');
    const { findCodexRegionForBoxel } =
        await import('@elite-dangerous-almanac/core/astro/codex-region-lookup');
    assert.equal(PS.fromSystemAddress(3_309_179_996_515).name, 'Synuefe EN-H d11-96');
    assert.equal(decodeSystemAddress(3_309_179_996_515).sizeClass, 3);
    assert.equal(findCodexRegionForBoxel(3_309_179_996_515).region?.name, 'Inner Orion Spur');
    assert.throws(() => PS.fromSystemAddress(2 ** 53 + 2), TypeError);
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

test('reading and writing SLEF costs nothing but the wire format', async () => {
    // `ships/slef` is the parse-and-serialise leaf: apps that only move builds between
    // tools must not pay for the catalogues. Serialising is the easy way to break this,
    // since the obvious implementation reaches for ShipLoadout.
    const graph = await readReachableJs(new URL('./dist/ships/slef.js', import.meta.url));
    assert.ok(graph.length < 8192, `expected a tiny module, got ${graph.length} bytes`);
    for (const marker of [/Anaconda/, /Chaff Launcher/, /FSD_LongRange/, /Witch Head/]) {
        assert.doesNotMatch(graph, marker);
    }
});

test('the engineering menus do not bundle the blueprint catalogue', async () => {
    // Reading a journal `BlueprintName` against a module needs both menus and recipes,
    // so that join lives in `blueprint-journal`. Menu-only consumers should not import
    // the recipe catalogue.
    const menus = await readReachableJs(
        new URL('./dist/ships/engineering-options.js', import.meta.url),
    );
    assert.ok(menus.length < 96 * 1024, `expected a menus-only module, got ${menus.length} bytes`);
    // Menu ids are strings, so `Sensor_LongRange` and the per-hull bulkhead symbols do
    // appear here. A recipe's modifier labels, magnitudes and display names must not.
    assert.match(menus, /beamLasers/);
    assert.match(menus, /Sensor_LongRange/);
    for (const marker of [/FSDOptimalMass/, /Increased range/, /multiplicative/]) {
        assert.doesNotMatch(menus, marker);
    }

    // The join module is where that weight is paid, and it must genuinely pull both.
    const join = await readReachableJs(
        new URL('./dist/ships/blueprint-journal.js', import.meta.url),
    );
    assert.match(join, /FSDOptimalMass/);
    assert.match(join, /beamLasers/);
});

test('a single module catalogue does not bundle the others', async () => {
    const graph = await readReachableJs(
        new URL('./dist/ships/modules-utility.js', import.meta.url),
    );
    // The utility catalogue must not drag in the standard-category armour data.
    assert.doesNotMatch(graph, /Anaconda_Armour/);
    assert.match(graph, /Chaff Launcher/);
});

test('every internal source module is outside the package export map', async () => {
    const entries = await internalSourceEntries();
    assert.ok(entries.length > 0, 'expected internal source modules');
    for (const entry of entries) {
        await assert.rejects(import(`@elite-dangerous-almanac/core/${entry}`), {
            code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
        });
    }
});

test('the build does not emit entry artifacts for inaccessible internal modules', async () => {
    for (const entry of await internalSourceEntries()) {
        for (const extension of ['js', 'd.ts']) {
            await assert.rejects(
                readFile(new URL(`./dist/${entry}.${extension}`, import.meta.url)),
                { code: 'ENOENT' },
                `dist/${entry}.${extension} should not be emitted`,
            );
        }
    }
});

test('the data-free build calculations are importable on their own', async () => {
    const { powerBudget } = await import('@elite-dangerous-almanac/core/ships/power');
    const { stackShieldResistance } =
        await import('@elite-dangerous-almanac/core/ships/resistances');
    const { weaponMetrics } = await import('@elite-dangerous-almanac/core/ships/weapons');
    const { ammunitionCapacity } = await import('@elite-dangerous-almanac/core/ships/ammunition');
    assert.equal(powerBudget(10, [{ draw: 4, priority: 1 }]).headroom, 6);
    assert.ok(Math.abs(stackShieldResistance(0, [0.1, 0.1]) - 0.19) < 1e-9);
    assert.equal(weaponMetrics({ damage: 2, rateOfFire: 3 }).damagePerSecond, 6);
    assert.equal(ammunitionCapacity({ clipSize: 6, ammoMaximum: 120 }).total, 126);
});

test('each barrel ships its orientation documentation in the declarations', async () => {
    // A barrel is pure re-exports, so tsup's declaration rollup emits a flat export
    // list and drops the file-level comment. `scripts/attach-barrel-docs.mjs` puts it
    // back. Without it, a consumer who opens (or goes to definition on) the module
    // they just imported finds a bare export list, and the guidance that orients the
    // feature area ships only to the repository.
    const barrels = [
        'index.d.ts',
        'astro/index.d.ts',
        'ships/index.d.ts',
        'materials/index.d.ts',
        'commodities/index.d.ts',
    ];
    for (const file of barrels) {
        const text = await readFile(new URL(`./dist/${file}`, import.meta.url), 'utf8');
        assert.ok(
            text.startsWith('/**'),
            `dist/${file} lost its @packageDocumentation block — run \`npm run build\``,
        );
        assert.ok(
            text.includes('@packageDocumentation'),
            `dist/${file} has no @packageDocumentation`,
        );
        // Match on size, not on prose: a reworded intro is fine, a lost one is not.
        // The floor only has to separate "the guide" from "a stub" — the root barrel
        // is the shortest real block at ~320 chars (it only points at the subpaths),
        // the feature-area barrels run from ~980 to ~3100. Kept well clear of 320 so
        // that trimming a sentence does not trip it with a misleading message.
        const block = text.slice(0, text.indexOf('*/'));
        assert.ok(
            block.length > 150,
            `dist/${file} has only a stub doc block (${block.length} chars) — expected the guide`,
        );
    }
});

test('data provenance references in the declarations are followable off-package', async () => {
    // `data/` is not in `files`, so a bare `data/ships/SOURCES.md` in a TSDoc comment
    // points at a file the consumer's node_modules does not contain — the reference a
    // consumer follows to judge how current and how complete the catalogues are is the
    // one they cannot reach. Every such reference must be an absolute URL.
    const declarations = await readdir(new URL('./dist', import.meta.url), {
        recursive: true,
    });
    const checked = [];
    for (const name of declarations) {
        if (!name.endsWith('.d.ts')) continue;
        const text = await readFile(new URL(`./dist/${name}`, import.meta.url), 'utf8');
        // Drop absolute markdown links first — whatever their label says, an
        // `https://` target is followable. Matching on the target rather than the
        // label matters: `[the provenance notes](https://…/data/astro/SOURCES.md)`
        // is correct, and a label-based strip would flag the path inside its URL.
        // A link with a *relative* target survives this and is still caught.
        const bare = text.replace(/\[[^\]]*\]\(https:\/\/[^)]+\)/g, '');
        // Deliberately broad: a directory (`data/astro/`, `data/commodities`), a
        // top-level file (`data/SNAPSHOTS.md`), an unticked path, any extension and
        // any case. Each is equally unreachable from a consumer's `node_modules`.
        for (const match of bare.matchAll(/\bdata\/[\w.-]+(?:\/[\w.-]*)*/gi)) {
            assert.fail(`dist/${name} references ${match[0]} relatively; use an absolute URL`);
        }
        if (text.includes('SOURCES.md')) checked.push(name);
    }
    // Guard the guard: if the traversal stops finding provenance references at all,
    // the loop above starts passing vacuously.
    assert.ok(checked.length > 20, `expected many provenance references, found ${checked.length}`);
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

    // The packaged licence is the same kind of generated copy, of the repository's
    // single root LICENSE. package.json declares "SEE LICENSE IN LICENSE", so a
    // missing or stale copy publishes a tarball whose stated terms are absent or
    // wrong — and the root file is the only one anybody edits.
    const license = await readFile(new URL('./LICENSE', import.meta.url), 'utf8');
    const canonicalLicense = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
    assert.equal(
        license,
        canonicalLicense,
        'LICENSE is stale — run `npm run build` (it copies the root LICENSE)',
    );
    // Match on collapsed whitespace: the assertion is that the licence still states
    // these terms, not that it is wrapped at any particular column.
    const licenseProse = license.replace(/\s+/g, ' ');
    assert.match(licenseProse, /does not relicense bundled third-party/);
    assert.match(licenseProse, /before redistributing the data or using it commercially/);
});
