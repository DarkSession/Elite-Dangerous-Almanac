import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { posix, win32 } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { decode, encode } from '@jridgewell/sourcemap-codec';
import { build } from 'esbuild';
import { pruneSourceMap } from './scripts/prune-sourcemap.mjs';
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
import { getPreEngineeredVariants } from '@elite-dangerous-almanac/core/ships/pre-engineered';
import {
    getPreEngineeredJournalModifiers,
    unresolvedModifiers,
} from '@elite-dangerous-almanac/core/ships/pre-engineered-stats';
import { getDefaultLoadout } from '@elite-dangerous-almanac/core/ships/default-loadouts';
import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
import { hasWeaponDamageStats } from '@elite-dangerous-almanac/core/ships/module-capabilities';
import { LoadoutEditError, ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
import { UTILITY_MODULES } from '@elite-dangerous-almanac/core/ships/modules-utility';
import { getCommodityBySymbol } from '@elite-dangerous-almanac/core/commodities';
import { RARE_COMMODITIES } from '@elite-dangerous-almanac/core/commodities/commodities-rare';
import { toSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address-input';
import { sectorNameFromGalacticPosition } from '@elite-dangerous-almanac/core/astro/galaxy-grid';
import { parseSlef, toSlef, stringifySlef } from '@elite-dangerous-almanac/core/ships/slef';
import {
    getBlueprintCost,
    getBlueprintGradeCost,
} from '@elite-dangerous-almanac/core/ships/blueprint-costs';
import { getExperimentalEffectCost } from '@elite-dangerous-almanac/core/ships/experimental-effect-costs';
import {
    getBlueprintName,
    getEngineeringGroupName,
    getExperimentalEffectName,
    getExperimentalEffectDescription,
    getMaterialName,
    getMicroResourceName,
    getModuleName,
    getShipManufacturer,
    getShipName,
} from '@elite-dangerous-almanac/core/i18n';

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

async function reachableJsFiles(entry, seen = new Map()) {
    if (seen.has(entry.href)) return seen;

    const source = await readFile(entry, 'utf8');
    seen.set(entry.href, entry);
    const importPattern = /(?:from\s*|import\s*)['"](\.\.?\/[^'"]+\.js)['"]/g;
    for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (specifier) await reachableJsFiles(new URL(specifier, entry), seen);
    }
    return seen;
}

async function builtFilesEndingWith(
    suffix,
    directory = new URL('./dist/', import.meta.url),
    files = [],
) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            await builtFilesEndingWith(suffix, new URL(`${entry.name}/`, directory), files);
        } else if (entry.name.endsWith(suffix)) {
            files.push(new URL(entry.name, directory));
        }
    }
    return files;
}

async function relativeFiles(directory, prefix = '') {
    const files = [];
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )) {
        const relative = `${prefix}${entry.name}`;
        if (entry.isDirectory()) {
            files.push(
                ...(await relativeFiles(new URL(`${entry.name}/`, directory), `${relative}/`)),
            );
        } else if (entry.isFile()) {
            files.push(relative);
        }
    }
    return files;
}

function referencedSourceIndexes(map) {
    return new Set(
        decode(map.mappings).flatMap((line) =>
            line.filter((segment) => segment.length >= 4).map((segment) => segment[1]),
        ),
    );
}

