/** Small, case-insensitive catalogue lookup helpers. @internal */

/** Keys whose non-null values are strings. */
type StringField<T extends object> = {
    [K in keyof T]-?: Exclude<T[K], null | undefined> extends string ? K : never;
}[keyof T] &
    string;

/** An immutable first-record-by-key index. */
export type KeyIndex<T> = Readonly<Record<string, T>>;

/** Normalize catalogue and consumer keys by trimming and folding case. */
export function normalizeKey(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Build an immutable first-record-by-key index for a fixed built-in catalogue.
 *
 * @remarks
 * This is intentionally explicit rather than cached. A domain pays for an index only
 * when it declares one for a hot built-in lookup; caller-supplied catalogues continue
 * through the scan helpers below, so mutable arrays and records never produce stale
 * answers. Duplicate keys retain the first record, matching `Array.prototype.find`.
 */
export function createKeyIndex<T extends object>(
    catalogue: readonly T[],
    field: StringField<T>,
): KeyIndex<T> {
    const index = Object.create(null) as Record<string, T>;
    for (const record of catalogue) {
        const raw = stringField(record, field);
        if (raw === null) continue;
        const key = normalizeKey(raw);
        if (!Object.hasOwn(index, key)) index[key] = record;
    }
    return Object.freeze(index);
}

/** Look up a normalized key in an immutable index. */
export function findInKeyIndex<T>(index: KeyIndex<T>, wanted: string): T | null {
    return index[normalizeKey(wanted)] ?? null;
}

/**
 * Look up a raw-keyed catalogue: exact key first, then a case-insensitive scan.
 *
 * @remarks
 * This is the counterpart to {@link findInKeyIndex} for a `Record` that keeps its
 * source's own casing — a Frontier `fdname` catalogue, say — rather than one built by
 * {@link createKeyIndex}. The own-property hit is both the fast path and the tie-break:
 * a catalogue holding two keys differing only in case answers the exact spelling first,
 * and only a miss pays for the scan. Prototype keys never match, so `'toString'` is a
 * miss unless the catalogue really holds it.
 */
export function findByRawKey<T>(catalogue: Readonly<Record<string, T>>, wanted: string): T | null {
    if (Object.hasOwn(catalogue, wanted)) return catalogue[wanted]!;
    const key = normalizeKey(wanted);
    for (const candidate of Object.keys(catalogue)) {
        if (normalizeKey(candidate) === key) return catalogue[candidate]!;
    }
    return null;
}

/** Find the first matching record by scanning the supplied catalogue. */
export function findByKey<T extends object>(
    catalogue: readonly T[],
    field: StringField<T>,
    wanted: string,
): T | null {
    const key = normalizeKey(wanted);
    return catalogue.find((record) => matches(stringField(record, field), key)) ?? null;
}

/** Find every matching record by scanning the supplied catalogue. */
export function filterByKey<T extends object>(
    catalogue: readonly T[],
    field: StringField<T>,
    wanted: string,
): T[] {
    const key = normalizeKey(wanted);
    return catalogue.filter((record) => matches(stringField(record, field), key));
}

function stringField<T extends object>(record: T, field: StringField<T>): string | null {
    const value = record[field];
    return typeof value === 'string' ? value : null;
}

function matches(raw: string | null, key: string): boolean {
    return raw !== null && normalizeKey(raw) === key;
}
