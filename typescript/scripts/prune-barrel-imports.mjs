import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';

const barrels = [
    'dist/index.js',
    'dist/astro/index.js',
    'dist/ships/index.js',
    'dist/materials/index.js',
    'dist/commodities/index.js',
];

// With every public module built as an entry, esbuild can leave redundant bare imports
// in the generated barrels. The source package has no side effects, so downstream
// bundlers correctly discard them but warn while doing so. Remove only bare imports;
// imports that bind a value, and every re-export, remain untouched.
for (const barrel of barrels) {
    const source = await readFile(barrel, 'utf8');
    const cleaned = source.replace(/\bimport\s*['"][^'"]+['"];?/g, '');
    await writeFile(barrel, cleaned);
}

// Splitting also leaves empty shared chunks behind. Once the redundant barrel imports
// are gone they are unreachable package noise, so omit them from the tarball.
for (const name of await readdir('dist')) {
    if (!/^chunk-.+\.js$/.test(name)) continue;
    const path = `dist/${name}`;
    if ((await stat(path)).size === 0) await rm(path);
}
