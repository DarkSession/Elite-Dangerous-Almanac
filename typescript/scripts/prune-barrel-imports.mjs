import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { stripBareImports } from './strip-bare-imports.mjs';

// With every public module built as an entry, esbuild can leave redundant bare imports
// in generated entry files. The source package has no side effects, so downstream
// bundlers correctly discard these imports but warn while doing so. Shared chunks are
// deliberately left untouched because they are implementation modules, not entries.
// Parse the generated ESM before blanking bare imports so import-like text in string
// literals or comments remains untouched. Imports that bind a value, and every
// re-export, remain too. Blanking rather than shortening the file preserves source-map
// positions emitted by tsup.
const files = (await readdir('dist', { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => `${entry.parentPath}/${entry.name}`);
for (const entry of files.filter((path) => !path.split('/').at(-1)?.startsWith('chunk-'))) {
    const source = await readFile(entry, 'utf8');
    const cleaned = stripBareImports(source);
    if (cleaned !== source) await writeFile(entry, cleaned);
}

// Declaration-only dependencies can still make esbuild emit zero-code shared chunks.
// Once the entry files' redundant bare imports are blanked above, those chunks are
// unreachable implementation artifacts; do not publish them or their source maps.
const sourceMapComments = /^\s*\/\/# sourceMappingURL=[^\r\n]+\s*$/gm;
for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (source.replace(sourceMapComments, '').trim() !== '') continue;

    await unlink(file);
    await unlink(`${file}.map`).catch((error) => {
        if (error?.code !== 'ENOENT') throw error;
    });
}
