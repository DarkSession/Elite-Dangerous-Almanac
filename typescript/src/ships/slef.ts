/**
 * **SLEF** — the Ship Loadout Export Format — types, a strict parser and a tolerant
 * inspector.
 *
 * SLEF is the community interchange format for a fitted ship, used by EDSY,
 * Coriolis, Inara and others. It is nothing more than the game journal's `Loadout`
 * event wrapped in an envelope that records which app exported it:
 *
 * ```json
 * [{ "header": { "appName": "EDSY", "appVersion": "..." },
 *    "data":   { "event": "Loadout", "Ship": "explorer_nx", "Modules": [ ... ] } }]
 * ```
 *
 * The top level is an **array** so several builds can travel together. This module carries
 * only the record shapes, so it imports no variant, blueprint, module or ship catalogue.
 * {@link parseSlef} / {@link getLoadoutModifier}
 * read, and {@link toSlef} / {@link stringifySlef} write. To turn a parsed build into
 * jump-range and fuel numbers, or to produce the `Loadout` event {@link toSlef} wraps,
 * hand it to {@link ShipLoadout} (`./ship-loadout`).
 *
 * ```ts
 * const build = ShipLoadout.fromSlef(exported);       // in
 * const text = stringifySlef(
 *     build.toSlef({ header: { appName: 'MyApp', appVersion: '1.0.0' } }),
 * );                                                  // and back out
 * ```
 *
 * Reference: the Inara SLEF specification, <https://inara.cz/elite/inara-impexp-slef/>.
 *
 * @packageDocumentation
 */

import { normalizeKey } from '../internal/registry-index.js';
import { truncate } from '../internal/argument-guards.js';

/** The envelope header — which app produced the export. */
export interface SlefHeader {
    /** Exporting app's name, e.g. `"EDSY"`. */
    readonly appName: string;
    /**
     * Exporting app's version. The spec calls for a string; some apps emit a
     * number, so both are accepted.
     */
    readonly appVersion: string | number;
    /** A link back to the build in the exporting app, when given. */
    readonly appURL?: string;
    /** App-specific extra fields, when given. */
    readonly appCustomProperties?: Readonly<Record<string, unknown>>;
}

/**
 * One engineering modifier — how a blueprint changed a single stat.
 *
 * @remarks
 * `Value` is the post-engineering figure, `OriginalValue` the stock one. Some
 * modifiers carry a string (`ValueStr`) instead of a number — generated Anti-Guardian
 * Zone Resistance uses `"Active"`. **Do not trust `LessIsGood`** — Frontier is known to
 * set it wrongly for some stats; decide a stat's direction yourself.
 */
export interface EngineeringModifier {
    /** The stat's journal name, e.g. `"FSDOptimalMass"`, `"Mass"`, `"PowerDraw"`. */
    readonly Label: string;
    /** The modified value, when the stat is numeric. */
    readonly Value?: number;
    /** The stock value before engineering, when the stat is numeric. */
    readonly OriginalValue?: number;
    /** A string-valued modifier's value (rare; used for non-numeric stats). */
    readonly ValueStr?: string;
    /** `1` if a lower value is better — unreliable; see the remark above. */
    readonly LessIsGood?: number;
}

/**
 * A graded engineering identity and its fitted state.
 *
 * `BlueprintName` may name a craftable recipe or a fixed pre-engineered identity such
 * as a grade-5 festive launcher. `Level` and `Quality` identify the stated grade and
 * quality; `Modifiers` may be absent because SLEF permits a compact identity-only block.
 */
