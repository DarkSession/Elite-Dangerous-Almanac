#!/usr/bin/env node

import { readFileSync, writeSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { inspect } from 'node:util';
import { pathToFileURL } from 'node:url';

import { compareExampleValue } from './example-value-match.mjs';

const RESULT_MARKER = 'ALMANAC_EXAMPLE_RESULTS ';
// The imported snippet shares this realm. Keep the runner's bookkeeping and result
// protocol independent of any globals or prototypes it changes while executing.
const apply = Reflect.apply;
const arrayPush = Array.prototype.push;
const jsonStringify = JSON.stringify;
const numberIsInteger = Number.isInteger;
const objectDefineProperty = Object.defineProperty;
const resultFd = process.stdout.fd;
const resultWrite = writeSync;
const manifestPath = process.argv[2];
if (manifestPath === undefined) throw new TypeError('run-example-claims: expected a manifest path');

const entryIndex = Number(process.argv[3]);
if (!Number.isInteger(entryIndex) || entryIndex < 0) {
    throw new TypeError('run-example-claims: expected a non-negative manifest index');
}

const handshake = JSON.parse(readFileSync(0, 'utf8'));
if (typeof handshake?.nonce !== 'string' || handshake.nonce === '') {
    throw new TypeError('run-example-claims: invalid parent handshake');
}
const nonce = handshake.nonce;

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = manifest[entryIndex];
if (entry === undefined) throw new RangeError(`run-example-claims: no entry ${entryIndex}`);
const failures = [];
const checked = new Array(entry.claims.length).fill(false);

const exampleClaim = (evaluate, claimIndex) => {
    if (!numberIsInteger(claimIndex) || claimIndex < 0 || claimIndex >= entry.claims.length) {
        append(failures, {
            name: entry.name,
            claimId: null,
            file: entry.file,
            line: entry.line,
            code: 'EXV003',
            message: `runtime emitted unknown claim index ${encode(claimIndex)}`,
        });
        return;
    }

    const claim = entry.claims[claimIndex];
    checked[claimIndex] = true;
    let actual;
    try {
        actual = evaluate();
    } catch (error) {
        append(failures, {
            name: entry.name,
            claimId: claim.id,
            file: claim.file,
            line: claim.line,
            code: 'EXV002',
            message: `documented expression threw ${formatError(error)}`,
        });
        return;
    }

    const comparison = compareExampleValue(actual, claim.spec);
    if (comparison.pass) return actual;
    append(failures, {
        name: entry.name,
        claimId: claim.id,
        file: claim.file,
        line: claim.line,
        code: 'EXV001',
        message: `${comparison.message}; documented as ${encode(claim.expected)}`,
    });
    return actual;
};

// Every snippet has its own process, so the hook lives until that process exits. Keeping
// it non-writable and non-configurable prevents a snippet from saving the real function,
// replacing the property with a wrapper and making a false value appear to pass.
objectDefineProperty(globalThis, '__almanacExampleClaim', {
    value: exampleClaim,
    writable: false,
    configurable: false,
    enumerable: false,
});

try {
    await import(pathToFileURL(entry.target).href);
} catch (error) {
    append(failures, {
        name: entry.name,
        claimId: null,
        file: entry.file,
        line: entry.line,
        code: 'EXV004',
        message: `snippet threw outside a value claim: ${formatError(error)}`,
    });
}

for (let index = 0; index < entry.claims.length; index += 1) {
    if (checked[index]) continue;
    const claim = entry.claims[index];
    append(failures, {
        name: entry.name,
        claimId: claim.id,
        file: claim.file,
        line: claim.line,
        code: 'EXV005',
        message: 'documented expression did not execute',
    });
}

resultWrite(
    resultFd,
    `\n${RESULT_MARKER}${encodeResult(nonce, failures, countChecked(checked))}\n`,
);

function append(array, value) {
    apply(arrayPush, array, [value]);
}

function countChecked(values) {
    let count = 0;
    for (let index = 0; index < values.length; index += 1) {
        if (values[index]) count += 1;
    }
    return count;
}

function encodeResult(resultNonce, records, checkedCount) {
    let encoded = `{"nonce":${encode(resultNonce)},"failures":[`;
    for (let index = 0; index < records.length; index += 1) {
        if (index > 0) encoded += ',';
        const record = records[index];
        encoded +=
            `{"name":${encode(record.name)},"claimId":${encode(record.claimId)},` +
            `"file":${encode(record.file)},"line":${record.line},` +
            `"code":${encode(record.code)},"message":${encode(record.message)}}`;
    }
    return `${encoded}],"checked":${checkedCount}}`;
}

function encode(value) {
    return apply(jsonStringify, null, [value]);
}

function formatError(error) {
    return inspect(error);
}
