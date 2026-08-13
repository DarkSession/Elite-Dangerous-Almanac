/**
 * Structural validation for fitted ship loadouts.
 *
 * @packageDocumentation
 */

import type { BuildSlot } from './slots.js';
import type { ModuleExclusionGroup } from './modules.js';
import { truncate } from '../internal/argument-guards.js';

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
    | 'unknownHull'
    | 'duplicateSlot'
    | 'unknownSlot'
    | 'missingRequiredSlot'
    | 'unknownModule'
    | 'incompatibleModule'
    | 'duplicateExclusiveModule';

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

/** One validation diagnostic. */
export interface LoadoutIssue {
    /** Machine-readable reason. */
    readonly code: LoadoutIssueCode;
    /** Invalid input is an error; missing catalogue/build data makes the build incomplete. */
    readonly severity: 'error' | 'incomplete';
    /** Slot involved, in the build's own spelling when possible. */
    readonly slot?: string;
    /** Module symbol involved, when any. */
    readonly symbol?: string;
    /** Human-readable explanation. */
    readonly message: string;
    /** Values interpolated into `message`, for consumers composing localized text. */
    readonly params?: Readonly<Record<string, string | number>>;
}

/** Summary returned by {@link validateLoadout}. */
export interface LoadoutValidation {
    /** No structurally invalid slots, duplicate keys, or incompatible modules. */
    readonly valid: boolean;
    /** Valid, operational core slots filled, and every fitted module classified. */
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
    /** Whether the caller's module catalogue resolved the symbol. */
    readonly known: boolean;
    /** Whether this entry must name one of the hull's outfitting slots. */
    readonly requiresKnownSlot?: boolean;
    /** Why the resolved module does not fit, or `null` when it fits. */
    readonly fitError: string | null;
    /** Stable reason for `fitError`, when supplied by the fitting implementation. */
    readonly fitConstraint?: ModuleFitConstraint;
    /** Dynamic values used by the fitting explanation. */
    readonly fitParams?: Readonly<Record<string, string | number>>;
    /** One-per-ship family, when the resolved module belongs to one. */
    readonly exclusionGroup?: ModuleExclusionGroup;
}

/** Input to {@link validateLoadout}. */
export interface LoadoutValidationInput {
    /** Hull symbol. */
    readonly shipSymbol: string;
    /** Expanded hull layout, or `null` for an unknown hull. */
    readonly slots: readonly BuildSlot[] | null;
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
 * const result = validateLoadout({ shipSymbol: 'FutureShip', slots: null, modules: [] });
 * result.valid;    // -> true: no impossible fit was claimed
 * result.complete; // -> false: the hull layout is unknown
 * ```
 */
export function validateLoadout(input: LoadoutValidationInput): LoadoutValidation {
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

    if (input.slots === null) {
        issues.push({
            code: 'unknownHull',
            severity: 'incomplete',
            message: `No slot layout is known for hull ${truncate(input.shipSymbol)}`,
            params: { shipSymbol: input.shipSymbol },
        });
    } else {
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
            if (
                (slot.kind === 'core' || slot.kind === 'armour') &&
                !seen.has(slot.key.toLowerCase())
            ) {
                issues.push({
                    code: 'missingRequiredSlot',
                    severity: 'incomplete',
                    slot: slot.key,
                    message: `${truncate(slot.key)} is required for an operational build`,
                    params: { slot: slot.key },
                });
            }
        }
    }

    for (const module of input.modules) {
        if (!module.known) {
            issues.push({
                code: 'unknownModule',
                severity: 'incomplete',
                slot: module.slot,
                symbol: module.symbol,
                message: `${truncate(module.slot)}: ${truncate(module.symbol)} is not in the module catalogue`,
                params: { slot: module.slot, symbol: module.symbol },
            });
        } else if (module.fitError !== null) {
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

    // Each issue is frozen, not only the array: `ShipLoadout.validation` memoises this
    // result, so one consumer editing an issue in place would otherwise rewrite what
    // every later reader of the same build sees.
    const frozen = Object.freeze(
        issues.map((issue) =>
            Object.freeze({
                ...issue,
                ...(issue.params ? { params: Object.freeze({ ...issue.params }) } : {}),
            }),
        ),
    );
    return Object.freeze({
        valid: !issues.some((issue) => issue.severity === 'error'),
        complete: issues.length === 0,
        issues: frozen,
    });
}
