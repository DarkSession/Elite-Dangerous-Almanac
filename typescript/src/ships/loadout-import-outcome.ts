/**
 * A change made while normalizing a journal or SLEF loadout against the catalogues.
 *
 * @remarks
 * Import removes an unresolved module from a hardpoint, utility, optional internal, or
 * unrecognized slot. Armour, the seven core internals, and the cargo hatch are fixed
 * mounts, so import installs the hull's stock module there instead when one is known.
 * It also fills an absent fixed mount from the same defaults. Without a default, an
 * unresolved fixed module is emptied and a required mount remains incomplete.
 *
 * `sourceSymbol` is `null` only when the source contained no module for that mount.
 * A defaulted module is a fresh stock identity: it inherits no engineering, power
 * state, priority, health, or captured value from an unresolved source module.
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
