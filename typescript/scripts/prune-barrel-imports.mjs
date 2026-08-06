import { readFile, readdir, writeFile } from 'node:fs/promises';

async function entryFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) files.push(...(await entryFiles(path)));
        else if (entry.name.endsWith('.js') && !entry.name.startsWith('chunk-')) files.push(path);
    }
    return files;
}

// With every public module built as an entry, esbuild can leave redundant bare imports
// in generated entry files. The source package has no side effects, so downstream
// bundlers correctly discard these imports but warn while doing so. Shared chunks are
// deliberately left untouched because they are implementation modules, not entries.
// Remove only bare imports; imports that bind a value, and every re-export, remain.
for (const entry of await entryFiles('dist')) {
    const source = await readFile(entry, 'utf8');
    const cleaned = source.replace(/\bimport\s*['"][^'"]+['"];?/g, '');
    if (cleaned !== source) await writeFile(entry, cleaned);
}
