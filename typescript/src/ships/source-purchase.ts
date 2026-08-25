/**
 * Frozen purchase snapshots and pure queries for credit figures carried by a journal
 * `Loadout` event or SLEF export.
 *
 * A capture preserves figures from one commander's purchase history. They can combine
 * station discounts, omit bought modules, and disagree with their own totals, so they
 * remain separate from the catalogue-retail figures calculated for a live build.
 *
 * @packageDocumentation
 */

import { deepFreeze } from '../internal/deep-freeze.js';
import { normalizeKey } from '../internal/registry-index.js';
import type { LoadoutEvent } from './slef.js';

/** One slot's captured purchase price, exactly as the source stated it. */
export interface SourceModuleValue {
    /** The slot key, in the source's own spelling. */
    readonly slot: string;
    /** The module symbol, in the source's own casing. */
    readonly item: string;
    /** What the source says was paid for that module, in credits. */
    readonly value: number;
}

/**
 * An immutable snapshot of the credit figures carried by one captured loadout.
 *
 * Every top-level figure can be `null`: absence means the source stated no value, not
 * that the hull or modules were free. Likewise, {@link moduleValues} contains only
 * individually priced slots. The snapshot remains unchanged when its owning
 * {@link ShipLoadout} is edited because it describes the source capture, not the live
 * fit.
 *
 * @example
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 * import {
 *     getSourceModuleValue,
 *     sumSourceModuleValues,
 * } from '@elite-dangerous-almanac/core/ships/source-purchase';
 *
 * declare const slefJson: string;
 *
 * const build = ShipLoadout.fromSlef(slefJson);
 * const paid = build.sourcePurchase;
 * if (paid) {
 *     paid.hullValue; // captured hull price, or null
 *     getSourceModuleValue(paid, 'PowerPlant')?.value; // captured slot price
 *     sumSourceModuleValues(paid); // sum of individually priced modules
 * }
 * ```
 */
export interface SourcePurchaseRecord {
    /** Hull cost in credits as the source stated it, or `null` if it stated none. */
    readonly hullValue: number | null;
    /** Fitted-module cost in credits as the source stated it, or `null` if absent. */
    readonly modulesValue: number | null;
    /** Insurance rebuy in credits as the source stated it, or `null` if absent. */
    readonly rebuy: number | null;
    /** Individually priced slots, in capture order; unpriced slots are absent. */
    readonly moduleValues: readonly SourceModuleValue[];
    /** Total modules listed by the capture, including entries with no price. */
    readonly moduleCount: number;
}

/**
 * Capture the purchase figures from a journal `Loadout` event or SLEF data object.
 *
 * @param event - Source event to snapshot. No object in it is retained by reference.
 * @returns A deeply frozen record, or `null` when the source states no credit figure at
 * all.
 * @remarks
 * A malformed event that repeats an exactly spelled slot keeps the last entry.
 * {@link ShipLoadout.fromLoadout} independently rejects duplicate mounts before
 * constructing a usable build.
 *
 * No discount is inferred. One capture can mix purchases from several stations, omit
 * module values, or state a total that differs from its priced parts. The snapshot keeps
 * those facts visible instead of inventing one misleading percentage.
 * @example
 * ```ts
 * import type { LoadoutEvent } from '@elite-dangerous-almanac/core/ships/slef';
 * import { sourcePurchaseFromLoadout } from '@elite-dangerous-almanac/core/ships/source-purchase';
 *
 * declare const event: LoadoutEvent;
 * const paid = sourcePurchaseFromLoadout(event);
 * paid?.rebuy; // captured rebuy, or null
 * ```
 */
export function sourcePurchaseFromLoadout(event: LoadoutEvent): SourcePurchaseRecord | null {
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
    return deepFreeze({
        hullValue: event.HullValue ?? null,
        modulesValue: event.ModulesValue ?? null,
        rebuy: event.Rebuy ?? null,
        moduleValues: [...bySlot.values()],
        moduleCount: event.Modules.length,
    });
}

/**
 * Find the captured purchase entry for one slot.
 *
 * @param record - Purchase snapshot to query.
 * @param slotKey - Slot key such as `"PowerPlant"`. An exact spelling wins; otherwise
 * matching folds case and ignores surrounding whitespace, as every identifier lookup in
 * the library does, so journal and lower-cased SLEF keys interoperate.
 * @returns The frozen entry, or `null` when the source priced no module in that slot.
 * `null` never means the module was free.
 * @throws {TypeError} If `slotKey` is present and not a string. A nullish `slotKey` is a
 * miss, answered the way a slot the source did not price is.
 * @example
 * ```ts
 * import {
 *     getSourceModuleValue,
 *     type SourcePurchaseRecord,
 * } from '@elite-dangerous-almanac/core/ships/source-purchase';
 *
 * declare const paid: SourcePurchaseRecord;
 * getSourceModuleValue(paid, 'FrameShiftDrive')?.value; // captured credits
 * ```
 */
export function getSourceModuleValue(
    record: SourcePurchaseRecord,
    slotKey: string,
): SourceModuleValue | null {
    // Normalizing first is also the type guard, so a wrong-typed key fails before it is
    // compared against anything. A nullish one normalizes to `undefined`, which no
    // entry's key can equal, and so stays a miss.
    const wanted = normalizeKey(slotKey, 'getSourceModuleValue: slotKey');
    for (const entry of record.moduleValues) {
        if (entry.slot === slotKey) return entry;
    }
    for (const entry of record.moduleValues) {
        if (entry.slot.trim().toLowerCase() === wanted) return entry;
    }
    return null;
}

/**
 * Sum every per-slot price that the source stated.
 *
 * @param record - Purchase snapshot whose individually priced entries to add.
 * @returns The stated total in credits, or `0` when no module was individually priced.
 * @remarks
 * This is deliberately not a replacement for {@link SourcePurchaseRecord.modulesValue}.
 * A capture may omit individual prices or publish an inconsistent total; comparing the
 * two is useful precisely because this function does not hide that discrepancy.
 * @example
 * ```ts
 * import {
 *     sumSourceModuleValues,
 *     type SourcePurchaseRecord,
 * } from '@elite-dangerous-almanac/core/ships/source-purchase';
 *
 * declare const paid: SourcePurchaseRecord;
 * const partsAgree = paid.modulesValue === sumSourceModuleValues(paid);
 * ```
 */
export function sumSourceModuleValues(record: SourcePurchaseRecord): number {
    let sum = 0;
    for (const entry of record.moduleValues) sum += entry.value;
    return sum;
}
