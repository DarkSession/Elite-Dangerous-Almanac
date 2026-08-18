/**
 * Structural validation for fitted ship loadouts.
 *
 * @packageDocumentation
 */

import type { BuildSlot } from './slots.js';
import type { ModuleExclusionGroup, ModuleLimitGroup, ModuleLimitIncrease } from './modules.js';
import { calculateModuleLimits } from './module-limits.js';
import { describeValue, truncate } from '../internal/argument-guards.js';
import { isRequiredSlot } from './internal/loadout-slot-rules.js';

/**
 * Stable machine-readable reason a loadout is invalid or incomplete.
 *
 * @remarks
 * `duplicateSlot` only ever comes from calling {@link validateLoadout} directly on a
 * module list you assembled yourself. A `ShipLoadout` cannot report it, because it
 * refuses to hold two modules in one slot in the first place: `fromLoadout` throws a
 * `TypeError` on a duplicate, and every edit is keyed by slot. Switch on it when you
 * validate your own list; skip it when the input came from a build.
 */
export type LoadoutIssueCode =
    | 'duplicateSlot'
    | 'unknownSlot'
    | 'missingRequiredSlot'
    | 'incompatibleModule'
    | 'duplicateExclusiveModule'
    | 'moduleLimitExceeded';

/** Stable machine-readable constraint behind an `incompatibleModule` issue. */
export type ModuleFitConstraint =
    | 'immutableSlot'
    | 'armourRequired'
    | 'wrongHullArmour'
    | 'restrictedHull'
    | 'restrictedMount'
    | 'wrongCoreType'
    | 'hardpointRequired'
    | 'utilityRequired'
    | 'optionalInternalRequired'
    | 'coreModuleInOptionalSlot'
    | 'oversized'
    | 'unknownConstraint';

/**
 * One language-neutral value carried by a structured loadout diagnostic: a scalar
 * string/number, or a string list the consumer can format for its locale. Paired name
 * and symbol lists use the same order so display names align with stable identifiers.
 */
export type LoadoutIssueParam = string | number | readonly string[];

/** Named {@link LoadoutIssueParam} values used to compose a localized diagnostic. */
export type LoadoutIssueParams = Readonly<Record<string, LoadoutIssueParam>>;

/** One validation diagnostic. */
export interface LoadoutIssue {
    /** Machine-readable reason. */
    readonly code: LoadoutIssueCode;
    /** Invalid input is an error; a missing required module makes the build incomplete. */
    readonly severity: 'error' | 'incomplete';
    /** Slot involved, in the build's own spelling when possible. */
    readonly slot?: string;
    /** Module symbol involved, when any. */
    readonly symbol?: string;
    /** Human-readable explanation. */
    readonly message: string;
    /** Values interpolated into `message`, for consumers composing localized text. */
    readonly params?: LoadoutIssueParams;
}

/** Summary returned by {@link validateLoadout}. */
export interface LoadoutValidation {
    /** No structurally invalid slots, duplicate keys, or incompatible modules. */
    readonly valid: boolean;
    /** Valid, with every operational core slot filled. */
    readonly complete: boolean;
    /** All validation diagnostics. */
    readonly issues: readonly LoadoutIssue[];
}

/** One fitted module reduced to what structural validation needs. */
export interface ValidationModule {
    /** Slot key in the input's own spelling. */
    readonly slot: string;
    /** Module symbol. */
    readonly symbol: string;
    /** Whether this entry must name one of the hull's outfitting slots. */
    readonly requiresKnownSlot?: boolean;
    /** Why the resolved module does not fit, or `null` when it fits. */
    readonly fitError: string | null;
    /** Stable reason for `fitError`, when supplied by the fitting implementation. */
    readonly fitConstraint?: ModuleFitConstraint;
    /**
     * Dynamic values used by the fitting explanation. `slot`, `symbol` and
     * `constraint` are reserved: validation always supplies their canonical values.
     */
    readonly fitParams?: LoadoutIssueParams;
    /** One-per-ship family, when the resolved module belongs to one. */
    readonly exclusionGroup?: ModuleExclusionGroup;
    /** Per-ship count family this resolved module consumes, when any. */
    readonly limitGroup?: ModuleLimitGroup;
    /** Per-ship count allowance increase this resolved module grants, when any. */
    readonly limitIncrease?: ModuleLimitIncrease;
}

/** Input to {@link validateLoadout}. */
export interface LoadoutValidationInput {
    /** Hull symbol. */
    readonly shipSymbol: string;
    /** Expanded hull layout. */
    readonly slots: readonly BuildSlot[];
    /** Fitted modules. Duplicate keys must be retained here so they can be diagnosed. */
    readonly modules: readonly ValidationModule[];
}

