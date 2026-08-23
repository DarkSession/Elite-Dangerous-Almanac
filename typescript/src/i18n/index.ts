/**
 * Sparse, source-backed localized display names for Elite Dangerous outfitting and
 * engineering catalogues.
 *
 * Each lookup takes the same Frontier symbol or `fdname` as its owning catalogue and a
 * BCP 47 locale. English is complete and exactly matches the owning record's `name`.
 * Other locales are intentionally sparse: the function returns `null` when its pinned
 * sources carry no translation, leaving the application in control of fallback policy.
 * A source-backed localized spelling can be identical to English; the lookup returns
 * explicit source values verbatim but never manufactures an English fallback.
 * The catalogues carry English, French, German, Portuguese, Russian and Spanish only,
 * each stored under a bare language tag: a regional or script subtag is dropped
 * (`de-DE` → `de`), and any other language is an unsupported locale.
 *
 * Each dataset lives in a separate runtime module. Import from this barrel for
 * convenience or from the corresponding `i18n/*` subpath for an explicit bundle
 * boundary.
 *
 * Structured diagnostic helpers expose their current English fallback only for English
 * locales and return `null` otherwise, so a UI never mistakes English prose for a
 * requested translation. Stable codes and `params` remain available for applications
 * that supply their own message catalogues.
 *
 * @example
 * ```ts
 * import {
 *   getBlueprintName,
 *   getMaterialName,
 *   getModuleName,
 * } from '@elite-dangerous-almanac/core/i18n';
 *
 * getModuleName('Int_Hyperdrive_Size6_Class5', 'de'); // -> 'Frameshiftantrieb'
 * getBlueprintName('FSD_LongRange', 'de-DE'); // -> 'Erhöhte FSA-Reichweite'
 * getMaterialName('GridResistors', 'de'); // -> 'Gitterwiderstände'
 * ```
 *
 * @packageDocumentation
 */

export { getModuleName } from './modules.js';
export { getOutfittingFamilyName } from './module-families.js';
export { getBlueprintName } from './blueprints.js';
export { getExperimentalEffectName } from './experimental-effects.js';
export { getExperimentalEffectDescription } from './experimental-effect-descriptions.js';
export { getEngineeringGroupName } from './engineering-groups.js';
export { getMaterialName } from './materials.js';
export { getMicroResourceName } from './micro-resources.js';
export { getShipManufacturer, getShipName } from './ships.js';
export { getLoadoutSlotName, getSlotRestrictionLabel } from './slots.js';
export {
    getCalculationIssueMessage,
    getLoadoutEditErrorMessage,
    getLoadoutIssueMessage,
    getSlefDiagnosticMessage,
} from './diagnostics.js';
export {
    getPreEngineeredVariantName,
    type PreEngineeredVariantIdentity,
} from './pre-engineered.js';
export type { GameLocale } from './locale.js';
