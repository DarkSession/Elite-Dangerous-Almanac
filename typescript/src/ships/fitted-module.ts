/**
 * A live fitted-module handle for {@link ShipLoadout}.
 *
 * @packageDocumentation
 */

import {
    availableBlueprintsFor,
    availableExperimentalsFor,
    statFor,
} from './loadout-engineering.js';
import { effectiveModule } from './loadout-metrics.js';
import type { OutfittingModule } from './modules.js';
import type { ApplyBlueprintOptions, AvailableBlueprint, ShipLoadout } from './ship-loadout.js';
import type { LoadoutModule, ModuleEngineering } from './slef.js';

/**
 * A live handle on the module fitted in one slot, as returned by
 * {@link ShipLoadout.getFittedModule} and `LoadoutSlot.module`.
 *
 * Journal fields are available under both camel-case and original journal
 * spellings. The handle remains valid across its own engineering changes; once
 * the slot is emptied or replaced, access throws instead of returning stale data.
 *
 * @example
 * ```ts
 * const fsd = build.getFittedModule('FrameShiftDrive')!;
 * fsd.applyBlueprint('FSD_LongRange', { grade: 5 });
 * fsd.clearEngineering();
 * ```
 */
export class FittedModule {
    readonly #loadout: ShipLoadout;
    readonly #slotKey: string;
    #slotVersion: number;
    readonly #currentSlotVersion: () => number;

    /** @internal Constructed by {@link ShipLoadout}; not part of the public API. */
    constructor(
        loadout: ShipLoadout,
        slotKey: string,
        slotVersion: number,
        currentSlotVersion: () => number,
    ) {
        this.#loadout = loadout;
        this.#slotKey = slotKey;
        this.#slotVersion = slotVersion;
        this.#currentSlotVersion = currentSlotVersion;
    }

    #raw(): LoadoutModule {
        if (this.#slotVersion !== this.#currentSlotVersion()) {
            throw new TypeError(
                `FittedModule: slot "${this.#slotKey}" no longer contains this fitted module`,
            );
        }
        const module = this.#loadout.moduleAt(this.#slotKey);
        if (!module) {
            throw new TypeError(
                `FittedModule: slot "${this.#slotKey}" is now empty (the module was removed)`,
            );
        }
        return module;
    }

    /** The stable journal slot key this module occupies. */
    get slot(): string {
        return this.#slotKey;
    }

    /** Journal-spelling alias of {@link slot}. */
    get Slot(): string {
        return this.#slotKey;
    }

    /** The module's Frontier symbol. */
    get item(): string {
        return this.#raw().Item;
    }

    /** Journal-spelling alias of {@link item}. */
    get Item(): string {
        return this.#raw().Item;
    }

    /** Whether the module is powered on, or `undefined` when unspecified. */
    get on(): boolean | undefined {
        return this.#raw().On;
    }

    /** Journal-spelling alias of {@link on}. */
    get On(): boolean | undefined {
        return this.#raw().On;
    }

    /** Power-priority group, or `undefined` when unspecified. */
    get priority(): number | undefined {
        return this.#raw().Priority;
    }

    /** Journal-spelling alias of {@link priority}. */
    get Priority(): number | undefined {
        return this.#raw().Priority;
    }

    /** Module health in `[0, 1]`, or `undefined` when unspecified. */
    get health(): number | undefined {
        return this.#raw().Health;
    }

    /** Journal-spelling alias of {@link health}. */
    get Health(): number | undefined {
        return this.#raw().Health;
    }

    /** Credit value, or `undefined` when unspecified. */
    get value(): number | undefined {
        return this.#raw().Value;
    }

    /** Journal-spelling alias of {@link value}. */
    get Value(): number | undefined {
        return this.#raw().Value;
    }

    /** Applied engineering, or `undefined` when the module is stock. */
    get engineering(): ModuleEngineering | undefined {
        return this.#raw().Engineering;
    }

    /** Journal-spelling alias of {@link engineering}. */
    get Engineering(): ModuleEngineering | undefined {
        return this.#raw().Engineering;
    }

    /** A detached copy of the underlying journal module record. */
    get raw(): LoadoutModule {
        return this.#raw();
    }

    /** The module's complete base catalogue record, or `null` if unknown. */
    get stats(): OutfittingModule | null {
        return statFor(this.#raw().Item);
    }

    /**
     * The same record with this build's engineering folded in — the module as it
     * actually performs, rather than as it left the shipyard.
     *
     * @returns The post-engineering record, or `null` if the module is not in the
     * catalogues. Identical to {@link stats} on a stock module.
     * @example
     * ```ts
     * const laser = build.getFittedModule('LargeHardpoint1')!;
     * laser.stats?.damage;          // -> as sold
     * laser.effectiveStats?.damage; // -> with the Overcharged blueprint applied
     * ```
     */
    get effectiveStats(): OutfittingModule | null {
        return effectiveModule(this.#raw());
    }

    /**
     * Apply engineering to this module.
     *
     * @param blueprintName - Frontier blueprint `fdname`.
     * @param options - Grade, optional quality in `[0, 1]`, and experimental effect.
     * @returns This handle for chaining.
     */
    applyBlueprint(blueprintName: string, options: ApplyBlueprintOptions): this {
        this.#raw();
        this.#loadout.applyBlueprint(this.#slotKey, blueprintName, options);
        this.#slotVersion = this.#currentSlotVersion();
        return this;
    }

    /** Remove engineering and return this handle for chaining. */
    clearEngineering(): this {
        this.#raw();
        this.#loadout.clearEngineering(this.#slotKey);
        this.#slotVersion = this.#currentSlotVersion();
        return this;
    }

    /**
     * Return compatible blueprints and the grades computable from carried stats.
     *
     * @returns Compatible blueprints in catalogue order.
     */
    getAvailableBlueprints(): AvailableBlueprint[] {
        return availableBlueprintsFor(this.#raw().Item);
    }

    /**
     * Return compatible experimental-effect identifiers.
     *
     * @returns Frontier experimental-effect `fdname`s in catalogue order.
     */
    getAvailableExperimentalEffects(): string[] {
        return availableExperimentalsFor(this.#raw().Item);
    }

    /**
     * Remove this module from its slot, invalidating the handle.
     *
     * @throws {TypeError} For the fixed cargo hatch.
     */
    remove(): void {
        this.#raw();
        this.#loadout.removeModule(this.#slotKey);
    }
}