export interface BlueprintModuleEngineering {
    /** The blueprint's journal name, e.g. `"FSD_LongRange"`. */
    readonly BlueprintName: string;
    /** The blueprint grade, 1–5. */
    readonly Level: number;
    /** The roll quality, 0–1. */
    readonly Quality: number;
    /** The experimental effect's journal name, when one is applied. */
    readonly ExperimentalEffect?: string;
    /** The experimental effect's display name, when present. */
    readonly ExperimentalEffect_Localised?: string;
    /**
     * Every stat this engineering changed.
     *
     * @remarks
     * **Optional.** A journal `Loadout` event always writes it, but SLEF requires only
     * `BlueprintName`, `Level` and `Quality` — the specification's own example omits it —
     * so an export from another app may name the blueprint and its roll without spelling
     * out the resulting stats. Treat a missing array as "not stated", not as "nothing was
     * changed". {@link ShipLoadout.fromLoadout} resolves what a missing array implies —
     * rolling the stated recipe, or fitting the catalogued article the identity can only
     * mean — so a build imported through it needs none of this. Working from the wire
     * shape directly, a craftable recipe is reconstructed with
     * {@link ShipLoadout.applyBlueprint}, or rolled where it stands with
     * {@link ShipLoadout.completeEngineeringGrade}, which spells out a stated identity
     * at quality `1`; resolve a fixed identity through the pre-engineered catalogue and
     * fit it with {@link ShipLoadout.setPreEngineeredVariant}.
     */
    readonly Modifiers?: readonly EngineeringModifier[];
}

/**
 * The durable modification applied to one module.
 *
 * @remarks
 * A journal capture may also name `Engineer`, `EngineerID` and `BlueprintID`. They are
 * deliberately outside this shape: the engineer fields record who applied a modification,
 * while the numeric blueprint id is redundant with `BlueprintName`; none changes the fitted
 * module. {@link ShipLoadout.fromLoadout} therefore drops them and subsequent loadout/SLEF
 * exports never write them.
 */
export type ModuleEngineering = BlueprintModuleEngineering;

/**
 * One fitted module in a `Loadout` event.
 *
 * @remarks
 * **Ammunition state is not carried.** A journal writes `AmmoInClip` and `AmmoInHopper`
 * on every weapon that takes ammunition; both are dropped on import and never written
 * back out, because they are the ship's rearm state at the instant of capture rather than
 * part of the build — the same reason a re-export recomputes a build's credit figures by
 * default instead of echoing the ones the capture carried. What a fitted weapon *can*
 * hold is a property of the build, and `./ammunition` answers it: `ammunitionCapacity`,
 * or `FittedModule.ammunition` for a fitted one, post-engineering.
 */
export interface LoadoutModule {
    /** The slot it occupies, e.g. `"FrameShiftDrive"`, `"Slot07_Size5"`. */
    readonly Slot: string;
    /** The module's internal id, e.g. `"int_hyperdrive_size5_class5"` (lower-cased). */
    readonly Item: string;
    /** Whether the module is powered on. Absent means on. */
    readonly On?: boolean;
    /** The module's power-priority group (0–4). */
    readonly Priority?: number;
    /** Module health, 0–1. */
    readonly Health?: number;
    /**
     * What the capture says was paid for this module, in credits — net of whatever
     * discount its owner had, and not the catalogue's list price. Absent where the
     * capture said nothing, which is not the same as free.
     * `ShipLoadout.sourcePurchase` keeps these figures as a stable record; the library's
     * own exports quote list price.
     */
    readonly Value?: number;
    /** Engineering, present only when the module is modified. */
    readonly Engineering?: ModuleEngineering;
}

/**
 * A journal `Loadout` event — the `data` half of a SLEF entry.
 *
 * @remarks
 * Only `Ship` and `Modules` are strictly required by SLEF; every other field is
 * optional. Masses are in tonnes, ranges in light-years, values in credits.
 *
 * `event`, `timestamp`, `ShipID`, `HullHealth` and `Hot` are deliberately outside the
 * durable loadout shape. They name the journal line, or describe the capture or the ship
 * instance/state, rather than its fit, so {@link ShipLoadout.fromLoadout} drops them and
 * subsequent loadout/SLEF exports never write them. A tolerant parse still accepts an
 * input object carrying those keys.
 */