async function consumerBundle(contents) {
    const result = await build({
        stdin: {
            contents,
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
    assert.equal(result.outputFiles.length, 1);
    return result.outputFiles[0].text;
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

test('system-address consumers exclude the named-region origin catalogue', async () => {
    const address = await readReachableJs(
        new URL('./dist/astro/system-address.js', import.meta.url),
    );
    assert.ok(
        address.length < 32 * 1024,
        `expected data-free address calculations, got ${address.length} bytes`,
    );
    assert.doesNotMatch(address, /Alrai Sector/);

    const codex = await readReachableJs(
        new URL('./dist/astro/codex-region-lookup.js', import.meta.url),
    );
    assert.doesNotMatch(codex, /Alrai Sector/);
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
    const festive = getPreEngineeredVariants('Hpt_FlakMortar_Turret_Medium').find(
        (variant) => variant.blueprint === 'Decorative_Green',
    );
    assert.ok(festive);
    assert.deepEqual(getPreEngineeredJournalModifiers(festive), [
        { Label: 'DamagePerSecond', Value: 0.17, OriginalValue: 17 },
        { Label: 'Damage', Value: 0.34, OriginalValue: 34 },
    ]);
    assert.deepEqual(unresolvedModifiers(festive), []);
    assert.equal(
        getDefaultLoadout('sidewinder')?.modules.find((module) => module.slot === 'FrameShiftDrive')
            ?.symbol,
        'Int_Hyperdrive_Size2_Class1',
    );
    const loadout = ShipLoadout.empty('Sidewinder').setModule(
        'FrameShiftDrive',
        getModuleBySymbol('Int_Hyperdrive_Size2_Class5'),
    );
    const moduleRecord = getModuleBySymbol('Int_Hyperdrive_Size2_Class5');
    assert.ok(moduleRecord);
    assert.equal(moduleRecord.engineeringGroup, 'frameShiftDrives');
    assert.equal('kind' in moduleRecord, false);
    const drive = loadout.fittedModuleAt('FrameShiftDrive');
    assert.equal(drive?.symbol, 'Int_Hyperdrive_Size2_Class5');
    assert.equal(
        loadout.slots('core').find((slot) => slot.core === 'frameShiftDrive')?.module?.symbol,
        drive?.symbol,
    );
    assert.ok(Object.isFrozen(drive));
    const chaff = getModuleBySymbol('Hpt_ChaffLauncher_Tiny', UTILITY_MODULES);
    assert.equal(chaff?.name, 'Chaff Launcher');
    assert.equal(hasWeaponDamageStats(chaff), false);
    assert.equal(hasWeaponDamageStats(getModuleBySymbol('Hpt_PulseLaser_Fixed_Small')), true);
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
    assert.equal(
        getBlueprintGradeCost('FSD_LongRange', 5)?.materials.find(
            (material) => material.symbol === 'DataminedWake',
        )?.count,
        1,
    );
    assert.equal(
        getBlueprintCost('FSD_LongRange', 5)?.materials.find(
            (material) => material.symbol === 'DataminedWake',
        )?.count,
        5,
    );
    assert.equal(getBlueprintCost('RailGun_LongShot', 5, 1)?.mercCoins, 415);
    assert.equal(getBlueprintCost('FSD_LongRange', 5)?.mercCoins, 0);
    assert.equal(
        getExperimentalEffectCost('special_fsd_heavy')?.find(
            (material) => material.symbol === 'HyperspaceTrajectories',
        )?.count,
        1,
    );
    assert.equal(getModuleName('Int_Hyperdrive_Size6_Class5', 'de-DE'), 'Frameshiftantrieb');
    assert.equal(getBlueprintName('FSD_LongRange', 'fr'), 'Portée FSD améliorée');
    assert.equal(
        getExperimentalEffectName('special_concordant_sequence', 'de'),
        'Konkordante Sequenz',
    );
    assert.equal(getMaterialName('GridResistors', 'de-DE'), 'Gitterwiderstände');
    assert.equal(getMicroResourceName('graphene', 'fr'), 'Graphène');
    assert.equal(getShipName('empire_trader', 'fr'), 'Imperial Clipper');
    assert.equal(getShipManufacturer('SideWinder', 'en-GB'), 'Faulcon DeLacy');
    assert.equal(getEngineeringGroupName('frameShiftDrives', 'en'), 'Frame Shift Drives');
    assert.equal(
        getExperimentalEffectDescription('special_auto_loader', 'en'),
        'Reloads the weapon while it continues firing.',
    );
});

test('localized-name datasets stay on their own leaf subpaths', async () => {
    const [
        modules,
        blueprints,
        effects,
        materials,
        microResources,
        ships,
        preEngineered,
        engineeringGroups,
        effectDescriptions,
        slots,
        diagnostics,
    ] = await Promise.all([
        consumerBundle(
            "import { getModuleName as value } from '@elite-dangerous-almanac/core/i18n/modules'; console.log(value);",
        ),
        consumerBundle(
            "import { getBlueprintName as value } from '@elite-dangerous-almanac/core/i18n/blueprints'; console.log(value);",
        ),
        consumerBundle(
            "import { getExperimentalEffectName as value } from '@elite-dangerous-almanac/core/i18n/experimental-effects'; console.log(value);",
        ),
        consumerBundle(
            "import { getMaterialName as value } from '@elite-dangerous-almanac/core/i18n/materials'; console.log(value);",
        ),
        consumerBundle(
            "import { getMicroResourceName as value } from '@elite-dangerous-almanac/core/i18n/micro-resources'; console.log(value);",
        ),
        consumerBundle(
            "import { getShipName as value } from '@elite-dangerous-almanac/core/i18n/ships'; console.log(value);",
        ),
        consumerBundle(
            "import { getPreEngineeredVariantName as value } from '@elite-dangerous-almanac/core/i18n/pre-engineered'; console.log(value);",
        ),
        consumerBundle(
            "import { getEngineeringGroupName as value } from '@elite-dangerous-almanac/core/i18n/engineering-groups'; console.log(value);",
        ),
        consumerBundle(
            "import { getExperimentalEffectDescription as value } from '@elite-dangerous-almanac/core/i18n/experimental-effect-descriptions'; console.log(value);",
        ),
        consumerBundle(
            "import { getLoadoutSlotName as value } from '@elite-dangerous-almanac/core/i18n/slots'; console.log(value);",
        ),
        consumerBundle(
            "import { getLoadoutIssueMessage as value } from '@elite-dangerous-almanac/core/i18n/diagnostics'; console.log(value);",
        ),
    ]);

    assert.ok(modules.length < 128 * 1024, `module-name bundle is ${modules.length} bytes`);
    assert.ok(blueprints.length < 40 * 1024, `blueprint-name bundle is ${blueprints.length} bytes`);
    assert.ok(effects.length < 40 * 1024, `effect-name bundle is ${effects.length} bytes`);
    assert.ok(materials.length < 64 * 1024, `material-name bundle is ${materials.length} bytes`);
    assert.ok(
        microResources.length < 72 * 1024,
        `micro-resource-name bundle is ${microResources.length} bytes`,
    );
    assert.ok(ships.length < 72 * 1024, `ship-name bundle is ${ships.length} bytes`);
    assert.ok(
        preEngineered.length < 72 * 1024,
        `pre-engineered-name bundle is ${preEngineered.length} bytes`,
    );
    assert.ok(
        engineeringGroups.length < 32 * 1024,
        `engineering-group-name bundle is ${engineeringGroups.length} bytes`,
    );
    assert.ok(
        effectDescriptions.length < 32 * 1024,
        `effect-description bundle is ${effectDescriptions.length} bytes`,
    );
    assert.ok(slots.length < 32 * 1024, `slot-name bundle is ${slots.length} bytes`);
    assert.ok(
        diagnostics.length < 24 * 1024,
        `diagnostic-message bundle is ${diagnostics.length} bytes`,
    );
    assert.doesNotMatch(modules, /Erhöhte FSA-Reichweite|Konkordante Sequenz/);
    assert.doesNotMatch(blueprints, /Frameshiftantrieb|Konkordante Sequenz/);
    assert.doesNotMatch(effects, /Frameshiftantrieb|Erhöhte FSA-Reichweite/);
    assert.doesNotMatch(materials, /Graphène|Frameshiftantrieb/);
    assert.doesNotMatch(microResources, /Gitterwiderstände|Frameshiftantrieb/);
    assert.doesNotMatch(
        ships,
        /Festive Red Remote Release Flak Launcher|Frame Shift Drives|Reloads the weapon/,
    );
    assert.doesNotMatch(preEngineered, /Faulcon DeLacy|Frame Shift Drives|Reloads the weapon/);
    assert.doesNotMatch(
        engineeringGroups,
        /Faulcon DeLacy|Festive Red Remote Release Flak Launcher|Reloads the weapon/,
    );
    assert.doesNotMatch(
        effectDescriptions,
        /Faulcon DeLacy|Festive Red Remote Release Flak Launcher|Frame Shift Drives/,
    );
    assert.doesNotMatch(
        slots,
        /Faulcon DeLacy|Festive Red Remote Release Flak Launcher|Frame Shift Drives|Reloads the weapon/,
    );
    assert.doesNotMatch(
        diagnostics,
        /Faulcon DeLacy|Festive Red Remote Release Flak Launcher|Frame Shift Drives|Reloads the weapon/,
    );
});

test('the ship-loadout subpath exports its facade and structured edit error', async () => {
    const loadout = await import('@elite-dangerous-almanac/core/ships/ship-loadout');
    assert.deepEqual(Object.keys(loadout), ['LoadoutEditError', 'ShipLoadout']);
    assert.ok(LoadoutEditError.prototype instanceof TypeError);
});

test('heavy catalogues stay on explicit subpaths', async () => {
    const [astro, ships, planetary, nebulae, modules] = await Promise.all([
        import('@elite-dangerous-almanac/core/astro'),
        import('@elite-dangerous-almanac/core/ships'),
        import('@elite-dangerous-almanac/core/astro/nebulae-planetary'),
        import('@elite-dangerous-almanac/core/astro/nebulae-all'),
        import('@elite-dangerous-almanac/core/ships/modules-all'),
    ]);

    for (const catalogue of ['PLANETARY_NEBULAE', 'ALL_NEBULAE']) {
        assert.ok(!(catalogue in astro), `${catalogue} leaked into the astro barrel`);
    }
    for (const catalogue of [
        'CORE_MODULES',
        'INTERNAL_MODULES',
        'HARDPOINT_MODULES',
        'UTILITY_MODULES',
        'ALL_MODULES',
    ]) {
        assert.ok(!(catalogue in ships), `${catalogue} leaked into the ships barrel`);
    }
    for (const costSymbol of [
        'BLUEPRINT_COSTS',
        'BLUEPRINT_MERC_COIN_COSTS',
        'getBlueprintCosts',
        'getBlueprintGradeCost',
        'getBlueprintCost',
        'EXPERIMENTAL_EFFECT_COSTS',
        'getExperimentalEffectCost',
    ]) {
        assert.ok(!(costSymbol in ships), `${costSymbol} leaked into the ships barrel`);
    }

    assert.equal(planetary.PLANETARY_NEBULAE.length, 5489);
    assert.equal(nebulae.ALL_NEBULAE.length, 5835);
    assert.equal(modules.ALL_MODULES.length, 1199);
});

test('codex-region geometry stays on its explicit lookup subpath', async () => {
    const [astro, lookup] = await Promise.all([
        import('@elite-dangerous-almanac/core/astro'),
        import('@elite-dangerous-almanac/core/astro/codex-region-lookup'),
    ]);
    const runtimeSymbols = [
        'findCodexRegionAt',
        'findCodexRegionForBoxel',
        'CODEX_REGION_MAP_X0',
        'CODEX_REGION_MAP_Y0',
        'CODEX_REGION_MAP_Z0',
        'CODEX_REGION_MAP_LY_PER_CELL',
    ];
    for (const symbol of runtimeSymbols) {
        assert.ok(!(symbol in astro), `${symbol} leaked into the astro barrel`);
        assert.ok(symbol in lookup, `${symbol} is missing from the direct lookup leaf`);
    }
    assert.equal(lookup.findCodexRegionAt({ x: 0, z: 0 })?.name, 'Inner Orion Spur');
    assert.equal(
        lookup.findCodexRegionForBoxel(3_309_179_996_515).region?.name,
        'Inner Orion Spur',
    );

    const [astroTypes, lookupTypes] = await Promise.all([
        readFile(new URL('./dist/astro/index.d.ts', import.meta.url), 'utf8'),
        readFile(new URL('./dist/astro/codex-region-lookup.d.ts', import.meta.url), 'utf8'),
    ]);
    const declarationsOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const symbol of [...runtimeSymbols, 'CodexRegionPoint', 'BoxelCodexRegionLookup']) {
        const name = new RegExp(`\\b${symbol}\\b`);
        assert.doesNotMatch(
            declarationsOnly(astroTypes),
            name,
            `${symbol} leaked into astro declarations`,
        );
        assert.match(
            declarationsOnly(lookupTypes),
            name,
            `${symbol} is missing from lookup declarations`,
        );
    }

    const [astroGraph, lookupGraph] = await Promise.all([
        readReachableJs(new URL('./dist/astro/index.js', import.meta.url)),
        readReachableJs(new URL('./dist/astro/codex-region-lookup.js', import.meta.url)),
    ]);
    // One budget, read from both sides: the region geometry is the largest thing in
    // `astro/`, so the barrel staying under it means the geometry is absent and the
    // lookup graph clearing it means the traversal actually found it. Both figures are
    // whitespace-compacted (`minify: 'terser'` in `tsup.config.ts`), so re-measure both
    // after a build change rather than moving the budget far enough that one failure
    // goes quiet.
    const GEOMETRY_BUDGET = 192 * 1024;
    assert.ok(astroGraph.length < GEOMETRY_BUDGET, `astro graph is ${astroGraph.length} bytes`);
    assert.ok(
        lookupGraph.length > GEOMETRY_BUDGET,
        `lookup traversal missed its geometry: ${lookupGraph.length} bytes`,
    );
    assert.doesNotMatch(astroGraph, /scaleNumerator/);
    assert.match(lookupGraph, /scaleNumerator/);

    const files = await reachableJsFiles(
        new URL('./dist/astro/codex-region-lookup.js', import.meta.url),
    );
    const maps = await Promise.all(
        [...files.values()].map(async (file) =>
            JSON.parse(await readFile(new URL(`${file.pathname}.map`, 'file:'), 'utf8')),
        ),
    );
    for (const suffix of ['src/astro/codex-region-lookup.ts']) {
        const map = maps.find((candidate) =>
            candidate.sources.some((source) => source.endsWith(suffix)),
        );
        assert.ok(map, `codex lookup has no source map entry for ${suffix}`);
        const index = map.sources.findIndex((source) => source.endsWith(suffix));
        assert.ok(referencedSourceIndexes(map).has(index), `${suffix} has no mapped segment`);
    }
});

test('generated public entries contain no redundant bare imports', async () => {
    for (const { file, specifier } of await publicEntries()) {
        const source = await readFile(file, 'utf8');
        assert.equal(stripBareImports(source), source, specifier);
    }
});

test('bare-import pruning preserves import-like text and value imports', () => {
    const source = `const message="import './keep.js'";import value from'./value.js';import'./remove.js';export{message,value};`;
    const bareImport = `import'./remove.js';`;
    assert.equal(
        stripBareImports(source),
        `const message="import './keep.js'";import value from'./value.js';${' '.repeat(bareImport.length)}export{message,value};`,
    );
});

test('a consumer bundle of every public entry produces no warnings', async () => {
    const entries = await publicEntries();
    const contents = entries
        .map(({ specifier }, index) => `import * as entry${index} from '${specifier}';`)
        .join('\n');
    await consumerBundle(
        `${contents}\nconsole.log(${entries.map((_, index) => `entry${index}`).join(',')});`,
    );
});

test('published pure annotations keep unused catalogue indexes tree-shakeable', async () => {
    const [sourceFiles, builtFiles] = await Promise.all([
        builtFilesEndingWith('.ts', new URL('./src/', import.meta.url)),
        builtFilesEndingWith('.js'),
    ]);
    const pureIndex = /\/\*\s*[@#]__PURE__\s*\*\/\s*createKeyIndex\(/g;
    const count = async (files) =>
        (await Promise.all(files.map((file) => readFile(file, 'utf8'))))
            .map((source) => [...source.matchAll(pureIndex)].length)
            .reduce((sum, matches) => sum + matches, 0);
    assert.equal(await count(builtFiles), await count(sourceFiles));

    // MaterialGrade shares a module with all 146 material records and three indexes.
    // Its tiny consumer bundle proves those initialisers remain removable instead of
    // merely proving that annotation-looking comments occur somewhere in `dist/`.
    const gradeBundle = await consumerBundle(
        "import { MaterialGrade } from '@elite-dangerous-almanac/core/materials/materials'; console.log(MaterialGrade.VeryRare);",
    );
    assert.ok(gradeBundle.length < 1024, `MaterialGrade bundle is ${gradeBundle.length} bytes`);
    assert.doesNotMatch(gradeBundle, /AdaptiveEncryptorsCapture|AbnormalCompactEmissionsData/);
});

test('catalogue-derived fields stay compact in consumer bundles', async () => {
    const [planetary, allNebulae, microResources] = await Promise.all([
        consumerBundle(
            "import { PLANETARY_NEBULAE as value } from '@elite-dangerous-almanac/core/astro/nebulae-planetary'; console.log(value);",
        ),
        consumerBundle(
            "import { ALL_NEBULAE as value } from '@elite-dangerous-almanac/core/astro/nebulae-all'; console.log(value);",
        ),
        consumerBundle(
            "import { getMicroResourceByName as value } from '@elite-dangerous-almanac/core/materials/micro-resources'; console.log(value);",
        ),
    ]);
    assert.ok(
        planetary.length < 416 * 1024,
        `planetary nebulae bundle is ${planetary.length} bytes`,
    );
    assert.ok(allNebulae.length < 448 * 1024, `all nebulae bundle is ${allNebulae.length} bytes`);
    assert.ok(
        microResources.length < 14 * 1024,
        `micro-resource bundle is ${microResources.length} bytes`,
    );
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

test('module capability guards do not pull the outfitting catalogues', async () => {
    const graph = await readReachableJs(
        new URL('./dist/ships/module-capabilities.js', import.meta.url),
    );
    assert.ok(graph.length < 4096, `expected a tiny module, got ${graph.length} bytes`);
    for (const marker of [/Hpt_PulseLaser/, /Int_Hyperdrive/, /Anaconda_Armour/]) {
        assert.doesNotMatch(graph, marker);
    }
});

test('reading and writing SLEF excludes heavyweight catalogues', async () => {
    // Engineering is identified structurally, so apps that only move builds must not pay
    // for module, variant, blueprint or ship catalogues.
    const graph = await readReachableJs(new URL('./dist/ships/slef.js', import.meta.url));
    assert.ok(graph.length < 16 * 1024, `expected a tiny module, got ${graph.length} bytes`);
    for (const marker of [
        /Decorative_Red/,
        /Anaconda/,
        /Chaff Launcher/,
        /FSD_LongRange/,
        /Witch Head/,
    ]) {
        assert.doesNotMatch(graph, marker);
    }
});

test('engineering menus and journal resolution do not bundle blueprint mechanics', async () => {
    // Menu-only consumers should not import the recipe catalogue.
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

    // Resolution needs the menus and three colliding journal spellings, not every recipe's
    // grades, modifiers and materials.
    const join = await readReachableJs(
        new URL('./dist/ships/blueprint-journal.js', import.meta.url),
    );
    assert.ok(join.length < 96 * 1024, `expected a resolver-only module, got ${join.length} bytes`);
    assert.match(join, /beamLasers/);
    for (const marker of [/FSDOptimalMass/, /Increased range/, /multiplicative/]) {
        assert.doesNotMatch(join, marker);
    }
});

test('engineering mechanics and shopping costs stay in separate leaf graphs', async () => {
    const [loadout, blueprints, blueprintCosts, effects, effectCosts] = await Promise.all([
        readReachableJs(new URL('./dist/ships/ship-loadout.js', import.meta.url)),
        readReachableJs(new URL('./dist/ships/blueprints.js', import.meta.url)),
        readReachableJs(new URL('./dist/ships/blueprint-costs.js', import.meta.url)),
        readReachableJs(new URL('./dist/ships/experimental-effects.js', import.meta.url)),
        readReachableJs(new URL('./dist/ships/experimental-effect-costs.js', import.meta.url)),
    ]);

    // `ShipLoadout.buildCost` prices a build in materials and Merc Coin as well as
    // credits, so the facade carries the shopping lists too — about 100 KiB of its graph.
    // The separation the rest of this test pins is between the leaf modules: a consumer
    // who wants mechanics or costs alone still imports one without the other.
    assert.ok(
        loadout.length < 1.2 * 1024 * 1024,
        `expected a loadout graph under the facade ceiling, got ${loadout.length} bytes`,
    );
    assert.match(loadout, /FSDOptimalMass/);
    assert.match(loadout, /DataminedWake/);
    assert.match(loadout, /HyperspaceTrajectories/);

    assert.ok(
        blueprints.length < 384 * 1024,
        `expected mechanics-only blueprints, got ${blueprints.length} bytes`,
    );
    assert.match(blueprints, /FSDOptimalMass/);
    assert.match(blueprints, /Increased range/);
    assert.doesNotMatch(blueprints, /DataminedWake/);

    assert.match(blueprintCosts, /DataminedWake/);
    // The cost calculator shares data-free roll/summing helpers with `engineering`, whose
    // calculation vocabulary includes FSDOptimalMass. The blueprint display name is the
    // catalogue-only sentinel that proves the mechanics payload itself is absent.
    assert.doesNotMatch(blueprintCosts, /Increased range/);

    assert.ok(
        effects.length < 40 * 1024,
        `expected mechanics-only experimental effects, got ${effects.length} bytes`,
    );
    assert.match(effects, /Mass Manager/);
    assert.doesNotMatch(effects, /HyperspaceTrajectories/);

    assert.match(effectCosts, /HyperspaceTrajectories/);
    assert.doesNotMatch(effectCosts, /Mass Manager/);
});

test('a single module catalogue does not bundle the others', async () => {
    const graph = await readReachableJs(
        new URL('./dist/ships/modules-utility.js', import.meta.url),
    );
    // The utility catalogue must not drag in the standard-category armour data.
    assert.doesNotMatch(graph, /Anaconda_Armour/);
    assert.match(graph, /Chaff Launcher/);
});

test('default-loadout identities do not bundle outfitting stats', async () => {
    const graph = await readReachableJs(
        new URL('./dist/ships/default-loadouts.js', import.meta.url),
    );
    assert.ok(graph.length < 64 * 1024, `default loadouts graph is ${graph.length} bytes`);
    assert.match(graph, /Int_Hyperdrive_Size2_Class1/);
    assert.doesNotMatch(graph, /FSD_LongRange/);
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

test('every runtime entry has one explicit public subpath', async () => {
    const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    const publicExports = Object.entries(pkg.exports).filter(([, target]) => target !== null);
    for (const [subpath, target] of publicExports) {
        assert.ok(!subpath.includes('*'), `public export ${subpath} is a wildcard`);
        assert.ok('types' in target, `public export ${subpath} has no declarations`);
        assert.ok('import' in target, `public export ${subpath} has no runtime entry`);
        assert.ok(
            !Object.values(target).some((path) => path.includes('*')),
            `public export ${subpath} has a wildcard target`,
        );
    }

    const builtSpecifiers = (await publicEntries()).map(({ specifier }) => specifier).sort();
    const exportedSpecifiers = publicExports
        .filter(([, target]) => 'import' in target)
        .map(([subpath]) => `@elite-dangerous-almanac/core/${subpath.slice(2)}`)
        .sort();
    assert.deepEqual(exportedSpecifiers, builtSpecifiers);
});

test('the package has no root entry', async () => {
    const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    assert.ok(!Object.hasOwn(pkg.exports, '.'));
    for (const field of ['main', 'module', 'types']) assert.ok(!Object.hasOwn(pkg, field));
    await assert.rejects(import('@elite-dangerous-almanac/core'), {
        code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
    for (const file of ['index.js', 'index.d.ts']) {
        await assert.rejects(readFile(new URL(`./dist/${file}`, import.meta.url)), {
            code: 'ENOENT',
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
    const { calculateModuleLimits } =
        await import('@elite-dangerous-almanac/core/ships/module-limits');
    assert.equal(powerBudget(10, [{ draw: 4, priority: 1 }]).headroom, 6);
    assert.ok(Math.abs(stackShieldResistance(0, [0.1, 0.1]) - 0.19) < 1e-9);
    assert.equal(weaponMetrics({ damage: 2, rateOfFire: 3 }).damagePerSecond, 6);
    assert.equal(ammunitionCapacity({ clipSize: 6, ammoMaximum: 120 }).total, 126);
    assert.equal(calculateModuleLimits([{ limitGroup: 'experimentalWeapon' }])[0].limit, 4);
});

test('each barrel ships its orientation documentation in the declarations', async () => {
    // A barrel is pure re-exports, so tsup's declaration rollup emits a flat export
    // list and drops the file-level comment. `scripts/attach-barrel-docs.mjs` puts it
    // back. Without it, a consumer who opens (or goes to definition on) the module
    // they just imported finds a bare export list, and the guidance that orients the
    // feature area ships only to the repository.
    const barrels = [
        'astro/index.d.ts',
        'ships/index.d.ts',
        'materials/index.d.ts',
        'commodities/index.d.ts',
    ];
    for (const file of barrels) {
        const text = await readFile(new URL(`./dist/${file}`, import.meta.url), 'utf8');
        assert.ok(
            text.startsWith('/**'),
            `dist/${file} lost its @packageDocumentation block — run \`pnpm run build\``,
        );
        assert.ok(
            text.includes('@packageDocumentation'),
            `dist/${file} has no @packageDocumentation`,
        );
        // Match on size, not on prose: a reworded intro is fine, a lost one is not.
        // The floor only has to separate "the guide" from "a stub". Feature-area
        // barrels run from ~980 to ~3100 characters, so this stays deliberately low.
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

test('every JavaScript artifact references a source map without embedded sources', async () => {
    const [javascriptFiles, mapFiles] = await Promise.all([
        builtFilesEndingWith('.js'),
        builtFilesEndingWith('.js.map'),
    ]);
    assert.ok(javascriptFiles.length > 100, 'expected the complete built package');
    assert.equal(mapFiles.length, javascriptFiles.length);

    const mapUrls = new Set(mapFiles.map((file) => file.href));
    let sourceMapBytes = 0;
    for (const javascriptFile of javascriptFiles) {
        const mapFile = new URL(`${javascriptFile.href}.map`);
        assert.ok(mapUrls.has(mapFile.href), `${javascriptFile.pathname} has no source map`);

        const [javascript, mapText] = await Promise.all([
            readFile(javascriptFile, 'utf8'),
            readFile(mapFile, 'utf8'),
        ]);
        sourceMapBytes += Buffer.byteLength(mapText);
        const map = JSON.parse(mapText);
        const mapName = mapFile.pathname.split('/').at(-1);
        assert.deepEqual(
            javascript.match(/\/\/# sourceMappingURL=[^\r\n]*/g),
            [`//# sourceMappingURL=${mapName}`],
            `${javascriptFile.pathname} must reference its source map exactly once`,
        );
        assert.ok(
            javascript.trimEnd().endsWith(`//# sourceMappingURL=${mapName}`),
            `${javascriptFile.pathname} does not reference its source map`,
        );
        assert.equal(map.version, 3, mapFile.pathname);
        assert.ok(!Object.hasOwn(map, 'sourceRoot'), `${mapFile.pathname} sets sourceRoot`);
        assert.ok(!Object.hasOwn(map, 'sourcesContent'), `${mapFile.pathname} embeds sources`);
        for (const source of map.sources) {
            assert.equal(
                posix.isAbsolute(source) || win32.isAbsolute(source),
                false,
                `${mapFile.pathname} contains absolute source ${source}`,
            );
            assert.doesNotMatch(
                source,
                /^[A-Za-z][A-Za-z\d+.-]*:/,
                `${mapFile.pathname} contains source URL ${source}`,
            );
            assert.match(
                source.replaceAll('\\', '/'),
                /(?:^|\/)src\/.+\.ts$/,
                `${mapFile.pathname} maps generated or non-portable source ${source}`,
            );
        }
        const decoded = decode(map.mappings);
        const sourceIndexes = new Set();
        const nameIndexes = new Set();
        for (const line of decoded) {
            for (const [index, segment] of line.entries()) {
                assert.ok(
                    segment.length === 1 || segment.length === 4 || segment.length === 5,
                    `${mapFile.pathname} contains an invalid mapping segment`,
                );
                if (segment.length === 1) {
                    assert.notEqual(
                        line[index - 1]?.length,
                        1,
                        `${mapFile.pathname} contains adjacent unmapped segments`,
                    );
                    continue;
                }
                assert.ok(
                    segment[1] >= 0 && segment[1] < map.sources.length,
                    `${mapFile.pathname} references missing source ${segment[1]}`,
                );
                sourceIndexes.add(segment[1]);
                if (segment.length === 5) {
                    assert.ok(
                        segment[4] >= 0 && segment[4] < map.names.length,
                        `${mapFile.pathname} references missing name ${segment[4]}`,
                    );
                    nameIndexes.add(segment[4]);
                }
            }
        }
        assert.ok(
            decoded.length <= javascript.split('\n').length,
            `${mapFile.pathname} contains mappings for lines absent from its JavaScript`,
        );
        if (map.sources.length > 0) {
            assert.ok(map.mappings.length > 0, `${mapFile.pathname} has no mappings`);
            assert.equal(
                sourceIndexes.size,
                map.sources.length,
                `${mapFile.pathname} retains an unused source`,
            );
        }
        assert.equal(
            nameIndexes.size,
            map.names.length,
            `${mapFile.pathname} retains an unused name`,
        );
    }
    assert.ok(
        sourceMapBytes < 256 * 1024,
        `TypeScript source maps are ${sourceMapBytes} bytes; expected less than 256 KiB`,
    );
});

test('source map pruning keeps one boundary around removed data mappings', () => {
    const map = {
        version: 3,
        sources: ['../src/first.ts', '../data/catalogue.jsonc', './generated.js', '../src/last.ts'],
        sourcesContent: ['first', 'catalogue', 'generated', 'last'],
        names: ['firstName', 'dataName', 'generatedName', 'lastName'],
        mappings: encode([
            [
                [0, 0, 1, 2, 0],
                [5, 1, 3, 4, 1],
                [7, 1, 5, 6, 1],
                [9, 2, 7, 8, 2],
                [11, 3, 9, 10, 3],
            ],
        ]),
    };
    const mapPath = fileURLToPath(new URL('./dist/example.js.map', import.meta.url));
    const distRoot = fileURLToPath(new URL('./dist/', import.meta.url));

    assert.equal(pruneSourceMap(map, mapPath, distRoot), 2);
    assert.deepEqual(map.sources, ['../src/first.ts', '../src/last.ts']);
    assert.deepEqual(map.sourcesContent, ['first', 'last']);
    assert.deepEqual(map.names, ['firstName', 'lastName']);
    assert.deepEqual(decode(map.mappings), [[[0, 0, 1, 2, 0], [5], [11, 1, 9, 10, 1]]]);

    const malformed = {
        version: 3,
        sources: ['../data/catalogue.jsonc'],
        names: [],
        mappings: encode([[[0, 99, 1, 2]]]),
    };
    assert.throws(() => pruneSourceMap(malformed, mapPath, distRoot), /missing source 99/);
});

test('engineering cost source maps retain their TypeScript source paths', async () => {
    for (const [entry, expected] of [
        ['blueprint-costs', ['src/ships/blueprint-costs.ts']],
        ['experimental-effect-costs', ['src/ships/experimental-effect-costs.ts']],
    ]) {
        const files = await reachableJsFiles(new URL(`./dist/ships/${entry}.js`, import.meta.url));
        const maps = await Promise.all(
            [...files.values()].map(async (file) =>
                JSON.parse(await readFile(new URL(`${file.pathname}.map`, 'file:'), 'utf8')),
            ),
        );
        for (const suffix of expected) {
            const map = maps.find((candidate) =>
                candidate.sources.some((source) => source.endsWith(suffix)),
            );
            assert.ok(map, `${entry} has no source map entry for ${suffix}`);
            const index = map.sources.findIndex((source) => source.endsWith(suffix));
            assert.ok(referencedSourceIndexes(map).has(index), `${suffix} has no mapped segment`);
        }
    }
});

test('published source maps resolve compact output to its TypeScript throw site', async () => {
    const source = await readFile(new URL('./src/ships/ship-loadout.ts', import.meta.url), 'utf8');
    const sourceLines = source.split('\n');
    const throwLine =
        sourceLines.findIndex(
            (line, index) =>
                line.includes('throw new RangeError(') &&
                sourceLines[index - 1]?.includes('if (!slot)'),
        ) + 1;
    assert.ok(throwLine > 0, 'could not find #requireSlot throw site');
    const mappedColumn = (sourceLines[throwLine - 1]?.indexOf('new RangeError') ?? -1) + 1;
    assert.ok(mappedColumn > 0, 'could not find #requireSlot mapped expression');

    const failure = spawnSync(
        process.execPath,
        [
            '--enable-source-maps',
            '--input-type=module',
            '--eval',
            "import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout'; import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules'; ShipLoadout.empty('Sidewinder').setModule('NotASlot', getModuleBySymbol('Int_Hyperdrive_Size2_Class5'));",
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
    );
    assert.notEqual(failure.status, 0);
    const stack = failure.stderr.replaceAll('\\', '/');
    // V8 renders a private method either as `#requireSlot` or as the transpiled
    // `_ShipLoadout.requireSlot`, depending on the Node.js patch release.
    assert.match(stack, /\bat (?:[\w$]+\.)?#?requireSlot\b/);
    assert.match(stack, new RegExp(`src/ships/ship-loadout\\.ts:${throwLine}:${mappedColumn}`));
});

test('types are exposed by owning runtime entries, not type-only subpaths', async () => {
    for (const file of [
        'astro/galactic-position.js',
        'ships/fitted-module.js',
        'ships/loadout-slot.js',
    ]) {
        for (const extension of ['.js', '.d.ts']) {
            await assert.rejects(
                readFile(new URL(`./dist/${file.replace(/\.js$/, extension)}`, import.meta.url)),
                { code: 'ENOENT' },
            );
        }
    }

    const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    for (const subpath of [
        './astro/galactic-position',
        './ships/fitted-module',
        './ships/loadout-slot',
    ]) {
        assert.ok(!Object.hasOwn(pkg.exports, subpath));
    }

    for (const [subpath, target] of Object.entries(pkg.exports)) {
        if (target === null) continue;
        await assert.doesNotReject(
            readFile(new URL(target.types, import.meta.url)),
            `${subpath} has no declaration artifact at ${target.types}`,
        );
    }

    const scratch = await mkdtemp(fileURLToPath(new URL('./.package-consumer-', import.meta.url)));
    try {
        const consumer = `${scratch}/consumer.ts`;
        await writeFile(
            consumer,
            [
                "import type { GalacticPosition } from '@elite-dangerous-almanac/core/astro';",
                "import type { FittedModule as FittedModuleFromBarrel } from '@elite-dangerous-almanac/core/ships';",
                "import type { FittedModule, ImmovableReason, LoadoutSlot } from '@elite-dangerous-almanac/core/ships/ship-loadout';",
                "import type { SystemAddressInput as AddressFromSystemAddress } from '@elite-dangerous-almanac/core/astro/system-address';",
                "import type { SystemAddressInput as AddressFromProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';",
                "import type { SystemAddressInput as AddressFromCodexLookup } from '@elite-dangerous-almanac/core/astro/codex-region-lookup';",
                "import type { SystemAddressInput as AddressFromLockedSystems } from '@elite-dangerous-almanac/core/astro/permit-locked-systems';",
                "import type { SystemAddressInput as AddressFromPermitLocks } from '@elite-dangerous-almanac/core/astro/permit-locks';",
                'declare const values: [GalacticPosition, FittedModuleFromBarrel, FittedModule, LoadoutSlot, ImmovableReason, AddressFromSystemAddress, AddressFromProceduralSystem, AddressFromCodexLookup, AddressFromLockedSystems, AddressFromPermitLocks];',
                'void values;',
            ].join('\n'),
        );
        const tsc = fileURLToPath(new URL('./node_modules/typescript/bin/tsc', import.meta.url));
        const result = spawnSync(
            process.execPath,
            [
                tsc,
                '--noEmit',
                '--strict',
                '--skipLibCheck',
                '--module',
                'NodeNext',
                '--moduleResolution',
                'NodeNext',
                '--target',
                'ES2022',
                consumer,
            ],
            { encoding: 'utf8', cwd: fileURLToPath(new URL('.', import.meta.url)) },
        );
        assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }

    const sourceMapComments = /^\s*\/\/# sourceMappingURL=[^\r\n]+\s*$/gm;
    async function assertNoEmptyJavaScript(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const file = new URL(entry.name, directory);
            if (entry.isDirectory()) {
                await assertNoEmptyJavaScript(new URL(`${entry.name}/`, directory));
            } else if (entry.name.endsWith('.js')) {
                const source = await readFile(file, 'utf8');
                assert.notEqual(
                    source.replace(sourceMapComments, '').trim(),
                    '',
                    `${file.pathname} has no runtime code`,
                );
            }
        }
    }
    await assertNoEmptyJavaScript(new URL('./dist/', import.meta.url));
});

test('the publication manifest includes consumer assets, documentation and notices', async () => {
    const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    assert.equal(pkg.license, 'SEE LICENSE IN LICENSE');
    assert.equal(
        pkg.repository.url,
        'git+https://github.com/DarkSession/Elite-Dangerous-Almanac.git',
    );
    assert.equal(pkg.homepage, 'https://github.com/DarkSession/Elite-Dangerous-Almanac#readme');
    assert.deepEqual(
        ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'PROVENANCE', 'assets'].map((name) => [
            name,
            pkg.files.includes(name),
        ]),
        [
            ['README.md', true],
            ['LICENSE', true],
            ['THIRD_PARTY_NOTICES.md', true],
            ['PROVENANCE', true],
            ['assets', true],
        ],
    );
    const readme = await readFile(new URL('./README.md', import.meta.url), 'utf8');
    assert.match(
        readme,
        /\]\(\.\/PROVENANCE\/SNAPSHOTS\.md\)/,
        'the packaged README must link to its local provenance record',
    );
    assert.match(readme, /data-feature="hardpoint"/);
    assert.match(readme, /data-feature="utility_mount"/);
    assert.match(readme, /data-journal-slot/);
    assert.match(readme, /same slot may occur once\s+on both sides/);
    assert.match(readme, /no\s+scripts,\s+styles,\s+event-handler\s+attributes/);

    // Provenance is separate from the legal notice so THIRD_PARTY_NOTICES can stay
    // byte-identical to the canonical ATTRIBUTIONS.md. The generated directory must
    // contain the snapshot policy and exactly one source record for every data domain:
    // a hard-coded list would silently omit the next feature area.
    const dataRoot = new URL('../data/', import.meta.url);
    const provenanceRoot = new URL('./PROVENANCE/', import.meta.url);
    const snapshots = await readFile(new URL('SNAPSHOTS.md', provenanceRoot), 'utf8');
    const canonicalSnapshots = await readFile(new URL('SNAPSHOTS.md', dataRoot), 'utf8');
    assert.equal(
        snapshots,
        canonicalSnapshots,
        'PROVENANCE/SNAPSHOTS.md is stale — run `pnpm run build`',
    );

    const canonicalDomains = (await readdir(dataRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const packagedEntries = await readdir(provenanceRoot, { withFileTypes: true });
    const packagedDomains = packagedEntries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const packagedFiles = packagedEntries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();
    assert.deepEqual(packagedDomains, canonicalDomains);
    assert.deepEqual(packagedFiles, ['SNAPSHOTS.md']);

    for (const domain of canonicalDomains) {
        const packaged = await readFile(new URL(`${domain}/SOURCES.md`, provenanceRoot), 'utf8');
        const canonical = await readFile(new URL(`${domain}/SOURCES.md`, dataRoot), 'utf8');
        assert.equal(
            packaged,
            canonical,
            `PROVENANCE/${domain}/SOURCES.md is stale — run \`pnpm run build\``,
        );
        assert.deepEqual(await readdir(new URL(`${domain}/`, provenanceRoot)), ['SOURCES.md']);
    }

    // The packaged notice is a generated copy of the repository's canonical
    // ATTRIBUTIONS.md. Assert it exists and is byte-identical: a missing or stale
    // copy would publish a tarball whose credits are wrong or absent, and several
    // upstream licences require the notice to travel with the distribution.
    const notices = await readFile(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
    const canonical = await readFile(new URL('../ATTRIBUTIONS.md', import.meta.url), 'utf8');
    assert.equal(
        notices,
        canonical,
        'THIRD_PARTY_NOTICES.md is stale — run `pnpm run build` (it copies ATTRIBUTIONS.md)',
    );
    assert.match(
        notices,
        /npm package includes matching copies under `PROVENANCE\/`/,
        'the shipped notice must identify its bundled provenance record',
    );
    // Every source the library takes something from has to be named in the shipped
    // notice, with its terms: the file is the one place a source is described.
    for (const source of [
        'EDCD FDevIDs',
        'EDCD/coriolis-data',
        'EDSY',
        'EliteDangerousRegionMap',
        'EDAstro',
        'Frontier Developments plc',
    ]) {
        assert.ok(notices.includes(source), `THIRD_PARTY_NOTICES.md must credit ${source}`);
    }
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
        'LICENSE is stale — run `pnpm run build` (it copies the root LICENSE)',
    );
    // Match on collapsed whitespace so line wrapping does not affect the assertion.
    const licenseProse = license.replace(/\s+/g, ' ');
    assert.match(licenseProse, /does not relicense bundled third-party/);
    assert.match(licenseProse, /before redistributing the data or using it commercially/);
});

test('the npm package contains byte-identical ship assets', async () => {
    const canonicalRoot = new URL('../assets/ships/', import.meta.url);
    const packagedRoot = new URL('./assets/ships/', import.meta.url);
    const canonicalFiles = await relativeFiles(canonicalRoot);
    const packagedFiles = await relativeFiles(packagedRoot);

    assert.equal(canonicalFiles.length, 48 * 4);
    assert.deepEqual(packagedFiles, canonicalFiles);
    for (const relative of canonicalFiles) {
        const [canonical, packaged] = await Promise.all([
            readFile(new URL(relative, canonicalRoot)),
            readFile(new URL(relative, packagedRoot)),
        ]);
        assert.deepEqual(packaged, canonical, `assets/ships/${relative} is stale`);
    }

    const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        encoding: 'utf8',
    });
    assert.equal(packed.status, 0, `${packed.stdout}${packed.stderr}`);
    const report = JSON.parse(packed.stdout);
    assert.equal(report.length, 1);
    const tarballAssets = report[0].files
        .map((file) => file.path)
        .filter((path) => path.startsWith('assets/ships/'))
        .sort();
    assert.deepEqual(
        tarballAssets,
        canonicalFiles.map((relative) => `assets/ships/${relative}`),
    );
});
