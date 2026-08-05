/**
 * A live fitted-module handle for {@link ShipLoadout}.
 *
 * @packageDocumentation
 */

import { availableBlueprintsFor, availableExperimentalsFor } from './loadout-engineering.js';
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
    readonly #currentStats: () => OutfittingModule | null;

    /** @internal Constructed by {@link ShipLoadout}; not part of the public API. */
    constructor(
        loadout: ShipLoadout,
        slotKey: string,
        slotVersion: number,
        currentSlotVersion: () => number,
        currentStats: () => OutfittingModule | null,
    ) {
        this.#loadout = loadout;
        this.#slotKey = slotKey;
        this.#slotVersion = slotVersion;
        this.#currentSlotVersion = currentSlotVersion;
        this.#currentStats = currentStats;
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

    /**
     * The slot key this module occupies, in the **build's own spelling**.
     *
     * @remarks
     * That is the journal's spelling on a build assembled here or imported from a
     * journal capture, but a SLEF producer may lower-case its keys as the
     * specification's own example does, and an import keeps whatever it wrote. So a
     * handle fetched with `getFittedModule('FrameShiftDrive')` reports
     * `frameshiftdrive` on an Inara build. Every `slotKey` argument in the library
     * accepts either, so the value is always safe to pass back.
     */
    get slot(): string {
        return this.#slotKey;
    }

    /** Journal-field alias of {@link slot}. */
    get Slot(): string {
        return this.#slotKey;
    }

    /**
     * The module's Frontier symbol, e.g. `"Int_Hyperdrive_Size6_Class5"` — the same
     * string {@link getModuleBySymbol} takes and `OutfittingModule.symbol` carries.
     *
     * @remarks
     * The journal calls this field `Item`, and {@link FittedModule.Item} is that
     * spelling; this one is named for what the rest of the library calls it, so a
     * handle and a catalogue record answer to the same word.
     */
    get symbol(): string {
        return this.#raw().Item;
    }

    /** Journal-spelling alias of {@link symbol}. */
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

    /** The snapshotted record fitted into this build, or `null` if unknown. */
    get stats(): OutfittingModule | null {
        this.#raw();
        return this.#currentStats();
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
        return effectiveModule(this.#raw(), this.#currentStats());
    }

    /**
     * Apply engineering to this module.
     *
     * @param blueprintName - Frontier blueprint `fdname`.
     * @param options - Grade, optional quality in `[0, 1]`, and experimental effect.
     * @returns This handle for chaining.
     *
     * @remarks
     * An experimental effect belongs to the blueprint, so re-applying the blueprint
     * already on this module keeps the effect on it and applying a different one drops
     * it — see {@link ApplyBlueprintOptions.experimental}.
     */
    applyBlueprint(blueprintName: string, options: ApplyBlueprintOptions): this {
        this.#raw();
        this.#loadout.applyBlueprint(this.#slotKey, blueprintName, options);
        this.#slotVersion = this.#currentSlotVersion();
        return this;
    }

    /**
     * Apply an experimental (special) effect, keeping the blueprint, grade and quality
     * already on this module.
     *
     * @param effect - The experimental effect's Frontier `fdname`. Replaces any effect
     * already applied — a module carries at most one.
     * @returns This handle for chaining.
     * @throws {RangeError} If this module carries no blueprint. An experimental effect
     * is applied to a blueprint, so engineer the module first.
     * @example
     * ```ts
     * const fsd = build.getFittedModule('FrameShiftDrive')!;
     * fsd.applyBlueprint('FSD_LongRange', { grade: 5 })
     *    .setExperimentalEffect('special_fsd_heavy');
     * ```
     */
    setExperimentalEffect(effect: string): this {
        this.#raw();
        this.#loadout.setExperimentalEffect(this.#slotKey, effect);
        this.#slotVersion = this.#currentSlotVersion();
        return this;
    }

    /**
     * Remove the experimental effect, keeping the blueprint, grade and quality.
     *
     * @returns This handle for chaining. A no-op when no effect is applied.
     */
    clearExperimentalEffect(): this {
        this.#raw();
        this.#loadout.clearExperimentalEffect(this.#slotKey);
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
     * Switch this module on or off.
     *
     * @param on - `true` to power it, `false` to switch it off.
     * @returns This handle for chaining — it stays valid, unlike after
     * {@link applyBlueprint}, because the module record is patched rather than replaced.
     */
    setEnabled(on: boolean): this {
        this.#raw();
        this.#loadout.setModuleEnabled(this.#slotKey, on);
        return this;
    }

    /**
     * Set this module's power-priority group.
     *
     * @param priority - The journal's **zero-based** group, `0`–`4`. The outfitting
     * panel numbers the same five groups `1`–`5`.
     * @returns This handle for chaining.
     * @throws {RangeError} If `priority` is not an integer in `[0, 4]`.
     */
    setPriority(priority: number): this {
        this.#raw();
        this.#loadout.setModulePriority(this.#slotKey, priority);
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
     * Return compatible experimental-effect identifiers **for one blueprint** — the
     * experimental slot belongs to the blueprint, so that is what decides the menu.
     *
     * @param blueprintName - The blueprint to answer for. Defaults to the one already
     * applied to this module; with neither, the answer is the whole family's compatible
     * set, which is the union a menu shows before a blueprint has been picked.
     * @returns Frontier experimental-effect `fdname`s in catalogue order.
     *
     * @remarks
     * The narrowing only applies where the engineering-options catalogue covers the
     * pairing — it groups 428 of the 1198 modules, and for the rest the family answer
     * stands. See `ships/engineering-options`.
     *
     * @example
     * ```ts
     * const fsd = build.getFittedModule('FrameShiftDrive')!;
     * fsd.getAvailableExperimentalEffects('FSD_LongRange'); // before engineering
     * fsd.applyBlueprint('FSD_LongRange', { grade: 5 });
     * fsd.getAvailableExperimentalEffects(); // the applied blueprint's own list
     * ```
     */
    getAvailableExperimentalEffects(blueprintName?: string): string[] {
        const module = this.#raw();
        return availableExperimentalsFor(
            module.Item,
            blueprintName ?? module.Engineering?.BlueprintName,
        );
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