export interface LoadoutEvent {
    /** `"Loadout"` when a journal line supplied it. Accepted on input, never written. */
    readonly event?: string;
    /** The hull's internal id, e.g. `"explorer_nx"` (lower-cased). */
    readonly Ship: string;
    /** The player-given ship name. */
    readonly ShipName?: string;
    /** The player-given ship ID plate. */
    readonly ShipIdent?: string;
    /** Hull cost in credits. */
    readonly HullValue?: number;
    /** Fitted-modules cost in credits. */
    readonly ModulesValue?: number;
    /** Hull + modules mass with an empty tank and no cargo, in tonnes. */
    readonly UnladenMass?: number;
    /** Cargo rack capacity, in tonnes. */
    readonly CargoCapacity?: number;
    /** The exporter's own best single-jump range, in light-years. */
    readonly MaxJumpRange?: number;
    /** Fuel-tank capacities, in tonnes. */
    readonly FuelCapacity?: { readonly Main: number; readonly Reserve: number };
    /** Insurance rebuy cost in credits. */
    readonly Rebuy?: number;
    /** Every fitted module. */
    readonly Modules: readonly LoadoutModule[];
}

/** One `{ header, data }` pair in a SLEF export. */
export interface SlefEntry {
    /** Which app produced this entry. */
    readonly header: SlefHeader;
    /** The fitted-ship loadout. */
    readonly data: LoadoutEvent;
}

/** A whole SLEF export — one or more {@link SlefEntry entries}. */
export type Slef = readonly SlefEntry[];

/** A synthetic header used when the input is a bare, header-less loadout. */
const SYNTHETIC_HEADER: SlefHeader = Object.freeze({ appName: '', appVersion: '' });

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === 'string';

const isOptionalFiniteNumber = (value: unknown): value is number | undefined =>
    value === undefined || (typeof value === 'number' && Number.isFinite(value));

const isOptionalNumberInRange = (
    value: unknown,
    minimum: number,
    maximum = Number.POSITIVE_INFINITY,
): value is number | undefined =>
    value === undefined ||
    (typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum);

const isOptionalIntegerInRange = (
    value: unknown,
    minimum: number,
    maximum: number,
): value is number | undefined => {
    if (value === undefined) return true;
    return (
        typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
    );
};

interface InvalidSlefField {
    readonly code: Exclude<SlefDiagnosticCode, 'duplicateSlot'>;
    readonly path: string;
    readonly reason: string;
    readonly constraint: SlefConstraint;
}

const CONSTRAINT_MESSAGES: Record<Exclude<SlefConstraint, 'uniqueSlot'>, string> = {
    objectRequired: 'must be an object',
    stringRequired: 'must be a string',
    booleanRequired: 'must be a boolean',
    arrayRequired: 'must be an array',
    finiteNumberRequired: 'must be a finite number',
    nonNegativeNumberRequired: 'must be a non-negative number',
    priorityRange: 'must be an integer from 0 to 4',
    engineeringLevelRange: 'must be an integer from 1 to 5',
    unitInterval: 'must be a number from 0 to 1',
    binaryInteger: 'must be 0 or 1',
    versionRequired: 'must be a string or finite number',
    loadoutEventRequired: 'must be "Loadout"',
    validLoadoutRequired: 'is not a valid Loadout event',
};

const invalid = (
    code: InvalidSlefField['code'],
    path: string,
    constraint: Exclude<SlefConstraint, 'uniqueSlot'>,
): InvalidSlefField => ({ code, path, constraint, reason: CONSTRAINT_MESSAGES[constraint] });

