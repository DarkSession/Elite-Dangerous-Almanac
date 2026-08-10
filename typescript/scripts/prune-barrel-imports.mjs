import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { stripBareImports } from './strip-bare-imports.mjs';

async function javascriptFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) files.push(...(await javascriptFiles(path)));
        else if (entry.name.endsWith('.js')) files.push(path);
    }
    return files;
}

// With every public module built as an entry, esbuild can leave redundant bare imports
// in generated entry files. The source package has no side effects, so downstream
// bundlers correctly discard these imports but warn while doing so. Shared chunks are
// deliberately left untouched because they are implementation modules, not entries.
// Parse the generated ESM before blanking bare imports so import-like text in string
// literals or comments remains untouched. Imports that bind a value, and every
// re-export, remain too. Blanking rather than shortening the file preserves source-map
// positions emitted by tsup.
const files = await javascriptFiles('dist');
for (const entry of files.filter((path) => !path.split('/').at(-1)?.startsWith('chunk-'))) {
    const source = await readFile(entry, 'utf8');
    const cleaned = stripBareImports(source);
    if (cleaned !== source) await writeFile(entry, cleaned);
}

// Type-only public modules need declarations but have no JavaScript API. tsup emits
// zero-code entry files for them, plus zero-code shared chunks imported only by the
// bare declarations removed above. Do not publish those misleading runtime files.
const sourceMapComments = /^\s*\/\/# sourceMappingURL=[^\r\n]+\s*$/gm;
for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (source.replace(sourceMapComments, '').trim() !== '') continue;

    await unlink(file);
    await unlink(`${file}.map`).catch((error) => {
        if (error?.code !== 'ENOENT') throw error;
    });
}
