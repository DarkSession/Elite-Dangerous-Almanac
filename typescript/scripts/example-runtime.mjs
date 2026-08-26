import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const RESULT_MARKER = 'ALMANAC_EXAMPLE_RESULTS ';

/**
 * Execute each documented snippet in its own Node process.
 *
 * Process isolation is intentional: examples are independent promises, so one snippet
 * must not make a later one pass by changing a global, an intrinsic prototype or an
 * imported module singleton. A timeout or broken result fails only that snippet and the
 * loop continues to the rest.
 *
 * @param {object[]} entries - Runtime manifest entries, in manifest order.
 * @param {{ manifestPath: string, runner: string, cwd: string, imports?: string[], timeoutMs?: number, nodePath?: string }} options
 * @returns {{ failures: object[], checked: number }}
 */
export function runExampleEntries(
    entries,
    { manifestPath, runner, cwd, imports = [], timeoutMs = 10_000, nodePath = process.execPath },
) {
    const failures = [];
    let checked = 0;

    for (const [index, entry] of entries.entries()) {
        const importArgs = imports.flatMap((specifier) => ['--import', specifier]);
        // The nonce reaches the runner over stdin, is consumed before the documented
        // snippet is imported, and is never exposed through argv, the environment or
        // the manifest. An example can print convincing result markers, but it cannot
        // authenticate one as the runner's final record.
        const nonce = randomBytes(32).toString('base64url');
        const result = spawnSync(nodePath, [...importArgs, runner, manifestPath, String(index)], {
            cwd,
            encoding: 'utf8',
            input: JSON.stringify({ nonce }),
            timeout: timeoutMs,
            killSignal: 'SIGKILL',
            maxBuffer: 10 * 1024 * 1024,
        });
        const stdout = result.stdout ?? '';
        const output = `${stdout}${result.stderr ?? ''}`;

        if (result.error !== undefined || result.status !== 0) {
            const timedOut = result.error?.code === 'ETIMEDOUT';
            const message = timedOut
                ? `runtime process exceeded its ${timeoutMs} ms timeout`
                : `runtime process failed: ${result.error?.message ?? (output.trim() || `(exit ${result.status})`)}`;
            failures.push(processFailure(entry, 'EXV006', message));
            failures.push(...unverifiedClaims(entry, message));
            continue;
        }

        const authenticated = authenticatedResults(stdout, nonce);
        if (authenticated.length !== 1) {
            const message =
                authenticated.length === 0
                    ? `runtime process returned no authenticated result${output.trim() === '' ? '' : `: ${output.trim()}`}`
                    : 'runtime process returned multiple authenticated results';
            failures.push(processFailure(entry, 'EXV007', message));
            failures.push(...unverifiedClaims(entry, message));
            continue;
        }

        const parsed = authenticated[0];
        if (!Array.isArray(parsed.failures) || !Number.isInteger(parsed.checked)) {
            const message = 'runtime process returned a malformed result object';
            failures.push(processFailure(entry, 'EXV007', message));
            failures.push(...unverifiedClaims(entry, message));
            continue;
        }

        checked += parsed.checked;
        failures.push(...parsed.failures);
    }

    return { failures, checked };
}

function authenticatedResults(stdout, nonce) {
    const results = [];
    for (const line of stdout.split(/\r?\n/)) {
        if (!line.startsWith(RESULT_MARKER)) continue;
        try {
            const parsed = JSON.parse(line.slice(RESULT_MARKER.length));
            if (parsed !== null && typeof parsed === 'object' && parsed.nonce === nonce) {
                results.push(parsed);
            }
        } catch {
            // A snippet may print arbitrary marker-like text. Only a parseable record
            // carrying the pre-import nonce participates in authentication.
        }
    }
    return results;
}

function processFailure(entry, code, message) {
    return {
        name: entry.name,
        file: entry.file,
        line: entry.line,
        code,
        message,
    };
}

function unverifiedClaims(entry, reason) {
    return entry.claims.map((claim) => ({
        name: entry.name,
        claimId: claim.id,
        file: claim.file,
        line: claim.line,
        code: 'EXV005',
        message: `documented expression was not verified because its ${reason}`,
    }));
}
