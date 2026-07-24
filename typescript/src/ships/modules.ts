/**
 * Outfitting-module types and lookups — the **data-free** core of the ship-modules
 * feature.
 *
 * Elite Dangerous has ~1200 fittable modules. This module holds the
 * {@link OutfittingModule} record shape and the pure functions that search a
 * catalogue ({@link getModuleBySymbol}, {@link getModulesByName},
 * {@link getModulesForShip}); the catalogues themselves
 * live in sibling modules, one per Frontier outfitting category, so you only bundle
 * the ones you ask for:
 *
 * | Module | Export | Entries | ≈ bundled |
 * | --- | --- | --- | --- |
 * | `./modules-standard` | `STANDARD_MODULES` | 521 | 67 KB |
 * | `./modules-internal` | `INTERNAL_MODULES` | 475 | 64 KB |
 * | `./modules-hardpoint` | `HARDPOINT_MODULES` | 159 | 25 KB |
 * | `./modules-utility` | `UTILITY_MODULES` | 35 | 4 KB |
 * | `./modules-all` | `ALL_MODULES` | 1190 | 161 KB |
 *
 * Importing a query function from here costs nothing but the function: pass in
 * whichever catalogue you imported.
 *
 * @example
 * ```ts
 * import { getModuleBySymbol } from '@elite-dangerous-almanac/core/ships/modules';
 * import { HARDPOINT_MODULES } from '@elite-dangerous-almanac/core/ships/modules-hardpoint';
 *
 * getModuleBySymbol('Hpt_PulseLaser_Fixed_Small', HARDPOINT_MODULES)?.name;
 * // -> 'Pulse Laser'
 * ```
 *
 * @packageDocumentation
 */

/**
 * Frontier's outfitting category — which kind of slot a module fits.
 *
 * - `standard` — core internals every hull must fit (armour, power plant,
 *   thrusters, frame shift drive, life support, power distributor, sensors, fuel
 *   tank).
 * - `internal` — optional internals (cargo racks, shield generators, fuel scoops,
 *   passenger cabins, limpet and planetary controllers, …).
 * - `hardpoint` — the weapons and tools mounted on a hardpoint.
 * - `utility` — the small utility-mount fittings (chaff, heat sinks, point defence,
 *   shield boosters, scanners).
 */
export type ModuleCategory = 'standard' | 'internal' | 'hardpoint' | 'utility';

/** How a hardpoint weapon is aimed. Only hardpoint modules carry a mount. */
export type ModuleMount = 'Fixed' | 'Gimballed' | 'Turreted';

/** A missile/torpedo hardpoint's guidance. Only some hardpoints carry one. */
export type ModuleGuidance = 'Dumbfire' | 'Seeker' | 'Swarm';

/** A module's grade letter, best (`A`) to worst; `I` is the armour placeholder. */
export type ModuleRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

/**
 * One fittable outfitting module in Frontier's registry.
 *
 * @remarks
 * A pure registry record — the outfitting registry, not a stats sheet. It tells you
 * what a module *is* (symbol, name, category, size and rating), not its mass,
 * cost or performance.
 */
export interface OutfittingModule {
    /** Internal identifier, e.g. `"Hpt_PulseLaser_Fixed_Small"`. Unique — the module's key. */
    readonly symbol: string;
    /** Which kind of slot the module fits. */
    readonly category: ModuleCategory;
    /**
     * Display name, e.g. `"Pulse Laser"`.
     *
     * @remarks
     * **Not unique** — the game shows most modules at several sizes and ratings, and
     * every hull's armour shares the same five names. Use {@link OutfittingModule.symbol}
     * as the key; {@link getModulesByName} returns every match.
     */
    readonly name: string;
    /**
     * The module size, `0`–`8` — the number in the "5A" the outfitting screen shows.
     *
     * @remarks
     * Frontier calls this the module *class*; it is the slot-size number, not the
     * grade letter (that is {@link OutfittingModule.rating}). Named `class` to match
     * the source registry.
     */
    readonly class: number;
    /** The grade letter, `A`–`I` — the letter in the "5A" the screen shows. */
    readonly rating: ModuleRating;
    /**
     * How the weapon is aimed. Present only on hardpoint weapons that have a mount
     * variant; absent on every other module.
     */
    readonly mount?: ModuleMount;
    /**
     * A missile/torpedo hardpoint's guidance. Present only on the launchers that
     * have one; absent on everything else.
     */
    readonly guidance?: ModuleGuidance;
    /**
     * The hull an armour variant belongs to, e.g. `"Anaconda"`. Present only on the
     * `standard`-category armour modules, which are the one ship-specific module;
     * absent on every generic module.
     */
    readonly ship?: string;
    /**
     * Frontier's DLC / purchase-grant entitlement token, e.g.
     * `"ELITE_HORIZONS_V_PLANETARY_LANDINGS"`. Present only on gated modules.
     */
    readonly entitlement?: string;
}

