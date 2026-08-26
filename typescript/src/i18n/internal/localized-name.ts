/** Sparse localized-name catalogue lookup helpers. @internal */

import { requireString } from '../../internal/argument-guards.js';
import {
    CATALOGUE_KEY,
    findInKeyIndex,
    normalizeKey,
    type KeyIndex,
} from '../../internal/registry-index.js';
import type { CatalogueLocale } from '../locale.js';

/** One source-backed name, complete in English and sparse in every other locale. @internal */
type LocalizedName = Readonly<Partial<Record<CatalogueLocale, string>>> & {
    readonly en: string;
};

/** Localized names keyed directly by their owning catalogue's identifier. @internal */
export type LocalizedNameMap = Readonly<Record<string, LocalizedName>>;

/** A deduplicated name table and the identifiers that select its records. @internal */
export interface LocalizedNameCatalogue {
    readonly nameKeys: Readonly<Record<string, string>>;
    readonly names: Readonly<Record<string, LocalizedName>>;
}

/** An immutable normalized identifier-to-localized-name index. @internal */
type LocalizedNameIndex = KeyIndex<LocalizedName>;

const CANONICAL_LOCALE: Readonly<Record<string, CatalogueLocale>> = Object.freeze({
    en: 'en',
    de: 'de',
    es: 'es',
    fr: 'fr',
    pt: 'pt',
    ru: 'ru',
});

/**
 * Resolve a BCP 47 tag onto the stored locale it selects, or `undefined` for a locale no
 * catalogue carries. Every stored locale is a bare language tag, so a region or script
 * subtag is dropped rather than matched: `de-DE` selects `de`.
 * @internal
 */
function catalogueLocale(locale: string, label: string): CatalogueLocale | undefined {
    const language = requireString(locale, label)
        .trim()
        .replaceAll('_', '-')
        .toLowerCase()
        .split('-', 1)[0]!;
    // Object.hasOwn keeps `toString` and other prototype keys from resolving.
    return Object.hasOwn(CANONICAL_LOCALE, language) ? CANONICAL_LOCALE[language] : undefined;
}

/** Build a normalized index for a directly keyed localized-name map. @internal */
export function createLocalizedNameIndex(names: LocalizedNameMap): LocalizedNameIndex {
    const index = Object.create(null) as Record<string, LocalizedName>;
    for (const [identifier, name] of Object.entries(names)) {
        const key = normalizeKey(identifier, CATALOGUE_KEY);
        if (!Object.hasOwn(index, key)) index[key] = name;
    }
    return Object.freeze(index);
}

/** Build a normalized index while retaining shared module-name records. @internal */
export function createDeduplicatedLocalizedNameIndex(
    catalogue: LocalizedNameCatalogue,
): LocalizedNameIndex {
    const index = Object.create(null) as Record<string, LocalizedName>;
    for (const [identifier, nameKey] of Object.entries(catalogue.nameKeys)) {
        const name = catalogue.names[nameKey];
        if (name === undefined) continue;
        const key = normalizeKey(identifier, CATALOGUE_KEY);
        if (!Object.hasOwn(index, key)) index[key] = name;
    }
    return Object.freeze(index);
}

/** Select a localized value from one name record for a BCP 47 locale. */
function selectLocalizedName(
    names: LocalizedName | null,
    locale: string,
    functionName: string,
): string | null {
    // Resolved before the null check so an invalid locale is rejected on a missing record.
    const candidate = catalogueLocale(locale, `${functionName}: locale`);
    if (names === null || candidate === undefined) return null;
    return names[candidate] ?? null;
}

/** Select a localized value without building an identifier index. @internal */
export function getLocalizedText(
    names: LocalizedName | null,
    locale: string,
    functionName: string,
): string | null {
    return selectLocalizedName(names, locale, functionName);
}

/** Look up a localized name in a normalized identifier index. @internal */
export function getLocalizedName(
    names: LocalizedNameIndex,
    identifier: string,
    locale: string,
    functionName: string,
    identifierName: string,
): string | null {
    const record = findInKeyIndex(names, identifier, `${functionName}: ${identifierName}`);
    return selectLocalizedName(record, locale, functionName);
}