function diagnoseEngineering(value: unknown, path: string): InvalidSlefField | null {
    if (!isRecord(value)) return invalid('invalidEngineering', path, 'objectRequired');
    if (typeof value.BlueprintName !== 'string')
        return invalid('invalidEngineering', `${path}.BlueprintName`, 'stringRequired');
    if (!isOptionalIntegerInRange(value.Level, 1, 5) || value.Level === undefined)
        return invalid('invalidEngineering', `${path}.Level`, 'engineeringLevelRange');
    if (!isOptionalNumberInRange(value.Quality, 0, 1) || value.Quality === undefined)
        return invalid('invalidEngineering', `${path}.Quality`, 'unitInterval');
    if (!isOptionalString(value.ExperimentalEffect))
        return invalid('invalidEngineering', `${path}.ExperimentalEffect`, 'stringRequired');
    if (!isOptionalString(value.ExperimentalEffect_Localised))
        return invalid(
            'invalidEngineering',
            `${path}.ExperimentalEffect_Localised`,
            'stringRequired',
        );
    if (value.Modifiers !== undefined) {
        if (!Array.isArray(value.Modifiers))
            return invalid('invalidEngineering', `${path}.Modifiers`, 'arrayRequired');
        for (let index = 0; index < value.Modifiers.length; index += 1) {
            const modifier = value.Modifiers[index];
            const modifierPath = `${path}.Modifiers[${index}]`;
            if (!isRecord(modifier))
                return invalid('invalidEngineering', modifierPath, 'objectRequired');
            if (typeof modifier.Label !== 'string')
                return invalid('invalidEngineering', `${modifierPath}.Label`, 'stringRequired');
            if (!isOptionalFiniteNumber(modifier.Value))
                return invalid(
                    'invalidEngineering',
                    `${modifierPath}.Value`,
                    'finiteNumberRequired',
                );
            if (!isOptionalFiniteNumber(modifier.OriginalValue))
                return invalid(
                    'invalidEngineering',
                    `${modifierPath}.OriginalValue`,
                    'finiteNumberRequired',
                );
            if (!isOptionalString(modifier.ValueStr))
                return invalid('invalidEngineering', `${modifierPath}.ValueStr`, 'stringRequired');
            if (!isOptionalIntegerInRange(modifier.LessIsGood, 0, 1))
                return invalid('invalidEngineering', `${modifierPath}.LessIsGood`, 'binaryInteger');
        }
    }
    return null;
}

function diagnoseModule(value: unknown, path: string): InvalidSlefField | null {
    if (!isRecord(value)) return invalid('invalidModule', path, 'objectRequired');
    if (typeof value.Slot !== 'string')
        return invalid('invalidModule', `${path}.Slot`, 'stringRequired');
    if (typeof value.Item !== 'string')
        return invalid('invalidModule', `${path}.Item`, 'stringRequired');
    if (value.On !== undefined && typeof value.On !== 'boolean')
        return invalid('invalidModule', `${path}.On`, 'booleanRequired');
    if (!isOptionalIntegerInRange(value.Priority, 0, 4))
        return invalid('invalidModule', `${path}.Priority`, 'priorityRange');
    if (!isOptionalNumberInRange(value.Health, 0, 1))
        return invalid('invalidModule', `${path}.Health`, 'unitInterval');
    if (!isOptionalNumberInRange(value.Value, 0))
        return invalid('invalidModule', `${path}.Value`, 'nonNegativeNumberRequired');
    if (value.Engineering !== undefined)
        return diagnoseEngineering(value.Engineering, `${path}.Engineering`);
    return null;
}

function diagnoseHeader(value: unknown, path: string): InvalidSlefField | null {
    if (!isRecord(value)) return invalid('invalidHeader', path, 'objectRequired');
    if (typeof value.appName !== 'string')
        return invalid('invalidHeader', `${path}.appName`, 'stringRequired');
    if (
        typeof value.appVersion !== 'string' &&
        !(typeof value.appVersion === 'number' && Number.isFinite(value.appVersion))
    )
        return invalid('invalidHeader', `${path}.appVersion`, 'versionRequired');
    if (!isOptionalString(value.appURL))
        return invalid('invalidHeader', `${path}.appURL`, 'stringRequired');
    if (value.appCustomProperties !== undefined && !isRecord(value.appCustomProperties))
        return invalid('invalidHeader', `${path}.appCustomProperties`, 'objectRequired');
    return null;
}

