/**
 * Keyed lookup over a catalogue, without a linear scan per call.
 *
 * The ship, module, commodity, material and micro-resource registries all answer the
 * same two questions — "which record has this key" and "which records share it" — over
 * an array a caller may narrow. Doing that with `Array.prototype.find` costs a pass
 * over the whole catalogue and a `toLowerCase()` per candidate: on the 1199-record
 * module catalogue, ~44 µs for an average hit, ~88 µs for one near the end and ~86 µs
 * for a miss.
 *
 * These helpers build the buckets once per (catalogue, field) pair and reuse them, so
 * those become ~0.2 µs. The first lookup against a given catalogue pays for the index
 * instead — ~430 µs for 1199 records, about five scans' worth — so a call site that
 * asks a large catalogue only one or two questions in the whole process is slower, and
 * one that asks repeatedly is hundreds of times faster.
 *
 * `astro/nebulae` deliberately keeps its own scan: its catalogues reach 5835 records,
 * but importing this module into the astro bundle would cost every astro consumer the
 * helper whether or not they resolve a nebula by name.
 *
 * **Only a catalogue that cannot change is indexed** — the array frozen *and* every
 * record frozen. Freezing the array alone fixes which records are in it and says
 * nothing about their key values, so a caller's `Object.freeze([...records])` over
 * mutable records would be indexed and then answer from keys the records no longer
 * carry. Anything that fails the test is scanned linearly, exactly as before. Every
 * catalogue this package exports is deeply frozen, so every default argument and every
 * published subset takes the fast path.
 *
 * @internal
 */

/**
 * The lookup key for a value: case- and whitespace-insensitive.
 *
 * Both sides of a comparison go through this, so a catalogue value and a caller's
 * string are normalised identically. No catalogue value carries surrounding
 * whitespace, so trimming the record side matches what the per-module lookups did
 * before and only widens what a hand-assembled record can match.
 *
 * @internal
 */
export function normalizeKey(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Per-catalogue, per-field buckets. Keyed on the array itself, so an index lives
 * exactly as long as the catalogue it describes and a caller's array is collected
 * with its index rather than pinned by it.
 */
const INDEXES = new WeakMap<readonly object[], Map<string, Map<string, readonly unknown[]>>>();

/**
 * Catalogues already found to be mutable, so the O(n) check below is paid once each
 * rather than per lookup.
 *
 * @remarks
 * Safe to remember because freezing only ever goes one way: a catalogue that is
 * mutable now may be frozen later, and continuing to scan it is always correct — only
 * slower — whereas the reverse would not be.
 */
const UNINDEXABLE = new WeakSet<readonly object[]>();

/**
 * Whether `catalogue` is immutable enough to index: the array frozen so its membership
 * cannot change, and every record frozen so the key read off it cannot change either.
 *
 * A shallow `Object.isFrozen` per record is the right test for how this is used — a key
 * is a string **data** property read straight off the record, so freezing the record
 * pins it, and what a record's *nested* values do cannot affect the index. It does not
 * pin a key reached any other way: `Object.freeze` leaves an accessor in place, so a
 * record whose key is a getter, or a `keyOf` that reads through a nested value, reports
 * frozen and can still answer differently. Every call site here reads an own data
 * property.
 */
function indexable(catalogue: readonly object[]): boolean {
    if (INDEXES.has(catalogue)) return true;
    if (UNINDEXABLE.has(catalogue)) return false;
    if (!Object.isFrozen(catalogue) || !catalogue.every((record) => Object.isFrozen(record))) {
        UNINDEXABLE.add(catalogue);
        return false;
    }
    return true;
}

/**
 * The records of `catalogue` grouped by `field`, in catalogue order within each bucket,
 * or `null` when `catalogue` can still change and so cannot be safely cached.
 */
function bucketsFor<T extends object>(
    catalogue: readonly T[],
    field: keyof T & string,
    keyOf: (record: T) => string | null | undefined,
): Map<string, readonly T[]> | null {
    if (!indexable(catalogue)) return null;
    let byField = INDEXES.get(catalogue);
    if (byField === undefined) {
        byField = new Map();
        INDEXES.set(catalogue, byField);
    }
    const cached = byField.get(field);
    if (cached !== undefined) return cached as Map<string, readonly T[]>;

    const buckets = new Map<string, T[]>();
    for (const record of catalogue) {
        const raw = keyOf(record);
        // A record that does not carry the field joins no bucket, so it can never be
        // returned for any key — including the empty string.
        if (raw === null || raw === undefined) continue;
        const key = normalizeKey(raw);
        const bucket = buckets.get(key);
        if (bucket === undefined) buckets.set(key, [record]);
        else bucket.push(record);
    }
    byField.set(field, buckets as Map<string, readonly unknown[]>);
    return buckets;
}

/** Whether a record's raw key value matches an already-normalised wanted key. */
function matches(raw: string | null | undefined, key: string): boolean {
    return raw !== null && raw !== undefined && normalizeKey(raw) === key;
}

/**
 * The first record whose `field` matches `wanted`, or `null` if none does.
 *
 * First, not last: this replaces `Array.prototype.find`, and a catalogue that ever
 * carried one key twice must keep answering with the earlier record.
 *
 * @param catalogue - The records to search.
 * @param field - The record property `keyOf` reads. Names the cached index, so two
 * fields of one catalogue do not share one; passing a name that disagrees with `keyOf`
 * would file the wrong values under it.
 * @param keyOf - Reads the key off a record; `null`/`undefined` means "no key".
 * @param wanted - The key to match, normalised the same way as the records'.
 * @returns The matching record, or `null`.
 * @internal
 */
export function findByKey<T extends object>(
    catalogue: readonly T[],
    field: keyof T & string,
    keyOf: (record: T) => string | null | undefined,
    wanted: string,
): T | null {
    const key = normalizeKey(wanted);
    const buckets = bucketsFor(catalogue, field, keyOf);
    if (buckets === null) {
        return catalogue.find((record) => matches(keyOf(record), key)) ?? null;
    }
    return buckets.get(key)?.[0] ?? null;
}

/**
 * Every record whose `field` matches `wanted`, in catalogue order.
 *
 * @param catalogue - The records to search.
 * @param field - The record property `keyOf` reads; see {@link findByKey}.
 * @param keyOf - Reads the key off a record; `null`/`undefined` means "no key".
 * @param wanted - The key to match, normalised the same way as the records'.
 * @returns A new array each call, so a caller cannot reach the cached bucket and
 * mutate a later caller's answer. Empty when nothing matches.
 * @internal
 */
export function filterByKey<T extends object>(
    catalogue: readonly T[],
    field: keyof T & string,
    keyOf: (record: T) => string | null | undefined,
    wanted: string,
): T[] {
    const key = normalizeKey(wanted);
    const buckets = bucketsFor(catalogue, field, keyOf);
    if (buckets === null) {
        return catalogue.filter((record) => matches(keyOf(record), key));
    }
    const bucket = buckets.get(key);
    return bucket === undefined ? [] : [...bucket];
}
