import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruneSourceMap } from './prune-sourcemap.mjs';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));

let prunedMaps = 0;
let prunedSources = 0;
for (const relativePath of await readdir(distRoot, { recursive: true })) {
    if (!relativePath.endsWith('.js.map')) continue;
    const mapPath = resolve(distRoot, relativePath);
    const map = JSON.parse(await readFile(mapPath, 'utf8'));
    const removed = pruneSourceMap(map, mapPath, distRoot);
    if (removed === 0) continue;
    await writeFile(mapPath, JSON.stringify(map));
    prunedMaps++;
    prunedSources += removed;
}

console.log(`pruned ${prunedSources} generated or JSONC sources from ${prunedMaps} source map(s)`);
