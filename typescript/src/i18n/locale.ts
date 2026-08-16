/**
 * A locale tag accepted by at least one localized game-name lookup.
 *
 * @remarks
 * English (`en`) is complete because it is the canonical name already published by the
 * Almanac. Every other locale is sparse and source-dependent. A lookup accepts any
 * string rather than only this union so callers can pass their application locale
 * directly: a regional tag such as `de-DE` falls back to `de`, while an unsupported tag
 * or a missing translation returns `null`. Chinese is script-sensitive: unqualified
 * `zh` and explicit Simplified Chinese tags such as `zh-CN` and `zh-Hans` select the
 * source's Simplified Chinese values, while `zh-TW`, `zh-Hant` and other Chinese
 * regional or script tags do not fall back across scripts.
 * A source may explicitly publish a localized value whose spelling equals the canonical
 * English name. Lookups return that source value verbatim; they never generate an
 * English fallback for a missing locale.
 *
 * `pt` is retained because that is the exact language tag published by EDSY and Odyssey
 * Materials Helper. EDDI additionally distinguishes Brazilian Portuguese (`pt-BR`) and
 * Simplified Chinese (`zh-CN`). Odyssey Materials Helper also supplies sparse Georgian
 * (`ka`) material and micro-resource names.
 *
 * @example
 * ```ts
 * import type { GameLocale } from '@elite-dangerous-almanac/core/i18n';
 *
 * const locale: GameLocale = 'de';
 * locale; // -> 'de'
 * ```
 */
/** Locale keys stored in the shared localized-name catalogues. @internal */
export type CatalogueLocale =
    'en' | 'de' | 'es' | 'fr' | 'hu' | 'it' | 'ka' | 'pt' | 'pt-BR' | 'ru' | 'zh-CN';

export type GameLocale =
    'en' | 'de' | 'es' | 'fr' | 'hu' | 'it' | 'ka' | 'pt' | 'pt-BR' | 'ru' | 'zh' | 'zh-CN';
