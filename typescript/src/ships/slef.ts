/**
 * **SLEF** — the Ship Loadout Export Format — types and a tolerant parser.
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
 * The top level is an **array** so several builds can travel together. This module
 * is **data-free** — just the record shapes and {@link parseSlef} / {@link getModifier}.
 * To turn a parsed build into jump-range and fuel numbers, hand it to
 * {@link ShipLoadout} (`./ship-loadout`).
 *
 * Reference: the Inara SLEF specification, <https://inara.cz/elite/inara-impexp-slef/>.
 *
 * @packageDocumentation
 */

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
 * modifiers carry a string (`ValueStr`) instead of a number. **Do not trust
 * `LessIsGood`** — Frontier is known to set it wrongly for some stats; decide a
 * stat's direction yourself.
 */
export interface EngineeringModifier {
    /** The stat's journal name, e.g. `"FSDOptimalMass"`, `"Mass"`, `"PowerDraw"`. */
    readonly Label: string;
    /** The modified (current) value, when the stat is numeric. */
    readonly Value?: number;
    /** The stock value before engineering, when the stat is numeric. */
    readonly OriginalValue?: number;
    /** A string-valued modifier's value (rare; used for non-numeric stats). */
    readonly ValueStr?: string;
    /** `1` if a lower value is better — unreliable; see the remark above. */
    readonly LessIsGood?: number;
}

/** The engineering applied to one module. */
export interface ModuleEngineering {
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
    /** Every stat this engineering changed. */
    readonly Modifiers: readonly EngineeringModifier[];
}

/** One fitted module in a `Loadout` event. */
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
    /** The module's credit value. */
    readonly Value?: number;
    /** Engineering, present only when the module is modified. */
    readonly Engineering?: ModuleEngineering;
}

/**
 * A journal `Loadout` event — the `data` half of a SLEF entry.
 *
 * @remarks
 * Only `Ship` and `Modules` are strictly required by SLEF; every other field is
 * copied from the journal event when the exporter has it. Masses are in tonnes,
 * ranges in light-years, values in credits.
 */
export interface LoadoutEvent {
    /** Always `"Loadout"`. */
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
const SYNTHETIC_HEADER: SlefHeader = { appName: '', appVersion: '' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === 'string';

const isOptionalFiniteNumber = (value: unknown): value is number | undefined =>
    value === undefined || (typeof value === 'number' && Number.isFinite(value));

function isEngineeringModifier(value: unknown): value is EngineeringModifier {
    if (!isRecord(value) || typeof value.Label !== 'string') return false;
    return (
        isOptionalFiniteNumber(value.Value) &&
        isOptionalFiniteNumber(value.OriginalValue) &&
        isOptionalString(value.ValueStr) &&
        isOptionalFiniteNumber(value.LessIsGood)
    );
}

function isModuleEngineering(value: unknown): value is ModuleEngineering {
    if (!isRecord(value)) return false;
    return (
        typeof value.BlueprintName === 'string' &&
        typeof value.Level === 'number' &&
        Number.isFinite(value.Level) &&
        typeof value.Quality === 'number' &&
        Number.isFinite(value.Quality) &&
        isOptionalString(value.ExperimentalEffect) &&
        isOptionalString(value.ExperimentalEffect_Localised) &&
        Array.isArray(value.Modifiers) &&
        value.Modifiers.every(isEngineeringModifier)
    );
}

function isLoadoutModule(value: unknown): value is LoadoutModule {
    if (!isRecord(value)) return false;
    return (
        typeof value.Slot === 'string' &&
        typeof value.Item === 'string' &&
        (value.On === undefined || typeof value.On === 'boolean') &&
        isOptionalFiniteNumber(value.Priority) &&
        isOptionalFiniteNumber(value.Health) &&
        isOptionalFiniteNumber(value.Value) &&
        (value.Engineering === undefined || isModuleEngineering(value.Engineering))
    );
}

function isSlefHeader(value: unknown): value is SlefHeader {
    if (!isRecord(value)) return false;
    return (
        typeof value.appName === 'string' &&
        (typeof value.appVersion === 'string' ||
            (typeof value.appVersion === 'number' && Number.isFinite(value.appVersion))) &&
        isOptionalString(value.appURL) &&
        (value.appCustomProperties === undefined || isRecord(value.appCustomProperties))
    );
}

function isLoadout(value: unknown): value is LoadoutEvent {
    if (!isRecord(value)) return false;
    const fuel = value.FuelCapacity;
    const validFuel =
        fuel === undefined ||
        (isRecord(fuel) &&
            typeof fuel.Main === 'number' &&
            Number.isFinite(fuel.Main) &&
            typeof fuel.Reserve === 'number' &&
            Number.isFinite(fuel.Reserve));
    return (
        typeof value.Ship === 'string' &&
        Array.isArray(value.Modules) &&
        value.Modules.every(isLoadoutModule) &&
        isOptionalString(value.event) &&
        isOptionalString(value.ShipName) &&
        isOptionalString(value.ShipIdent) &&
        isOptionalFiniteNumber(value.HullValue) &&
        isOptionalFiniteNumber(value.ModulesValue) &&
        isOptionalFiniteNumber(value.UnladenMass) &&
        isOptionalFiniteNumber(value.CargoCapacity) &&
        isOptionalFiniteNumber(value.MaxJumpRange) &&
        validFuel &&
        isOptionalFiniteNumber(value.Rebuy)
    );
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
 * against the public record shape; malformed entries are skipped.
 * @returns The entries, in export order — never empty (a parse that finds no valid
 * entry throws instead).
 * @throws {SyntaxError} If `input` is a string that is not valid JSON.
 * @throws {TypeError} If nothing in `input` is a usable loadout (no `Ship` /
 * `Modules`).
 * @example
 * ```ts
 * const [entry] = parseSlef(slefJsonString);
 * entry.data.Ship; // -> 'explorer_nx'
 * ```
 */
export function parseSlef(input: string | object): SlefEntry[] {
    const root: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    const rawEntries: unknown[] = Array.isArray(root) ? root : [root];

    const entries: SlefEntry[] = [];
    for (const raw of rawEntries) {
        if (isLoadout(raw)) {
            entries.push({ header: SYNTHETIC_HEADER, data: raw });
            continue;
        }
        if (isRecord(raw) && isLoadout(raw.data)) {
            const header = raw.header ?? SYNTHETIC_HEADER;
            if (isSlefHeader(header)) entries.push({ header, data: raw.data });
        }
    }

    if (entries.length === 0) {
        throw new TypeError('parseSlef: input holds no Loadout (needs a `Ship` and `Modules`)');
    }
    return entries;
}

/**
 * Read one engineering modifier off a module by its journal label.
 *
 * @param module - The fitted module.
 * @param label - The stat's journal name, e.g. `"FSDOptimalMass"`. Matched
 * case-insensitively.
 * @returns The modifier's numeric `Value`, or `null` if the module is not
 * engineered, carries no such modifier, or the modifier is non-numeric.
 * @example
 * ```ts
 * getModifier(fsdModule, 'FSDOptimalMass'); // -> 7528.04, or null if stock
 * ```
 */
export function getModifier(module: LoadoutModule, label: string): number | null {
    const wanted = label.trim().toLowerCase();
    const mod = module.Engineering?.Modifiers.find((m) => m.Label.toLowerCase() === wanted);
    return typeof mod?.Value === 'number' ? mod.Value : null;
}
