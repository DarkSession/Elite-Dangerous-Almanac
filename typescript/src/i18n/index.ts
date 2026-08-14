/**
 * Sparse, source-backed localized display names for Elite Dangerous outfitting and
 * engineering catalogues.
 *
 * Each lookup takes the same Frontier symbol or `fdname` as its owning catalogue and a
 * BCP 47 locale. English is complete and exactly matches the owning record's `name`.
 * Other locales are intentionally sparse: the function returns `null` when its pinned
 * sources carry no translation, leaving the application in control of fallback policy.
 * Regional tags normally use language fallback (`de-DE` → `de`). Unqualified `zh`
 * selects Simplified Chinese (`zh-CN`), while other Chinese scripts and regions do not
 * fall back across scripts.
 *
 * The three datasets live in separate runtime modules. Import from this barrel for
 * convenience or from `i18n/modules`, `i18n/blueprints` and
 * `i18n/experimental-effects` for an explicit bundle boundary.
 *
 * Diagnostics remain English for logs but expose stable codes and structured `params`
 * on `LoadoutIssue`, `CalculationIssue` and `SlefDiagnostic`, allowing consumers to
 * compose localized messages without parsing prose.
 *
 * @example
 * ```ts
 * import {
 *   getBlueprintName,
 *   getModuleName,
 * } from '@elite-dangerous-almanac/core/i18n';
 *
 * getModuleName('Int_Hyperdrive_Size6_Class5', 'de'); // -> 'Frameshiftantrieb'
 * getBlueprintName('FSD_LongRange', 'de-DE'); // -> 'Erhöhte FSA-Reichweite'
 * ```
 *
 * @packageDocumentation
 */

export { getModuleName } from './modules.js';
export { getBlueprintName } from './blueprints.js';
export { getExperimentalEffectName } from './experimental-effects.js';
export type { GameLocale } from './locale.js';
