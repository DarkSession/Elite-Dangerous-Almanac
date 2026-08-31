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
 * `duplicateSlot` and `missingRequiredSlot` only ever come from calling
 * {@link validateLoadout} directly on a module list you assembled yourself. A
 * `ShipLoadout` reports neither: it is keyed by slot and `fromLoadout` throws a
 * `TypeError` on a duplicate, and every build fills its fixed mounts from the hull
 * defaults. Switch on them when you validate your own list; skip them for a build.
 *
 * `thrusterMassExceeded` is the one code that reads a figure rather than the structure,
 * so it is reported only when the input states both a
 * {@link LoadoutValidationInput.mass} and the fitted thrusters'
 * {@link ValidationModule.thrusterMaxMass}. A build supplies both.
 */
export type LoadoutIssueCode =
    | 'duplicateSlot'
    | 'unknownSlot'
    | 'missingRequiredSlot'
    | 'incompatibleModule'
    | 'duplicateExclusiveModule'
    | 'moduleLimitExceeded'
    | 'thrusterMassExceeded';

/**
 * A load a thruster rating is read against, lightest first.
 *
 * @remarks
 * `dry` is the fit alone — hull plus modules, an empty tank and no cargo. `unladen`
 * adds a full main tank, and is the figure the game and every outfitting tool call a
 * ship's unladen mass; note that {@link ships!ShipLoadout.unladenMass} is the `dry`
 * figure, because that is what a journal's `UnladenMass` states. `laden` adds a full
 * hold on top.
 *
 * A ship cannot undock without fuel, so failing at `dry` or `unladen` is an error.
 * Failing only at `laden` is a warning: the hold is the one load a pilot chooses.
 */
export type ThrusterLoad = 'dry' | 'unladen' | 'laden';

/**
 * Stable machine-readable constraint behind an `incompatibleModule` issue.
 *
 * `builtInHullModule` is the one that names the *article* rather than the mount: the
 * cargo hatch comes with the hull and goes in no mount an editor can set.
 */
export type ModuleFitConstraint =
    | 'immutableSlot'
    | 'builtInHullModule'
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
    /**
     * Invalid input is an error; a missing required module makes the build incomplete;
     * a warning is a build that flies, but not at every load it can carry.
     *
     * @remarks
     * Only `error` clears {@link LoadoutValidation.valid}, and only `error` or
     * `incomplete` clears {@link LoadoutValidation.complete}. A `warning` is a note
     * against a legal, fully-mounted build, so it leaves both answers alone. Branch on
     * {@link code} rather than on this: one severity covers findings that belong in
     * different places on a panel.
     */
    readonly severity: 'error' | 'incomplete' | 'warning';
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
    /** Valid, with armour and every operational core mount filled. */
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
    /**
     * The mass this module can still move, in tonnes — a thruster's post-engineering
     * `maxMass`, and the top of its mass curve.
     *
     * @remarks
     * Present only on the fitted thrusters, and only where their record carries the
     * figure. Above it the curve contributes nothing and the ship does not move, which
     * is what {@link LoadoutValidationInput.mass} is weighed against. Leave it off every
     * other module: a shield generator's curve has a `maxMass` of its own and is not a
     * limit on the build's mass.
     */
    readonly thrusterMaxMass?: number;
}

/** Input to {@link validateLoadout}. */
export interface LoadoutValidationInput {
    /** Hull symbol. */
    readonly shipSymbol: string;
    /** Expanded hull layout. */
    readonly slots: readonly BuildSlot[];
    /** Fitted modules. Duplicate keys must be retained here so they can be diagnosed. */
    readonly modules: readonly ValidationModule[];
    /**
     * What the assembled ship weighs, for the one rule that reads a figure: thrusters
     * rated below the ship's mass cannot move it.
     *
     * Omit it to check structure alone.
     */
    readonly mass?: LoadoutMass;
}

