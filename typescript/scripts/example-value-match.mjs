import { inspect } from 'node:util';

/**
 * Compare a runtime value with a parsed documented-value claim.
 *
 * This module deliberately has no TypeScript dependency: the runtime runner loads it in
 * the same process as tsx and the JSONC hook, while parsing and instrumentation happen in
 * the parent process.
 *
 * @param {unknown} actual - The expression's runtime value.
 * @param {object} spec - A spec returned by `parseExpectedClaim`.
 * @returns {{ pass: boolean, message?: string }}
 */
export function compareExampleValue(actual, spec) {
    const mismatch = compareEncoded(actual, spec, 'value');
    return mismatch === null ? { pass: true } : { pass: false, message: mismatch };
}

function compareEncoded(actual, spec, path) {
    switch (spec.kind) {
        case 'undefined':
            return actual === undefined ? null : expectedMessage(path, 'undefined', actual);
        case 'null':
            return actual === null ? null : expectedMessage(path, 'null', actual);
        case 'boolean':
        case 'string':
        case 'number-exact':
            return Object.is(actual, spec.value)
                ? null
                : expectedMessage(path, inspect(spec.value), actual);
        case 'bigint': {
            const expected = BigInt(spec.value);
            return actual === expected ? null : expectedMessage(path, `${expected}n`, actual);
        }
        case 'number-special': {
            const expected = Number(spec.value);
            return Object.is(actual, expected) ? null : expectedMessage(path, spec.value, actual);
        }
        case 'number-rounded': {
            if (typeof actual !== 'number' || !Number.isFinite(actual)) {
                return expectedMessage(
                    path,
                    `${spec.text} at ${spec.decimalPlaces} decimal places`,
                    actual,
                );
            }
            const expected = spec.value.toFixed(spec.decimalPlaces);
            const received = actual.toFixed(spec.decimalPlaces);
            return received === expected
                ? null
                : `${path}: expected ${expected} when rounded to ${spec.decimalPlaces} decimal places, received ${inspect(actual)}`;
        }
        case 'number-prefix': {
            if (typeof actual !== 'number' || !Number.isFinite(actual)) {
                return expectedMessage(path, `a finite number beginning ${spec.prefix}`, actual);
            }
            const received = String(actual);
            return received.startsWith(spec.prefix)
                ? null
                : `${path}: expected a decimal beginning ${spec.prefix}, received ${received}`;
        }
        case 'array': {
            if (!Array.isArray(actual)) return expectedMessage(path, 'an array', actual);
            if (actual.length !== spec.items.length) {
                return `${path}: expected an array of length ${spec.items.length}, received length ${actual.length}`;
            }
            for (const [index, item] of spec.items.entries()) {
                const mismatch = compareEncoded(actual[index], item, `${path}[${index}]`);
                if (mismatch !== null) return mismatch;
            }
            return null;
        }
        case 'object': {
            if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
                return expectedMessage(path, 'an object', actual);
            }
            const expectedKeys = spec.entries.map(([key]) => key).sort();
            const actualKeys = Object.keys(actual).sort();
            if (
                expectedKeys.length !== actualKeys.length ||
                expectedKeys.some((key, index) => key !== actualKeys[index])
            ) {
                return `${path}: expected keys ${inspect(expectedKeys)}, received ${inspect(actualKeys)}`;
            }
            for (const [key, value] of spec.entries) {
                const mismatch = compareEncoded(actual[key], value, `${path}.${key}`);
                if (mismatch !== null) return mismatch;
            }
            return null;
        }
        default:
            return `${path}: unsupported claim kind ${inspect(spec.kind)}`;
    }
}

function expectedMessage(path, expected, actual) {
    return `${path}: expected ${expected}, received ${inspect(actual)}`;
}
