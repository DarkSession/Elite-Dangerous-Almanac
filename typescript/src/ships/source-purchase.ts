/**
 * {@link SourcePurchaseRecord} — the credit figures a captured build arrived with,
 * kept verbatim and apart from what the build is worth at retail.
 *
 * A `Loadout` event or SLEF export states what one commander paid at one station:
 * `HullValue`, `ModulesValue`, `Rebuy` and a per-module `Value`. Those figures are
 * **provenance about the capture**, not properties of the fit — they carry station
 * discounts, they can omit a module that was nonetheless bought, and the two producers
 * do not even agree on whether `HullValue` counts the hull's stock fittings. This record
 * preserves them exactly as supplied so an app can show, attribute or re-export them,
 * while every live figure the library computes stays at catalogue retail.
 *
 * @remarks
 * **No single discount is inferred, and none ever will be.** It is tempting to divide
 * the supplied total by the retail total and call the quotient "the station discount":
 * on the Deep Black every priced module sits at 0.8775 of list, and on the Viper Mk IV
 * capture at 0.85, so the quotient looks meaningful. It is not one number. A capture can
 * omit `Value` on a module that was paid for, mix modules bought at different stations
 * with different discounts, and disagree with its own parts — one Viper Mk IV event
 * declares `ModulesValue` 4 940 956 while its per-module figures sum to 3 942 898. A
 * derived percentage would read as a fact about the build and be wrong for most of them,
 * so what a source stated is offered as stated and nothing is computed from it.
 *
 * @example
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * const build = ShipLoadout.fromSlef(slefJson);
 * const paid = build.sourcePurchase;          // -> SourcePurchaseRecord | null
 * paid?.hullValue;                            // -> 189326510  (as captured)
 * paid?.valueForSlot('PowerPlant');           // -> 20692437   (as captured)
 *
 * build.removeModule('Slot05_Size4');         // edit freely…
 * paid === build.sourcePurchase;              // -> true  (…the record is unchanged)
 * ```
 *
 * @packageDocumentation
 */

import { deepFreeze } from '../internal/deep-freeze.js';
import type { LoadoutEvent } from './slef.js';

/** One slot's captured purchase price, exactly as the source stated it. */
export interface SourceModuleValue {
    /** The slot key, in the **source's own spelling** (a SLEF producer may lower-case it). */
    readonly slot: string;
    /** The module symbol the source priced, in the source's own casing. */
    readonly item: string;
    /** What the source says was paid for that module, in credits. */
    readonly value: number;
}

/**
 * The credit figures one capture arrived with — a read-only purchase record, distinct
 * from the retail prices the library computes.
 *
 * Obtained from {@link ShipLoadout.sourcePurchase}, or from a raw event with
 * {@link SourcePurchaseRecord.fromLoadout}. The record is **frozen and never edited**:
 * fitting, removing or engineering a module leaves it exactly as the source wrote it,
 * because it describes the capture rather than the build in hand. That is the opposite
 * of `ShipLoadout.hullValue` / `modulesValue` / `rebuy`, which track the live build and
 * are dropped as soon as an edit invalidates them.
 *
 * Every figure is optional in a capture, so every one can be `null` or absent here. A
 * slot missing from {@link moduleValues} was not priced by the source; that is not the
 * same as free — decorations never carry a price, and a journal also omits `Value` on
 * modules that came with the hull and on some that were genuinely bought.
 */
export class SourcePurchaseRecord {
    /** Hull cost in credits as the source stated it, or `null` if it stated none. */
    readonly hullValue: number | null;
    /** Fitted-modules cost in credits as the source stated it, or `null` if it stated none. */
    readonly modulesValue: number | null;
    /** Insurance rebuy in credits as the source stated it, or `null` if it stated none. */
    readonly rebuy: number | null;
    /**
     * Every slot the source priced, in the order the capture listed them. Slots the
     * source left unpriced are absent rather than present with a zero.
     */
    readonly moduleValues: readonly SourceModuleValue[];
    /**
     * How many modules the capture listed in total, priced or not — the denominator
     * `moduleValues.length` is the numerator of. A capture lists decorations, the
     * cockpit and the cargo hatch alongside outfitting modules, so a partially priced
     * record is the normal case rather than a defect.
     */
    readonly moduleCount: number;

    /** @internal Constructed by {@link SourcePurchaseRecord.fromLoadout}. */
    private constructor(
        hullValue: number | null,
        modulesValue: number | null,
        rebuy: number | null,
        moduleValues: readonly SourceModuleValue[],
        moduleCount: number,
    ) {
        this.hullValue = hullValue;
        this.modulesValue = modulesValue;
        this.rebuy = rebuy;
        this.moduleValues = deepFreeze(moduleValues.map((entry) => ({ ...entry })));
        this.moduleCount = moduleCount;
        Object.freeze(this);
    }

