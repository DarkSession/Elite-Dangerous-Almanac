#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { inspect } from 'node:util';
import { pathToFileURL } from 'node:url';

import { compareExampleValue } from './example-value-match.mjs';

const RESULT_MARKER = 'ALMANAC_EXAMPLE_RESULTS ';
const manifestPath = process.argv[2];
if (manifestPath === undefined) throw new TypeError('run-example-claims: expected a manifest path');

const entryIndex = Number(process.argv[3]);
if (!Number.isInteger(entryIndex) || entryIndex < 0) {
    throw new TypeError('run-example-claims: expected a non-negative manifest index');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = manifest[entryIndex];
if (entry === undefined) throw new RangeError(`run-example-claims: no entry ${entryIndex}`);
const claims = new Map();
for (const claim of entry.claims) claims.set(claim.id, { ...claim, entry });

const failures = [];
const checked = new Set();

globalThis.__almanacExampleClaim = (evaluate, id) => {
    const claim = claims.get(id);
    if (claim === undefined) {
        failures.push({
            name: entry.name,
            file: entry.file,
            line: entry.line,
            code: 'EXV003',
            message: `runtime emitted unknown claim id ${JSON.stringify(id)}`,
        });
        return;
    }

    checked.add(id);
    let actual;
    try {
        actual = evaluate();
    } catch (error) {
        failures.push({
            name: claim.entry.name,
            claimId: id,
            file: claim.file,
            line: claim.line,
            code: 'EXV002',
            message: `documented expression threw ${formatError(error)}`,
        });
        return;
    }

    const comparison = compareExampleValue(actual, claim.spec);
    if (comparison.pass) return actual;
    failures.push({
        name: claim.entry.name,
        claimId: id,
        file: claim.file,
        line: claim.line,
        code: 'EXV001',
        message: `${comparison.message}; documented as ${JSON.stringify(claim.expected)}`,
    });
    return actual;
};

try {
    try {
        await import(pathToFileURL(entry.target).href);
    } catch (error) {
        failures.push({
            name: entry.name,
            file: entry.file,
            line: entry.line,
            code: 'EXV004',
            message: `snippet threw outside a value claim: ${formatError(error)}`,
        });
    }

    for (const claim of entry.claims) {
        if (checked.has(claim.id)) continue;
        failures.push({
            name: entry.name,
            claimId: claim.id,
            file: claim.file,
            line: claim.line,
            code: 'EXV005',
            message: 'documented expression did not execute',
        });
    }
} finally {
    delete globalThis.__almanacExampleClaim;
}

process.stdout.write(`${RESULT_MARKER}${JSON.stringify({ failures, checked: checked.size })}\n`);

function formatError(error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : inspect(error);
}
