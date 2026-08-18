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
export type LocalizedName = Readonly<Partial<Record<CatalogueLocale, string>>> & {
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
export type LocalizedNameIndex = KeyIndex<LocalizedName>;

const CANONICAL_LOCALE: Readonly<Record<string, CatalogueLocale>> = Object.freeze({
    en: 'en',
    de: 'de',
    es: 'es',
    fr: 'fr',
    hu: 'hu',
    it: 'it',
    ka: 'ka',
    pt: 'pt',
    'pt-br': 'pt-BR',
    ru: 'ru',
    'zh-cn': 'zh-CN',
});

/** Read a locale tag without admitting properties inherited from `Object.prototype`. */
function canonicalLocale(locale: string): CatalogueLocale | undefined {
    return Object.hasOwn(CANONICAL_LOCALE, locale) ? CANONICAL_LOCALE[locale] : undefined;
}

/**
 * Return the exact supported tag followed by its language fallback, when available.
 * @internal
 */
function localeCandidates(locale: string, label: string): readonly CatalogueLocale[] {
    const normalized = requireString(locale, label).trim().replaceAll('_', '-').toLowerCase();
    if (normalized === 'zh' || normalized === 'zh-hans' || normalized.startsWith('zh-hans-')) {
        return ['zh-CN'];
    }
    if (normalized.startsWith('zh-') && normalized !== 'zh-cn') return [];
    const exact = canonicalLocale(normalized);
    const language = canonicalLocale(normalized.split('-', 1)[0]!);
    if (exact === undefined) return language === undefined ? [] : [language];
    return language === undefined || language === exact ? [exact] : [exact, language];
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

/** Select a localized value from one name record with BCP 47 language fallback. */
function selectLocalizedName(
    names: LocalizedName | null,
    locale: string,
    functionName: string,
): string | null {
    const candidates = localeCandidates(locale, `${functionName}: locale`);
    if (names === null) return null;
    for (const candidate of candidates) {
        const name = names[candidate];
        if (name !== undefined) return name;
    }
    return null;
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