/**
 * Look up a module by its internal symbol, case-insensitively.
 *
 * @param symbol - The internal identifier, e.g. `"Hpt_PulseLaser_Fixed_Small"`.
 * Leading/trailing whitespace and case are ignored, so the journal's lower-cased
 * form resolves too.
 * @param modules - The catalogue to search — `STANDARD_MODULES`, `INTERNAL_MODULES`,
 * `HARDPOINT_MODULES`, `UTILITY_MODULES`, `ALL_MODULES`, or any subset you have
 * filtered yourself.
 * @returns The matching {@link OutfittingModule}, or `null` if the catalogue holds
 * no module with that symbol.
 * @example
 * ```ts
 * getModuleBySymbol('hpt_pulselaser_fixed_small', HARDPOINT_MODULES)?.class; // -> 1
 * ```
 */
export function getModuleBySymbol(
    symbol: string,
    modules: readonly OutfittingModule[],
): OutfittingModule | null {
    const wanted = symbol.trim().toLowerCase();
    return modules.find((module) => module.symbol.toLowerCase() === wanted) ?? null;
}

/**
 * Every module with a given display name, in catalogue order.
 *
 * @param name - The display name as the registry spells it, e.g. `"Pulse Laser"`.
 * Leading/trailing whitespace and case are ignored, but matching is otherwise exact.
 * @param modules - The catalogue to search (see {@link getModuleBySymbol}).
 * @returns All matching modules — the name is shared across sizes, ratings and (for
 * armour) hulls, so this returns an array. Empty if none match. The input array is
 * not modified.
 * @example
 * ```ts
 * getModulesByName('pulse laser', HARDPOINT_MODULES).length; // -> every size/mount variant
 * ```
 */
export function getModulesByName(
    name: string,
    modules: readonly OutfittingModule[],
): OutfittingModule[] {
    const wanted = name.trim().toLowerCase();
    return modules.filter((module) => module.name.toLowerCase() === wanted);
}

/**
 * Every armour variant fitted to a given ship, in catalogue order.
 *
 * @param ship - The hull's display name as the registry spells it, e.g.
 * `"Anaconda"`. Leading/trailing whitespace and case are ignored, but matching is
 * otherwise exact.
 * @param modules - The catalogue to search (see {@link getModuleBySymbol}). Armour lives
 * in `STANDARD_MODULES` (and therefore `ALL_MODULES`); other catalogues hold no
 * ship-specific modules and return an empty array.
 * @returns The ship's armour modules — the five bulkhead variants — or an empty
 * array if the catalogue holds none for that hull. The input array is not modified.
 * @remarks
 * Armour is the only module tied to a specific hull; every other module fits by slot
 * size, so "modules for a ship" beyond armour is a question of slot layout, which
 * this registry does not carry.
 * @example
 * ```ts
 * getModulesForShip('Anaconda', STANDARD_MODULES).map((m) => m.name);
 * // -> [ 'Lightweight Alloy', 'Reinforced Alloy', 'Military Grade Composite',
 * //      'Mirrored Surface Composite', 'Reactive Surface Composite' ]
 * ```
 */
export function getModulesForShip(
    ship: string,
    modules: readonly OutfittingModule[],
): OutfittingModule[] {
    const wanted = ship.trim().toLowerCase();
    return modules.filter((module) => module.ship?.toLowerCase() === wanted);
}