    /**
     * Capture the credit figures of a journal `Loadout` event (or the `data` half of a
     * SLEF entry).
     *
     * @param event - The event to read. Nothing in it is retained by reference.
     * @returns The record, or `null` when the capture states no credit figure at all —
     * no `HullValue`, no `ModulesValue`, no `Rebuy` and no module `Value`. There is then
     * no purchase record to preserve, and a record of four nulls would suggest a source
     * that priced the build at nothing.
     * @remarks
     * A malformed capture that lists one slot key twice keeps the **last** entry, exactly
     * as the build itself does when it loads the same event: a record disagreeing with
     * the build about which module occupies a slot would price the one that is not there.
     * @example
     * ```ts
     * SourcePurchaseRecord.fromLoadout(event)?.rebuy; // -> 19097585
     * ```
     */
    static fromLoadout(event: LoadoutEvent): SourcePurchaseRecord | null {
        // Keyed exactly as `ShipLoadout.fromLoadout` keys its own module map, so the two
        // resolve a repeated slot key to the same entry. A `Map` keeps the first
        // appearance's position while taking the last appearance's value.
        const bySlot = new Map<string, SourceModuleValue>();
        for (const module of event.Modules) {
            if (module.Value === undefined) continue;
            bySlot.set(module.Slot, {
                slot: module.Slot,
                item: module.Item,
                value: module.Value,
            });
        }
        if (
            event.HullValue === undefined &&
            event.ModulesValue === undefined &&
            event.Rebuy === undefined &&
            bySlot.size === 0
        ) {
            return null;
        }
        return new SourcePurchaseRecord(
            event.HullValue ?? null,
            event.ModulesValue ?? null,
            event.Rebuy ?? null,
            [...bySlot.values()],
            event.Modules.length,
        );
    }

    /**
     * The sum of the per-slot figures the source did state, in credits.
     *
     * @returns `0` when the source priced no module individually.
     * @remarks
     * Deliberately **not** a replacement for {@link modulesValue}: the two disagree
     * whenever the capture omitted a `Value` on a module that was paid for. Comparing
     * them is the point — an app that needs the totals to add up can see that they do
     * not, rather than being handed one number that hides it.
     * @example
     * ```ts
     * // Do this capture's parts add up to the total it declares?
     * paid.modulesValue !== null && paid.modulesValue !== paid.pricedModulesValue;
     * // -> true on a capture that priced fewer modules than its total counted
     * ```
     */
    get pricedModulesValue(): number {
        let sum = 0;
        for (const entry of this.moduleValues) sum += entry.value;
        return sum;
    }

    /**
     * What the source paid for the module in one slot.
     *
     * @param slotKey - The slot key, e.g. `"PowerPlant"`. Matched as everywhere else in
     * the library — an exactly spelled key first, then case-insensitively — so a
     * lower-casing producer's capture answers to the journal's spelling and vice versa.
     * @returns The captured price in credits, or `null` when the source priced no module
     * in that slot (or named no such slot). `null` is not `0`: an unpriced slot is one
     * the capture said nothing about, not one that cost nothing.
     * @example
     * ```ts
     * paid.valueForSlot('PowerPlant'); // -> 20692437
     * paid.valueForSlot('frameshiftdrive'); // the same mount, either spelling
     * ```
     */
    valueForSlot(slotKey: string): number | null {
        return this.entryForSlot(slotKey)?.value ?? null;
    }

    /**
     * The whole captured entry for one slot — its price *and* the module symbol that
     * price was paid for.
     *
     * @param slotKey - The slot key. An exactly spelled key wins; failing that, the first
     * key naming the same mount whatever its casing — the rule `ShipLoadout` resolves its
     * own slot keys by, so the record and the build always agree on which entry a key
     * names.
     * @returns The entry, or `null` when the source priced no module in that slot.
     * @remarks
     * The symbol is what makes the record safe to use after an edit: a price captured
     * for the drive that *was* in a slot says nothing about the one there now, and
     * comparing {@link SourceModuleValue.item} against the fitted module is how a caller
     * tells the two apart. {@link ShipLoadout.toLoadoutEvent}'s source-record export does
     * exactly that.
     * @example
     * ```ts
     * const entry = paid.entryForSlot('FrameShiftDrive');
     * entry?.item === build.getFittedModule('FrameShiftDrive')?.symbol.toLowerCase();
     * // -> false once the drive has been swapped: the price is the old drive's
     * ```
     */
    entryForSlot(slotKey: string): SourceModuleValue | null {
        for (const entry of this.moduleValues) {
            if (entry.slot === slotKey) return entry;
        }
        const wanted = slotKey.toLowerCase();
        for (const entry of this.moduleValues) {
            if (entry.slot.toLowerCase() === wanted) return entry;
        }
        return null;
    }
}