function diagnoseLoadout(value: unknown, path: string): InvalidSlefField | null {
    if (!isRecord(value)) return invalid('invalidLoadout', path, 'objectRequired');
    if (typeof value.Ship !== 'string')
        return invalid('invalidLoadout', `${path}.Ship`, 'stringRequired');
    if (!Array.isArray(value.Modules))
        return invalid('invalidLoadout', `${path}.Modules`, 'arrayRequired');
    if (value.event !== undefined && value.event !== 'Loadout')
        return invalid('invalidLoadout', `${path}.event`, 'loadoutEventRequired');
    for (const field of ['ShipName', 'ShipIdent'] as const) {
        if (!isOptionalString(value[field]))
            return invalid('invalidLoadout', `${path}.${field}`, 'stringRequired');
    }
    for (const field of [
        'HullValue',
        'ModulesValue',
        'UnladenMass',
        'CargoCapacity',
        'MaxJumpRange',
        'Rebuy',
    ] as const) {
        if (!isOptionalNumberInRange(value[field], 0))
            return invalid('invalidLoadout', `${path}.${field}`, 'nonNegativeNumberRequired');
    }
    if (value.FuelCapacity !== undefined) {
        if (!isRecord(value.FuelCapacity))
            return invalid('invalidLoadout', `${path}.FuelCapacity`, 'objectRequired');
        for (const field of ['Main', 'Reserve'] as const) {
            if (
                !isOptionalNumberInRange(value.FuelCapacity[field], 0) ||
                value.FuelCapacity[field] === undefined
            )
                return invalid(
                    'invalidLoadout',
                    `${path}.FuelCapacity.${field}`,
                    'nonNegativeNumberRequired',
                );
        }
    }
    for (let index = 0; index < value.Modules.length; index += 1) {
        const moduleDiagnostic = diagnoseModule(value.Modules[index], `${path}.Modules[${index}]`);
        if (moduleDiagnostic !== null) return moduleDiagnostic;
    }
    return null;
}

/** Boolean acceptance is derived from the same diagnostics exposed to consumers. */
function isSlefHeader(value: unknown): value is SlefHeader {
    return diagnoseHeader(value, 'header') === null;
}

/** Boolean acceptance is derived from the same diagnostics exposed to consumers. */
function isLoadout(value: unknown): value is LoadoutEvent {
    return diagnoseLoadout(value, 'loadout') === null;
}

function duplicateSlot(loadout: LoadoutEvent): { slot: string; moduleIndex: number } | null {
    const seen = new Set<string>();
    for (let moduleIndex = 0; moduleIndex < loadout.Modules.length; moduleIndex += 1) {
        const module = loadout.Modules[moduleIndex]!;
        const slot = module.Slot.toLowerCase();
        if (seen.has(slot)) return { slot: module.Slot, moduleIndex };
        seen.add(slot);
    }
    return null;
}

/** Stable machine-readable reason an entry was rejected. */
export type SlefDiagnosticCode =
    'invalidHeader' | 'invalidLoadout' | 'invalidModule' | 'invalidEngineering' | 'duplicateSlot';

/** Stable field-level constraint behind a rejected SLEF entry. */
export type SlefConstraint =
    | 'objectRequired'
    | 'stringRequired'
    | 'booleanRequired'
    | 'arrayRequired'
    | 'finiteNumberRequired'
    | 'nonNegativeNumberRequired'
    | 'priorityRange'
    | 'engineeringLevelRange'
    | 'unitInterval'
    | 'binaryInteger'
    | 'versionRequired'
    | 'loadoutEventRequired'
    | 'validLoadoutRequired'
    | 'uniqueSlot';

/** One entry rejected by {@link inspectSlef}. */
export interface SlefDiagnostic {
    /** Zero-based entry index in the top-level array. */
    readonly index: number;
    /** Stable machine-readable category. */
    readonly code: SlefDiagnosticCode;
    /** Property path to the rejected value, including entry and module indexes. */
    readonly path: string;
    /** Stable field-level constraint, suitable for localized message selection. */
    readonly constraint: SlefConstraint;
    /** Human-readable reason the entry was rejected. */
    readonly message: string;
    /** Values interpolated into `message`, for consumers composing localized text. */
    readonly params?: Readonly<Record<string, string | number>>;
}

/** Tolerant SLEF inspection result. */
export interface SlefInspection {
    /** Valid entries, retaining their input order. */
    readonly entries: readonly SlefEntry[];
    /** Rejected entries, retaining their input order. */
    readonly diagnostics: readonly SlefDiagnostic[];
}

/**
 * Inspect a potentially mixed SLEF payload without silently losing malformed entries.
 *
 * @param input - A JSON string, SLEF envelope/array, or bare `Loadout` event.
 * @returns Every valid entry and an indexed diagnostic for every rejected entry.
 * @throws {SyntaxError} If a string is not valid JSON.
 * @example
 * ```ts
 * import { inspectSlef } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * const result = inspectSlef([{ Ship: 'sidewinder', Modules: [{ Slot: 'PowerPlant' }] }]);
 * result.diagnostics[0]?.path; // -> 'entries[0].Modules[0].Item'
 * ```
 */
