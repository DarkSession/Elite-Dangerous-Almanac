import { decode, encode } from '@jridgewell/sourcemap-codec';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

function isWithin(directory, path) {
    const fromDirectory = relative(directory, path);
    return (
        fromDirectory === '' ||
        (!fromDirectory.startsWith(`..${sep}`) &&
            fromDirectory !== '..' &&
            !isAbsolute(fromDirectory))
    );
}

function shouldPruneSource(source, mapPath, distRoot, sourceRoot) {
    if (source.replaceAll('\\', '/').endsWith('.jsonc')) return true;
    const resolved = resolve(dirname(mapPath), sourceRoot ?? '', source);
    return isWithin(distRoot, resolved);
}

function compactUnmappedSegments(line) {
    return line.filter(
        (segment, index) => segment.length > 1 || index === 0 || line[index - 1].length > 1,
    );
}

export function pruneSourceMap(map, mapPath, distRoot) {
    const prunedSourceIndexes = new Set(
        map.sources.flatMap((source, index) =>
            shouldPruneSource(source, mapPath, distRoot, map.sourceRoot) ? [index] : [],
        ),
    );

    const sourceIndexAfterPruning = new Map();
    const sources = [];
    const sourcesContent = map.sourcesContent === undefined ? undefined : [];
    for (const [index, source] of map.sources.entries()) {
        if (prunedSourceIndexes.has(index)) continue;
        sourceIndexAfterPruning.set(index, sources.length);
        sources.push(source);
        if (sourcesContent) sourcesContent.push(map.sourcesContent[index] ?? null);
    }

    const decoded = decode(map.mappings).map((line) =>
        compactUnmappedSegments(
            line.map((segment) => {
                if (segment.length < 4) return segment;
                const replacement = sourceIndexAfterPruning.get(segment[1]);
                if (replacement === undefined) return [segment[0]];
                return [segment[0], replacement, segment[2], segment[3], ...segment.slice(4)];
            }),
        ),
    );

    const referencedNameIndexes = new Set(
        decoded.flatMap((line) =>
            line.filter((segment) => segment.length === 5).map((segment) => segment[4]),
        ),
    );
    const nameIndexAfterPruning = new Map();
    const names = [];
    for (const [index, name] of map.names.entries()) {
        if (!referencedNameIndexes.has(index)) continue;
        nameIndexAfterPruning.set(index, names.length);
        names.push(name);
    }
    for (const line of decoded) {
        for (const segment of line) {
            if (segment.length !== 5) continue;
            const replacement = nameIndexAfterPruning.get(segment[4]);
            if (replacement === undefined) throw new Error(`missing retained name ${segment[4]}`);
            segment[4] = replacement;
        }
    }

    map.sources = sources;
    map.names = names;
    map.mappings = encode(decoded);
    if (sourcesContent) map.sourcesContent = sourcesContent;
    return prunedSourceIndexes.size;
}