/**
 * What a build weighs at each load a thruster rating is read against, in tonnes.
 *
 * @remarks
 * State as much as the build knows. {@link fuel} and {@link cargo} are *capacities*,
 * not a chosen load: the rule weighs a full tank and a full hold, because those are the
 * heaviest the build can become without being re-fitted. Leave one off and the loads
 * above it simply go unchecked.
 */
export interface LoadoutMass {
    /**
     * Hull plus every fitted module, an empty tank and no cargo — a build's
     * {@link ships!ShipLoadout.unladenMass | unladenMass}.
     *
     * @remarks
     * Despite that name this is the *dry* figure: a journal's `UnladenMass` excludes
     * fuel, while the game's own "unladen mass" readout includes a full tank. The two
     * are told apart here as {@link ThrusterLoad}'s `dry` and `unladen`.
     */
    readonly dry: number;
    /** Main-tank capacity. The reserve is not counted, as the flight model does not. */
    readonly fuel?: number;
    /** Cargo capacity, as fitted racks allow rather than as any hold currently holds. */
    readonly cargo?: number;
}

/**
 * A mass as an outfitting screen shows it: tonnes to one decimal, trailing zero dropped.
 *
 * @param tonnes - The measured figure.
 * @returns The rounded figure, for a message only — a structured `params` value stays
 * exact.
 */
function tenths(tonnes: number): number {
    return Math.round(tonnes * 10) / 10;
}

/** How each {@link ThrusterLoad} reads at the end of an overload message. */
const LOAD_PHRASE: Readonly<Record<ThrusterLoad, string>> = Object.freeze({
    dry: 'before fuel',
    unladen: 'with a full tank',
    laden: 'fully laden',
});

/**
 * The loads a thruster rating is read against, lightest first.
 *
 * @remarks
 * The same three columns an outfitting tool shows a speed for: the fit alone, the fit
 * with a full main tank, and that with a full hold. Each is built from the one below,
 * so a capacity nobody stated ends the list rather than being guessed at zero — an
 * unstated tank is a tank of unknown size, not an empty one.
 *
 * @param mass - The stated figures, or `undefined` where the build stated none.
 * @returns One entry per load that can be weighed, in ascending order of mass.
 */
function thrusterLoads(
    mass: LoadoutMass | undefined,
): readonly { load: ThrusterLoad; mass: number }[] {
    if (mass === undefined) return [];
    const loads: { load: ThrusterLoad; mass: number }[] = [{ load: 'dry', mass: mass.dry }];
    if (mass.fuel === undefined) return loads;
    loads.push({ load: 'unladen', mass: mass.dry + mass.fuel });
    if (mass.cargo === undefined) return loads;
    loads.push({ load: 'laden', mass: mass.dry + mass.fuel + mass.cargo });
    return loads;
}

/**
 * Refuse a mass that is present but not weighable.
 *
 * @remarks
 * A `NaN` compares false against every rating, so an unguarded one would report a
 * thruster overload on any build it reached rather than being ignored.
 *
 * @param name - The input field to name in a failure, already abbreviated where it
 * carries a caller's own slot key.
 * @param value - The figure as received; `undefined` is the documented absence.
 * @throws {RangeError} If `value` is present and not a finite number of zero or more.
 */
function requireTonnes(name: string, value: number | undefined): void {
    if (value === undefined) return;
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(
            `validateLoadout: ${name} must be a finite non-negative number of tonnes, received ${describeValue(value)}`,
        );
    }
}

