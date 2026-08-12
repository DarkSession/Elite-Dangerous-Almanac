/** Small, case-insensitive catalogue lookup helpers. @internal */

import { requireString } from './argument-guards.js';

/** Keys whose non-null values are strings. */
type StringField<T extends object> = {
    [K in keyof T]-?: Exclude<T[K], null | undefined> extends string ? K : never;
}[keyof T] &
    string;

/** An immutable first-record-by-key index. */
export type KeyIndex<T> = Readonly<Record<string, T>>;

/**
 * The label for the catalogue's own side of a comparison, and for a catalogue index built
 * from bundled data. It names a failure a malformed data file would have to cause, never
 * a caller: the comparison paths reach {@link normalizeKey} only once `stringField` or
 * `Object.keys` has established a string, and the index builders read a `data/` payload.
 *
 * @internal
 */
export const CATALOGUE_KEY = 'catalogue key';

/**
 * Normalize catalogue and consumer keys by trimming and folding case.
 *
 * The catalogue lookup helpers in this module funnel consumer keys through here, so
 * this is also where those lookups catch a wrong-typed key. Other case-insensitive
 * comparisons — such as structural parsing and exact game slot identifiers — define
 * their own normalization rules at their public entry points. Invalid catalogue keys
 * fail with a message that names the public parameter and received value.
 *
 * **A nullish key is not a wrong type.** It stays a miss, which is what the whole
 * lookup family answers for a key no record carries, and what an optional field an
 * import did not carry has to keep meaning — an engineering block with no
 * `ExperimentalEffect` must compare equal to a catalogue entry that has none. The
 * strict factories (`ProceduralSystem.fromName`, `ShipLoadout.empty`) are where a
 * missing argument is loud; a search is not.
 *
 * @param value - The key to normalize.
 * @param label - How to name it in a failure, `"function: parameter"` — see
 * {@link requireString}. Callers pass the *public* parameter they received, so a lookup
 * reached through a facade still names the function the consumer called.
 * @throws {TypeError} If `value` is present and not a string.
 */
export function normalizeKey(value: string, label: string): string;
/** Preserve an absent optional key while normalizing a present one. */
export function normalizeKey(value: string | undefined, label: string): string | undefined;
export function normalizeKey(value: string | undefined, label: string): string | undefined {
    return value == null ? undefined : requireString(value, label).trim().toLowerCase();
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
        const key = normalizeKey(raw, CATALOGUE_KEY);
        if (!Object.hasOwn(index, key)) index[key] = record;
    }
    return Object.freeze(index);
}

/**
 * Look up a normalized key in an immutable index.
 *
 * @param label - How to name `wanted` in a failure — see {@link normalizeKey}.
 */
export function findInKeyIndex<T>(index: KeyIndex<T>, wanted: string, label: string): T | null {
    return index[normalizeKey(wanted, label)] ?? null;
}

/**
 * Look up a raw-keyed catalogue: exact key first, then a case-insensitive scan.
 *
 * @remarks
 * This is the counterpart to {@link findInKeyIndex} for a `Record` that keeps its
 * source's own casing — a Frontier `fdname` catalogue, say — rather than one built by
 * {@link createKeyIndex}. The own-property hit is both the fast path and the tie-break:
 * a catalogue holding two keys differing only in case answers the exact spelling first,
 * and only a miss pays for the scan. Inherited keys never match, so `'toString'` is a
 * miss unless the catalogue really holds it; the scan reads own *enumerable* keys, so a
 * hidden own key is reachable by its exact spelling only.
 *
 * @param label - How to name `wanted` in a failure — see {@link normalizeKey}. The key
 * is normalized before the own-property hit is tried, so a wrong-typed key fails here
 * rather than reaching the catalogue as a property name.
 */
export function findByRawKey<T>(
    catalogue: Readonly<Record<string, T>>,
    wanted: string,
    label: string,
): T | null {
    const key = normalizeKey(wanted, label);
    if (Object.hasOwn(catalogue, wanted)) return catalogue[wanted]!;
    for (const candidate of Object.keys(catalogue)) {
        if (normalizeKey(candidate, CATALOGUE_KEY) === key) return catalogue[candidate]!;
    }
    return null;
}

/**
 * Find the first matching record by scanning the supplied catalogue.
 *
 * @param label - How to name `wanted` in a failure — see {@link normalizeKey}.
 */
export function findByKey<T extends object>(
    catalogue: readonly T[],
    field: StringField<T>,
    wanted: string,
    label: string,
): T | null {
    const key = normalizeKey(wanted, label);
    return catalogue.find((record) => matches(stringField(record, field), key)) ?? null;
}

/**
 * Find every matching record by scanning the supplied catalogue.
 *
 * @param label - How to name `wanted` in a failure — see {@link normalizeKey}.
 */
export function filterByKey<T extends object>(
    catalogue: readonly T[],
    field: StringField<T>,
    wanted: string,
    label: string,
): T[] {
    const key = normalizeKey(wanted, label);
    return catalogue.filter((record) => matches(stringField(record, field), key));
}

function stringField<T extends object>(record: T, field: StringField<T>): string | null {
    const value = record[field];
    return typeof value === 'string' ? value : null;
}

function matches(raw: string | null, key: string): boolean {
    return raw !== null && normalizeKey(raw, CATALOGUE_KEY) === key;
}