/**
 * Validate a resolved fitted build without importing any catalogue.
 *
 * @param input - Hull layout and resolved module classifications.
 * @returns Structural validity, operational completeness, and diagnostics.
 * @example
 * ```ts
 * import { validateLoadout } from '@elite-dangerous-almanac/core/ships/loadout-validation';
 *
 * const result = validateLoadout({ shipSymbol: 'CustomHull', slots: [], modules: [] });
 * result.valid; // -> true: no impossible fit was claimed
 * result.complete; // -> true: the supplied layout has no required mounts
 * ```
 * @throws {TypeError} If `input.slots` is not an array.
 */
export function validateLoadout(input: LoadoutValidationInput): LoadoutValidation {
    if (!Array.isArray(input.slots)) {
        throw new TypeError(
            `validateLoadout: input.slots must be an array, received ${describeValue(input.slots)}`,
        );
    }
    const issues: LoadoutIssue[] = [];
    const seen = new Map<string, string>();
    for (const module of input.modules) {
        const normalized = module.slot.toLowerCase();
        const previous = seen.get(normalized);
        if (previous !== undefined) {
            issues.push({
                code: 'duplicateSlot',
                severity: 'error',
                slot: module.slot,
                symbol: module.symbol,
                params: { slot: module.slot, previousSlot: previous, symbol: module.symbol },
                message: `Slot ${truncate(module.slot)} occurs more than once (also ${truncate(previous)})`,
            });
        } else {
            seen.set(normalized, module.slot);
        }
    }

    const exclusive = new Map<ModuleExclusionGroup, ValidationModule>();
    for (const module of input.modules) {
        if (!module.exclusionGroup) continue;
        const previous = exclusive.get(module.exclusionGroup);
        if (previous) {
            issues.push({
                code: 'duplicateExclusiveModule',
                severity: 'error',
                slot: module.slot,
                symbol: module.symbol,
                params: {
                    exclusionGroup: module.exclusionGroup,
                    slot: module.slot,
                    symbol: module.symbol,
                    previousSlot: previous.slot,
                    previousSymbol: previous.symbol,
                },
                message: `${truncate(module.slot)}: ${truncate(module.symbol)} conflicts with ${truncate(previous.symbol)} in ${truncate(previous.slot)} (${module.exclusionGroup} is limited to one per ship)`,
            });
        } else {
            exclusive.set(module.exclusionGroup, module);
        }
    }

    for (const usage of calculateModuleLimits(input.modules)) {
        if (usage.excess === 0) continue;
        issues.push({
            code: 'moduleLimitExceeded',
            severity: 'error',
            params: { group: usage.group, count: usage.count, limit: usage.limit },
            message: `${usage.group} has ${usage.count} fitted modules but the ship allows ${usage.limit}`,
        });
    }

    const knownSlots = new Map(input.slots.map((slot) => [slot.key.toLowerCase(), slot]));
    for (const module of input.modules) {
        if (module.requiresKnownSlot !== false && !knownSlots.has(module.slot.toLowerCase())) {
            issues.push({
                code: 'unknownSlot',
                severity: 'error',
                slot: module.slot,
                symbol: module.symbol,
                message: `${truncate(module.slot)} is not a slot on ${truncate(input.shipSymbol)}`,
                params: {
                    shipSymbol: input.shipSymbol,
                    slot: module.slot,
                    symbol: module.symbol,
                },
            });
        }
    }
    for (const slot of input.slots) {
        if (isRequiredSlot(slot) && !seen.has(slot.key.toLowerCase())) {
            issues.push({
                code: 'missingRequiredSlot',
                severity: 'incomplete',
                slot: slot.key,
                message: `${truncate(slot.key)} is required for an operational build`,
                params: { slot: slot.key },
            });
        }
    }

    for (const module of input.modules) {
        if (module.fitError !== null) {
            issues.push({
                code: 'incompatibleModule',
                severity: 'error',
                slot: module.slot,
                symbol: module.symbol,
                message: `${truncate(module.slot)}: ${truncate(module.symbol)} ${truncate(module.fitError)}`,
                params: {
                    ...module.fitParams,
                    slot: module.slot,
                    symbol: module.symbol,
                    constraint: module.fitConstraint ?? 'unknownConstraint',
                },
            });
        }
    }

    // Each issue is frozen, not only the array, so callers cannot mutate a validation
    // snapshot in place.
    const frozen = Object.freeze(
        issues.map((issue) =>
            Object.freeze({
                ...issue,
                ...(issue.params
                    ? {
                          params: Object.freeze(
                              Object.fromEntries(
                                  Object.entries(issue.params).map(([key, value]) => [
                                      key,
                                      Array.isArray(value) ? Object.freeze([...value]) : value,
                                  ]),
                              ) as Record<string, LoadoutIssueParam>,
                          ),
                      }
                    : {}),
            }),
        ),
    );
    return Object.freeze({
        valid: !issues.some((issue) => issue.severity === 'error'),
        complete: issues.length === 0,
        issues: frozen,
    });
}
