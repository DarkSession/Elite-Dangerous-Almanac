import { spawnSync } from 'node:child_process';

import { EXAMPLE_CLAIM_MARKER, EXAMPLE_CLAIM_MATCHED_MARKER } from './example-value-match.mjs';

/** Execute each documented snippet in its own bounded Node process. */
export function runExampleEntries(
    entries,
    { cwd, imports = [], timeoutMs = 10_000, nodePath = process.execPath },
) {
    const failures = [];
    let checked = 0;
    let matched = 0;

    for (const entry of entries) {
        const result = spawnSync(
            nodePath,
            [...imports.flatMap((specifier) => ['--import', specifier]), entry.target],
            {
                cwd,
                encoding: 'utf8',
                timeout: timeoutMs,
                killSignal: 'SIGKILL',
                maxBuffer: 10 * 1024 * 1024,
            },
        );
        const lines = (result.stdout ?? '').split(/\r?\n/);
        const executed = markerIndexes(lines, EXAMPLE_CLAIM_MARKER, entry.claims.length);
        const successful = markerIndexes(lines, EXAMPLE_CLAIM_MATCHED_MARKER, entry.claims.length);
        checked += executed.size;
        matched += successful.size;

        for (const [index, claim] of entry.claims.entries()) {
            if (executed.has(index)) continue;
            failures.push({
                name: entry.name,
                file: entry.file,
                line: claim.line ?? entry.line,
                code: 'EXV005',
                message: 'documented expression did not execute',
            });
        }

        if (result.status === 0 && result.error === undefined) continue;
        const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
        failures.push({
            name: entry.name,
            file: entry.file,
            line: entry.line,
            code: 'EXV001',
            message:
                result.error?.code === 'ETIMEDOUT'
                    ? `runtime process exceeded its ${timeoutMs} ms timeout`
                    : `runtime process failed: ${result.error?.message ?? (output || `(exit ${result.status})`)}`,
        });
    }

    return { failures, checked, matched };
}

function markerIndexes(lines, marker, claimCount) {
    return new Set(
        lines
            .filter((line) => line.startsWith(marker))
            .map((line) => Number(line.slice(marker.length)))
            .filter((index) => Number.isInteger(index) && index >= 0 && index < claimCount),
    );
}
