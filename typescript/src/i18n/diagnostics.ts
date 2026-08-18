/** Locale-aware access to the English fallback carried by structured diagnostics. */

import type { CalculationIssue } from '../ships/loadout-calculations.js';
import type { LoadoutIssue } from '../ships/loadout-validation.js';
import type { LoadoutEditError } from '../ships/ship-loadout.js';
import type { SlefDiagnostic } from '../ships/slef.js';
import { requireString } from '../internal/argument-guards.js';
import { getLocalizedText } from './internal/localized-name.js';

function diagnosticMessage(
    diagnostic: { readonly message: string } | null,
    locale: string,
    functionName: string,
    parameterName: string,
): string | null {
    if (diagnostic === null || typeof diagnostic !== 'object') {
        throw new TypeError(`${functionName}: ${parameterName} must be an object`);
    }
    const message = requireString(diagnostic.message, `${functionName}: ${parameterName}.message`);
    return getLocalizedText({ en: message }, locale, functionName);
}

/**
 * Resolve a loadout-validation issue's fallback message.
 * @param issue - A structured issue returned by `validateLoadout`.
 * @param locale - A BCP 47 locale.
 * @returns The issue's English message for an English locale, otherwise `null`.
 * @throws {TypeError} If `issue` is not an object with a string `message`, or `locale`
 * is not a string.
 */
export function getLoadoutIssueMessage(issue: LoadoutIssue, locale: string): string | null {
    return diagnosticMessage(issue, locale, 'getLoadoutIssueMessage', 'issue');
}

/**
 * Resolve a loadout-calculation issue's fallback message.
 * @param issue - A structured issue returned by a loadout calculation.
 * @param locale - A BCP 47 locale.
 * @returns The issue's English message for an English locale, otherwise `null`.
 * @throws {TypeError} If `issue` is not an object with a string `message`, or `locale`
 * is not a string.
 */
export function getCalculationIssueMessage(issue: CalculationIssue, locale: string): string | null {
    return diagnosticMessage(issue, locale, 'getCalculationIssueMessage', 'issue');
}

/**
 * Resolve a SLEF diagnostic's fallback message.
 * @param diagnostic - A structured diagnostic returned by `inspectSlef`.
 * @param locale - A BCP 47 locale.
 * @returns The diagnostic's English message for an English locale, otherwise `null`.
 * @throws {TypeError} If `diagnostic` is not an object with a string `message`, or
 * `locale` is not a string.
 */
export function getSlefDiagnosticMessage(
    diagnostic: SlefDiagnostic,
    locale: string,
): string | null {
    return diagnosticMessage(diagnostic, locale, 'getSlefDiagnosticMessage', 'diagnostic');
}

/**
 * Resolve a refused loadout edit's fallback message.
 * @param error - A structured `LoadoutEditError` thrown by a loadout edit.
 * @param locale - A BCP 47 locale.
 * @returns The error's English message for an English locale, otherwise `null`.
 * @throws {TypeError} If `error` is not an object with a string `message`, or `locale`
 * is not a string.
 */
export function getLoadoutEditErrorMessage(error: LoadoutEditError, locale: string): string | null {
    return diagnosticMessage(error, locale, 'getLoadoutEditErrorMessage', 'error');
}
