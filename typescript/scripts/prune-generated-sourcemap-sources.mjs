import { decode, encode } from '@jridgewell/sourcemap-codec';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));

function isWithin(directory, path) {
    const fromDirectory = relative(directory, path);
    return (
        fromDirectory === '' ||
        (!fromDirectory.startsWith(`..${sep}`) &&
            fromDirectory !== '..' &&
            !isAbsolute(fromDirectory))
    );
}

function pruneGeneratedSources(map, mapPath) {
    const generatedIndexes = new Set(
        map.sources.flatMap((source, index) => {
            const resolved = resolve(dirname(mapPath), map.sourceRoot ?? '', source);
            return isWithin(distRoot, resolved) ? [index] : [];
        }),
    );
    if (generatedIndexes.size === 0) return false;

    const sourceIndexAfterPruning = new Map();
    const sources = [];
    const sourcesContent = map.sourcesContent === undefined ? undefined : [];
    for (const [index, source] of map.sources.entries()) {
        if (generatedIndexes.has(index)) continue;
        sourceIndexAfterPruning.set(index, sources.length);
        sources.push(source);
        if (sourcesContent) sourcesContent.push(map.sourcesContent[index] ?? null);
    }

    const mappings = decode(map.mappings).map((line) =>
        line.map((segment) => {
            if (segment.length < 4) return segment;
            const sourceIndex = segment[1];
            const replacement = sourceIndexAfterPruning.get(sourceIndex);
            if (replacement === undefined) return [segment[0]];
            return [segment[0], replacement, segment[2], segment[3], ...segment.slice(4)];
        }),
    );

    map.sources = sources;
    map.mappings = encode(mappings);
    if (sourcesContent) map.sourcesContent = sourcesContent;
    return true;
}

let pruned = 0;
for (const relativePath of await readdir(distRoot, { recursive: true })) {
    if (!relativePath.endsWith('.js.map')) continue;
    const mapPath = resolve(distRoot, relativePath);
    const map = JSON.parse(await readFile(mapPath, 'utf8'));
    if (!pruneGeneratedSources(map, mapPath)) continue;
    await writeFile(mapPath, JSON.stringify(map));
    pruned++;
}

console.log(`pruned generated sources from ${pruned} JavaScript source map(s)`);