export function inspectSlef(input: unknown): SlefInspection {
    const root: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    const rawEntries: unknown[] = Array.isArray(root) ? root : [root];
    const entries: SlefEntry[] = [];
    const diagnostics: SlefDiagnostic[] = [];

    rawEntries.forEach((raw, index) => {
        const entryPath = `entries[${index}]`;
        let header: SlefHeader | null = null;
        let loadout: LoadoutEvent | null = null;
        if (isLoadout(raw)) {
            header = SYNTHETIC_HEADER;
            loadout = raw;
        } else if (isRecord(raw) && isLoadout(raw.data)) {
            if (isSlefHeader(raw.header)) {
                header = raw.header;
                loadout = raw.data;
            }
        }

        if (header === null || loadout === null) {
            const envelope = isRecord(raw) && ('header' in raw || 'data' in raw);
            const detail = envelope
                ? (diagnoseHeader(isRecord(raw) ? raw.header : null, `${entryPath}.header`) ??
                  diagnoseLoadout(isRecord(raw) ? raw.data : null, `${entryPath}.data`))
                : diagnoseLoadout(raw, entryPath);
            diagnostics.push({
                index,
                code: detail?.code ?? 'invalidLoadout',
                path: detail?.path ?? entryPath,
                constraint: detail?.constraint ?? 'validLoadoutRequired',
                message: `${detail?.path ?? entryPath} ${detail?.reason ?? 'is not a valid Loadout event'}`,
                params: {
                    path: detail?.path ?? entryPath,
                    constraint: detail?.constraint ?? 'validLoadoutRequired',
                },
            });
            return;
        }
        const duplicate = duplicateSlot(loadout);
        if (duplicate !== null) {
            diagnostics.push({
                index,
                code: 'duplicateSlot',
                path: `${entryPath}${isLoadout(raw) ? '' : '.data'}.Modules[${duplicate.moduleIndex}].Slot`,
                constraint: 'uniqueSlot',
                message: `Entry ${index} contains duplicate slot "${truncate(duplicate.slot)}"`,
                params: { index, slot: duplicate.slot },
            });
            return;
        }
        entries.push({ header, data: loadout });
    });

    return Object.freeze({
        entries: Object.freeze(entries),
        diagnostics: Object.freeze(
            diagnostics.map((diagnostic) =>
                Object.freeze({
                    ...diagnostic,
                    ...(diagnostic.params
                        ? { params: Object.freeze({ ...diagnostic.params }) }
                        : {}),
                }),
            ),
        ),
    });
}

/**
 * Parse a SLEF export into its entries.
 *
 * @param input - Either the SLEF JSON **string** or an already-parsed object.
 * Accepted shapes, in order of leniency:
 * - the standard array `[{ header, data }, ...]`;
 * - a single `{ header, data }` object;
 * - a bare journal `Loadout` event (`{ Ship, Modules, ... }`) — wrapped in an entry
 *   with an empty synthetic header.
 * Every returned header, loadout, module and engineering modifier is runtime-checked
 * against the public record shape. Parsing is strict: one malformed entry rejects the
 * whole payload. Use {@link inspectSlef} to recover valid entries from a mixed payload.
 * @returns The entries, in export order — never empty (a parse that finds no valid
 * entry throws instead).
 * @throws {SyntaxError} If `input` is a string that is not valid JSON.
 * @throws {TypeError} If the payload is empty or any entry, header, loadout, module or
 * engineering field is malformed.
 * @example
 * ```ts
 * import { parseSlef } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const slefJsonString: string;
 *
 * const [entry] = parseSlef(slefJsonString);
 * entry?.data.Ship; // -> 'explorer_nx'
 * ```
 */
export function parseSlef(input: unknown): SlefEntry[] {
    const inspected = inspectSlef(input);
    if (inspected.diagnostics.length > 0) {
        throw new TypeError(`parseSlef: ${inspected.diagnostics[0]!.message}`);
    }
    if (inspected.entries.length === 0) {
        throw new TypeError('parseSlef: input holds no entries');
    }
    return [...inspected.entries];
}