/**
 * Validate a resolved fitted build without importing any catalogue.
 *
 * @param input - Hull layout and resolved module classifications, and optionally what
 * the assembled ship weighs.
 * @returns Structural validity, operational completeness, and diagnostics.
 * @remarks
 * Every rule but one reads the structure alone. The exception is
 * `thrusterMassExceeded`: state {@link LoadoutValidationInput.mass} and the fitted
 * thrusters' {@link ValidationModule.thrusterMaxMass}, and a ship too heavy for its own
 * thrusters is reported, because above that rating the thruster curve contributes
 * nothing and the ship does not move at all.
 *
 * The rating is weighed against each {@link ThrusterLoad} the input can state, and the
 * lightest load that is already too heavy is the one reported. A ship that cannot move
 * `dry` or `unladen` is an error — it cannot leave a pad, where the tank is always
 * full. One that only fails `laden` is a warning, and leaves the build both valid and
 * complete: the hold is the one load a pilot chooses.
 * @example
 * ```ts
 * import { validateLoadout } from '@elite-dangerous-almanac/core/ships/loadout-validation';
 *
 * const result = validateLoadout({ shipSymbol: 'CustomHull', slots: [], modules: [] });
 * result.valid; // -> true: no impossible fit was claimed
 * result.complete; // -> true: the supplied layout has no required mounts
 *
 * const overloaded = validateLoadout({
 *     shipSymbol: 'CustomHull',
 *     slots: [],
 *     mass: { dry: 60.6, fuel: 25 },
 *     modules: [
 *         {
 *             slot: 'MainEngines',
 *             symbol: 'Int_Engine_Size2_Class1',
 *             requiresKnownSlot: false,
 *             fitError: null,
 *             thrusterMaxMass: 72,
 *         },
 *     ],
 * });
 * overloaded.valid; // -> false
 * overloaded.issues[0]?.code; // -> 'thrusterMassExceeded'
 * overloaded.issues[0]?.params?.load; // -> 'unladen': it is the full tank that sinks it
 * ```
 * @throws {TypeError} If `input.slots` is not an array.
 * @throws {RangeError} If a figure in `input.mass`, or a module's `thrusterMaxMass`, is
 * present and is not a finite number of zero or more.
 */
export function validateLoadout(input: LoadoutValidationInput): LoadoutValidation {
    if (!Array.isArray(input.slots)) {
        throw new TypeError(
            `validateLoadout: input.slots must be an array, received ${describeValue(input.slots)}`,
        );
    }
    requireTonnes('input.mass.dry', input.mass?.dry);
    requireTonnes('input.mass.fuel', input.mass?.fuel);
    requireTonnes('input.mass.cargo', input.mass?.cargo);
    for (const module of input.modules) {
        requireTonnes(`${truncate(module.slot)} thrusterMaxMass`, module.thrusterMaxMass);
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

    for (const load of thrusterLoads(input.mass)) {
        for (const module of input.modules) {
            if (module.thrusterMaxMass === undefined || load.mass <= module.thrusterMaxMass) {
                continue;
            }
            issues.push({
                code: 'thrusterMassExceeded',
                severity: load.load === 'laden' ? 'warning' : 'error',
                slot: module.slot,
                symbol: module.symbol,
                // The message quotes both figures to the tenth of a tonne an outfitting
                // screen shows, while `params` keeps them exactly as measured — a
                // capture's own unladen mass runs to six decimals, and an engineered
                // rating to ten.
                message: `${truncate(module.slot)}: ${truncate(module.symbol)} is rated to ${tenths(module.thrusterMaxMass)} t but the ship weighs ${tenths(load.mass)} t ${LOAD_PHRASE[load.load]}`,
                params: {
                    slot: module.slot,
                    symbol: module.symbol,
                    load: load.load,
                    mass: load.mass,
                    maxMass: module.thrusterMaxMass,
                },
            });
        }
        // The loads only grow, so the lightest one that is already too heavy is the
        // whole finding: reporting the heavier ones as well would say the same thing
        // three times, each less true than the last.
        if (issues.some((issue) => issue.code === 'thrusterMassExceeded')) break;
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
        // A warning is a note against a build that is both legal and fully mounted, so
        // it answers neither question.
        complete: !issues.some((issue) => issue.severity !== 'warning'),
        issues: frozen,
    });
}
