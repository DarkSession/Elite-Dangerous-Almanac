/**
 * A locale tag accepted by at least one localized game-name lookup.
 *
 * @remarks
 * English (`en`) is complete because it is the canonical name already published by the
 * Almanac. Every other locale is sparse and source-dependent. A lookup accepts any
 * string rather than only this union so callers can pass their application locale
 * directly: a regional tag such as `de-DE` falls back to `de`, while an unsupported tag
 * or a missing translation returns `null`.
 * A source may explicitly publish a localized value whose spelling equals the canonical
 * English name. Lookups return that source value verbatim; they never generate an
 * English fallback for a missing locale.
 *
 * The catalogues carry English, French, German, Russian and Spanish and no other
 * language. Several accepted sources publish more — Portuguese, Brazilian Portuguese,
 * Italian, Hungarian, Georgian and Simplified Chinese among them — and those values are
 * deliberately not stored, so every one of those tags is an unsupported locale that
 * returns `null`.
 *
 * @example
 * ```ts
 * import type { GameLocale } from '@elite-dangerous-almanac/core/i18n';
 *
 * const locale: GameLocale = 'de';
 * locale; // -> 'de'
 * ```
 */
export type GameLocale = 'en' | 'de' | 'es' | 'fr' | 'ru';

/** Locale keys stored in the shared localized-name catalogues. @internal */
export type CatalogueLocale = GameLocale;