/** Options for {@link stringifySlef}. */
export interface SlefStringifyOptions {
    /**
     * Spaces per indent level. `0` — the default — emits compact JSON, which is what
     * the clipboard-and-paste exchange these exports travel by wants.
     */
    readonly indent?: number;
}

/**
 * Wrap one or more loadouts in SLEF envelopes.
 *
 * @param data - A single `Loadout` event or several. Several travel in one export as
 * separate entries, which is what the format's array top level is for.
 * @param header - Which exporting app to credit. SLEF attribution belongs to the
 * application producing the export, so callers must provide its name and version.
 * @returns The export, one entry per loadout, in the order given.
 * @throws {TypeError} If `data` is empty, or the header or any loadout does not match
 * the record shape. Every entry is checked with the same guards {@link parseSlef}
 * applies, so anything this returns is guaranteed to parse back.
 * @example
 * ```ts
 * import type { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import { stringifySlef, toSlef } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const build: ShipLoadout;
 *
 * const slef = toSlef(build.toLoadoutEvent(), { appName: 'MyApp', appVersion: '1.2.0' });
 * stringifySlef(slef); // -> '[{"header":{...},"data":{...}}]'
 * ```
 */
export function toSlef(data: LoadoutEvent | readonly LoadoutEvent[], header: SlefHeader): Slef {
    if (!isSlefHeader(header)) {
        throw new TypeError('toSlef: header needs a string `appName` and an `appVersion`');
    }

    const events = Array.isArray(data) ? data : [data as LoadoutEvent];
    if (events.length === 0) {
        // parseSlef rejects an empty export, so returning one would break the promise
        // that everything this produces parses back.
        throw new TypeError('toSlef: needs at least one Loadout');
    }
    return events.map((event, index) => {
        if (!isLoadout(event)) {
            throw new TypeError(
                `toSlef: entry ${index} is not a valid Loadout (needs a \`Ship\` and \`Modules\`)`,
            );
        }
        const duplicate = duplicateSlot(event);
        if (duplicate !== null) {
            throw new TypeError(
                `toSlef: entry ${index} contains duplicate slot "${truncate(duplicate.slot)}"`,
            );
        }
        return { header, data: event };
    });
}

/**
 * Serialise a SLEF export to its JSON string.
 *
 * @param slef - The entries, as {@link toSlef} returns them.
 * @param options - Formatting. Compact by default.
 * @returns The JSON text.
 * @example
 * ```ts
 * import { stringifySlef } from '@elite-dangerous-almanac/core/ships/slef';
 * import type { Slef } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const slef: Slef;
 *
 * stringifySlef(slef, { indent: 2 }); // human-readable, for writing to a file
 * ```
 */
export function stringifySlef(slef: Slef, options: SlefStringifyOptions = {}): string {
    return JSON.stringify(slef, null, options.indent ?? 0);
}

/**
 * Read one engineering modifier off a module by its journal label.
 *
 * @param module - The fitted module.
 * @param label - The stat's journal name, e.g. `"FSDOptimalMass"`. Matched
 * case-insensitively after trimming surrounding whitespace.
 * @returns The modifier's numeric `Value`, or `null` if the module is not
 * engineered, states no modifiers at all, carries no such modifier, or the modifier is
 * non-numeric.
 * @throws {TypeError} If `label` is present and not a string. A nullish
 * `label` is a miss, answered the way an unrecognised one is. All engineering blocks use
 * the same modifier representation.
 * @example
 * ```ts
 * import { getLoadoutModifier } from '@elite-dangerous-almanac/core/ships/slef';
 * import type { LoadoutModule } from '@elite-dangerous-almanac/core/ships/slef';
 *
 * declare const fsdModule: LoadoutModule;
 *
 * getLoadoutModifier(fsdModule, 'FSDOptimalMass'); // -> 7528.04, or null if stock
 * ```
 */
export function getLoadoutModifier(module: LoadoutModule, label: string): number | null {
    const wanted = normalizeKey(label, 'getLoadoutModifier: label');
    const mod = module.Engineering?.Modifiers?.find((m) => m.Label.toLowerCase() === wanted);
    return typeof mod?.Value === 'number' ? mod.Value : null;
}
