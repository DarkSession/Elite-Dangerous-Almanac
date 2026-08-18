/**
 * Argument guards for public entry points, so a wrong-typed argument fails with a
 * message naming the parameter and the value instead of an internal property-access
 * error from somewhere further in.
 *
 * TypeScript consumers are largely protected by the signatures; these guards are for
 * JavaScript callers and for parsed journal data handed straight in.
 *
 * @internal
 */

/**
 * Longest value preview {@link describeValue} embeds, in UTF-16 code units.
 *
 * An error message identifies the argument; it does not reproduce it. A caller who
 * hands a whole SLEF payload where a symbol belongs gets enough of it to recognise
 * what they passed, not the payload back.
 */
const PREVIEW_LIMIT = 60;

/**
 * Render a value for an error message: its type, plus the value itself whenever that
 * can be shown safely.
 *
 * Strings are quoted, primitives are printed, and an object or function is described by
 * its type followed by a JSON preview. Either rendering of a value is truncated past
 * {@link PREVIEW_LIMIT}; an object's is omitted entirely when the value cannot be
 * serialized (a cycle, a `bigint` inside, a function). `null` and `undefined` are
 * rendered bare — naming their type as well would say the same thing twice.
 *
 * @internal
 */
export function describeValue(value: unknown): string {
    if (value === null || value === undefined) return String(value);

    const type = typeof value;
    if (type === 'string') return `string ${truncate(JSON.stringify(value))}`;
    if (type === 'object' || type === 'function') {
        const preview = previewOf(value);
        return preview === null ? type : `${type} ${preview}`;
    }
    return `${type} ${truncate(value)}`;
}

/**
 * Require a string argument.
 *
 * @param value - The argument as received.
 * @param label - How to name it in the message, `"Class.method: parameter"`.
 * @returns `value`, narrowed to `string`.
 * @throws {TypeError} If `value` is not a string. The message names the parameter and
 * the value received.
 * @internal
 */
export function requireString(value: unknown, label: string): string {
    if (typeof value !== 'string') {
        throw new TypeError(`${label} must be a string, received ${describeValue(value)}`);
    }
    return value;
}

/**
 * Require a string argument at an entry point where a nullish one is an answer rather
 * than a failure.
 *
 * A parser that tolerates an absent field, and a lookup that reads a missing key as a
 * miss, both have to keep saying so; what neither should do is let a *present* value of
 * the wrong type through to fail on a property it does not have.
 *
 * @param value - The argument as received.
 * @param label - How to name it in the message, `"function: parameter"`.
 * @throws {TypeError} If `value` is present and not a string.
 * @internal
 */
export function requireStringIfPresent(value: unknown, label: string): void {
    if (value !== null && value !== undefined) requireString(value, label);
}

/**
 * Require a non-null object argument.
 *
 * @param value - The argument as received.
 * @param label - How to name it in the message, `"function: parameter"`.
 * @throws {TypeError} If `value` is not an object.
 * @internal
 */
export function requireObject(value: unknown, label: string): asserts value is object {
    if (value === null || typeof value !== 'object') {
        throw new TypeError(`${label} must be an object, received ${describeValue(value)}`);
    }
}

/** A short JSON rendering of a value, or `null` when it has none. */
function previewOf(value: unknown): string | null {
    let json;
    try {
        json = JSON.stringify(value);
    } catch {
        return null; // A cycle, or a `bigint` somewhere inside.
    }
    if (json === undefined) return null; // A function, or an object of only those.
    return truncate(json);
}

/**
 * Shorten a caller-controlled value to {@link PREVIEW_LIMIT}, marking that it was
 * shortened.
 *
 * Every exception or validation message that reproduces a caller-supplied argument or
 * capture field uses this preview policy. The original value remains intact in any
 * structured diagnostic field. `unknown` is intentional: reporting loosely typed JSON
 * must not fail merely because a value did not have its declared TypeScript type.
 *
 * @internal
 */
export function truncate(value: unknown): string {
    let text: string;
    try {
        text = String(value);
    } catch {
        // A JavaScript caller can supply an object whose conversion hook throws. The
        // diagnostic still has to report the original failure instead of replacing it.
        text = '<unprintable>';
    }
    if (text.length <= PREVIEW_LIMIT) return text;
    // Never end on the leading half of a surrogate pair the cut split in two.
    const cut = /[\uD800-\uDBFF]$/.test(text.slice(0, PREVIEW_LIMIT))
        ? PREVIEW_LIMIT - 1
        : PREVIEW_LIMIT;
    return `${text.slice(0, cut)}…`;
}
