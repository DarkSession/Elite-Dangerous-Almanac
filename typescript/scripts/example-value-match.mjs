import { inspect } from 'node:util';

// Documented snippets run in this realm and can legitimately assign to globals or
// prototypes. Capture every intrinsic operation used for assertion before a snippet is
// imported so the value being checked cannot redefine what "matches" means.
const apply = Reflect.apply;
const arrayIsArray = Array.isArray;
const bigintFrom = BigInt;
const numberFrom = Number;
const numberIsFinite = Number.isFinite;
const numberToFixed = Number.prototype.toFixed;
const objectIs = Object.is;
const objectKeys = Object.keys;
const stringFrom = String;
const stringStartsWith = String.prototype.startsWith;

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
            return objectIs(actual, spec.value)
                ? null
                : expectedMessage(path, inspect(spec.value), actual);
        case 'bigint': {
            const expected = bigintFrom(spec.value);
            return actual === expected ? null : expectedMessage(path, `${expected}n`, actual);
        }
        case 'number-special': {
            const expected = numberFrom(spec.value);
            return objectIs(actual, expected) ? null : expectedMessage(path, spec.value, actual);
        }
        case 'number-rounded': {
            if (typeof actual !== 'number' || !numberIsFinite(actual)) {
                return expectedMessage(
                    path,
                    `${spec.text} at ${spec.decimalPlaces} decimal places`,
                    actual,
                );
            }
            const expected = apply(numberToFixed, spec.value, [spec.decimalPlaces]);
            const received = apply(numberToFixed, actual, [spec.decimalPlaces]);
            return received === expected
                ? null
                : `${path}: expected ${expected} when rounded to ${spec.decimalPlaces} decimal places, received ${inspect(actual)}`;
        }
        case 'number-prefix': {
            if (typeof actual !== 'number' || !numberIsFinite(actual)) {
                return expectedMessage(path, `a finite number beginning ${spec.prefix}`, actual);
            }
            const received = stringFrom(actual);
            return apply(stringStartsWith, received, [spec.prefix])
                ? null
                : `${path}: expected a decimal beginning ${spec.prefix}, received ${received}`;
        }
        case 'array': {
            if (!arrayIsArray(actual)) return expectedMessage(path, 'an array', actual);
            if (actual.length !== spec.items.length) {
                return `${path}: expected an array of length ${spec.items.length}, received length ${actual.length}`;
            }
            for (let index = 0; index < spec.items.length; index += 1) {
                const mismatch = compareEncoded(
                    actual[index],
                    spec.items[index],
                    `${path}[${index}]`,
                );
                if (mismatch !== null) return mismatch;
            }
            return null;
        }
        case 'object': {
            if (actual === null || typeof actual !== 'object' || arrayIsArray(actual)) {
                return expectedMessage(path, 'an object', actual);
            }
            const actualKeys = objectKeys(actual);
            if (!sameObjectKeys(spec.entries, actualKeys)) {
                const expectedKeys = [];
                for (let index = 0; index < spec.entries.length; index += 1) {
                    expectedKeys[index] = spec.entries[index][0];
                }
                return `${path}: expected keys ${inspect(expectedKeys)}, received ${inspect(actualKeys)}`;
            }
            for (let index = 0; index < spec.entries.length; index += 1) {
                const key = spec.entries[index][0];
                const mismatch = compareEncoded(
                    actual[key],
                    spec.entries[index][1],
                    `${path}.${key}`,
                );
                if (mismatch !== null) return mismatch;
            }
            return null;
        }
        default:
            return `${path}: unsupported claim kind ${inspect(spec.kind)}`;
    }
}

function sameObjectKeys(expectedEntries, actualKeys) {
    if (expectedEntries.length !== actualKeys.length) return false;
    for (let expectedIndex = 0; expectedIndex < expectedEntries.length; expectedIndex += 1) {
        const expected = expectedEntries[expectedIndex][0];
        let found = false;
        for (let actualIndex = 0; actualIndex < actualKeys.length; actualIndex += 1) {
            if (actualKeys[actualIndex] === expected) {
                found = true;
                break;
            }
        }
        if (!found) return false;
    }
    return true;
}

function expectedMessage(path, expected, actual) {
    return `${path}: expected ${expected}, received ${inspect(actual)}`;
}
