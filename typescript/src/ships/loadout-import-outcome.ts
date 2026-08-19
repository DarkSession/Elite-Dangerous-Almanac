/**
 * A change made while normalizing a journal or SLEF loadout against the catalogues.
 *
 * @remarks
 * Import removes an unresolved module from a hardpoint, utility, optional internal or
 * unrecognised slot, and replaces one in a fixed mount — armour, the seven core
 * internals, the cargo hatch — with the hull's stock module. `ShipLoadout.fromLoadout`
 * states the rule in full, including what survives unresolved and produces no outcome.
 *
 * `sourceSymbol` is `null` only for a cargo hatch restored to a source that named none,
 * the one mount import fills unasked. A replacement keeps the source's `On`, `Priority`
 * and `Health`, which describe the mount rather than the article, and none of its
 * engineering or captured value.
 *
 * @example
 * ```ts
 * import { ShipLoadout } from '@elite-dangerous-almanac/core/ships/ship-loadout';
 *
 * const build = ShipLoadout.fromLoadout({
 *   Ship: 'SideWinder',
 *   Modules: [{ Slot: 'SmallHardpoint1', Item: 'FutureWeapon' }],
 * });
 *
 * build.importOutcomes.find((outcome) => outcome.slot === 'SmallHardpoint1')?.action;
 * // -> 'emptied'
 * ```
 */
export type LoadoutImportOutcome =
    | {
          /** The unresolved module was removed because no replacement applies or exists. */
          readonly action: 'emptied';
          /** Exact slot spelling used by the imported build. */
          readonly slot: string;
          /** Unresolved module identity supplied by the source. */
          readonly sourceSymbol: string;
      }
    | {
          /** The hull's stock module was installed in a fixed mount. */
          readonly action: 'defaulted';
          /** Exact slot spelling used by the normalized build. */
          readonly slot: string;
          /** Unresolved source identity, or `null` when the mount was absent. */
          readonly sourceSymbol: string | null;
          /** Stock module identity installed in the mount. */
          readonly replacementSymbol: string;
      };
